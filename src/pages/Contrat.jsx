// src/pages/Contrat.jsx
import { useState } from "react";
import { generateContractPdf } from "../utils/generateContractPdf";
import { saveAs } from "file-saver";
import "./Contrat.css"; 

export default function Contrat() {
  const [form, setForm] = useState({
    nom: "", adresse: "", siren: "", tel: "", montant: ""
  });
  const [loading, setLoading] = useState(false);

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const blob = await generateContractPdf(form);
      saveAs(blob, `Contrat_${form.nom}.pdf`);
    } finally {
      setLoading(false);
    }
  };

return (
  <div className="contract-page">
    <div className="contract-card">
      <h2 className="contract-title">Nouveau contrat</h2>

      <form className="contract-form" onSubmit={handleSubmit}>
        {/* ─── champs ─── */}
        <label>Nom client
          <input name="nom" value={form.nom} onChange={handleChange} required/>
        </label>

        <label>Adresse
          <input name="adresse" value={form.adresse} onChange={handleChange} required/>
        </label>

        <label>N° SIREN
          <input name="siren" value={form.siren} onChange={handleChange} required/>
        </label>

        <label>Téléphone
          <input name="tel" value={form.tel} onChange={handleChange} required/>
        </label>

        <label>Montant mensuel (€)
          <input type="number" name="montant" value={form.montant}
                 onChange={handleChange} required/>
        </label>

        <button className="contract-btn" type="submit" disabled={loading}>
          {loading ? "Génération…" : "Générer le PDF"}
        </button>
      </form>
    </div>
  </div>
);
}
