// ContactList.jsx — emails / téléphones multiples et typés de la fiche client.
//
// Source : GET /finance-periods/client/{id}/profile → profile.contacts, table
// `client_contact` PARTAGÉE avec le board Owner/Opti'Lex. Un email ajouté ici
// est aussi poussé dans l'email_history du board (fait côté backend) — la
// même liste des deux côtés, par construction.
//
// Chaque contact porte un TYPE (perso / pro / associé / comptable /
// facturation), matérialisé par un glyphe : c'est ce qui permet à l'équipe
// facturation de relancer la bonne adresse sans deviner.
//
// Le téléphone « hérité » : tant qu'aucun téléphone n'est en base, on montre
// celui que la fiche affichait déjà (jointure contrats → leads, volatile) avec
// un bouton pour l'enregistrer proprement. On n'invente rien, on récupère.

import React, { useState, useCallback } from 'react';
import {
  Mail, Phone, Home, Building2, Users, Calculator, Receipt, Tag,
  Plus, Star, Trash2, Check, X as XIcon, ChevronDown,
} from 'lucide-react';

import apiClient from '../../services/apiClient.js';
import { CONTACT_LABEL_OPTIONS } from './constants.js';
import { CopyButton } from './EditableCell.jsx';

const N = {
  sideBg:    '#f7f7f5',
  sideHover: '#efeeec',
  border:    '#e9e9e7',
  borderSft: '#f1f1ef',
  text:      '#37352f',
  textMuted: '#787774',
  textFaint: '#9b9a97',
  green:     '#0f7b6c',
  red:       '#b74133',
  redBg:     '#ffe2dd',
};

// Un glyphe par TYPE de contact — il dit à qui on s'adresse.
const LABEL_ICONS = {
  perso:       Home,
  pro:         Building2,
  associe:     Users,
  comptable:   Calculator,
  facturation: Receipt,
};
const LABEL_TEXT = Object.fromEntries(CONTACT_LABEL_OPTIONS.map((o) => [o.value, o.label]));

const KIND_META = {
  email: { Icon: Mail,  title: 'Emails',     placeholder: 'adresse@exemple.fr' },
  phone: { Icon: Phone, title: 'Téléphones', placeholder: '+33 6 12 34 56 78' },
};

