// « Trouver des contacts » : le stock de l'outil de scraping, interrogé avec les seuls critères que son
// API accepte (code NAF, département). Le total affiché est celui de l'API, exact ; la pagination suit
// son curseur ; « Créer une liste » réserve exactement ce stock-là. `nafOnly` (sheet des commerciaux,
// demande dev 06/10/2026) : la recherche ne demande que le code NAF, partout en France.
import { useEffect, useRef, useState } from 'react';
import { MapPin, Landmark, Loader2, ListPlus, Radar } from 'lucide-react';
import { prospectionApi, errorMessage } from './prospectionApi';
import { Card, Chip, Button, Modal, ProspectionStyles } from './ui';
import { MONO, FONT, fmtInt, inputStyle, chipColors } from './format';
import CriteriaInput from './CriteriaInput';
import PappersSearch from './PappersSearch';

const PAGE_SIZE = 50;
const EXAMPLES = [
  { activity: { code: '43.22A', label: "Travaux d'installation d'eau et de gaz en tous locaux" }, departement: { code: '69', name: 'Rhône' }, title: 'Plomberie · Rhône (69)' },
  { activity: { code: '56.10A', label: 'Restauration traditionnelle' }, departement: { code: '59', name: 'Nord' }, title: 'Restauration traditionnelle · Nord (59)' },
  { activity: { code: '69.20Z', label: 'Activités comptables' }, departement: null, title: 'Activités comptables · toute la France' },
];

// Commerciaux : le code NAF seul (« demande juste code NAF »).
const NAF_EXAMPLES = [
  { activity: { code: '43.22A', label: "Travaux d'installation d'eau et de gaz en tous locaux" }, departement: null, title: '43.22A · Plomberie' },
  { activity: { code: '56.10A', label: 'Restauration traditionnelle' }, departement: null, title: '56.10A · Restauration traditionnelle' },
  { activity: { code: '69.20Z', label: 'Activités comptables' }, departement: null, title: '69.20Z · Activités comptables' },
];

const activityLabel = (a) => `${a.code} · ${a.label}`;
const departementLabel = (d) => `${d.name} (${d.code})`;

