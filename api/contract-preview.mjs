// api/contract-preview.mjs
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { CompanySchema } from "../src/contracts/schemas.js";
import { companyClause } from "../src/contracts/format.js";

/* -------------------------- Helpers nom de fichier ------------------------- */
const stripDiacritics = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const safeAscii = (s = "") => stripDiacritics(s).replace(/[^a-zA-Z0-9 _.\-]+/g, "").replace(/\s+/g, " ").trim();

const makePdfFilename = ({ body, company }) => {
  const full = (body?.company?.representatives?.[0]?.fullName || "").trim().replace(/\s+/g, " ");
  let displayName = full;

  // "Prénom Nom" → "Nom Prénom"
  if (full) {
    const parts = full.split(" ");
    if (parts.length >= 2) {
      const prenom = parts[0];
      const nom = parts.slice(1).join(" ");
      displayName = `${nom} ${prenom}`;
    }
  }

  if (!displayName) displayName = company?.legalName || "Document";
  const base = `${displayName} - Clause de confidentialité`;
  return {
    utf8: `${base}.pdf`,
    ascii: `${safeAscii(base) || "Clause de confidentialite"}.pdf`,
  };
};

/* ------------------------------ Body parsing ------------------------------- */
async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

/* --------------------------------- Images --------------------------------- */
function drawCenteredImage(doc, absPath, { y, width, height } = {}) {
  try {
    if (!absPath || !fs.existsSync(absPath)) return null;
    const availW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const topY   = y ?? doc.page.margins.top;
    let w = width  ?? Math.min(160, availW);
    let h = height ?? 60;
    const x = doc.page.margins.left + (availW - w) / 2;
    const opts = (width && height) ? { fit: [w, h] } : (width ? { width: w } : { height: h });
    doc.image(absPath, x, topY, opts);
    return topY + (opts.fit ? opts.fit[1] : (h || 0));
  } catch { return null; }
}
function drawLeftImage(doc, absPath, { y, width, height } = {}) {
  try {
    if (!absPath || !fs.existsSync(absPath)) return null;
    const topY  = y ?? doc.y;
    const xLeft = doc.page.margins.left;
    const opts  = (width && height) ? { fit: [width, height] } : (width ? { width } : { height });
    doc.image(absPath, xLeft, topY, opts);
    return topY + (opts.fit ? opts.fit[1] : (opts.height ?? 0));
  } catch { return null; }
}

/* ------------------------- Webhook fiable (Option 1) ----------------------- */
const WEBHOOK_TIMEOUT_MS = 4500;
const WEBHOOK_RETRIES    = 2;
const WEBHOOK_BACKOFF_MS = 800;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

async function sendToWebhookReliable(payload, {
  timeoutMs = WEBHOOK_TIMEOUT_MS,
  retries   = WEBHOOK_RETRIES,
  backoffMs = WEBHOOK_BACKOFF_MS,
} = {}) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return false;

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, timeoutMs);
      if (res.ok) return true;
      console.warn(`Webhook HTTP ${res.status} (attempt ${attempt + 1}/${retries + 1})`);
    } catch (err) {
      console.warn(`Webhook error (attempt ${attempt + 1}/${retries + 1}):`, err?.message || err);
    }
    attempt++;
    if (attempt <= retries) await sleep(backoffMs * Math.pow(2, attempt - 1));
  }
  return false;
}

