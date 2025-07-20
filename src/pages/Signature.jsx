// src/pages/Signature.jsx
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min?url"; 
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

import SignaturePad from "react-signature-canvas";
import { PDFDocument, rgb } from "pdf-lib";
import { generateContractPdf } from "../utils/generateContractPdf";
import { sendSignedContractEmail } from "./sendEmail.js";
import "./Signature.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function Signature() {
  const { id } = useParams();

  // États principaux
  const [contract, setContract] = useState(null);
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [blobData, setBlobData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [numPages, setNumPages] = useState(0);

  // Wizard
  const [step,            setStep]           = useState("preview"); 
  const padRef                                  = useRef(null);
  const [sigURL,          setSigURL]         = useState(null);
  const [sigPos,          setSigPos]         = useState({ x:0, y:0, w:120, h:60 });

  // Slider
  const [sliderValue,     setSliderValue]    = useState(0);
  const [sliderCompleted, setSliderCompleted]= useState(false);

  // Quand on lâche le thumb du slider
  const handleSliderChange = (e) => {
  const value = Number(e.target.value);
  setSliderValue(value);

  if (value >= 100 && !sliderCompleted) {
    setSliderCompleted(true);
    const dataURL = padRef.current.getCanvas().toDataURL();
    console.log("✅ Signature capturée :", dataURL);
    setSigURL(dataURL);
    setTimeout(() => {
      setStep("place");
    }, 300);
  }
}; 


  // 1) Fetch contrat + générer PDF
useEffect(() => {
  let objectUrl;
  (async () => {
    try {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", id)
        .maybeSingle(); // ✅ évite l'erreur si aucune ou plusieurs lignes
      
      if (error) throw error;
      if (!data) throw new Error("Contrat introuvable avec cet ID");

      setContract(data);

      const blob = await generateContractPdf(data);
      objectUrl = URL.createObjectURL(blob);
      setBlobUrl(objectUrl);
      setBlobData(blob);
    } catch (err) {
      console.error(err);
      alert(err.message || "Erreur lors du chargement du contrat.");
    } finally {
      setLoading(false);
    }
  })();

  return () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  };
}, [id]);


  if (loading)   return <p>Chargement…</p>;
  if (!contract) return <p>Contrat non trouvé.</p>;

  function onDocumentLoad({ numPages }) {
    setNumPages(numPages);
  }

  // ── STEP 1: Prévisualisation ─────────────────────────────────────────────────
  if (step === "preview") {
    return (
      <div className="signature-full">
        <h2>Prévisualisation du contrat</h2>
        <div className="pdf-box">
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoad}
            loading="Chargement du PDF…"
            onLoadError={console.error}
          >
            <Page
              pageNumber={1}
              width={620}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>
        <div className="page-indicator">Page 1 / {numPages}</div>
        <button className="signature-cta" onClick={() => setStep("create")}>
          Continuer
        </button>
      </div>
    );
  }

  // ── STEP 2: Création de la signature avec slider ─────────────────────────────
  if (step === "create") {
    return (
      <div className="signature-full">
        <h2>Créez votre signature</h2>
        <SignaturePad ref={padRef} canvasProps={{ className: "sig-pad" }} />
        <div className="slider-container">
          <input
           type="range"
min={0}
  max={100}
  value={sliderValue}
  disabled={sliderCompleted}
  onChange={handleSliderChange}
  className="slider"
          />
          <div className="slider-label">
            {sliderCompleted
              ? "Signature validée ✔️"
              : "Glissez pour valider votre signature →"}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 3: Placement de la signature ─────────────────────────────────────────
  if (step === "place") {
    return (
      <div className="signature-full">
        <h2>Placez la signature sur le document</h2>
        <div
          className="pdf-box"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            setSigPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              w: sigPos.w,
              h: sigPos.h,
            });
            setStep("confirm");
          }}
        >
          <Document file={blobUrl} loading="Chargement…">
            <Page
              pageNumber={1}
              width={620}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
          <img
            src={sigURL}
            className="placed-sig"
            style={{
              left: sigPos.x,
              top: sigPos.y,
              width: sigPos.w,
            }}
            alt="Aperçu de la signature"
          />
        </div>
        <p>➜ Cliquez à l’endroit où vous souhaitez l’insérer.</p>
      </div>
    );
  }

  // ── STEP 4: Confirmation & fusion dans le PDF ────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="signature-full">
        <h2>Confirmer la signature</h2>
      // dans Signature.jsx, à l’étape “confirm”
<button
  className="signature-btn"
  onClick={async () => {
    try {
      // 1. Fusionner la signature dans le PDF
      const pdfDoc = await PDFDocument.load(await blobData.arrayBuffer());
      const sigImage = await pdfDoc.embedPng(sigURL);
      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();

      page.drawImage(sigImage, {
        x: sigPos.x,
        y: height - sigPos.y - sigPos.h, // coordonnée Y inversée
        width: sigPos.w,
        height: sigPos.h,
      });

      const signedPdfBytes = await pdfDoc.save();
      const signedBlob = new Blob([signedPdfBytes], { type: "application/pdf" });

      // 2. Upload dans Supabase Storage
      const fileName = `signed-contract-${id}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(fileName, signedBlob, { upsert: true });

      if (uploadError) throw uploadError;

      // 3. Récupérer l'URL publique
      const { data: urlData } = await supabase.storage
        .from("contracts")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 4. Envoi de l'email au client
      await sendSignedContractEmail({
        client_name: contract.nom,
        email:       contract.email,
        pdf_url:     publicUrl,
      });

      // 5. Copie à l'interne
      await sendSignedContractEmail({
        client_name: contract.nom,
        email:       "contracts@votreboite.com",
        pdf_url:     publicUrl,
      });

      // 6. Mise à jour du contrat dans Supabase
      await supabase
        .from("contracts")
        .update({ status: "signed" })
        .eq("id", id);

      setStep("done");
    } catch (err) {
      console.error("Envoi email signé KO :", err);
      alert("Une erreur est survenue lors de l’envoi du mail : " + (err.text || err.message || err));
    }
  }}
>
  Signer maintenant
</button>


      </div>
    );
  }

  // ── STEP 5: Terminé ───────────────────────────────────────────────────────────
  return (
    <div className="signature-full">
      <p className="signed-ok">✅ Contrat signé !</p>
    </div>
  );
}