export default function ProspectSearch({ C, darkMode, onToast, onOpenList, nafOnly = false }) {
  const [meta, setMeta] = useState(null);
  const [stockSize, setStockSize] = useState(null);
  const [criteria, setCriteria] = useState({ activity: null, departement: null });
  const [result, setResult] = useState(null);
  const [cursors, setCursors] = useState([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pappersOpen, setPappersOpen] = useState(false);
  const seq = useRef(0);
  const col = chipColors(C, darkMode);

  useEffect(() => {
    prospectionApi.meta().then(setMeta).catch(() => setMeta({ enabled: false }));
    prospectionApi.stockSize().then(setStockSize).catch(() => setStockSize(null));
  }, []);

  // Une page du stock : critères + curseur de la page (null pour la première).
  const load = async (nextCriteria, nextCursors, nextIndex) => {
    setCriteria(nextCriteria);
    if (!nextCriteria.activity && !nextCriteria.departement) {
      seq.current += 1;
      setResult(null); setError(''); setLoading(false); setCursors([null]); setPageIndex(0);
      return;
    }
    const mine = ++seq.current;
    setLoading(true); setError('');
    try {
      const page = await prospectionApi.available({
        departement: nextCriteria.departement?.code, codeNaf: nextCriteria.activity?.code,
        cursor: nextCursors[nextIndex], limit: PAGE_SIZE,
      });
      if (mine !== seq.current) return;
      setResult(page); setCursors(nextCursors); setPageIndex(nextIndex);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(errorMessage(err)); setResult(null);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  };

  const setCriterion = (key, value) => load({ ...criteria, [key]: value }, [null], 0);
  const onPick = (picked) => setCriterion(picked.type, picked.type === 'activity'
    ? { code: picked.code, label: picked.label } : { code: picked.code, name: picked.name });
  const goNext = () => load(criteria, [...cursors.slice(0, pageIndex + 1), result.next_cursor], pageIndex + 1);
  const goPrev = () => load(criteria, cursors, pageIndex - 1);

  const hasCriteria = Boolean(criteria.activity || criteria.departement);
  const total = result?.available_total || 0;
  const canLaunch = Boolean(meta?.can_launch_search);

  if (meta && !meta.enabled) {
    return <Card C={C} darkMode={darkMode} style={{ padding: 24, color: C.muted, fontSize: 14 }}>L'outil de prospection n'est pas encore configuré sur ce serveur.</Card>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ProspectionStyles />
      <Card C={C} darkMode={darkMode} style={{ padding: '6px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 4px' }}>
          <CriteriaInput C={C} onPick={onPick} autoFocus kinds={nafOnly ? ['activities'] : undefined}
            placeholder={nafOnly ? 'Code NAF (ex. 43.22A)' : 'Activité, code NAF, département ou ville (ex. plombier, 43.22A, Rhône, Lyon)'} />
          {loading && <Loader2 size={18} color={C.muted} style={{ animation: 'prospSpin 1s linear infinite', flexShrink: 0 }} />}
        </div>

        {hasCriteria && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 4px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, color: C.text }}>Critères :</span>
            {criteria.activity
              ? <Chip C={C} darkMode={darkMode} label={activityLabel(criteria.activity)} onRemove={() => setCriterion('activity', null)} />
              : <MutedChip C={C} label="Toutes activités" />}
            {!nafOnly && (criteria.departement
              ? <Chip C={C} darkMode={darkMode} label={departementLabel(criteria.departement)} onRemove={() => setCriterion('departement', null)} />
              : <MutedChip C={C} label="Toute la France" />)}
          </div>
        )}

        {hasCriteria && result && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 4px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
              {fmtInt(total)} entreprise{total > 1 ? 's' : ''} disponible{total > 1 ? 's' : ''} pour ces critères
            </span>
            {stockSize?.distributable != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999,
                border: `1px solid ${C.border}`, color: C.muted, fontSize: 13 }}>
                <Landmark size={15} /> Stock Owner · {fmtInt(stockSize.distributable)} entreprises distribuables
              </span>
            )}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 10 }}>
              {canLaunch && (
                <Button C={C} darkMode={darkMode} onClick={() => setPappersOpen(true)} title="Alimenter le stock (payant)">
                  <Radar size={16} /> Recherche Pappers
                </Button>
              )}
              {total > 0 && (
                <Button C={C} darkMode={darkMode} primary onClick={() => setCreateOpen(true)}>
                  <ListPlus size={16} /> Créer une liste
                </Button>
              )}
            </span>
          </div>
        )}
      </Card>

      {error && <div role="alert" style={{ color: '#b42318', fontSize: 14 }}>{error}</div>}

      {!hasCriteria && (
        <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.7 }}>
          {nafOnly ? 'Saisissez un code NAF. Par exemple :' : "Choisissez une activité (code NAF), un département, ou les deux : ce sont les critères de l'outil de scraping. Par exemple :"}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {(nafOnly ? NAF_EXAMPLES : EXAMPLES).map((ex) => (
              <button key={ex.title} type="button" onClick={() => load({ activity: ex.activity, departement: ex.departement }, [null], 0)} style={{
                border: `1px solid ${C.border}`, background: col.bg, color: col.text, borderRadius: 999, padding: '6px 12px',
                fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
              }}>{ex.title}</button>
            ))}
          </div>
          {canLaunch && (
            <div style={{ marginTop: 16 }}>
              <Button C={C} darkMode={darkMode} onClick={() => setPappersOpen(true)}><Radar size={16} /> Recherches Pappers</Button>
            </div>
          )}
        </div>
      )}

      {hasCriteria && result && total === 0 && (
        <Card C={C} darkMode={darkMode} style={{ padding: 24, fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
          Aucune entreprise disponible pour ces critères dans le stock.
          {canLaunch
            ? <div style={{ marginTop: 12 }}><Button C={C} darkMode={darkMode} onClick={() => setPappersOpen(true)}><Radar size={16} /> Lancer une recherche Pappers</Button></div>
            : ' Demandez à votre manager de lancer une recherche Pappers pour ces critères.'}
        </Card>
      )}

      {hasCriteria && result && total > 0 && (
        <ResultsTable C={C} darkMode={darkMode} result={result} loading={loading} page={pageIndex + 1}
          pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} onPrev={goPrev} onNext={goNext} />
      )}

      {createOpen && (
        <CreateListModal C={C} darkMode={darkMode} criteria={criteria} total={total} max={meta?.max_list || 500}
          onClose={() => setCreateOpen(false)}
          onCreate={async ({ name, count }) => {
            const list = await prospectionApi.createList({
              name, count, departement: criteria.departement?.code, codeNaf: criteria.activity?.code,
            });
            setCreateOpen(false);
            const short = list.total < count ? ` (le stock n'en avait plus que ${fmtInt(list.total)})` : '';
            onToast?.(`Liste « ${list.name} » créée : ${fmtInt(list.total)} entreprise${list.total > 1 ? 's' : ''} réservée${list.total > 1 ? 's' : ''} pour vous${short}.`);
            onOpenList?.(list.id);
          }} />
      )}
      {pappersOpen && meta && (
        <PappersSearch C={C} darkMode={darkMode} meta={meta} initial={criteria} onToast={onToast}
          onClose={() => { setPappersOpen(false); if (hasCriteria) load(criteria, [null], 0); }} />
      )}
    </div>
  );
}