export default function ContactList({
  clientId,
  kind,                 // 'email' | 'phone'
  contacts,             // profile.contacts (tous kinds — on filtre ici)
  inheritedValue,       // valeur héritée (volatile) affichée si rien en base
  canEdit,
  onChanged,            // () → refetch du profile côté parent
  onShowToast,
  onCopied,
}) {
  const meta = KIND_META[kind];
  const list = (contacts || []).filter((c) => c.kind === kind);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      onChanged?.();
      if (okMsg) onShowToast?.(okMsg, 'success');
    } catch (e) {
      onShowToast?.(e?.message || 'Erreur', 'error');
    } finally {
      setBusy(false);
    }
  }, [onChanged, onShowToast]);

  const addContact = useCallback((value, label, isPrimary) => call(
    () => apiClient.post(`/api/v1/finance-periods/client/${clientId}/contacts`, {
      kind, value, label: label || null, is_primary: isPrimary,
    }),
    'Contact ajouté',
  ), [call, clientId, kind]);

  const retype = useCallback((id, label) => call(
    () => apiClient.patch(`/api/v1/finance-periods/client/${clientId}/contacts/${id}`, { label }),
  ), [call, clientId]);

  const makePrimary = useCallback((id) => call(
    () => apiClient.patch(`/api/v1/finance-periods/client/${clientId}/contacts/${id}`, { is_primary: true }),
  ), [call, clientId]);

  const archive = useCallback((id) => call(
    () => apiClient.delete(`/api/v1/finance-periods/client/${clientId}/contacts/${id}`),
    'Contact retiré',
  ), [call, clientId]);

  const showInherited = kind === 'phone' && list.length === 0 && inheritedValue;

  return (
    <div style={{ padding: '6px 0', borderBottom: `1px solid ${N.borderSft}` }}>
      {/* En-tête de groupe : icône kind + titre + bouton + */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: list.length || showInherited || adding ? 6 : 0,
      }}>
        <meta.Icon size={13} style={{ color: N.textFaint, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: N.textMuted, flex: 1 }}>{meta.title}</span>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            title={`Ajouter un ${kind === 'email' ? 'email' : 'téléphone'}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: N.textFaint, fontSize: 12, padding: '2px 6px', borderRadius: 4,
              fontFamily: 'inherit', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = N.sideHover; e.currentTarget.style.color = N.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = N.textFaint; }}
          >
            <Plus size={12} /> Ajouter
          </button>
        )}
      </div>

      {/* Lignes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.map((c) => (
          <ContactRow
            key={c.id}
            contact={c}
            canEdit={canEdit}
            busy={busy}
            onRetype={(label) => retype(c.id, label)}
            onMakePrimary={() => makePrimary(c.id)}
            onArchive={() => archive(c.id)}
            onCopied={onCopied}
          />
        ))}

        {showInherited && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 8px', borderRadius: 4, fontSize: 13,
          }}>
            <span style={{ color: N.text }}>{inheritedValue}</span>
            <span style={{ fontSize: 11, color: N.textFaint, fontStyle: 'italic' }}>
              hérité de la fiche
            </span>
            <span style={{ flex: 1 }} />
            <CopyButton value={inheritedValue} onCopied={onCopied} size={12} />
            {canEdit && (
              <button
                type="button"
                disabled={busy}
                onClick={() => addContact(inheritedValue, null, true)}
                style={{
                  border: `1px solid ${N.border}`, background: 'transparent',
                  borderRadius: 4, cursor: 'pointer', color: N.textMuted,
                  fontSize: 11, padding: '2px 8px', fontFamily: 'inherit',
                }}
              >
                Enregistrer
              </button>
            )}
          </div>
        )}

        {!list.length && !showInherited && !adding && (
          <div style={{ fontSize: 12.5, color: '#c7c7c2', fontStyle: 'italic', padding: '2px 8px' }}>
            Aucun
          </div>
        )}

        {adding && (
          <AddForm
            kind={kind}
            placeholder={meta.placeholder}
            busy={busy}
            firstOfKind={list.length === 0}
            onCancel={() => setAdding(false)}
            onSubmit={async (value, label, isPrimary) => {
              await addContact(value, label, isPrimary);
              setAdding(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Une ligne contact ───────────────────────────────────────────────────────
function ContactRow({ contact, canEdit, busy, onRetype, onMakePrimary, onArchive, onCopied }) {
  const [typeOpen, setTypeOpen] = useState(false);
  const LabelIcon = LABEL_ICONS[contact.label] || Tag;

  return (
    <div
      className="tsf-copy-wrap"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 8px', borderRadius: 4,
        transition: 'background 0.12s', position: 'relative',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = N.sideBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Pastille TYPE : glyphe + libellé, cliquable pour retyper */}
      <button
        type="button"
        disabled={!canEdit || busy}
        onClick={() => canEdit && setTypeOpen((v) => !v)}
        title={canEdit ? 'Changer le type' : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          border: 'none', borderRadius: 4, padding: '2px 7px',
          background: contact.label ? '#eef1f6' : 'transparent',
          color: contact.label ? '#41496b' : N.textFaint,
          fontSize: 11, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default',
          fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        <LabelIcon size={11} />
        {contact.label ? LABEL_TEXT[contact.label] : 'Typer'}
        {canEdit && <ChevronDown size={10} style={{ opacity: 0.6 }} />}
      </button>

      {typeOpen && (
        <TypePicker
          current={contact.label}
          onPick={(label) => { setTypeOpen(false); onRetype(label); }}
          onClose={() => setTypeOpen(false)}
        />
      )}

      {/* Valeur */}
      <span style={{
        fontSize: 13, color: N.text, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {contact.value}
      </span>

      {/* Étoile = contact principal */}
      {contact.is_primary ? (
        <Star size={12} style={{ color: '#d9910d', fill: '#d9910d', flexShrink: 0 }} title="Contact principal" />
      ) : canEdit ? (
        <button
          type="button"
          disabled={busy}
          onClick={onMakePrimary}
          title="Définir comme principal"
          className="tsf-contact-hover"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: N.textFaint, padding: 2, display: 'inline-flex', flexShrink: 0,
          }}
        >
          <Star size={12} />
        </button>
      ) : null}

      <span style={{ flex: 1 }} />
      <CopyButton value={contact.value} onCopied={onCopied} size={12} />

      {canEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          title="Retirer ce contact"
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: N.textFaint, padding: 2, display: 'inline-flex', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = N.red; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = N.textFaint; }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

// ── Sélecteur de type (popover minimal) ─────────────────────────────────────
function TypePicker({ current, onPick, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 60 }}
      />
      <div style={{
        position: 'absolute', top: '100%', left: 0, zIndex: 61,
        marginTop: 4, minWidth: 160,
        background: '#fff', border: `1px solid ${N.border}`, borderRadius: 6,
        boxShadow: '0 8px 24px rgba(15,15,15,0.12)', padding: 4,
      }}>
        {CONTACT_LABEL_OPTIONS.map((o) => {
          const Icon = LABEL_ICONS[o.value] || Tag;
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onPick(o.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                border: 'none', background: active ? N.sideHover : 'transparent',
                borderRadius: 4, padding: '6px 8px', cursor: 'pointer',
                fontSize: 12.5, color: N.text, fontFamily: 'inherit', textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = N.sideBg; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = active ? N.sideHover : 'transparent'; }}
            >
              <Icon size={13} style={{ color: N.textMuted }} />
              {o.label}
              {active && <Check size={12} style={{ marginLeft: 'auto', color: N.green }} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Formulaire d'ajout inline ───────────────────────────────────────────────
function AddForm({ kind, placeholder, busy, firstOfKind, onCancel, onSubmit }) {
  const [value, setValue] = useState('');
  // Le premier contact d'un kind devient principal d'office : il n'y a pas de
  // choix à faire quand il n'y a qu'un candidat.
  const [isPrimary, setIsPrimary] = useState(firstOfKind);
  const [label, setLabel] = useState(null);
  const canSubmit = value.trim().length > 3 && !busy;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '6px 8px', background: N.sideBg, borderRadius: 6,
    }}>
      <input
        autoFocus
        type={kind === 'email' ? 'email' : 'tel'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) onSubmit(value.trim(), label, isPrimary);
          if (e.key === 'Escape') onCancel();
        }}
        style={{
          flex: 1, minWidth: 160, border: `1px solid ${N.border}`,
          borderRadius: 4, padding: '5px 8px', fontSize: 13,
          fontFamily: 'inherit', outline: 'none', background: '#fff',
        }}
      />

      {/* Type en pills — un clic, pas de dropdown à ouvrir pour 5 options */}
      <div style={{ display: 'flex', gap: 3 }}>
        {CONTACT_LABEL_OPTIONS.map((o) => {
          const Icon = LABEL_ICONS[o.value] || Tag;
          const active = label === o.value;
          return (
            <button
              key={o.value}
              type="button"
              title={o.label}
              onClick={() => setLabel(active ? null : o.value)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 26, height: 26, borderRadius: 5,
                border: `1px solid ${active ? '#41496b' : N.border}`,
                background: active ? '#eef1f6' : '#fff',
                color: active ? '#41496b' : N.textFaint, cursor: 'pointer',
              }}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>

      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11.5, color: N.textMuted, cursor: 'pointer', userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          style={{ accentColor: '#41496b' }}
        />
        Principal
      </label>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit(value.trim(), label, isPrimary)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          border: 'none', borderRadius: 4, padding: '5px 10px',
          background: canSubmit ? N.green : '#d5d5d2', color: '#fff',
          fontSize: 12, fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default',
          fontFamily: 'inherit',
        }}
      >
        <Check size={12} /> Ajouter
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: N.textFaint, padding: 4, display: 'inline-flex',
        }}
      >
        <XIcon size={13} />
      </button>
    </div>
  );
}
