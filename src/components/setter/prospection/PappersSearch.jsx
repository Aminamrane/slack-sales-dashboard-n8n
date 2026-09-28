// Recherche Pappers (managers) : POST /lead-searches avec les champs de la doc de l'API Leads. Payante :
// l'outil parcourt Pappers jusqu'au bout pour ces critères ; les sociétés trouvées rejoignent le stock
// commun une fois enrichies (dirigeants et Google). Le suivi relit GET /lead-searches.
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Radar } from 'lucide-react';
import { prospectionApi, errorMessage } from './prospectionApi';
import { Button, Chip, Modal } from './ui';
import { MONO, fmtInt, fmtDateTime, inputStyle, PAPPERS_STATUS, PAPPERS_STAGE } from './format';
import CriteriaInput from './CriteriaInput';

export default function PappersSearch({ C, darkMode, meta, initial, onClose, onToast }) {
  const [departement, setDepartement] = useState(initial?.departement?.code || '');
  const [activity, setActivity] = useState(initial?.activity || null);
  const [bandMin, setBandMin] = useState('');
  const [bandMax, setBandMax] = useState('');
  const [types, setTypes] = useState([]);
  const [ageOn, setAgeOn] = useState(true);
  const [age, setAge] = useState(meta.age_default);
  const [pool, setPool] = useState(null);
  const [searches, setSearches] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(() => prospectionApi.pappersSearches().then(setSearches).catch(() => setSearches([])), []);
  useEffect(() => { refresh(); }, [refresh]);
  // Suivi : relecture toutes les 5 s tant qu'une recherche est en file ou en cours.
  const running = (searches || []).some((s) => !['completed', 'failed'].includes(s.status));
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [running, refresh]);

  useEffect(() => {
    if (!departement || !activity) { setPool(null); return undefined; }
    let alive = true;
    prospectionApi.poolStats({ departement, codeNaf: activity.code })
      .then((r) => { if (alive) setPool(r); }).catch(() => { if (alive) setPool(null); });
    return () => { alive = false; };
  }, [departement, activity]);

  const bandIndex = (code) => meta.bands.findIndex((b) => b.code === code);
  const bandError = Boolean(bandMin && bandMax && bandIndex(bandMin) > bandIndex(bandMax));
  const ageValue = Number(age);
  const ageError = ageOn && !(Number.isInteger(ageValue) && ageValue >= meta.age_min && ageValue <= meta.age_max);
  const ready = Boolean(departement && activity) && !bandError && !ageError && !busy;

  const launch = async () => {
    setBusy(true); setError('');
    try {
      await prospectionApi.launchPappers({
        departement, code_naf: activity.code,
        tranche_effectif_min: bandMin || null, tranche_effectif_max: bandMax || null,
        type_societe: types, age_dirigeant: ageOn ? ageValue : null,
      });
      onToast?.('Recherche Pappers lancée : les sociétés trouvées rejoindront le stock une fois enrichies.');
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const label = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: C.text };
  const select = { ...inputStyle(C), width: '100%', cursor: 'pointer' };
  const help = { fontSize: 12, fontWeight: 400, color: C.muted, lineHeight: 1.5 };

  return (
    <Modal C={C} darkMode={darkMode} title="Recherche Pappers" onClose={busy ? undefined : onClose} width={760}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, marginBottom: 18,
        background: darkMode ? 'rgba(245,158,11,0.12)' : '#fff7e6', color: darkMode ? '#fcd34d' : '#92400e', fontSize: 13, lineHeight: 1.55 }}>
        <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Payante : l'outil parcourt Pappers jusqu'au bout pour ces critères et enregistre toutes les sociétés trouvées ; les crédits
          sont dépensés selon les réponses récupérées. Les sociétés rejoignent le stock commun une fois enrichies (dirigeants et Google).
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
        <label style={label}>Département
          <select value={departement} onChange={(e) => setDepartement(e.target.value)} style={select} required>
            <option value="">Choisir un département</option>
            {meta.departements.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)}
          </select>
        </label>
        <div style={label}>Activité (code NAF)
          {activity ? (
            <div><Chip C={C} darkMode={darkMode} label={`${activity.code} · ${activity.label}`} onRemove={() => setActivity(null)} /></div>
          ) : (
            <div style={{ ...inputStyle(C), padding: '6px 12px' }}>
              <CriteriaInput C={C} kinds={['activities']} compact placeholder="Métier ou code NAF"
                onPick={(picked) => setActivity({ code: picked.code, label: picked.label })} />
            </div>
          )}
          <span style={help}>Obligatoire ici : sans activité, tout le département serait parcouru et facturé.</span>
        </div>

        <div style={label}>Effectif (tranches INSEE)
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={bandMin} onChange={(e) => setBandMin(e.target.value)} style={select} aria-label="Tranche minimale">
              <option value="">Sans minimum</option>
              {meta.bands.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
            </select>
            <span style={{ fontWeight: 400, color: C.muted }}>à</span>
            <select value={bandMax} onChange={(e) => setBandMax(e.target.value)} style={select} aria-label="Tranche maximale">
              <option value="">Sans maximum</option>
              {meta.bands.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
            </select>
          </div>
          {bandError && <span style={{ ...help, color: '#b42318' }}>La tranche minimale dépasse la maximale.</span>}
        </div>

        <div style={label}>Âge du dirigeant (age_dirigeant)
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 400, cursor: 'pointer' }}>
              <input type="checkbox" checked={ageOn} onChange={(e) => setAgeOn(e.target.checked)} /> Filtrer
            </label>
            <input type="number" min={meta.age_min} max={meta.age_max} value={age} disabled={!ageOn}
              onChange={(e) => setAge(e.target.value)} style={{ ...inputStyle(C), width: 100, opacity: ageOn ? 1 : 0.5 }} />
          </div>
          <span style={{ ...help, color: ageError ? '#b42318' : C.muted }}>
            Valeur transmise telle quelle à l'outil : {meta.age_default} par défaut, de {meta.age_min} à {meta.age_max}. Décoché : aucun filtre d'âge.
          </span>
        </div>

        <div style={{ ...label, gridColumn: '1 / -1' }}>Catégories juridiques (type_societe)
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {meta.legal_categories.map((l) => {
              const on = types.includes(l.code);
              return (
                <button key={l.code} type="button" onClick={() => setTypes((t) => (on ? t.filter((c) => c !== l.code) : [...t, l.code]))} style={{
                  padding: '6px 12px', borderRadius: 999, border: `1px solid ${on ? C.text : C.border}`, background: on ? C.text : C.bg,
                  color: on ? C.bg : C.text, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                }}>{l.label} <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{l.code}</span></button>
              );
            })}
          </div>
          <span style={help}>Aucune sélection : toutes les catégories.</span>
        </div>
      </div>

      {pool && (
        <p style={{ fontSize: 13, color: C.muted, margin: '18px 0 0' }}>
          Stock actuel pour ce département et cette activité : <b style={{ color: C.text }}>{fmtInt(pool.distributable)}</b> distribuable{pool.distributable > 1 ? 's' : ''}
          {pool.incomplete > 0 && <>, {fmtInt(pool.incomplete)} en attente d'enrichissement ou incomplète{pool.incomplete > 1 ? 's' : ''}</>}.
        </p>
      )}
      {error && <div role="alert" style={{ color: '#b42318', fontSize: 13, marginTop: 12 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <Button C={C} darkMode={darkMode} onClick={onClose} disabled={busy}>Fermer</Button>
        <Button C={C} darkMode={darkMode} primary onClick={launch} disabled={!ready}>
          {busy ? <Loader2 size={15} style={{ animation: 'prospSpin 1s linear infinite' }} /> : <Radar size={15} />} Lancer la recherche
        </Button>
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 22, paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Recherches récentes</div>
        {searches === null && <div style={{ fontSize: 13, color: C.muted }}>Chargement…</div>}
        {searches?.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>Aucune recherche lancée pour l'instant.</div>}
        {searches?.slice(0, 10).map((s) => {
          const status = PAPPERS_STATUS[s.status] || { label: s.status, dot: '#9ca3af' };
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: `1px solid ${C.border}`, fontSize: 13, flexWrap: 'wrap' }}>
              <span style={{ color: C.muted, minWidth: 130 }}>{fmtDateTime(s.created_at)}</span>
              <span style={{ flex: '1 1 240px', color: C.text }}>{s.chips.map((chip) => chip.label).join(' · ')}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.text }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.dot }} />
                {status.label}{s.status === 'running' && s.stage ? ` · étape ${PAPPERS_STAGE[s.stage] || s.stage}` : ''}
              </span>
              <span style={{ color: C.text, minWidth: 100, textAlign: 'right' }}>
                {s.lead_count != null ? `${fmtInt(s.lead_count)} société${s.lead_count > 1 ? 's' : ''}` : ''}
              </span>
              {s.status === 'failed' && s.error && <span style={{ flexBasis: '100%', color: '#b42318' }}>{s.error}</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