function MutedChip({ C, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 999,
      border: `1px dashed ${C.border}`, color: C.muted, fontSize: 14 }}>{label}</span>
  );
}

function ResultsTable({ C, darkMode, result, loading, page, pages, onPrev, onNext }) {
  const th = { textAlign: 'left', padding: '14px 20px', fontSize: 14, fontWeight: 500, color: C.muted, whiteSpace: 'nowrap' };
  const td = { padding: '16px 20px', fontSize: 15, color: C.text, borderTop: `1px solid ${C.border}` };
  const mono = { ...td, fontFamily: MONO, fontSize: 14, whiteSpace: 'nowrap' };
  return (
    <Card C={C} darkMode={darkMode} style={{ overflow: 'hidden', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead style={{ background: C.surface }}>
            <tr>
              <th style={{ ...th, width: '24%', borderRight: `1px solid ${C.border}` }}>Entreprise</th>
              <th style={th}>Localisation</th><th style={{ ...th, width: '30%' }}>Activité</th><th style={th}>Effectif</th><th style={th}>Création</th>
            </tr>
          </thead>
          <tbody>
            {result.companies.map((c) => (
              <tr key={c.id}>
                <td style={{ ...td, fontWeight: 500, borderRight: `1px solid ${C.border}` }}>{c.name}</td>
                <td style={mono}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><MapPin size={16} color={C.muted} />{c.location_label || 'Non renseigné'}</span>
                  {c.local_establishment && (
                    <div style={{ fontFamily: FONT, fontSize: 12, color: C.muted, margin: '4px 0 0 24px' }}>Établissement à {c.local_establishment.label}</div>
                  )}
                </td>
                <td style={td}>{c.activity || 'Non renseigné'}</td>
                <td style={mono}>{c.workforce_label || 'Non renseigné'}</td>
                <td style={mono}>{c.creation_label || 'Non renseignée'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 20px', borderTop: `1px solid ${C.border}` }}>
          <Button C={C} darkMode={darkMode} disabled={page <= 1 || loading} onClick={onPrev}>Précédent</Button>
          <span style={{ fontSize: 13, color: C.muted }}>Page {page} sur {fmtInt(pages)}</span>
          <Button C={C} darkMode={darkMode} disabled={loading || !result.next_cursor} onClick={onNext}>Suivant</Button>
        </div>
      )}
    </Card>
  );
}

function CreateListModal({ C, darkMode, criteria, total, max, onClose, onCreate }) {
  const limit = Math.min(total, max);
  const defaultName = [criteria.activity ? activityLabel(criteria.activity) : 'Toutes activités',
    criteria.departement ? departementLabel(criteria.departement) : 'Toute la France'].join(' · ').slice(0, 120);
  const [name, setName] = useState(defaultName);
  const [count, setCount] = useState(Math.min(limit, 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await onCreate({ name: name.trim(), count: Number(count) }); } catch (err) { setError(errorMessage(err)); setBusy(false); }
  };
  return (
    <Modal C={C} darkMode={darkMode} title="Créer une liste" onClose={busy ? undefined : onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Nom de la liste
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} style={{ ...inputStyle(C), width: '100%', marginTop: 6 }} />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Nombre d'entreprises
          <input type="number" min={1} max={limit} value={count} onChange={(e) => setCount(e.target.value)} required
            style={{ ...inputStyle(C), width: 160, marginTop: 6, display: 'block' }} />
        </label>
        <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
          Les entreprises sont prises dans le stock avec ces mêmes critères et vous sont réservées : personne d'autre ne les
          recevra. {fmtInt(max)} au plus par liste. Si d'autres réservations passent entre-temps, la liste peut en contenir un peu moins.
        </p>
        {error && <div role="alert" style={{ color: '#b42318', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button C={C} darkMode={darkMode} onClick={onClose} disabled={busy}>Annuler</Button>
          <Button C={C} darkMode={darkMode} primary type="submit" disabled={busy || !name.trim() || !(Number(count) >= 1 && Number(count) <= limit)}>
            {busy ? <><Loader2 size={15} style={{ animation: 'prospSpin 1s linear infinite' }} /> Réservation…</> : 'Créer la liste'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
