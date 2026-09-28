// src/components/sequenceMail/SequenceSchema.jsx
//
// Contenu de la fenêtre « Schéma de séquence » : le parcours complet des e-mails de la cohorte
// sélectionnée dans « Gestion de séquence », sous forme de chaînes (une par séquence × segment)
// reliées par des flèches portant le délai entre deux étapes. Tant qu'aucune cohorte précise
// n'est choisie (« Toutes les cohortes »), la fenêtre reste dans son état vide d'origine : le
// logo Owner centré, en très faible opacité.
//
// Données réelles uniquement, dérivées par `useSequenceMail` (dataStore.js) — le même hook que
// « Gestion de séquence » — et regroupées par `buildSchemaChains` (schemaModel.js), qui reprend
// le découpage séquence/segment déjà utilisé pour afficher « Précédent »/« Suivant » dans le
// lecteur (neighborsOf, model.js). Ctrl/Cmd + clic (ou Entrée) sur une étape appelle
// `actions.openEmail`, exactement l'action qu'utilise la liste de « Gestion de séquence » pour
// ouvrir un e-mail : il n'existe qu'un seul mécanisme de sélection, partagé par les deux fenêtres
// via le store de module (store.js).

import { useCallback, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { SCHEMA_BACKGROUND, SCHEMA_COLORS, SCHEMA_BORDER, SCHEMA_TONES } from './schemaTheme';
import { actions, useSeqStore } from './store';
import { useSequenceMail } from './hooks';
import { ensureContent } from './dataStore';
import { PHASES, SEGMENTS, shortRelative } from './model';
import { fmtWhenShort } from './format';
import { buildSchemaChains } from './schemaModel';

const FAVICON_URL = `${import.meta.env.BASE_URL}favicon.png`;
const NODE_W = 236;

/** @brief État vide/chargement/erreur : le logo, très transparent, et un court message. */
function SchemaMessage({ tone = 'neutral', action, children }) {
  return (
    <div
      role="region"
      aria-label="Schéma de séquence"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 24,
        textAlign: 'center',
        overflow: 'hidden',
        background: SCHEMA_BACKGROUND,
      }}
    >
      <img
        src={FAVICON_URL}
        alt=""
        draggable={false}
        style={{
          width: 'clamp(72px, 24%, 160px)',
          height: 'auto',
          opacity: 0.2,
          border: 'none',
          outline: 'none',
          background: 'none',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
      <p
        style={{
          margin: 0,
          maxWidth: 320,
          fontSize: 13.5,
          lineHeight: 1.5,
          fontWeight: tone === 'danger' ? 600 : 400,
          color: tone === 'danger' ? '#a3260f' : SCHEMA_COLORS.muted,
        }}
      >
        {children}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: `1.5px solid ${SCHEMA_BORDER}`,
            background: '#fffaf2',
            color: SCHEMA_COLORS.text,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** @brief Une étape : sujet, phase/segment, moment d'envoi. Ctrl/Cmd + clic ou Entrée l'ouvre dans Gestion de séquence. */
function SchemaNode({ step, ordinal, total, isSelected, isOpen, onJump }) {
  const tone = SCHEMA_TONES[PHASES[step.phase]?.tone] ?? SCHEMA_TONES.grey;
  const phaseLabel = PHASES[step.phase]?.label ?? step.phase;
  const segmentLabel = step.segment ? SEGMENTS[step.segment] : null;
  const title = step.subject || (step.hasContent ? '(sans objet)' : step.kind);
  const t = step.timing;
  const when = t?.mode === 'calendar' ? fmtWhenShort(t.at) : shortRelative(t);

  const activate = useCallback(() => onJump(step.key), [onJump, step.key]);

  const ariaLabel = [
    `Étape ${ordinal} sur ${total}`,
    title,
    phaseLabel,
    segmentLabel,
    when,
    step.status?.label,
    'Ctrl ou Cmd + clic, ou Entrée, pour ouvrir dans Gestion de séquence',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <button
      type="button"
      data-email-key={step.key}
      aria-label={ariaLabel}
      aria-current={isSelected ? 'true' : undefined}
      title={`Ctrl/Cmd + clic (ou Entrée) : ouvrir « ${title} » dans Gestion de séquence`}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) activate();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        width: NODE_W,
        boxSizing: 'border-box',
        margin: 0,
        padding: '10px 12px',
        borderRadius: 10,
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        color: 'inherit',
        background: isSelected ? tone.bg : '#fffaf2',
        border: `1.5px solid ${isSelected ? tone.fg : tone.border}`,
        boxShadow: isSelected ? `0 0 0 3px ${tone.bg}` : 'none',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: tone.fg }}>
        <span style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 5, padding: '1px 6px' }}>
          {String(ordinal).padStart(2, '0')}/{total}
        </span>
        <span>{phaseLabel}</span>
        {segmentLabel && <span style={{ color: SCHEMA_COLORS.muted, fontWeight: 500 }}>· {segmentLabel}</span>}
        {isOpen && (
          <span
            aria-hidden
            title="Déjà ouvert dans Gestion de séquence"
            style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: tone.fg, flexShrink: 0 }}
          />
        )}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: SCHEMA_COLORS.text, lineHeight: 1.35 }}>{title}</span>
      {when && <span style={{ fontSize: 11.5, color: SCHEMA_COLORS.muted }}>{when}</span>}
    </button>
  );
}

