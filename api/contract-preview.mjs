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

// ---- util: image centrée
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
    return topY + h;
  } catch {
    return null;
  }
}

// ---- util: envoi non-bloquant vers n8n
async function sendToWebhook(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
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

    const coyParsed = parsed.data;

    // infos extra pour Google Sheet (email/téléphone même si hors schéma)
    const coyForSheet = {
      ...coyParsed,
      email: body.company?.email || "",
      phone: body.company?.phone || "",
      representatives: Array.isArray(body.company?.representatives)
        ? body.company.representatives
        : (coyParsed.representatives || []),
    };

    const clause = companyClause({ company: coyParsed });

    // Webhook n8n (fire-and-forget)
    sendToWebhook({
      company: coyForSheet,
      clause,
      meta: {
        clientProspect: "Contrat envoyé",
        typeEntreprise: "Général",
        generatedAt: new Date().toISOString(),
      },
    });

    // --- PDF ---
    const buffers = [];
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    doc.on("data", (ch) => buffers.push(ch));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="contract-draft.pdf"');
      res.status(200).send(pdfBuffer);
    });

    // ===== POLICES: Arial si dispo, sinon Helvetica =====
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

    // ----------------------------------------------------
    // TES RÉGLAGES D’ESPACEMENT (inchangés) + nouveaux
    // ----------------------------------------------------
    const SPACE_AFTER_LOGO          = 32;
    const SPACE_BEFORE_ENTRE        = 100;
    const SPACE_AFTER_ENTRE_HEADING = 25;
    const SPACE_AFTER_CLAUSE        = 24;

    // bloc “client/owner” (tes valeurs)
    const BLOC_GAP_BEFORE_CLIENT_ALIAS = 10;
    const BLOC_GAP_AFTER_CLIENT_ALIAS  = 30;
    const BLOC_GAP_AFTER_ET            = 10;
    const BLOC_GAP_AFTER_OWNER_NAME    = 6;
    const BLOC_GAP_BEFORE_OWNER_ALIAS  = 18;

    // préambule / article 1 (tu peux jouer avec)
    const GAP_BEFORE_PREAMBULE_TITLE   = 70;
    const GAP_AFTER_PREAMBULE_TITLE    = 8;
    const GAP_AFTER_PREAMBULE_TEXT     = 70;
    const GAP_BEFORE_ART1_TITLE        = 8;
    const GAP_AFTER_ART1_TITLE         = 8;
    // ----------------------------------------------------

    // -------- Page 1 --------
    const logoPath = path.join(process.cwd(), "public", "contract-logo.png");
    const bottomOfLogoY = drawCenteredImage(doc, logoPath, { y: 30, width: 180 });
    if (bottomOfLogoY) doc.y = bottomOfLogoY + SPACE_AFTER_LOGO;

    // titres
    doc.font(boldFont).fontSize(H1).text("Engagement unilatéral", { align: "center" });
    doc.moveDown(0.2);
    doc.font(boldFont).fontSize(H1).text("Accord de confidentialité et d'audit gratuit", { align: "center" });

    // “Entre :” + clause société
    doc.y += SPACE_BEFORE_ENTRE;
    writeH2("Entre :");
    doc.y += SPACE_AFTER_ENTRE_HEADING;
    para(clause);
    doc.y += SPACE_AFTER_CLAUSE;

    // ------ bloc client/owner ------
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
    // ------ fin bloc client/owner ------

    // ------ PRÉAMBULE + ARTICLE 1 (ajout) ------
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
    // ------ fin PRÉAMBULE + ARTICLE 1 ------

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
