// Onglet « RDV webinaire » de la tracking sheet setter (demande dev 05/10/2026). Les rendez-vous pris via
// le lien webinaire personnel de la setteuse (/lamia, /aurelie) arrivent chez un commercial : ici, elle
// les retrouve avec leur date, leur résultat et le commercial à qui chacun a été affecté.
// Lecture seule : rien ne change pour le commercial ni pour le lead. Mêmes règles que le Pilotage setting.
// Logique pure : src/utils/setterWebinarRdv.js (testée).
import { useMemo } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { Card, ProspectionStyles } from './prospection/ui.jsx';
import { fmtInt } from './prospection/format.js';
import {
  OUTCOME_HINTS, OUTCOME_LABELS, OUTCOME_TONES, SUMMARY_KEYS, assignedLabel, fmtBooked, fmtRdv, orderRdv,
} from '../../utils/setterWebinarRdv.js';

export default function SetterWebinarRdv({ C, darkMode, data, loading, error, onRefresh }) {
  const rows = useMemo(() => orderRdv(data?.items), [data]);
  const counts = data?.counts || {};
  const head = {
    padding: '10px 14px', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase',
    letterSpacing: '0.05em', textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
  };
  const cell = { padding: '12px 14px', fontSize: 13.5, color: C.text, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' };
  const tile = (label, value, tone, title) => (
    <Card key={label} C={C} darkMode={darkMode} style={{ padding: '14px 18px', minWidth: 120, flex: '1 1 120px' }}>
      <div title={title} style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: tone || C.text, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(value)}</div>
    </Card>
  );

  return (
    <div>
      <ProspectionStyles />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        {tile('RDV pris', counts.total)}
        {SUMMARY_KEYS.map((key) => tile(OUTCOME_LABELS[key], counts[key], OUTCOME_TONES[key], OUTCOME_HINTS[key]))}
        {tile('Signés', counts.signed, '#10b981', 'Prospects devenus clients.')}
      </div>

      <Card C={C} darkMode={darkMode} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Vos rendez-vous webinaire</div>
          <button type="button" onClick={onRefresh} disabled={loading} title="Actualiser" aria-label="Actualiser" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', cursor: loading ? 'default' : 'pointer',
          }}>
            {loading
              ? <LoaderCircle size={14} style={{ animation: 'prospSpin 0.9s linear infinite' }} />
              : <RefreshCw size={14} />}
            Actualiser
          </button>
        </div>

        {error && (
          <div style={{ padding: '16px 18px', fontSize: 13.5, color: '#dc2626' }}>
            Impossible de charger vos rendez-vous webinaire. Réessayez avec « Actualiser ».
          </div>
        )}
        {!error && !rows.length && (
          <div style={{ padding: '28px 18px', fontSize: 13.5, color: C.muted, textAlign: 'center' }}>
            {loading ? 'Chargement…' : 'Aucun rendez-vous pris via votre lien webinaire pour l\'instant.'}
          </div>
        )}
        {!error && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={head}>Prospect</th>
                  <th style={head}>Rendez-vous</th>
                  <th style={head}>Résultat</th>
                  <th style={head}>Affecté à</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone = OUTCOME_TONES[r.outcome] || OUTCOME_TONES.removed;
                  const waiting = r.assigned?.state !== 'assigned';
                  return (
                    <tr key={r.lead_id}>
                      <td style={cell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                          <span>{r.full_name || 'Prospect sans nom'}</span>
                          {r.signed && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', background: darkMode ? 'rgba(16,185,129,0.14)' : '#ecfdf5', padding: '2px 8px', borderRadius: 999 }}>
                              Signé
                            </span>
                          )}
                        </div>
                        {r.company && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{r.company}</div>}
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <div style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtRdv(r.rdv_at)}</div>
                        {r.booked_at && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Réservé le {fmtBooked(r.booked_at)}</div>}
                      </td>
                      <td style={cell}>
                        <span title={OUTCOME_HINTS[r.outcome]} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: tone,
                          background: `${tone}1f`, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: tone }} />
                          {OUTCOME_LABELS[r.outcome] || r.outcome}
                        </span>
                      </td>
                      <td style={{ ...cell, color: waiting ? C.muted : C.text, fontStyle: waiting ? 'italic' : 'normal' }}>
                        {assignedLabel(r.assigned)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
