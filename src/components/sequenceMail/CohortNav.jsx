// src/components/sequenceMail/CohortNav.jsx
//
// Volet de navigation façon « libellés » Gmail : toutes les cohortes, une par une, puis les
// séquences (pré-webinaire, post-webinaire, envois ponctuels) qui filtrent la liste.

import { Inbox, MailCheck, MailPlus, Megaphone, TriangleAlert, Workflow } from 'lucide-react';
import { fmtInt } from './format';
import { SEQUENCES, audienceTone } from './model';

const DOT = { blue: '#1a73e8', green: '#188038', grey: '#9aa0a6' };

const SEQ_ICONS = { any: Inbox, pre: MailPlus, post: MailCheck, oneshot: Megaphone };
const SEQ_ORDER = ['any', 'pre', 'post', 'oneshot'];

/**
 * @param cohorts Cohortes (catalogue ∪ CRM), les plus récentes d'abord.
 * @param totalCount Nombre d'e-mails de toutes les cohortes chargées.
 * @param countsByCohort Nombre d'e-mails par cohorte.
 * @param seqCounts Nombre d'e-mails par séquence dans la cohorte sélectionnée.
 * @param onOpenSchema Ouvre (ou ramène au premier plan) la fenêtre « Schéma de séquence » ; le bouton n'existe que si fourni.
 * @param schemaOpen La fenêtre « Schéma de séquence » est actuellement ouverte.
 */
export default function CohortNav({
  cohorts,
  cohortId,
  sequence,
  totalCount,
  countsByCohort,
  seqCounts,
  collapsed,
  apiStatus,
  onSelectCohort,
  onSelectSequence,
  onOpenSchema,
  schemaOpen = false,
}) {
  return (
    <nav className={`smx-nav${collapsed ? ' is-collapsed' : ''}`} aria-label="Cohortes et séquences">
      <div className="smx-nav-title">Cohortes</div>
      <button
        type="button"
        className={`smx-nav-item${cohortId === 'all' ? ' is-active' : ''}`}
        aria-current={cohortId === 'all' ? 'page' : undefined}
        title="Toutes les cohortes"
        onClick={() => onSelectCohort('all')}
      >
        <span className="smx-nav-ico"><Inbox size={16} strokeWidth={1.9} aria-hidden /></span>
        <span className="smx-nav-label">Toutes les cohortes</span>
        <span className="smx-nav-count">{totalCount === null ? '' : fmtInt(totalCount)}</span>
      </button>
      {cohorts.map((c) => {
        const active = cohortId === c.id;
        const count = countsByCohort.get(c.id) ?? c.stepCount;
        const tip = [c.label, c.audience, c.inApi ? null : 'Absente du CRM (contenu local seul)', c.inCatalog ? null : 'Contenu local indisponible']
          .filter(Boolean)
          .join(' · ');
        return (
          <button
            key={c.id}
            type="button"
            className={`smx-nav-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            title={tip}
            onClick={() => onSelectCohort(c.id)}
          >
            <span className="smx-nav-ico">
              <span className="smx-nav-dot" style={{ background: DOT[audienceTone(c.audience)] || DOT.grey }} aria-hidden />
            </span>
            <span className="smx-nav-label">
              {c.short}
              {c.audience && <span className="smx-nav-sub">{c.audience}</span>}
            </span>
            <span className="smx-nav-count">{typeof count === 'number' ? fmtInt(count) : '—'}</span>
          </button>
        );
      })}

      <div className="smx-nav-title">Séquences</div>
      {SEQ_ORDER.map((seq) => {
        const Icon = SEQ_ICONS[seq];
        const label = seq === 'any' ? 'Toutes les séquences' : SEQUENCES[seq].label;
        const count = seqCounts[seq];
        const active = sequence === seq;
        return (
          <button
            key={seq}
            type="button"
            className={`smx-nav-item${active ? ' is-active' : ''}`}
            aria-current={active ? 'true' : undefined}
            title={label}
            onClick={() => onSelectSequence(seq)}
          >
            <span className="smx-nav-ico"><Icon size={16} strokeWidth={1.9} aria-hidden /></span>
            <span className="smx-nav-label">{label}</span>
            <span className="smx-nav-count">{typeof count === 'number' ? fmtInt(count) : ''}</span>
          </button>
        );
      })}
      {onOpenSchema && (
        <button
          type="button"
          className="smx-nav-item"
          title={schemaOpen ? 'Schéma de séquence (déjà ouvert : le ramener au premier plan)' : 'Rouvrir la fenêtre « Schéma de séquence »'}
          onClick={onOpenSchema}
        >
          <span className="smx-nav-ico"><Workflow size={16} strokeWidth={1.9} aria-hidden /></span>
          <span className="smx-nav-label">Schéma de séquence</span>
        </button>
      )}

      {apiStatus === 'error' && !collapsed && (
        <p className="smx-nav-note" role="status">
          <TriangleAlert size={12} aria-hidden style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Cohortes du CRM indisponibles : seules celles dont le contenu est local sont listées.
        </p>
      )}
    </nav>
  );
}
