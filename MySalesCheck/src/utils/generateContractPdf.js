// src/utils/generateContractPdf.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generateContractPdf({ nom, adresse, siren, tel, montant }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);          // A4 portrait
  const { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;

  const draw = (text, y) =>
    page.drawText(text, { x: 50, y, size: fontSize, font, color: rgb(0,0,0) });

  let y = height - 80;
  draw("CONTRAT DE PRESTATION", y); y -= 40;

  draw(`Client : ${nom}`, y);        y -= 20;
  draw(`Adresse : ${adresse}`, y);   y -= 20;
  draw(`SIREN : ${siren}`, y);       y -= 20;
  draw(`Téléphone : ${tel}`, y);     y -= 20;
  draw(`Montant mensuel : ${montant} €`, y); y -= 40;

  draw("Fait le : " + new Date().toLocaleDateString("fr-FR"), y);

  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}
