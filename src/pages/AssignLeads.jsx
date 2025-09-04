import { useEffect, useMemo, useState } from "react";
import "./assign.css";

const API   = import.meta.env.VITE_ASSIGN_API;      // e.g. https://script.google.com/macros/s/XXX/exec
const TOKEN = import.meta.env.VITE_ASSIGN_TOKEN;    // must match API_TOKEN in Apps Script

export default function AssignLeads() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [employees, setEmployees] = useState([]);   // [{key,label}]
  const [leads, setLeads] = useState([]);           // last 50
  const [q, setQ] = useState("");

  useEffect(() => { fetchList(); }, []);

  async function fetchList() {
    setLoading(true); setError("");
    try {
      const url = `${API}?action=list&token=${encodeURIComponent(TOKEN)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || res.statusText);

      setEmployees(data.employees || []);
      setLeads((data.leads || []).map(l => ({ ...l, _status: "idle", _err: "" })));
    } catch (e) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = leads;
    if (s) {
      list = list.filter(l =>
        [l.origin, l.nom, l.email, l.tel, l.ig, l.comp, l.sect, l.src, l.proj]
          .some(v => String(v || "").toLowerCase().includes(s))
      );
    }
    return list;
  }, [q, leads]);

  // POST without preflight (text/plain)
  async function postJsonNoPreflight(payload, timeoutMs = 15000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(t);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new Error(data?.error || res.statusText);
    return data;
  }

  async function onAssignChange(key, newAssignee) {
    // optimistic
    setLeads(prev =>
      prev.map(l => l.key === key ? { ...l, assignee: newAssignee, _status:"saving", _err:"" } : l)
    );
    try {
      await postJsonNoPreflight({ token:TOKEN, action:"assign", key, assignee:newAssignee });
      setLeads(prev => prev.map(l => l.key === key ? { ...l, _status:"saved" } : l));
      setTimeout(() => {
        setLeads(prev => prev.map(l => l.key === key ? { ...l, _status:"idle" } : l));
      }, 700);
      // Optionally re-sync from server: await fetchList();
    } catch (e) {
      const msg = e?.message || "Assign failed";
      setLeads(prev =>
        prev.map(l => l.key === key ? { ...l, _status:"error", _err: msg } : l)
      );
      alert(`Assign failed:\n${msg}`);
    }
  }

  return (
    <div className="assign-wrap">
      <h1 className="assign-title">Affectation des leads (50 dernières lignes)</h1>

      <div className="assign-controls">
        <button className="btn" onClick={fetchList} disabled={loading}>
          {loading ? "Chargement…" : "Rafraîchir"}
        </button>

        <input
          className="input"
          placeholder="Rechercher (nom, email, tel, IG, origine…)"
          value={q}
          onChange={e => setQ(e.target.value)}
        />

        <span className="helper">{filtered.length} ligne(s)</span>
        {error && <span className="error">Erreur: {error}</span>}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Tel</th>
              <th>Email</th>
              <th>Company</th>
              <th>Secteur</th>
              <th>Plateforme</th>
              <th>Source</th>
              <th>Nb</th>
              <th>CA</th>
              <th>Projet</th>
              <th>Assigné</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.key}>
                <td className="nowrap">{l.tel ? <a href={`tel:${cleanTel(l.tel)}`}>{l.tel}</a> : "—"}</td>
                <td>{l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : "—"}</td>
                <td>{l.comp || "—"}</td>
                <td>{l.sect || "—"}</td>
                <td>{l.plat || "—"}</td>
                <td>{l.src  || "—"}</td>
                <td className="nowrap">{l.nb || "—"}</td>
                <td className="nowrap">{l.ca || "—"}</td>
                <td>{l.proj || "—"}</td>
                <td className="nowrap">
                  <AssignSelect
                    current={l.assignee || "0"}
                    employees={employees}
                    onChange={val => onAssignChange(l.key, val)}
                    status={l._status}
                    err={l._err}
                  />
                </td>
              </tr>
            ))}
            {!loading && !filtered.length && (
              <tr><td colSpan={10} style={{textAlign:'center', padding:'20px'}}>Aucun élément</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="helper" style={{marginTop:12}}>
        Pour mettre un lead de côté, choisissez <b>0 (parqué)</b>.
      </p>
    </div>
  );
}

function cleanTel(t){ return String(t).replace(/[^\d+]/g,''); }

function AssignSelect({ current, employees, onChange, status, err }) {
  return (
    <div className="assign-cell">
      <select
        className="select"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={status === "saving"}
        title={err || ""}
      >
        <option value="0">0 (parqué)</option>
        {employees.map(emp => (
          <option key={emp.key} value={emp.key}>{emp.label}</option>
        ))}
      </select>
      {status === "saving" && <span className="mini muted">…</span>}
      {status === "saved"  && <span className="mini ok">✓</span>}
      {status === "error"  && <span className="mini err" title={err || ""}>!</span>}
    </div>
  );
}
