// api/contract-preview.mjs
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { CompanySchema } from "../src/contracts/schemas.js";
import { companyClause } from "../src/contracts/format.js";

// ---- util: parse JSON body (Vercel dev/serverless)
async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

// ---- util: image centrée (contrôle y / width / height)
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
    return topY + h; // approx bas de l'image
  } catch {
    return null;
  }
}

// ---- util: envoi non-bloquant vers n8n
console.log("N8N configured:", !!process.env.N8N_WEBHOOK_URL);
async function sendToWebhook(payload) {
  const url = process.env.N8N_WEBHOOK_URL; // ex: https://ton-n8n.tld/webhook/contract-log
  if (!url) return;
  // on n'attend pas (fire-and-forget) → pas d'impact sur le PDF
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("n8n webhook error:", err));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body   = await readJson(req);
    const parsed = CompanySchema.safeParse(body.company);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

    // Données validées pour la clause
    const coyParsed = parsed.data;

    // Conserver email/phone même si non définis dans le schéma
    const coyForSheet = {
      ...coyParsed,
      email: body.company?.email || "",
      phone: body.company?.phone || "",
      representatives: Array.isArray(body.company?.representatives)
        ? body.company.representatives
        : (coyParsed.representatives || []),
    };

    const clause = companyClause({ company: coyParsed });

    // --- Envoi non-bloquant vers n8n (pour Google Sheets) ---
    // Par défaut: "Contrat envoyé" et "Général" (tu peux changer)
    sendToWebhook({
      company: coyForSheet,
      clause, // colonne "Informations"
      meta: {
        clientProspect: "Contrat envoyé",
        typeEntreprise: "Général",
        generatedAt: new Date().toISOString(),
      },
    });

    // --- PDF ---
    const buffers = [];
    const doc = new PDFDocument({ size: "A4", margin: 56 }); // ≈ 2 cm
    doc.on("data", (ch) => buffers.push(ch));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="contract-draft.pdf"');
      res.status(200).send(pdfBuffer);
    });

    // ===== POLICES: Arial si dispo, sinon Helvetica =====
    let bodyFont = "Helvetica", boldFont = "Helvetica-Bold";
    try {
      const regularPath = path.join(process.cwd(), "public", "fonts", "Arial.ttf");
      const boldPath    = path.join(process.cwd(), "public", "fonts", "Arial-Bold.ttf");
      if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
        doc.registerFont("ArialRegular", regularPath);
        doc.registerFont("ArialBold",    boldPath);
        bodyFont = "ArialRegular";
        boldFont = "ArialBold";
      }
    } catch { /* fallback Helvetica */ }

    const H1 = 16, H2 = 13, P = 12;
    const writeH2 = (t) => { doc.font(boldFont).fontSize(H2).text(t, { align: "left" }); };
    const para    = (t, opts={}) => { doc.font(bodyFont).fontSize(P).text(t, { align: "justify", lineGap: 2, ...opts }); };

    // -------- Page 1 --------
    const logoPath = path.join(process.cwd(), "public", "contract-logo.png");
    const bottomOfLogoY = drawCenteredImage(doc, logoPath, { y: 30, width: 180 });

    const SPACE_AFTER_LOGO = 32;
    if (bottomOfLogoY) doc.y = bottomOfLogoY + SPACE_AFTER_LOGO;

    doc.font(boldFont).fontSize(H1).text("Engagement unilatéral", { align: "center" });
    doc.moveDown(0.2);
    doc.font(boldFont).fontSize(H1).text("Accord de confidentialité et d'audit gratuit", { align: "center" });

    const SPACE_BEFORE_ENTRE        = 100;
    const SPACE_AFTER_ENTRE_HEADING = 25;
    const SPACE_AFTER_CLAUSE        = 24;

    doc.y += SPACE_BEFORE_ENTRE;
    writeH2("Entre :");
    doc.y += SPACE_AFTER_ENTRE_HEADING;
    para(clause);
    doc.y += SPACE_AFTER_CLAUSE;

    // -------- Page 2 : date en bas --------
    doc.addPage();
    const genDate  = new Date().toLocaleDateString("fr-FR");
    const pageW    = doc.page.width;
    const leftM    = doc.page.margins.left;
    const rightM   = doc.page.margins.right;
    const bottomY  = doc.page.height - doc.page.margins.bottom - P - 2;

    doc.font(bodyFont).fontSize(P);
    doc.text(genDate, leftM, bottomY, {
      width: pageW - leftM - rightM,
      align: "center",
      lineBreak: false,
    });

    doc.end();
  } catch (e) {
    console.error(e);
    return res.status(500).send("Internal Server Error");
  }
}
