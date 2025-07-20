// src/utils/generateContractPdf.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generateContractPdf({ nom, adresse, siren, tel, montant }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);          // A4 portrait
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  let y = height - 80;

  // titre centré
  const title = "CONTRAT DE PRESTATION";
  const titleWidth = font.widthOfTextAtSize(title, 14);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y,
    size: 14,
    font,
    color: rgb(0, 0, 0)
  });
  y -= 40;

  const draw = text => {
    page.drawText(text, { x: 50, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= fontSize * 1.6;
  };

  draw(`Client : ${nom}`);
  draw(`Adresse : ${adresse}`);
  draw(`SIREN : ${siren}`);
  draw(`Téléphone : ${tel}`);
  draw(`Montant mensuel : ${montant} €`);
  y -= 20;
  draw(`Fait le : ${new Date().toLocaleDateString("fr-FR")}`);

  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}