/* --------------------------------- Handler -------------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = await readJson(req);
    const incoming = body?.company ?? {};

    const typeEntreprise =
      body?.meta?.typeEntreprise ??
      body?.company?.businessType ??
      "Générale";

    // --- Detect EI from payload (either client sends "EI", or legacy "Autre" + empty rcsCity)
    const isEI =
      String(incoming.legalForm || "").toUpperCase() === "EI" ||
      (String(incoming.legalForm || "").toUpperCase() === "AUTRE" && !incoming.rcsCity);

    // --- Build a version ONLY for schema validation (schema doesn't know EI and requires rcsCity)
    const forSchema = {
      ...incoming,
      legalForm: isEI ? "Autre" : incoming.legalForm,     // map EI → Autre so the schema accepts it
      rcsCity: isEI ? (incoming.rcsCity || "Lille") : incoming.rcsCity, // dummy city to satisfy required field
    };

    const parsed = CompanySchema.safeParse(forSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }

    // --- Build the *actual* company object we want to use (and show) in the clause/PDF
    const coyParsedSchemaOK = parsed.data;
    const companyForOutput = isEI
      ? { ...coyParsedSchemaOK, legalForm: "EI", rcsCity: "" }   // blank RCS city for EI
      : coyParsedSchemaOK;

    // Infos extra pour Sheet (email/tél même si hors schéma) — keep the original values
    const coyForSheet = {
      ...companyForOutput,
      email: incoming?.email || "",
      phone: incoming?.phone || "",
      businessType: typeEntreprise,
      representatives: Array.isArray(incoming?.representatives)
        ? incoming.representatives
        : (companyForOutput.representatives || []),
    };

    // --- Clause text
    let clause = companyClause({ company: companyForOutput });
    if (isEI) {
      // Some formatters leave "au RCS de ,". Clean it.
      clause = clause.replace(/\s*au RCS de\s*,\s*/i, " ");
    }

    // --- Envoi webhook FIABLE
    const webhookOk = await sendToWebhookReliable({
      company: coyForSheet,
      clause,
      meta: {
        clientProspect: "Audit Prévu",
        typeEntreprise,
        generatedAt: new Date().toISOString(),
      },
    });
    res.setHeader("X-Webhook-Status", webhookOk ? "ok" : "failed");

    // --- PDF ---
    const buffers = [];
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    doc.on("data", (ch) => buffers.push(ch));

    // Polices : Arial si dispo, sinon Helvetica
    let bodyFont = "Helvetica", boldFont = "Helvetica-Bold", italicFont = "Helvetica-Oblique";
    try {
      const regularPath = path.join(process.cwd(), "public", "fonts", "Arial.ttf");
      const boldPath    = path.join(process.cwd(), "public", "fonts", "Arial-Bold.ttf");
      const italicPath  = path.join(process.cwd(), "public", "fonts", "Arial-Italic.ttf");
      if (fs.existsSync(regularPath)) { doc.registerFont("ArialRegular", regularPath); bodyFont = "ArialRegular"; }
      if (fs.existsSync(boldPath))    { doc.registerFont("ArialBold",    boldPath);    boldFont = "ArialBold";    }
      if (fs.existsSync(italicPath))  { doc.registerFont("ArialItalic",  italicPath);  italicFont = "ArialItalic"; }
    } catch {}

    const H1 = 16, H2 = 13, P = 12;
    const writeH2 = (t) => { doc.font(boldFont).fontSize(H2).text(t, { align: "left" }); };
    const para    = (t, opts={}) => { doc.font(bodyFont).fontSize(P).text(t, { align: "justify", lineGap: 2, ...opts }); };

    const SPACE_AFTER_LOGO          = 32;
    const SPACE_BEFORE_ENTRE        = 100;
    const SPACE_AFTER_ENTRE_HEADING = 25;
    const SPACE_AFTER_CLAUSE        = 24;

    const BLOC_GAP_BEFORE_CLIENT_ALIAS = 10;
    const BLOC_GAP_AFTER_CLIENT_ALIAS  = 30;
    const BLOC_GAP_AFTER_ET            = 10;
    const BLOC_GAP_AFTER_OWNER_NAME    = 6;
    const BLOC_GAP_BEFORE_OWNER_ALIAS  = 18;

    const GAP_BEFORE_PREAMBULE_TITLE   = 70;
    const GAP_AFTER_PREAMBULE_TITLE    = 8;
    const GAP_AFTER_PREAMBULE_TEXT     = 70;
    const GAP_BEFORE_ART1_TITLE        = 8;
    const GAP_AFTER_ART1_TITLE         = 8;

    const GAP_BEFORE_ART2_TITLE        = 16;
    const GAP_AFTER_ART2_TITLE         = 8;
    const GAP_AFTER_ART2_LIST          = 16;

    const GAP_BEFORE_ART3_TITLE        = 8;
    const GAP_AFTER_ART3_TITLE         = 8;

    const GAP_BEFORE_ART4_TITLE        = 8;
    const GAP_AFTER_ART4_TITLE         = 8;

    const GAP_BEFORE_ART5_TITLE        = 8;
    const GAP_AFTER_ART5_TITLE         = 8;

    const GAP_BEFORE_ART6_TITLE        = 8;
    const GAP_AFTER_ART6_TITLE         = 8;

    const GAP_BEFORE_PLACE_DATE        = 12;
    const GAP_AFTER_PLACE_DATE         = 10;
    const GAP_AFTER_SIGNATURE_HEADING  = 6;
    const GAP_AFTER_SIGN_NAME          = 4;

    const SIGN_IMAGE_PATH              = path.join(process.cwd(), "public", "signature-owner.png");
    const GAP_BEFORE_SIGNATURE_IMAGE   = 8;
    const SIGN_IMAGE_WIDTH             = 100;
    const SIGN_IMAGE_HEIGHT            = null;

    // ---- Contenu PDF
    const logoPath = path.join(process.cwd(), "public", "contract-logo.png");
    const bottomOfLogoY = drawCenteredImage(doc, logoPath, { y: 30, width: 180 });
    if (bottomOfLogoY) doc.y = bottomOfLogoY + SPACE_AFTER_LOGO;

    doc.font(boldFont).fontSize(H1).text("Engagement unilatéral", { align: "center" });
    doc.moveDown(0.2);
    doc.font(boldFont).fontSize(H1).text("Accord de confidentialité et d'audit gratuit", { align: "center" });

    doc.y += SPACE_BEFORE_ENTRE;
    writeH2("Entre :");
    doc.y += SPACE_AFTER_ENTRE_HEADING;
    para(clause);
    doc.y += SPACE_AFTER_CLAUSE;

    doc.y += BLOC_GAP_BEFORE_CLIENT_ALIAS;
    doc.font(italicFont).fontSize(P).text('Ci-après dénommée “Le client”', { align: "left", lineBreak: true });

    doc.y += BLOC_GAP_AFTER_CLIENT_ALIAS;
    doc.font(boldFont).fontSize(H2).text("Et", { align: "left" });

    doc.y += BLOC_GAP_AFTER_ET;
    doc.font(bodyFont).fontSize(H2).text("OWNER TECHNOLOGY - FZCO", { align: "left" });

    doc.y += BLOC_GAP_AFTER_OWNER_NAME;
    doc.font(bodyFont).fontSize(P).text(
      "Freezone Company dont le siège social est situé Building A1, IFZA, Silicon Oasis (UAE)\n" +
      "immatriculée au sein de Silicon Oasis représentée par Paul Faucomprez, en qualité de\n" +
      "Director General Manager",
      { align: "left" }
    );

    doc.y += BLOC_GAP_BEFORE_OWNER_ALIAS;
    doc.font(italicFont).fontSize(P).text('Ci-après dénommée “Owner”', { align: "left", lineBreak: true });

    // Préambule + Articles
    doc.y += GAP_BEFORE_PREAMBULE_TITLE;
    doc.font(boldFont).fontSize(H1).text("Préambule", { align: "center" });

    doc.y += GAP_AFTER_PREAMBULE_TITLE;
    para(
      "Owner, spécialisée dans l’optimisation sociale et fiscale pour les TPE/PME, propose un " +
      "service d’audit gratuit permettant d’identifier des opportunités d’optimisation. Dans ce cadre, " +
      "des documents et informations confidentiels sont susceptibles d’être transmis à Owner. Ce " +
      "document formalise l’engagement unilatéral de Owner à protéger ces données."
    );

    doc.y += GAP_AFTER_PREAMBULE_TEXT;
    writeH2("Article 1 : Objet de l’engagement");

    doc.y += GAP_AFTER_ART1_TITLE;
    para(
      "Owner s’engage à assurer la confidentialité des documents et informations transmis dans le " +
      "cadre de la réalisation de l’audit, ainsi qu’à respecter les principes énoncés dans le présent " +
      "document."
    );

    doc.y += GAP_BEFORE_ART2_TITLE;
    writeH2("Article 2 : Confidentialité des données");

    doc.y += GAP_AFTER_ART2_TITLE;
    para("Owner s’engage à :");

    doc.font(bodyFont).fontSize(P).text(
      "1. Ne pas divulguer, directement ou indirectement, les documents ou informations transmis, " +
      "sauf accord écrit préalable de la partie concernée ou si leur divulgation est exigée par la loi " +
      "ou une autorité compétente.\n" +
      "2. Utiliser les données exclusivement aux fins de réalisation de l’audit et dans le respect des " +
      "réglementations en vigueur, notamment le Règlement (UE) 2016/679 (RGPD).\n" +
      "3. Prendre toutes les mesures nécessaires pour garantir la sécurité des informations, en évitant " +
      "tout accès non autorisé.",
      { align: "justify", indent: 12, lineGap: 2 }
    );

    doc.y += GAP_AFTER_ART2_LIST;

    doc.y += GAP_BEFORE_ART3_TITLE;
    writeH2("Article 3 : Durée de conservation des données");

    doc.y += GAP_AFTER_ART3_TITLE;
    para(
      "Owner s’engage à détruire toutes copies des documents et informations transmis dans un " +
      "délai de 15 jours suivant la réalisation de l’audit."
    );

    doc.y += GAP_BEFORE_ART4_TITLE;
    writeH2("Article 4 : Non-utilisation à d’autres fins");

    doc.y += GAP_AFTER_ART4_TITLE;
    para(
      "Owner garantit que les documents et informations transmis ne seront pas utilisés à des fins " +
      "autres que celles strictement nécessaires à la réalisation de l’audit."
    );

    doc.y += GAP_BEFORE_ART5_TITLE;
    writeH2("Article 5 : Responsabilité");

    doc.y += GAP_AFTER_ART5_TITLE;
    para(
      "En cas de non-respect des engagements prévus au présent document, Owner reconnaît sa " +
      "responsabilité et s’engage à prendre les mesures nécessaires pour remédier à la situation et " +
      "limiter les conséquences pour les parties concernées."
    );

    doc.y += GAP_BEFORE_ART6_TITLE;
    writeH2("Article 6 : Droit applicable");

    doc.y += GAP_AFTER_ART6_TITLE;
    para(
      "Le présent engagement est régi par le droit français. Tout litige relatif à son interprétation ou " +
      "à son exécution sera soumis aux juridictions compétentes."
    );

    // Signature
    const genDate  = new Date().toLocaleDateString("fr-FR");

    doc.y += GAP_BEFORE_PLACE_DATE;
    doc.font(bodyFont).fontSize(P).text(`Fait à Silicon Oasis (UAE), le ${genDate}.`, { align: "left" });

    doc.y += GAP_AFTER_PLACE_DATE;
    doc.font(boldFont).fontSize(H2).text("Pour Owner", { align: "left" });

    doc.y += GAP_AFTER_SIGNATURE_HEADING;
    doc.font(bodyFont).fontSize(P).text("Monsieur Paul FAUCOMPREZ", { align: "left" });

    doc.y += GAP_AFTER_SIGN_NAME;
    doc.font(bodyFont).fontSize(P).text("En sa qualité de Président", { align: "left" });

    doc.y += GAP_BEFORE_SIGNATURE_IMAGE;
    drawLeftImage(doc, SIGN_IMAGE_PATH, { y: doc.y, width: SIGN_IMAGE_WIDTH, height: SIGN_IMAGE_HEIGHT });

    // Envoi du PDF
    const filename = makePdfFilename({ body, company: companyForOutput });
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename.ascii}"; filename*=UTF-8''${encodeURIComponent(filename.utf8)}`
      );
      res.status(200).send(pdfBuffer);
    });

    doc.end();
  } catch (e) {
    console.error(e);
    return res.status(500).send("Internal Server Error");
  }
}
