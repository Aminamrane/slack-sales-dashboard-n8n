import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Sert les fonctions serveur additives (api/**\/*.mjs) pendant `npm run dev`.
 *
 * En production c'est Vercel qui route api/**\/*.mjs vers /api/** ; en
 * développement, Vite ne le fait pas — pire, il renvoie le SOURCE du fichier
 * transformé en module navigateur avec un HTTP 200, ce qui ressemble à un
 * succès et casse au premier res.json(). Ce plugin monte donc le vrai
 * handler pour chaque route de ROUTES, pour que le local se comporte comme
 * la production.
 *
 * `apply: 'serve'` : le plugin n'existe qu'en développement et ne touche pas
 * à `vite build`.
 */
function localApiDev() {
  const ROUTES = {
    '/api/meta-ads/read': 'api/meta-ads/read.mjs',
    '/api/meta-ads/sync': 'api/meta-ads/sync.mjs',
  }
  const cache = new Map()

  // Import re-daté sur la mtime : éditer le handler est pris en compte sans
  // relancer le serveur (un import() nu resterait bloqué sur le cache ESM).
  async function loadHandler(absPath) {
    const { mtimeMs } = fs.statSync(absPath)
    const hit = cache.get(absPath)
    if (hit && hit.mtimeMs === mtimeMs) return hit.mod
    const mod = await import(`${pathToFileURL(absPath).href}?v=${mtimeMs}`)
    cache.set(absPath, { mtimeMs, mod })
    return mod
  }

  const mount = (server) => {
    for (const [url, file] of Object.entries(ROUTES)) {
      const absPath = path.join(rootDir, file)
      server.middlewares.use(url, async (req, res) => {
        try {
          const mod = await loadHandler(absPath)
          await mod.default(req, res)
        } catch (err) {
          server.config.logger.error(`[api-dev] ${url} → ${err?.stack || err}`)
          if (res.headersSent) return res.destroy()
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })
    }
  }

  return {
    name: 'local-api-dev',
    apply: 'serve',
    configureServer: mount,
    configurePreviewServer: mount, // pour que `npm run preview` marche aussi
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Le 3e argument (préfixe vide) est indispensable : sans lui, loadEnv ne
  // charge que les VITE_* et META_ADS_DB_URL resterait introuvable côté
  // fonctions serveur. Rien ne fuit pour autant dans le bundle : Vite
  // n'inline que import.meta.env.VITE_*.
  const env = loadEnv(mode, rootDir, '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }
  return {
    plugins: [react(), localApiDev()],
  }
})
