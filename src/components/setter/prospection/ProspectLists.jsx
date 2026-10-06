// « Mes listes » : les listes d'entreprises réservées par le setter ou le commercial (06/10/2026), leur
// entonnoir de prospection, les fiches société, l'export CSV et l'export vers le CRM (leads dans « Mes
// leads »). `canBook` : prise de RDV depuis la liste (parcours setter ; un commercial pose son R1 depuis
// sa sheet après l'export).
import { useCallback, useEffect, useState } from 'react';
import {
  Building2, CalendarDays, FileText, Mail, Send, MessageCircle, ChevronRight, ChevronDown, Download, Upload,
  MoreHorizontal, Search, MapPin, Users, Globe, ExternalLink, Phone, UserRound, Star, Trash2, ArrowLeft, Loader2, CheckCircle2,
  CalendarPlus, CalendarCheck2,
} from 'lucide-react';
import SetterJourneyDialog from '../SetterJourneyDialog';
import { prospectionApi, errorMessage } from './prospectionApi';
import { Card, Chip, Button, Modal, IconButton, ProspectionStyles } from './ui';
import { MONO, fmtInt, fmtDay, fmtWallDateTime, inputStyle, STATUS_META, chipColors } from './format';

export default function ProspectLists({ C, darkMode, onToast, openListId, onOpenList, onOpenLeads, teamSales = [], canBook = true }) {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    prospectionApi.lists().then(setLists).catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(() => { if (!openListId) load(); }, [openListId, load]);

  if (openListId) {
    return <ListDetail C={C} darkMode={darkMode} listId={openListId} onBack={() => onOpenList(null)} onToast={onToast} onOpenLeads={onOpenLeads} teamSales={teamSales} canBook={canBook} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ProspectionStyles />
      {error && <div role="alert" style={{ color: '#b42318', fontSize: 14 }}>{error}</div>}
      {lists === null && !error && <div style={{ color: C.muted, fontSize: 14 }}>Chargement…</div>}
      {lists?.length === 0 && (
        <Card C={C} darkMode={darkMode} style={{ padding: 24, fontSize: 14, color: C.muted }}>
          Aucune liste pour l'instant. Créez-en une depuis « Trouver des contacts ».
        </Card>
      )}
      {lists?.map((list) => (
        <Card key={list.id} C={C} darkMode={darkMode} style={{ padding: '16px 20px', cursor: 'pointer' }}>
          <div role="button" tabIndex={0} onClick={() => onOpenList(list.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpenList(list.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{list.name}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Créée le {fmtDay(list.created_at)} · {fmtInt(list.total)} entreprise{list.total > 1 ? 's' : ''}</div>
              {list.chips?.length > 0 && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={list.chips.map((chip) => chip.label).join(' · ')}>
                  {list.chips.map((chip) => chip.label).join(' · ')}
                </div>
              )}
            </div>
            <Funnel C={C} counts={list} compact />
            <ChevronRight size={18} color={C.muted} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Funnel({ C, counts, compact }) {
  const size = compact ? 13 : 16;
  const step = (icon, n, label, color) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color, fontSize: size, fontWeight: color === C.text ? 500 : 600 }}>
      {icon}{fmtInt(n)} {label}
    </span>
  );
  const arrow = <ChevronRight size={compact ? 14 : 16} color={C.muted} />;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 8 : 14, flexWrap: 'wrap' }}>
      {!compact && <span style={{ fontSize: size, color: C.text }}>Prospection :</span>}
      {step(<Mail size={size} color={C.accent} />, counts.a_contacter, 'prêtes à contacter', C.text)}
      {arrow}
      {step(<Send size={size} color={C.accent} />, counts.contacte, 'contactées', C.text)}
      {arrow}
      {step(<MessageCircle size={size} color="#15803d" />, counts.repondu, 'ont répondu', '#15803d')}
    </span>
  );
}

function ListDetail({ C, darkMode, listId, onBack, onToast, onOpenLeads, teamSales, canBook }) {
  const [list, setList] = useState(null);
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [exportResult, setExportResult] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rdvItem, setRdvItem] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [l, it] = await Promise.all([prospectionApi.getList(listId), prospectionApi.items(listId, { q, status, page, pageSize })]);
      setList(l); setItems(it); setError('');
    } catch (err) { setError(errorMessage(err)); }
  }, [listId, q, status, page, pageSize]);

  useEffect(() => { const t = setTimeout(refresh, q ? 250 : 0); return () => clearTimeout(t); }, [refresh, q]);

  const exportCrm = async (itemIds = null) => {
    setBusy('crm');
    try {
      const r = await prospectionApi.exportCrm(listId, itemIds);
      setExportResult(r);
      await refresh();
    } catch (err) { onToast?.(errorMessage(err), 'err'); } finally { setBusy(''); }
  };
  // RDV pris au téléphone : le lead de cette seule entreprise naît avec son R1 (rien si la pose échoue).
  const book = async (item, action) => {
    try {
      const r = action.single
        ? await prospectionApi.bookR1(item.id, action.body, action.email)
        : await prospectionApi.placeR1(item.id, action.body, action.email);
      onToast?.(`R1 placé le ${fmtWallDateTime(r.r1_date)} avec ${r.sales?.name || r.sales?.email} pour ${item.company.name}.`);
      await refresh();
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  };
  const downloadCsv = async () => {
    setBusy('csv');
    try { await prospectionApi.downloadCsv(listId, list?.name); } catch (err) { onToast?.(errorMessage(err), 'err'); } finally { setBusy(''); }
  };
  const changeStatus = async (item, next) => {
    try { await prospectionApi.setStatus(item.id, next); await refresh(); } catch (err) { onToast?.(errorMessage(err), 'err'); }
  };
  const removeItem = async (item) => {
    try {
      const r = await prospectionApi.removeItem(item.id);
      const fate = item.crm_lead_id ? 'le lead reste dans Mes leads' : r?.released ? 'rendue au stock' : 'déjà traitée, plus proposée à personne';
      onToast?.(`${item.company.name} retirée de la liste (${fate}).`);
      await refresh();
    } catch (err) { onToast?.(errorMessage(err), 'err'); }
  };
  const deleteList = async () => {
    try {
      const r = await prospectionApi.deleteList(listId);
      onToast?.(`Liste supprimée : ${fmtInt(r?.released)} entreprise${r?.released > 1 ? 's' : ''} rendue${r?.released > 1 ? 's' : ''} au stock, ${fmtInt(r?.consumed)} marquée${r?.consumed > 1 ? 's' : ''} comme traitée${r?.consumed > 1 ? 's' : ''}.`);
      onBack();
    } catch (err) { onToast?.(errorMessage(err), 'err'); }
  };

  if (error && !list) return <div role="alert" style={{ color: '#b42318', fontSize: 14 }}>{error}</div>;
  if (!list) return <div style={{ color: C.muted, fontSize: 14 }}>Chargement…</div>;
  const pending = (list.total || 0) - (list.exported || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <ProspectionStyles />
      <button type="button" onClick={onBack} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none',
        background: 'transparent', color: C.muted, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', padding: 0 }}>
        <ArrowLeft size={15} /> Toutes mes listes
      </button>

      <Card C={C} darkMode={darkMode} style={{ padding: '22px 28px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 14 }}>{list.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', paddingBottom: 18, borderBottom: `1px solid ${C.border}` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 16, color: C.text }}>
            <Building2 size={20} color={C.muted} />{fmtInt(list.total)} entreprise{list.total > 1 ? 's' : ''}
            <span style={{ fontFamily: MONO, fontSize: 15, marginLeft: 6 }}>{list.total}/{list.max}</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 16, color: C.text }}><CalendarDays size={19} color={C.muted} />Créée le {fmtDay(list.created_at)}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 16, color: C.text }}><FileText size={19} color={C.muted} />Mise à jour le {fmtDay(list.updated_at)}</span>
        </div>
        <div style={{ paddingTop: 16 }}><Funnel C={C} counts={list} /></div>
        {list.chips?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            {list.chips.map((chip) => <Chip key={`${chip.kind}-${chip.code}`} C={C} darkMode={darkMode} label={chip.label} />)}
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Button C={C} darkMode={darkMode} onClick={downloadCsv} disabled={busy === 'csv'}><Download size={17} /> Exporter CSV</Button>
        <Button C={C} darkMode={darkMode} onClick={() => exportCrm(null)} disabled={busy === 'crm' || pending <= 0}
          title={pending <= 0 ? 'Toutes les entreprises sont déjà dans le CRM' : 'Créer un lead dans « Mes leads » pour chaque entreprise'}>
          {busy === 'crm' ? <Loader2 size={17} style={{ animation: 'prospSpin 1s linear infinite' }} /> : <Upload size={17} />} Exporter vers CRM
        </Button>
        <span style={{ width: 1, height: 28, background: C.border, margin: '0 4px' }} />
        <div style={{ position: 'relative' }}>
          <Button C={C} darkMode={darkMode} onClick={() => setMenuOpen((v) => !v)} style={{ padding: '10px 12px' }} title="Plus d'actions"><MoreHorizontal size={18} /></Button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10,
              zIndex: 20, boxShadow: '0 12px 28px rgba(16,24,40,0.12)', minWidth: 220 }}>
              <button type="button" onClick={() => { setMenuOpen(false); setConfirmDelete(true); }} style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', border: 'none', background: 'transparent',
                color: '#b42318', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}><Trash2 size={15} /> Supprimer la liste</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 520 }}>
          <Search size={18} color={C.muted} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Rechercher (nom, SIREN, téléphone…)"
            style={{ ...inputStyle(C), width: '100%', padding: '12px 14px 12px 42px', fontSize: 15 }} />
        </div>
        <Select C={C} value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[['', 'Tous les statuts'], ...Object.entries(STATUS_META).map(([k, m]) => [k, m.label])]} />
        <Select C={C} value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
          options={[['25', '25 / page'], ['50', '50 / page'], ['100', '100 / page']]} />
      </div>

      {items?.items.length === 0 && <div style={{ color: C.muted, fontSize: 14 }}>Aucune entreprise ne correspond.</div>}
      {items?.items.map((item) => (
        <CompanyCard key={item.id} C={C} darkMode={darkMode} item={item} onStatus={(s) => changeStatus(item, s)}
          onBook={canBook && list.is_owner ? () => setRdvItem(item) : null}
          onExport={() => exportCrm([item.id])} onRemove={() => removeItem(item)} onOpenLeads={onOpenLeads} busy={busy === 'crm'} />
      ))}
      {items && items.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <Button C={C} darkMode={darkMode} disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
          <span style={{ fontSize: 13, color: C.muted }}>Page {items.page} sur {items.pages}</span>
          <Button C={C} darkMode={darkMode} disabled={page >= items.pages} onClick={() => setPage(page + 1)}>Suivant</Button>
        </div>
      )}

      {exportResult && <ExportResult C={C} darkMode={darkMode} result={exportResult} onClose={() => setExportResult(null)} onOpenLeads={onOpenLeads} />}
      {rdvItem && (
        <SetterJourneyDialog prospect={{ name: rdvItem.company.name, itemId: rdvItem.id }} teamSales={teamSales} dark={darkMode}
          onBook={(action) => book(rdvItem, action)} onClose={() => setRdvItem(null)} />
      )}
      {confirmDelete && (
        <Modal C={C} darkMode={darkMode} title="Supprimer la liste ?" onClose={() => setConfirmDelete(false)}>
          <p style={{ marginTop: 0, fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
            {list.to_release > 0 && <>{fmtInt(list.to_release)} entreprise{list.to_release > 1 ? 's' : ''} jamais contactée{list.to_release > 1 ? 's' : ''} redevien{list.to_release > 1 ? 'nent' : 't'} disponible{list.to_release > 1 ? 's' : ''} pour les autres. </>}
            {list.to_consume > 0 && <>{fmtInt(list.to_consume)} déjà traitée{list.to_consume > 1 ? 's' : ''} {list.to_consume > 1 ? 'sont marquées' : 'est marquée'} comme utilisée{list.to_consume > 1 ? 's' : ''} dans l'outil et ne {list.to_consume > 1 ? 'seront' : 'sera'} plus proposée{list.to_consume > 1 ? 's' : ''} à personne. </>}
            Les leads déjà créés dans le CRM restent dans « Mes leads ».
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button C={C} darkMode={darkMode} onClick={() => setConfirmDelete(false)}>Annuler</Button>
            <Button C={C} darkMode={darkMode} danger onClick={deleteList}>Supprimer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Select({ C, value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle(C), appearance: 'none', padding: '12px 42px 12px 16px', fontSize: 15, cursor: 'pointer' }}>
        {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <ChevronDown size={17} color={C.muted} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  );
}

function CompanyCard({ C, darkMode, item, onStatus, onBook, onExport, onRemove, onOpenLeads, busy }) {
  const c = item.company;
  const col = chipColors(C, darkMode);
  const meta = STATUS_META[item.status] || STATUS_META.a_contacter;
  const manager = (c.managers || [])[0];
  const site = c.website ? c.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;
  const row = { display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, color: C.text };
  const pill = { padding: '4px 14px', borderRadius: 999, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, whiteSpace: 'nowrap' };
  const iconBtn = { border: 'none', background: 'transparent', color: C.text, cursor: 'pointer', padding: 6, display: 'inline-flex', borderRadius: 8 };
  return (
    <Card C={C} darkMode={darkMode} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', padding: '22px 24px', gap: 0 }}>
        <div style={{ flex: '1 1 340px', display: 'flex', gap: 18, paddingRight: 24, minWidth: 0 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: col.bg, color: col.text, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 600, fontSize: 18, flexShrink: 0, border: `1px solid ${C.border}` }}>{c.initials}</div>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{c.name}</div>
            <div style={{ fontSize: 15, color: C.text }}>{c.activity}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', fontSize: 15, color: C.text }}>
              {c.location_label && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={17} color={C.muted} />{c.location_label}</span>}
              {c.workforce_label && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 14 }}><Users size={17} color={C.muted} />{c.workforce_label}{c.workforce_year ? ` (${c.workforce_year})` : ''}</span>}
              {c.creation_label && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CalendarDays size={17} color={C.muted} />{c.creation_label}</span>}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, color: C.text }}><Building2 size={17} color={C.muted} />{c.establishments} établ.{c.legal_form ? ` · ${c.legal_form}` : ''}
              {c.local_establishment && <span style={{ color: C.muted }}> · dont un à {c.local_establishment.label}</span>}</span>
            {c.siren_display && <span style={{ fontFamily: MONO, fontSize: 15, color: C.text, letterSpacing: '0.02em' }}>SIREN {c.siren_display}</span>}
          </div>
        </div>
        <div style={{ flex: '1 1 340px', borderLeft: `1px solid ${C.border}`, paddingLeft: 28, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {site && (
            <a href={c.website} target="_blank" rel="noreferrer" style={{ ...row, color: C.accent, textDecoration: 'none' }}>
              <Globe size={19} />{site}<ExternalLink size={14} />
            </a>
          )}
          {c.google_rating != null && (
            <span style={row}><Star size={18} color="#f59e0b" fill="#f59e0b" />{String(c.google_rating).replace('.', ',')} / 5{c.google_reviews_count ? ` · ${fmtInt(c.google_reviews_count)} avis Google` : ' sur Google'}</span>
          )}
          {c.phone
            ? <span style={row}><Phone size={18} color={C.muted} /><a href={`tel:${c.phone.replace(/\s/g, '')}`} style={{ color: C.text, textDecoration: 'none' }}>{c.phone}</a><span style={pill}>Standard</span></span>
            : <span style={{ ...row, color: C.muted }}><Phone size={18} />Pas de téléphone connu</span>}
          {(c.managers || []).slice(0, 2).map((m, i) => (
            <span key={`${i}-${m.name}`} style={row}><UserRound size={18} color={C.muted} />{m.name}{m.quality && <span style={pill}>{m.quality}</span>}</span>
          ))}
          {c.address && <span style={{ ...row, color: C.muted, fontSize: 13 }}><MapPin size={16} />{c.address}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: C.surface }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot }} />
          <select value={item.status} onChange={(e) => onStatus(e.target.value)} aria-label="Statut de prospection" style={{
            appearance: 'none', border: 'none', background: 'transparent', color: C.text, fontSize: 15, fontWeight: 500, fontFamily: 'inherit',
            cursor: 'pointer', paddingRight: 18 }}>
            {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
          <ChevronDown size={14} color={C.text} style={{ position: 'absolute', right: 12, pointerEvents: 'none' }} />
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.text }}><CalendarDays size={16} color={C.muted} />{fmtDay(item.added_at)}</span>
        {manager && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, color: C.text }}><Users size={17} color={C.muted} />Contact : {item.contact || manager.name}</span>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {item.rdv ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, fontSize: 14, fontWeight: 600,
              color: darkMode ? '#86efac' : '#15803d', background: darkMode ? 'rgba(34,197,94,0.14)' : '#f0fdf4' }}>
              <CalendarCheck2 size={16} /> R1 le {fmtWallDateTime(item.rdv.date)} · {item.rdv.sales}
            </span>
          ) : onBook && (
            <Button C={C} darkMode={darkMode} primary onClick={onBook} disabled={!c.phone && !item.crm_lead_id} style={{ padding: '8px 14px' }}
              title={c.phone || item.crm_lead_id ? 'Placer le R1 : le lead de cette entreprise est créé avec le rendez-vous'
                : 'Pas de téléphone connu : impossible de créer le lead'}>
              <CalendarPlus size={16} /> Prendre RDV
            </Button>
          )}
          {item.crm_lead_id
            ? <button type="button" onClick={onOpenLeads} style={{ ...iconBtn, gap: 6, color: '#15803d', fontSize: 13, fontWeight: 600 }} title="Voir dans Mes leads"><CheckCircle2 size={17} /> Dans le CRM</button>
            : <IconButton C={C} darkMode={darkMode} tone="accent" onClick={onExport} disabled={busy || !c.phone}
                title={c.phone ? 'Exporter cette entreprise vers le CRM, sans rendez-vous' : 'Pas de téléphone : export impossible'}><Upload size={19} /></IconButton>}
          {!item.crm_lead_id && (
            <IconButton C={C} darkMode={darkMode} tone="danger" onClick={onRemove}
              title={item.manual_status === 'a_contacter' ? "Retirer de la liste : l'entreprise redevient disponible pour les autres"
                : 'Retirer de la liste : déjà traitée, elle ne sera plus proposée à personne'}><Trash2 size={19} /></IconButton>
          )}
        </span>
      </div>
    </Card>
  );
}