/** @brief Flèche entre deux étapes d'une même chaîne, avec le délai (ou « délai variable » si non comparable). */
function SchemaConnector({ delay }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
      <span aria-hidden style={{ width: 2, height: 9, background: SCHEMA_BORDER, opacity: 0.5 }} />
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: SCHEMA_COLORS.text,
          background: SCHEMA_COLORS.subtle,
          border: `1px solid ${SCHEMA_BORDER}`,
          borderRadius: 999,
          padding: '2px 9px',
          margin: '2px 0',
          whiteSpace: 'nowrap',
        }}
        title={delay ? undefined : "Délai variable : dépend de la date d'inscription de chaque destinataire."}
      >
        {delay || 'délai variable'}
      </span>
      <span aria-hidden style={{ width: 2, height: 9, background: SCHEMA_BORDER, opacity: 0.5 }} />
      <ArrowDown aria-hidden size={13} style={{ color: SCHEMA_BORDER, marginTop: -3 }} />
    </div>
  );
}

/** @brief Une chaîne : son titre (séquence, segment éventuel) puis ses étapes, reliées sauf pour un envoi ponctuel. */
function SchemaChainColumn({ chain, selectedKey, openKeys, onJump }) {
  return (
    <div role="group" aria-label={`${chain.label}, ${chain.steps.length} e-mail${chain.steps.length > 1 ? 's' : ''}`} style={{ display: 'flex', flexDirection: 'column', width: NODE_W, flexShrink: 0 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: SCHEMA_COLORS.text,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: `2px solid ${SCHEMA_BORDER}`,
        }}
      >
        {chain.label} <span style={{ fontWeight: 500, color: SCHEMA_COLORS.muted, textTransform: 'none' }}>· {chain.steps.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: chain.connected ? 'column' : 'row', flexWrap: chain.connected ? 'nowrap' : 'wrap', gap: chain.connected ? 0 : 12 }}>
        {chain.steps.map((step, i) => (
          <div key={step.key} style={{ display: 'flex', flexDirection: 'column' }}>
            <SchemaNode
              step={step}
              ordinal={i + 1}
              total={chain.steps.length}
              isSelected={step.key === selectedKey}
              isOpen={openKeys.has(step.key)}
              onJump={onJump}
            />
            {chain.connected && i < chain.steps.length - 1 && <SchemaConnector delay={chain.gaps[i]} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** @brief Le schéma complet : toutes les chaînes de la cohorte, côte à côte, dans une zone qui défile. */
function SchemaCanvas({ cohort, chains, selectedKey, openKeys, onJump }) {
  return (
    <div
      role="region"
      aria-label={`Schéma de séquence : ${cohort.label}`}
      style={{ width: '100%', height: '100%', overflow: 'auto', background: SCHEMA_BACKGROUND, padding: 20, boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 28, minWidth: 'max-content' }}>
        {chains.map((chain) => (
          <SchemaChainColumn key={chain.id} chain={chain} selectedKey={selectedKey} openKeys={openKeys} onJump={onJump} />
        ))}
      </div>
    </div>
  );
}

/**
 * @param onOpenManager Ramène la fenêtre « Gestion de séquence » au premier plan (elles peuvent se
 *   recouvrir si l'une des deux a été déplacée) ; appelé juste avant d'y ouvrir l'e-mail visé.
 */
export default function SequenceSchema({ onOpenManager }) {
  const cohortId = useSeqStore((s) => s.cohortId);
  const selectedKey = useSeqStore((s) => s.selectedKey);
  const tabs = useSeqStore((s) => s.tabs);
  const floating = useSeqStore((s) => s.floating);

  const openKeys = useMemo(() => [...tabs, ...floating.map((f) => f.key)], [tabs, floating]);
  const openSet = useMemo(() => new Set(openKeys), [openKeys]);
  const { cohorts, emails, loadingContent, contentError } = useSequenceMail({ cohortId, openKeys });
  const cohort = cohortId === 'all' ? null : cohorts.find((c) => c.id === cohortId) ?? null;
  const chains = useMemo(() => buildSchemaChains(emails), [emails]);

  const jump = useCallback(
    (key) => {
      onOpenManager?.();
      actions.openEmail(key);
    },
    [onOpenManager]
  );

  if (!cohort) {
    return <SchemaMessage>Sélectionnez une cohorte dans « Gestion de séquence » pour afficher son schéma de séquence.</SchemaMessage>;
  }
  if (loadingContent) {
    return <SchemaMessage>Chargement du schéma de séquence…</SchemaMessage>;
  }
  if (contentError) {
    return (
      <SchemaMessage tone="danger" action={{ label: 'Réessayer', onClick: () => void ensureContent(cohortId, true) }}>
        Schéma indisponible : {contentError}
      </SchemaMessage>
    );
  }
  if (chains.length === 0) {
    return <SchemaMessage>Cette cohorte ne contient aucune séquence.</SchemaMessage>;
  }
  return <SchemaCanvas cohort={cohort} chains={chains} selectedKey={selectedKey} openKeys={openSet} onJump={jump} />;
}
