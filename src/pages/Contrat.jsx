import { createClient } from "@supabase/supabase-js";
import { sendContractEmail } from "./sendEmail"; // ajuste si nécessaire
import { useState } from "react";
import { generateContractPdf } from "../utils/generateContractPdf";
import { saveAs } from "file-saver";
import "./Contrat.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);


export default function Contrat() {
  const [form, setForm] = useState({
  nom: "", adresse: "", siren: "", tel: "", montant: "", email: ""
});

  const [loading, setLoading] = useState(false);

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from("contracts")
      .insert([{ ...form }])
      .select()
      .single();

    if (error) throw error;

    const signatureLink = `http://localhost:5173/signature/${data.id}`;

    await sendContractEmail({
      nom: data.nom,
      email: data.email,
      lien: signatureLink
    });

    alert("Contrat enregistré avec succès ! Le lien de signature a été envoyé.");
  } catch (err) {
    console.error("Erreur :", err.message);
    alert("Une erreur est survenue.");
  } finally {
    setLoading(false);
  }
};

// ✅ ICI c’est bien à l’intérieur de `Contrat()`
return (
  <div className="contract-page">
    <div className="contract-card">
      <h2 className="contract-title">Nouveau contrat</h2>

      <form className="contract-form" onSubmit={handleSubmit}>
        {/* champs */}
        <label>Nom client
          <input name="nom" value={form.nom} onChange={handleChange} required />
        </label>
        <label>Adresse
          <input name="adresse" value={form.adresse} onChange={handleChange} required />
        </label>
        <label>N° SIREN
          <input name="siren" value={form.siren} onChange={handleChange} required />
        </label>
        <label>Téléphone
          <input name="tel" value={form.tel} onChange={handleChange} required />
        </label>
        <label>Montant mensuel (€)
          <input type="number" name="montant" value={form.montant}
                 onChange={handleChange} required />
        </label>
        <label>Email
          <input type="email" name="email" value={form.email}
                 onChange={handleChange} required />
        </label>

        <button className="contract-btn" type="submit" disabled={loading}>
          {loading ? "Génération…" : "Générer le PDF"}
        </button>
      </form>
    </div>
  </div>
);
} // ✅ et là seulement tu fermes la fonction `Contrat`