function ExportResult({ C, darkMode, result, onClose, onOpenLeads }) {
  const n = result.created.length;
  return (
    <Modal C={C} darkMode={darkMode} title="Export vers le CRM" onClose={onClose}>
      <p style={{ marginTop: 0, fontSize: 15, color: C.text }}>
        <b>{fmtInt(n)}</b> lead{n > 1 ? 's' : ''} créé{n > 1 ? 's' : ''} dans « Mes leads ».
      </p>
      {result.duplicates.length > 0 && (
        <div style={{ fontSize: 14, color: C.text, marginBottom: 12 }}>
          <b>{result.duplicates.length}</b> déjà dans le CRM, non recréée{result.duplicates.length > 1 ? 's' : ''} :
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: C.muted }}>
            {result.duplicates.slice(0, 8).map((d) => <li key={d.item_id}>{d.name}{d.owner ? ` (chez ${d.owner})` : ''}</li>)}
            {result.duplicates.length > 8 && <li>et {result.duplicates.length - 8} autre(s)</li>}
          </ul>
        </div>
      )}
      {result.without_phone.length > 0 && (
        <p style={{ fontSize: 14, color: C.muted }}>{result.without_phone.length} sans téléphone, laissée{result.without_phone.length > 1 ? 's' : ''} dans la liste.</p>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button C={C} darkMode={darkMode} onClick={onClose}>Fermer</Button>
        {n > 0 && <Button C={C} darkMode={darkMode} primary onClick={() => { onClose(); onOpenLeads?.(); }}>Voir Mes leads</Button>}
      </div>
    </Modal>
  );
}
