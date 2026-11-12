import SalePaymentMode from '../components/SalePaymentMode';
import { ContractFolders } from '../components/BoardClientFiles.jsx';
import { createLiveListener } from "../utils/liveDictation.js";
import { revealInRail } from "../utils/tabRail.js";
import LeadContactRows, { ContactsToggle, PriorityTag } from '../components/leadContacts/LeadContacts.jsx';
import LeadTransfer, { TransferTag } from '../components/leadTransfer/LeadTransfer.jsx';
import {canRescheduleAfterSale, onboardingDateOf, onboardingAwaitingConfirmation} from '../utils/saleRescheduling';
import OnboardingReschedule from '../components/integrationPreview/OnboardingReschedule';
import { generateSavedNda } from '../contracts/ndaGeneration.js';
import { ndaRepresentatives, emptyRepresentative } from '../contracts/representatives.js';
import SaleReservation from '../components/integrationPreview/SaleReservation';
import { fetchContractsOfLead, contractSentLine } from '../utils/leadContracts.js';
import { isTypingTarget } from '../utils/typingTarget.js';
import { AbsenceDialog } from "../components/absences/AbsencePanel";
import InternalCalendar from "../components/calendar/InternalCalendar";
import {hasGuidedSalesJourney} from '../utils/guidedSalesJourney';
import FrenchDateInput from '../components/salesJourney/FrenchDateInput';
import {parisToday,parisParts,minuteOptions} from '../utils/parisDates';
import React, { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import LeadSmsActions from "../components/LeadSmsActions";
import { CalendarCheck2, ChevronRight, TriangleAlert, Check, X, Building2, UserRoundCheck, ArrowRight, PhoneCall, UserSearch, ListChecks, SlidersHorizontal, Funnel, ChartNoAxesCombined } from 'lucide-react';
import SalesProspection from "../components/setter/prospection/SalesProspection.jsx";
import { isMobilePhone } from "../components/setter/prospection/mobilePhones.js";
import R1QualificationDialog from '../components/salesJourney/R1QualificationDialog';
import DailyQualificationDeck from '../components/salesJourney/DailyQualificationDeck';
import { ownRdvsToQualify, viewedSheet } from '../utils/dailyQualification';
import QualificationDialog, { RESULTS as QUALIFICATION_RESULTS } from '../components/salesJourney/QualificationDialog';
import ContactQualificationDialog from '../components/salesJourney/ContactQualificationDialog';
import {contactQualificationPatch, recallInPast, recallNote, recallWhen, recallRuleNote, CALLBACK_NOTE_MAX, CALLBACK_RULE_HELP} from '../utils/contactQualification';
import NotesDialog from '../components/salesJourney/NotesDialog';
import { SaleIntake, SaleDocuments } from "../components/integrationPreview/SaleIntake";
import PortalAccess from '../components/salesJourney/PortalAccess';
import LeadDocuments from '../components/salesJourney/LeadDocuments';
import NdaProgress from '../components/salesJourney/NdaProgress';
import SalesNotes, { SalesNotesView } from '../components/salesJourney/SalesNotes';
import { qualificationPatch } from '../utils/r2Qualification';
import { presentContractError } from "../utils/contractErrors";
import { IntegrationRollout, IntegrationButton, IntegrationDialog, SalesJourneySteps } from "../components/integrationPreview/TrackingIntegration";
import { leadAvatar } from "../utils/leadAvatar";
import { originDisplay } from "../utils/sectors";
import { supabase } from "../lib/supabaseClient";
import SharedNavbar from "../components/SharedNavbar.jsx";
import SheetSidebar from "../components/shared/Sidebar/SheetSidebar.jsx";
import SidebarAvailability from "../components/shared/Sidebar/SidebarAvailability.jsx";
import LeadsManagement from "./LeadsManagement.jsx";
import PerfSalesTable from "../components/PerfSalesTable.jsx";
import CommonVoicemailPool from "../components/CommonVoicemailPool.jsx";
import ReproLinkRow from "../components/booking/ReproLinkRow.jsx";
import BookingSettings from "../components/booking/BookingSettings.jsx";
import MyWeeklyBilan from "../components/MyWeeklyBilan.jsx";
import SalesPreferences from "../components/salesPreferences/SalesPreferences.jsx";
import "../index.css";

// ── SIDEBAR ICONS ────────────────────────────────────────────────────────────
import iconMyLead from "../assets/global.png";
import iconPlus from "../assets/plus.png";
import iconEmail from "../assets/email.png";
import iconEmailDetail from "../assets/eamail.svg";
import iconScalier from "../assets/scalier.svg";
import iconQualLead from "../assets/Lead.svg";
import iconQualQualifie from "../assets/qualifié.svg";
import iconQualProposition from "../assets/proposition.svg";
import iconQualNegociation from "../assets/négociation.svg";
import iconQualGagne from "../assets/gagné.svg";
import iconQualPerdu from "../assets/perdu.svg";
import iconQualSansSuite from "../assets/Sans suite.svg";
import iconPrio from "../assets/prio.svg";
import iconPrioHigh from "../assets/high.svg";
import iconPrioMedium from "../assets/medium.svg";
import iconPrioLow from "../assets/low.svg";
import iconCampaigns from "../assets/tar.png";
import iconCalendrier from "../assets/calendrier.png";
import iconSheets from "../assets/files.png";
import iconBuilding from "../assets/building.svg";
import campaignImg1 from "../assets/audit-document.jpg";
import campaignImg2 from "../assets/charges-fatales-2.png";
import rabbitIcon from "../assets/lapin.png";
import completedIcon from "../assets/completed.png";
import meetIcon from "../assets/meet.png";
import mynoteIcon from "../assets/mynote.svg";
import iconFuse from "../assets/Fuse.svg";
const FunnelLeads = React.lazy(() => import("./FunnelLeads/index.jsx"));
const MonitoringPerf = React.lazy(() => import("./MonitoringPerf.jsx"));
import CeoSalesRecordingsView from "./CeoSalesRecordingsView.jsx";
import iconMessage from "../assets/message.svg";
import iconSiren from "../assets/siren2.svg";
import { useLeadCreative, CreativeButton, CreativePopup } from "../components/CreativePopup.jsx";
import iconCreaActive from "../assets/metaads.png";
import iconCreaEmpty from "../assets/metagris.png";

// ── SIREN HELPERS (consumed from contracts/schemas.js, do not modify there) ──
import { normalizeSiren, isValidSiren, formatSiren } from "../contracts/schemas.js";

// ── CATEGORIES ────────────────────────────────────────────────────────────────
// ── PARIS WALL-CLOCK PICKER (French date, exact stored hour/minute) ────
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = minuteOptions();
function DateTimePicker({ value, onChange, color = '#3b82f6', C, darkMode, autoSave = false, floating = false }) {
  const [localDate, setLocalDate] = useState(value ? value.slice(0, 10) : '');
  const [localHour, setLocalHour] = useState(value ? value.slice(11, 13) : '09');
  const [localMin, setLocalMin] = useState(() => {
    const m = value ? value.slice(14, 16) : '00';
    return m;
  });
  // Sync from parent when value changes externally (polling, etc.)
  useEffect(() => {
    if (value) { setLocalDate(value.slice(0, 10)); setLocalHour(value.slice(11, 13)); const m = value.slice(14, 16); setLocalMin(m); }
  }, [value]);
  const currentFull = localDate + 'T' + localHour + ':' + localMin;
  const hasChanged = value && currentFull !== (value.slice(0, 16));
  const isNew = !value || value.length < 10;
  const confirm = () => { if (localDate) onChange(currentFull); };
  const selectStyle = {
    padding: '7px 8px', borderRadius: 8, border: `1px solid ${C.border}`,
    background: darkMode ? C.subtle : '#faf9f7', color: C.text,
    fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
    appearance: 'none', textAlign: 'center', minWidth: 52,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='${darkMode ? '%235e6273' : '%239ca3af'}' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center', paddingRight: 20,
  };
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <FrenchDateInput aria-label="Date du rendez-vous" floating={floating} value={localDate} onChange={(date) => { setLocalDate(date); if ((isNew || autoSave) && date) onChange(date + 'T' + localHour + ':' + localMin); }}
        style={{
          width: 136, flexShrink: 0, padding: '6px 4px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: darkMode ? C.subtle : '#faf9f7', color: C.text,
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
        }}
      />
      <select value={localHour} onChange={(e) => { setLocalHour(e.target.value); if (isNew || autoSave) onChange(localDate + 'T' + e.target.value + ':' + localMin); }} style={{ ...selectStyle, minWidth: 44, fontSize: 12, padding: '6px 6px 6px 6px', paddingRight: 18 }}>
        {HOURS.map(h => <option key={h} value={h}>{h}h</option>)}
      </select>
      <span style={{ color: C.muted, fontSize: 11, fontWeight: 500 }}>:</span>
      <select value={localMin} onChange={(e) => { setLocalMin(e.target.value); if (isNew || autoSave) onChange(localDate + 'T' + localHour + ':' + e.target.value); }} style={{ ...selectStyle, minWidth: 44, fontSize: 12, padding: '6px 6px 6px 6px', paddingRight: 18 }}>
        {minuteOptions(localMin).map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      {hasChanged && !autoSave && (
        <button onClick={confirm} style={{
          width: 26, height: 26, borderRadius: 6, border: 'none',
          background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'transform 0.15s',
          animation: 'solarFadeIn 0.2s ease both',
        }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        ><Check size={14} strokeWidth={2.2} aria-hidden="true" /></button>
      )}
    </div>
  );
}

// Choix du jour et de l'heure d'un rendez-vous (12/11/2026 : la liste déroulante de 24 heures « ne facilite pas la mise
// en place d'un rendez-vous »). Tout se choisit d'un clic : les sept prochains jours en pastilles (une autre date par le
// calendrier), les heures de bureau en grille, les quarts d'heure en dessous. La phrase du haut redit le rendez-vous
// tel qu'il sera enregistré. Les heures et minutes inhabituelles restent accessibles (« Autres heures », « Par 5 min »).
function RdvEditor({ value, onChange, C, darkMode }) {
  const today = parisToday();
  const date = (value || '').slice(0, 10) || today;
  const hour = (value || '').slice(11, 13) || '09';
  const minute = (value || '').slice(14, 16) || '00';
  const [allHours, setAllHours] = useState(() => Number(hour) < 8 || Number(hour) > 19);
  const [allMinutes, setAllMinutes] = useState(() => !['00', '15', '30', '45'].includes(minute));
  const set = (d, h, m) => onChange(`${d}T${h}:${m}`);
  const pad = (n) => String(n).padStart(2, '0');
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + i);
    return { iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, week: i === 0 ? 'auj.' : d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''), num: d.getDate(), weekend: [0, 6].includes(d.getDay()) };
  });
  const hours = allHours ? HOURS : HOURS.slice(8, 20);
  const minutes = allMinutes ? minuteOptions(minute) : ['00', '15', '30', '45'];
  const ink = darkMode ? '#ededed' : '#2b2927';
  const onInk = darkMode ? '#141414' : '#ffffff';
  const pill = (on, extra = {}) => ({ padding: '7px 0', borderRadius: 10, border: `1px solid ${on ? ink : C.border}`, background: on ? ink : C.bg, color: on ? onInk : C.text,
    fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', textAlign: 'center', minWidth: 0,
    transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', ...extra });
  const label = { fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: darkMode ? C.muted : '#a8a39b' };
  const link = { border: 'none', background: 'transparent', padding: 0, color: C.muted, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 };
  const press = { onMouseDown: (e) => { e.currentTarget.style.transform = 'scale(0.95)'; }, onMouseUp: (e) => { e.currentTarget.style.transform = 'none'; }, onMouseLeave: (e) => { e.currentTarget.style.transform = 'none'; } };
  const spoken = new Date(`${date}T12:00:00`);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, letterSpacing: '-0.01em' }} aria-live="polite">
        {Number.isNaN(spoken.getTime()) ? 'Choisissez un jour' : spoken.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        <span style={{ color: C.secondary, fontWeight: 400 }}> à {hour}h{minute}</span>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={label}>Jour</span>
          <span style={{ display: 'inline-flex', width: 132, flex: 'none' }} title="Choisir une autre date">
            <FrenchDateInput aria-label="Autre date" floating value={date} onChange={(d) => { if (d) set(d, hour, minute); }}
              style={{ width: 132, flexShrink: 0, padding: '5px 4px 5px 8px', borderRadius: 9, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', outline: 'none' }} />
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
          {days.map((d) => {
            const on = d.iso === date;
            return (
              <button key={d.iso} type="button" aria-pressed={on} onClick={() => set(d.iso, hour, minute)} {...press}
                style={pill(on, { padding: '5px 0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, opacity: d.weekend && !on ? 0.55 : 1 })}>
                <span style={{ fontSize: 10, fontWeight: 400, color: on ? onInk : C.muted }}>{d.week}</span>
                <span style={{ fontSize: 13 }}>{d.num}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={label}>Heure</span>
          <button type="button" style={link} onClick={() => setAllHours(v => !v)}>{allHours ? 'Heures de bureau' : 'Autres heures'}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
          {hours.map((h) => <button key={h} type="button" aria-pressed={h === hour} onClick={() => set(date, h, minute)} {...press} style={pill(h === hour)}>{h}h</button>)}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={label}>Minutes</span>
          <button type="button" style={link} onClick={() => setAllMinutes(v => !v)}>{allMinutes ? 'Par quart d’heure' : 'Par 5 min'}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${allMinutes ? 6 : 4}, minmax(0, 1fr))`, gap: 4 }}>
          {minutes.map((m) => <button key={m} type="button" aria-pressed={m === minute} onClick={() => set(date, hour, m)} {...press} style={pill(m === minute)}>{m}</button>)}
        </div>
      </div>
    </div>
  );
}

// Les rendez-vous dans la fiche, en frise (11/11/2026, d'après la référence « Timeline » du dev : un fil vertical, un point
// par étape, le prochain rendez-vous en point plein sur une ligne légèrement teintée, les passés en retrait). Au repos la
// ligne se lit (étape, jour en toutes lettres, heure, « demain » ou « il y a 3 j ») ; un clic la déplie sur le sélecteur de
// date (calendrier flottant, jamais rogné), et la date ne change qu'au clic sur « Enregistrer ».
function rdvDays(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const now = new Date();
  return Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}
function RdvRow({ label, value, onChange, C, darkMode, first, last, next }) {
  const [open, setOpen] = useState(false);
  // Brouillon : la date ne change qu'au clic sur « Enregistrer » (avant : une petite coche qui pouvait sortir du cadre).
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!open) setDraft(value); }, [value, open]);
  const days = rdvDays(value);
  const valid = days != null;
  const day = valid ? new Date(value).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date à poser';
  const time = valid ? `${value.slice(11, 13)}h${value.slice(14, 16)}` : '';
  const past = valid && days < 0;
  const rail = darkMode ? '#3a3a3a' : '#ddd8d0';
  const ink = darkMode ? '#ededed' : '#2b2927';
  const lit = next || open;
  const changed = !!draft && draft.slice(0, 16) !== (value || '').slice(0, 16);
  // « aujourd'hui » et « demain » en étiquette pastel, le reste en texte discret.
  const soon = days === 0 ? ['aujourd’hui', darkMode ? ['rgba(16,185,129,.14)', '#7cc49b', 'rgba(16,185,129,.25)'] : ['#e2f6ea', '#0b7a4b', '#c3ebd3']]
    : days === 1 ? ['demain', darkMode ? ['rgba(245,200,66,.14)', '#e8d49a', 'rgba(245,200,66,.25)'] : ['#fbf1c2', '#7a5a05', '#f0e09a']] : null;
  const when = !valid || soon ? '' : days === -1 ? 'hier' : days > 0 ? `dans ${days} j` : `il y a ${-days} j`;
  const save = () => { if (changed) onChange(draft); setOpen(false); };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', columnGap: 6 }}>
      {/* Le fil et son point : plein et sombre pour le prochain rendez-vous, creux pour ceux à venir, effacé pour les passés. */}
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 8, top: first ? 19 : 0, bottom: last ? 'calc(100% - 19px)' : 0, width: 1, background: rail }} />
        <span style={{ position: 'absolute', left: next ? 4 : 5, top: next ? 14 : 15, width: next ? 9 : 7, height: next ? 9 : 7, borderRadius: '50%', boxSizing: 'border-box',
          background: next ? ink : past ? rail : C.bg, border: next || past ? 'none' : `1.5px solid ${darkMode ? '#a3a3a3' : '#8b867e'}`,
          boxShadow: next ? `0 0 0 3px ${darkMode ? 'rgba(255,255,255,0.10)' : 'rgba(43,41,39,0.10)'}` : `0 0 0 3px ${C.bg}`,
          transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
      <div style={{ minWidth: 0, borderRadius: 12, background: lit ? (darkMode ? '#262626' : '#f4f2ee') : 'transparent', transition: 'background 0.2s ease', marginBottom: last ? 0 : 2 }}>
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} title={open ? 'Refermer' : `Changer la date du ${label}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px', border: 'none', borderRadius: 12, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'background 0.15s ease' }}
          onMouseEnter={(e) => { if (!lit) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : '#f7f5f2'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: past ? C.muted : C.text, flexShrink: 0 }}>{label}</span>
          <span style={{ minWidth: 0, fontSize: 13, color: past ? C.muted : C.secondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
            {day}{time && ` à ${time}`}
          </span>
          {soon && <span style={{ marginLeft: 'auto', padding: '1px 7px', borderRadius: 7, border: `1px solid ${soon[1][2]}`, background: soon[1][0], color: soon[1][1], fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>{soon[0]}</span>}
          {when && <span style={{ marginLeft: 'auto', paddingLeft: 6, fontSize: 11.5, color: C.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>{when}</span>}
        </button>
        <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s cubic-bezier(0.4,0,0.2,1)' }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ padding: '4px 10px 10px' }}>
              {open && <RdvEditor value={draft} onChange={setDraft} C={C} darkMode={darkMode} />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <span style={{ marginRight: 'auto', fontSize: 11, color: C.muted }}>{changed ? 'Nouvelle date à enregistrer' : 'Heure de Paris'}</span>
                <button type="button" onClick={() => { setDraft(value); setOpen(false); }}
                  style={{ padding: '6px 11px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.secondary, fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>Annuler</button>
                <button type="button" onClick={save} disabled={!changed}
                  style={{ padding: '6px 12px', borderRadius: 9, border: 'none', background: ink, color: darkMode ? '#141414' : '#ffffff', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                    cursor: changed ? 'pointer' : 'default', opacity: changed ? 1 : 0.4, transition: 'opacity 0.2s ease' }}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSelect({ value, onChange, C, darkMode }) {
  const h = (value || '09:00').slice(0, 2);
  const m = (value || '09:00').slice(3, 5);
  const roundedM = m;
  const ss = { padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', appearance: 'none', paddingRight: 22, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='${darkMode ? '%235e6273' : '%239ca3af'}' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' };
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <select value={h} onChange={(e) => onChange(e.target.value + ':' + roundedM)} style={{ ...ss, width: 58 }}>
        {HOURS.map(hr => <option key={hr} value={hr}>{hr}h</option>)}
      </select>
      <span style={{ color: C.muted, fontSize: 11, fontWeight: 500 }}>:</span>
      <select value={roundedM} onChange={(e) => onChange(h + ':' + e.target.value)} style={{ ...ss, width: 58 }}>
        {minuteOptions(roundedM).map(mi => <option key={mi} value={mi}>{mi}</option>)}
      </select>
    </div>
  );
}

// ── SLOT PICKER (créneaux libres freebusy 8h-18h) pour RDV Onboarding/Lancement ──
function SaleSlotPicker({ kind, value, onChange, C, darkMode, band, readOnly = false, slotsPath }) {
  const accent = C.accent || '#2563eb';
  const _pad = (n) => String(n).padStart(2, '0');
  const _ymd = (yy, mm, dd) => `${yy}-${_pad(mm + 1)}-${_pad(dd)}`;
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const WD = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];
  const WD_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

  const _today = new Date(); _today.setHours(0, 0, 0, 0);
  const curMonthKey = _today.getFullYear() * 12 + _today.getMonth();
  const _initMonth = () => {
    if (value) { const d = new Date(value.slice(0, 10) + 'T00:00:00'); return new Date(d.getFullYear(), d.getMonth(), 1); }
    return new Date(_today.getFullYear(), _today.getMonth(), 1);
  };

  const [viewMonth, setViewMonth] = useState(_initMonth);
  const [data, setData] = useState({ days: [] });
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(value ? value.slice(0, 10) : null);
  // À l'ouverture seulement : si le premier créneau libre tombe dans un mois suivant, le
  // calendrier s'y place (sinon il reste sur un mois sans aucun jour cliquable). Ensuite,
  // la navigation du commercial n'est plus jamais forcée.
  const autoMonthDone = useRef(!!value);
  const slotListRef = useRef(null);

  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const leading = new Date(y, m, 1).getDay(); // 0 = dimanche
  const monthKey = y * 12 + m;
  const canGoPrev = monthKey > curMonthKey;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // band (tranche salariale) route le Lancement vers H. Moraru si 20+ salariés ->
    // on lit les dispos du BON agenda. Onboarding = créneaux 50 min avec dispo CROISÉE
    // animateur + facturation sur les 15 dernières min (géré côté backend) ; chaque créneau
    // libre porte le prénom de l'animateur (`host`), montré par sa photo (`host_photos`) pour information.
    const bandParam = band ? `&band=${encodeURIComponent(band)}` : '';
    apiClient.get(`${slotsPath || "/api/v1/tracking/sale-slots"}?kind=${kind}&start=${_ymd(y, m, 1)}&days=${daysInMonth}${bandParam}`)
      .then(r => {
        if (!alive) return;
        const days = (r && r.days) || [];
        setData({ days, slotMinutes: (r && r.slot_minutes) || null, hostPhotos: (r && r.host_photos) || {} });
        setSelectedDay(prev => {
          if (prev && days.some(d => d.date === prev)) return prev;
          if (value && days.some(d => d.date === value.slice(0, 10))) return value.slice(0, 10);
          return days.length ? days[0].date : null;
        });
        if (!autoMonthDone.current) {
          autoMonthDone.current = true;
          const first = days.length ? days[0].date : null;
          if (first && first.slice(0, 7) !== _ymd(y, m, 1).slice(0, 7)) {
            setViewMonth(new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1));
          }
        }
      })
      .catch(() => { if (alive) setData({ days: [] }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind, monthKey, band, slotsPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const daysMap = {};
  (data.days || []).forEach(d => { daysMap[d.date] = d.slots; });
  const selectedSlots = selectedDay ? (daysMap[selectedDay] || []) : [];
  const valDay = value ? value.slice(0, 10) : null;
  const valTime = value ? value.slice(11, 16) : null;

  // La liste commence à 8h : sans défilement, un premier créneau libre l'après-midi reste
  // caché sous les créneaux barrés et le jour paraît complet. On amène en vue le créneau
  // choisi, sinon le premier créneau libre du jour (dans la liste seule, sans bouger la page).
  const scrollTarget = (() => {
    if (valDay === selectedDay && selectedSlots.some(s => s.t === valTime)) return valTime;
    const firstFree = selectedSlots.find(s => s.free);
    return firstFree ? firstFree.t : null;
  })();
  useEffect(() => {
    const list = slotListRef.current;
    if (loading || !list || !scrollTarget) return;
    const target = list.querySelector(`[data-slot="${scrollTarget}"]`);
    if (target) list.scrollTop = Math.max(0, target.offsetTop - 6);
  }, [selectedDay, scrollTarget, loading]);
  let selLabel = '';
  if (selectedDay) { const sd = new Date(selectedDay + 'T00:00:00'); selLabel = `${WD_SHORT[sd.getDay()]} ${sd.getDate()}`; }

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const navBtn = (enabled) => ({ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent',
    color: enabled ? C.text : (darkMode ? '#3a3a3a' : '#cbd2e0'), cursor: enabled ? 'pointer' : 'default', fontSize: 15, fontFamily: 'inherit',
    display: 'flex', alignItems: 'center', justifyContent: 'center' });

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Calendrier mensuel */}
      <div style={{ flex: 1.7, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{MONTHS[m]} <span style={{ color: C.muted, fontWeight: 500 }}>{y}</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => canGoPrev && setViewMonth(new Date(y, m - 1, 1))} disabled={!canGoPrev} style={navBtn(canGoPrev)}>‹</button>
            <button onClick={() => setViewMonth(new Date(y, m + 1, 1))} style={navBtn(true)}>›</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {WD.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 500, color: C.muted, padding: '4px 0' }}>{w}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, idx) => {
            if (day === null) return <div key={'e' + idx} />;
            const ymd = _ymd(y, m, day);
            const clickable = !!daysMap[ymd];
            const selected = selectedDay === ymd;
            return (
              <button key={ymd} onClick={() => clickable && setSelectedDay(ymd)} disabled={!clickable}
                style={{ padding: '9px 0', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 14,
                  fontWeight: 500, cursor: clickable ? 'pointer' : 'default',
                  background: selected ? accent : (clickable ? (darkMode ? '#262626' : '#f4f2ee') : 'transparent'),
                  color: selected ? (C.onAccent || '#fff') : (clickable ? C.text : (darkMode ? '#3a3a3a' : '#c9c4bc')),
                  transition: 'all 0.12s' }}>{day}</button>
            );
          })}
        </div>
      </div>

      {/* Liste des créneaux du jour (occupés grisés/barrés) */}
      <div style={{ width: 148, borderLeft: `1px solid ${C.border}`, paddingLeft: 16, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 2 }}>{selLabel || '—'}</div>
        {data.slotMinutes ? <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Créneaux de {data.slotMinutes} min</div> : <div style={{ marginBottom: 8 }} />}
        <div ref={slotListRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
          {loading ? (
            <div style={{ color: C.muted, fontSize: 12, padding: '24px 0', textAlign: 'center' }}>…</div>
          ) : !selectedDay ? (
            <div style={{ color: C.muted, fontSize: 12, padding: '24px 0', textAlign: 'center' }}>Aucun créneau ce mois</div>
          ) : selectedSlots.map((s, idx) => {
            const sel = valDay === selectedDay && valTime === s.t;
            const host = s.free ? s.host : null;
            const photo = host && (data.hostPhotos || {})[host];
            return (
              <button key={s.t} data-slot={s.t} onClick={() => !readOnly && s.free && onChange(selectedDay + 'T' + s.t)} disabled={!s.free || readOnly}
                title={host || undefined}
                style={{ padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums',
                  cursor: s.free && !readOnly ? 'pointer' : 'default',
                  border: `1px solid ${sel ? accent : (s.free ? C.border : 'transparent')}`,
                  background: sel ? accent : (s.free ? C.bg : (darkMode ? 'rgba(255,255,255,0.02)' : '#f7f5f2')),
                  color: sel ? (C.onAccent || '#fff') : (s.free ? C.text : (darkMode ? '#4a4a4a' : '#c9c4bc')),
                  textDecoration: s.free ? 'none' : 'line-through',
                  animation: 'solarFadeIn 0.2s ease both', animationDelay: `${Math.min(idx * 0.012, 0.25)}s`, transition: 'all 0.12s' }}>
                {s.t}
                {/* Animateur de l'onboarding : sa photo, sinon son prénom (marges négatives = hauteur de ligne inchangée). */}
                {photo ? (
                  <img src={photo} alt={host} draggable={false}
                    style={{ width: 22, height: 22, margin: '-4px 0 -4px 8px', verticalAlign: 'middle', borderRadius: '50%', objectFit: 'cover',
                      boxShadow: sel ? '0 0 0 1.5px #fff' : 'none' }} />
                ) : host && (
                  <span style={{ marginLeft: 6, fontSize: 11.5, fontWeight: 500, color: sel ? 'rgba(255,255,255,0.72)' : C.muted }}>{host}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CATEGORIES = [
  { key: "new",          label: "Nouveaux leads",  color: "#6366f1", dotColor: "#b9b5ee", softBg: "#f0f1fb", softBgDark: "rgba(99,102,241,0.18)",  softText: "#7578c4", description: "Leads assignés, pas encore contactés" },
  { key: "r1",           label: "R1 Placés",       color: "#3b82f6", softBg: "#edf4fc", softBgDark: "rgba(59,130,246,0.18)",  softText: "#6a9fd8", description: "Premier rendez-vous programmé" },
  { key: "r2",           label: "R2 Placés",       color: "#fb923c", softBg: "#fdf3eb", softBgDark: "rgba(251,146,60,0.18)",  softText: "#c48a5a", description: "Rendez-vous audit programmé" },
  { key: "r3",           label: "R3 Placés",       color: "#8b5cf6", softBg: "#f3f0ff", softBgDark: "rgba(139,92,246,0.18)",  softText: "#9b8ac4", description: "Rendez-vous suivi programmé" },
  { key: "callback",     label: "À rappeler",      color: "#a8a39b", softBg: "#f4f2ee", softBgDark: "rgba(148,163,184,0.18)", softText: "#8993a4", description: "Prospect souhaite être rappelé" },
  { key: "voicemail",    label: "Répondeurs",      color: "#8b867e", softBg: "#f1eee9", softBgDark: "rgba(100,116,139,0.18)", softText: "#7a8594", description: "Pas de réponse" },
  { key: "not_relevant", label: "Non-pertinents",  color: "#f87171", softBg: "#fceeed", softBgDark: "rgba(248,113,113,0.18)", softText: "#c47272", description: "Non qualifiés ou pas intéressés" },
  { key: "to_recontact", label: "À relancer",      color: "#14b8a6", softBg: "#e6faf6", softBgDark: "rgba(20,184,166,0.18)",  softText: "#0f9b8e", description: "Pas pour nous maintenant, à recontacter plus tard" },
  { key: "signed",       label: "Signés",          color: "#34d399", softBg: "#edfbf3", softBgDark: "rgba(52,211,153,0.18)",  softText: "#5ab896", description: "Clients signés" },
];

// ── TODAY (for dynamic notifications in demo) ────────────────────────────────
const TODAY = parisToday();

// ── STATUS MAPPING (extra statuses → closest tab) ───────────────────────────
const EXTRA_STATUS_MAP = {
  not_interested: 'not_relevant',
  not_reached: 'voicemail',
  wrong_number: 'not_relevant',
  long_term: 'callback',
};

// ── DATE/TIME HELPERS ─────────────────────────────────────────────────────────
// Backend now returns ISO timestamps (e.g. "2026-03-11T14:00:00+00:00")
// datetime-local inputs need "YYYY-MM-DDTHH:MM" format (no timezone suffix)
const toDatetimeLocal = (val) => {
  if (!val) return '';
  if (val.length === 10) return val + 'T09:00'; // date-only → default 9am
  return val.slice(0, 16); // trim seconds + timezone
};
// Libellé court d'un RDV à partir du wall-clock naïf (aucune conversion tz) : "09/07/2026 à 14:00".
const fmtRdvLabel = (val) => { const s = toDatetimeLocal(val); return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} à ${s.slice(11, 16)}` : ''; };
const toDateOnly = (val) => {
  if (!val) return '';
  return val.slice(0, 10);
};
// Format Notion-like pour le timestamp de derniere modification d'une note.
// "aujourd'hui a 14h56" / "hier a 14h56" / "lundi a 14h56" / "le 3 juin a 14h56".
const formatNoteDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const parts=parisParts(d);
  const now=new Date();
  const time=`${parts.hour}h${parts.minute}`;
  if(parisToday(d)===parisToday(now))return `aujourd’hui à ${time}`;
  return `le ${new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'numeric',month:'short',year:'numeric'}).format(d)} à ${time}`;
};
const formatDateTimeFR = (val) => {
  if (!val) return '';
  const d = val.slice(0, 10).split('-');
  const t = val.length > 10 ? val.slice(11, 16) : null;
  const date = `${d[2]}/${d[1]}`;
  return t && t !== '00:00' ? `${date} à ${t.replace(':', 'h')}` : date;
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const EMPLOYEE_RANGES = [
  '1-2', '3-5', '6-10', '11-19', '20-29',
  '30-39', '40-49', '50-74', '75-99', '100-149',
  '150-199', '200-249', '250-299', '300-349', '350-400'
];

// Les animateurs d'onboarding du moment, tels que le serveur les donne avec les réglages d'agenda (dev 12/11/2026 :
// « que ce soit automatique »). Aucun prénom n'est écrit dans cette page ; sans liste (serveur plus ancien), les
// phrases se disent sans prénom.
const onboardingHostNames = (hosts) => (Array.isArray(hosts) ? hosts : []).map(name => String(name || '').trim()).filter(Boolean);
// « A ou B » : qui anime un onboarding.
function onboardingHostsChoice(hosts) {
  const names = onboardingHostNames(hosts);
  if (!names.length) return 'L’équipe d’onboarding';
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} ou ${names[names.length - 1]}`;
}
// « Voir les créneaux de A et B ».
function onboardingHostsLabel(hosts) {
  const names = onboardingHostNames(hosts);
  if (!names.length) return 'Voir les créneaux d’onboarding';
  const of = (name) => (/^[aeiouyàâäéèêëîïôöùûüh]/i.test(name) ? `d’${name}` : `de ${name}`);
  const list = names.length === 1 ? of(names[0]) : `${of(names[0])}${names.slice(1, -1).map(name => `, ${name}`).join('')} et ${names[names.length - 1]}`;
  return `Voir les créneaux ${list}`;
}

// ── ORIGIN BADGE COLORS ───────────────────────────────────────────────────────
const ORIGIN_COLORS = {
  Ads: { bg: "rgba(245,158,11,0.12)", text: "#f59e0b" },
  CC:  { bg: "rgba(99,102,241,0.12)", text: "#6366f1" },
};
const DEFAULT_ORIGIN = { bg: "rgba(107,114,128,0.12)", text: "#8b867e" };

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
// Signal « traité » : tout geste sur un lead (ouvrir sa fiche, copier son
// numéro ou son e-mail) vaut traitement. On réessaie, car un envoi perdu en
// silence coûte au sales le lead qu'il est justement en train de travailler
// (incident du 31/08 : RDV posé, signal jamais reçu, lead retiré 8 s plus tard).
async function pingTreated(leadId) {
  if (!leadId || !apiClient.getToken()) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await apiClient.post(`/api/v1/tracking/leads/${leadId}/treated`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

export default function TrackingSheet() {
  const navigate = useNavigate();

  // ── DARK MODE ─────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode);
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }
  }, [darkMode]);

  // ── CARD COLORS ───────────────────────────────────────────────────────────
  // Mode clair au style Owner (docs/STYLE-OWNER.md, 11/11/2026) : toile grège, cartes blanches à trait fin, encre et
  // gris chauds, anthracite à la place du bleu. Mode sombre (références du dev, 11/11/2026) : noirs et gris neutres,
  // plus de bleu nuit ; l'accent y est le clair, donc le texte posé dessus est sombre (onAccent). Peau seulement.
  const C = {
    bg:        darkMode ? '#1f1f1f' : '#ffffff',
    border:    darkMode ? '#2e2e2e' : '#ece9e4',
    surface:   darkMode ? '#141414' : '#f4f2ef',
    text:      darkMode ? '#f2f2f2' : '#1c1b19',
    muted:     darkMode ? '#7d7d7d' : '#9d9890',
    subtle:    darkMode ? '#262626' : '#f7f5f2',
    secondary: darkMode ? '#a3a3a3' : '#55514b',
    accent:    darkMode ? '#ededed' : '#2b2927',
    onAccent:  darkMode ? '#141414' : '#ffffff',
    // Fenêtres et menus (STYLE-OWNER §4) : voile chaud sans flou, feuille rayon 22, ombre longue ; menus rayon 14.
    veil:      darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(28,27,25,0.22)',
    sheetShadow: darkMode ? '0 24px 64px rgba(0,0,0,0.55)' : '0 24px 60px rgba(28,27,25,0.14)',
    popShadow: darkMode ? '0 14px 34px rgba(0,0,0,0.5)' : '0 14px 34px rgba(28,27,25,0.10), 0 2px 6px rgba(28,27,25,0.04)',
    shadow:    darkMode
      ? '0 1px 3px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)'
      : 'none',
  };
  // Images dessinées pour le fond clair (note, portrait, étiquettes de qualification et de priorité, enveloppe) :
  // en mode sombre on inverse la luminosité en gardant les teintes.
  const imgDark = darkMode ? 'invert(0.88) hue-rotate(180deg)' : undefined;

  // ── AUTH ───────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── ADMIN VIEW: viewing another sales rep's sheet ──────────────────────────
  // ?sheet_id= égal à son propre e-mail (sa feuille ouverte depuis la liste des sheets) = sa propre feuille.
  const urlParams = new URLSearchParams(window.location.search);
  const viewingSheetId = viewedSheet(urlParams.get('sheet_id'), apiClient.getUser()?.email);
  const isAdminView = !!viewingSheetId;
  const initialView = urlParams.get('view');
  // Embed mode: masque uniquement SharedNavbar interne. Utilisé par
  // CeoSheetView qui rend déjà sa propre sidebar CEO autour du TS.
  const embedMode = urlParams.get('embed') === 'true';
  const [intakeRollout, setIntakeRollout] = useState(null);
  const [intakeDialog, setIntakeDialog] = useState(null);
  const [intakeReady, setIntakeReady] = useState({});
  const [intakeContexts, setIntakeContexts] = useState({});
  const [intakeSaved, setIntakeSaved] = useState({});
  const [intakeJourneys, setIntakeJourneys] = useState({});
  const [saleOnboardingOnly, setSaleOnboardingOnly] = useState(false);
  const [qualificationDialog, setQualificationDialog] = useState(null);
  const [qualifyDeck, setQualifyDeck] = useState(null);
  const qualifyDeckChecked = useRef(false);
  const [contactDialog, setContactDialog] = useState(null);
  const [commentLeadId, setCommentLeadId] = useState(null);
  // Fiche de droite en trois volets (11/11/2026) : Infos, Documents, Commentaire. Retenu par lead.
  const [panelTab, setPanelTab] = useState({ leadId: null, tab: 'infos' });
  const [notesError, setNotesError] = useState(null);
  const isSignedPilot = lead => !!intakeJourneys[lead?.id]?.onboarding_only;
  const isGuidedLead = lead => hasGuidedSalesJourney(intakeRollout, lead, intakeContexts[lead?.id], apiClient.getUser()?.email);
  // Qualification depuis le calendrier (06/10/2026) : même fenêtre et même enregistrement que dans la sheet.
  const openCalendarQualification = async (ev) => {
    const stage = ['r1', 'r2', 'r3'].includes(ev?.rdv_type) ? ev.rdv_type : null;
    if (!stage || !ev.lead_id) return;
    let lead = leads.find(l => l.id === ev.lead_id);
    if (!lead) {
      try { lead = await apiClient.get(`/api/v1/tracking/leads/${ev.lead_id}`); } catch { lead = null; }
    }
    if (lead) setQualificationDialog({ lead, stage, fromCalendar: true });
  };
  // `quiet` : appel depuis le pop-up des RDV à qualifier, sans changer d'onglet ni de fiche.
  const saveQualificationFor = async (lead, stage, {result,attended,date,continueContract,followUp,relance}, {quiet=false}={}) => {
    const patch=qualificationPatch(lead,stage,{result,attended,date,followUp,relance});
    try {
      const response=await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`,patch);
      for(const field of ['r1_meet_link','r2_meet_link','r1_event_id','r2_event_id','r3_event_id']){
        if(response?.lead?.[field])patch[field]=response.lead[field];
      }
      if(response?.calendar_conflict){
        setCalendarError({leadId:lead.id,message:response.calendar_conflict.message||'Le rendez-vous est enregistré, mais un conflit existe dans votre agenda. Vérifiez le créneau.'});
      }
    }
    catch(error) { throw new Error(error.status===409 ? 'Ce créneau est indisponible. Vérifiez l’agenda avant de choisir une autre date.' : 'La qualification n’a pas pu être enregistrée. Vos choix sont conservés ; réessayez.'); }
    setLeads(previous=>previous.map(l=>l.id===lead.id?{...l,...patch,...(patch.r1_date?{r1:patch.r1_date}:{}),...(patch.r2_date?{r2:patch.r2_date}:{}),...(patch.r3_date?{r3:patch.r3_date}:{})}:l));
    if(quiet)return;
    setQualificationDialog(null);
    if(patch.status==='r2'||patch.status==='r3'){
      triggerLeadMovedNotif(lead,patch.status);
      const index=CATEGORIES.findIndex(c=>c.key===patch.status);
      if(index>=0)handleTabChange(index);
      setSelectedLead(lead.id);
    }
    if(continueContract) {
      const latest=leadContracts[lead.id]?.[0];
      if(latest && ['failed','canceled','expired'].includes(latest.yousign_status)) await handleResendContract(latest.id,lead.id);
      else await handleSendContract({...lead,...patch});
    }
  };
  const saveQualification = (payload) => saveQualificationFor(qualificationDialog.lead, qualificationDialog.stage, payload);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (!apiClient.getToken()) return;
      try { const state = await apiClient.get('/api/v1/owner-integration/context'); if (alive) setIntakeRollout(state); }
      catch { /* Existing sheet remains usable if the optional context is unavailable. */ }
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  const openIntake = async (leadId) => {
    try {
      const context = await apiClient.get(`/api/v1/owner-integration/leads/${leadId}`);
      if (!context.required) { setContractErrorModal({ message: 'Ce dossier conserve le parcours actuel : son contrat a déjà été envoyé ou le nouveau parcours n’est pas activé pour ce dossier.', isNdaMissing: false }); return; }
      setIntakeDialog(context);
      setIntakeContexts(previous => ({ ...previous, [leadId]: context }));
    } catch (error) { setContractErrorModal({ message: error.message || 'Impossible de charger la fiche.', isNdaMissing: false }); }
  };
  const openSavedIntake = async (leadId) => {
    try {
      const saved = await apiClient.get(`/api/v1/owner-integration/leads/${leadId}/saved`);
      if (!saved.available) { setContractErrorModal({ title: 'Fiche non enregistrée', message: 'Enregistrez la fiche depuis la préparation du contrat pour pouvoir la consulter ici.' }); return; }
      setIntakeDialog({ ...saved, readOnly: true });
      setIntakeSaved(previous => ({ ...previous, [leadId]: { available: true, validated: saved.validated, revision: saved.revision } }));
    } catch (error) { reportContractError(error, leadId, null, { preparation: true }); }
  };
  const checkIntakeBeforeSend = async (leadId, nextAction) => {
    if (intakeRollout && !intakeRollout.available) return true;
    const context = await apiClient.get(`/api/v1/owner-integration/leads/${leadId}`);
    if (context.required) {
      setIntakeContexts(previous => ({...previous,[leadId]:context}));
      const preparation = await apiClient.get(`/api/v1/owner-integration/leads/${leadId}/contract-preparation`);
      if (!preparation.nda_ready) {
        const lead=leads.find(l=>l.id===leadId);
        if (!lead) throw new Error('Rouvrez le dossier avant de préparer le contrat.');
        openNdaPopup(lead,nextAction); return false;
      }
      setIntakeDialog({ ...context, preparation, nextAction }); setIntakeReady(previous => ({ ...previous, [leadId]: context.ready })); return false;
    }
    return true;
  };

  const reportContractError = (error, leadId, nextAction, options = {}) => {
    setContractErrorModal({ ...presentContractError(error, { pilot: !!intakeContexts[leadId]?.required, ...options }), leadId, nextAction });
  };
  const correctContractInformation = async () => {
    const issue = contractErrorModal;
    const lead = leads.find(l => l.id === issue.leadId);
    if (!lead) return;
    setContractErrorModal(null);
    if (issue.action === 'nda') { openNdaPopup(lead); return; }
    try {
      if (!await checkIntakeBeforeSend(lead.id, issue.nextAction || { type: 'send' })) return;
      openNdaPopup(lead);
    } catch (error) { reportContractError(error, lead.id, issue.nextAction, { preparation: true }); }
  };


  // ── REFRESH DATA (reusable — called on mount + polling) ────────────────────
  const refreshData = useCallback(async () => {
    // If admin is viewing another user's sheet, use the admin endpoint
    const leadsUrl = isAdminView
      ? `/api/v1/tracking/leads?assigned_to=${encodeURIComponent(viewingSheetId)}`
      : '/api/v1/tracking/my-leads';
    const leadsResp = await apiClient.get(leadsUrl);
    const mappedLeads = (leadsResp.leads || []).map(l => ({
      ...l,
      status: EXTRA_STATUS_MAP[l.status] || l.status,
      full_name: l.full_name || l.client || '',
      r1: l.r1_date || l.r1 || null,
      r2: l.r2_date || l.r2 || null,
      r3: l.r3_date || l.r3 || null,
    }));
    setLeads(mappedLeads);

    // Fetch dismissed notifications from backend
    try {
      const dismissedResp = await apiClient.get('/api/v1/notifications/dismissed');
      if (dismissedResp.dismissed) setDismissedNotifs(dismissedResp.dismissed);
    } catch (e) { console.warn('Failed to fetch dismissed notifs:', e); }

    // Fetch performance alerts from backend (skip in admin view)
    if (!isAdminView) {
      try {
        const perfResp = await apiClient.get('/api/v1/notifications/performance?period=current_week');
        if (perfResp.alerts) setBackendPerfAlerts(perfResp.alerts);
      } catch (e) { console.warn('Failed to fetch perf alerts:', e); }
    }

    // Fetch personal KPIs (skip in admin view)
    if (!isAdminView) {
      try {
        const kpiResp = await apiClient.get('/api/v1/tracking/my-kpis');
        setKpis(kpiResp);
      } catch (e) { console.warn('Failed to fetch KPIs:', e); }
    }
  }, [isAdminView, viewingSheetId]);

  useEffect(() => {
    const check = async () => {
      try {
        const token = apiClient.getToken();
        const user = apiClient.getUser();
        if (!token || !user) { navigate("/login"); return; }
        setSession({ user: { email: user.email, user_metadata: { name: user.name, avatar_url: user.avatar_url || null } } });

        // Access check — skip if admin view OR user has tracking_sheet permission
        const hasPermission = user.role === 'admin' || user.role === 'ceo' || apiClient.hasAccess('tracking_sheet');
        if (!isAdminView && !hasPermission) {
          navigate("/");
          return;
        }

        // If admin view, fetch the sheet status (active/killed)
        if (isAdminView) {
          try {
            const sheetsResp = await apiClient.get('/api/v1/tracking/sheets');
            const sheets = sheetsResp.sheets || [];
            setAllSheets(sheets);
            const viewedSheet = sheets.find(s => s.email === viewingSheetId);
            setViewingSheetStatus(viewedSheet?.status || 'active');
          } catch { setViewingSheetStatus('active'); }
        }

        await refreshData();
        // Mode MANUEL : mes setters en mode manuel (pour le bouton "Donner à un setter").
        // Si aucun, le bouton n'apparaît jamais (zéro impact pour les autres sales).
        try {
          const ms = await apiClient.get('/api/v1/users/me/setters');
          setMyManualSetters((Array.isArray(ms) ? ms : []).filter(s => s.manual_only));
        } catch { /* pas de setter manuel ou endpoint indispo -> rien */ }
        // Fetch calendar + relance settings immediately (for R3 tab visibility + toggle states)
        try {
          const cs = await apiClient.get('/api/v1/tracking/calendar-settings');
          setCalSettings(cs);
        } catch {};
        try {
          const rs = await apiClient.get('/api/v1/tracking/relance-settings');
          setRelanceSettings(rs);
        } catch {};
      } catch (e) {
        console.error('[TrackingSheet] Init failed:', e);
        if (e?.status === 401) { navigate("/login"); return; }
        if (e?.status === 403 || e?.detail?.includes?.('Accès') || e?.message?.includes?.('403')) {
          // Not authorized — redirect to own sheet instead
          if (isAdminView) { window.location.href = '/tracking-sheet'; return; }
          navigate("/"); return;
        }
        navigate("/login");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [navigate, refreshData]);

  // ── POLLING: refresh leads + notifications every 30s ─────────────────────
  useEffect(() => {
    if (loading) return; // don't poll until initial load is done
    const interval = setInterval(() => {
      refreshData().catch(e => console.warn('Poll refresh failed:', e));
    }, 30000);
    return () => clearInterval(interval);
  }, [loading, refreshData]);

  // ── RAFRAÎCHISSEMENT AU RETOUR SUR L'ONGLET ───────────────────────────────
  // Les navigateurs brident les minuteries des onglets en arrière-plan : la
  // boucle de 30 s ci-dessus peut ne pas tourner pendant que le sales est
  // ailleurs, et rien ne la déclenchait à son retour. Résultat vécu : il reçoit
  // la notification d'un nouveau lead, revient sur le CRM, et lit une sheet
  // périmée où le lead n'apparaît pas. On recharge donc dès que l'onglet
  // redevient visible ou reprend le focus.
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    if (loading) return;
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      // visibilitychange et focus se déclenchent souvent ensemble : on garde
      // un seul rechargement.
      if (Date.now() - lastRefreshRef.current < 2000) return;
      lastRefreshRef.current = Date.now();
      refreshData().catch(e => console.warn('Refresh au retour sur l\'onglet échoué:', e));
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [loading, refreshData]);

  // ── WEBSOCKET CONNECTION ──────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const user = apiClient.getUser();
    if (!user?.email) return;

    // Admin can view another sales rep's sheet via ?sheet_id= query param
    const urlParams = new URLSearchParams(window.location.search);
    const sheetId = urlParams.get('sheet_id') || user.email;

    const wsUrl = `wss://ws.ownertechnology.com/ws?sheet_id=${encodeURIComponent(sheetId)}`;
    let ws;
    try { ws = new WebSocket(wsUrl); } catch { return; }
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      const urlGhost = new URLSearchParams(window.location.search).get('ghost') === 'true';
      ws.send(JSON.stringify({ type: 'join', email: user.email, full_name: user.name || user.full_name || '', role: user.role || '', ghost: urlGhost }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'presence_list':
            setPresenceUsers(msg.users || []);
            break;
          case 'user_joined':
            setPresenceUsers(prev => [...prev.filter(u => u.email !== msg.email), { email: msg.email, full_name: msg.full_name }]);
            break;
          case 'user_left':
            setPresenceUsers(prev => prev.filter(u => u.email !== msg.email));
            setRemoteCursors(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            setRemoteUserTabs(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            setRemoteLeadFocus(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            break;
          case 'cursor_move':
            if (msg.email === user.email) break; // ignore own cursor
            setRemoteCursors(prev => ({
              ...prev,
              [msg.email]: { full_name: msg.full_name, x: msg.x, y: msg.y, lastSeen: Date.now(), color: getCursorColor(msg.email) },
            }));
            break;
          case 'action_toast': {
            setActionToasts(prev => [...prev, { ...msg, id: Date.now() + Math.random(), ts: Date.now() }].slice(-5));
            setTimeout(() => setActionToasts(prev => prev.filter(t => Date.now() - t.ts < 3000)), 3500);
            // Highlight the lead card briefly
            if (msg.lead_id) {
              setHighlightedLeadId(String(msg.lead_id));
              setTimeout(() => setHighlightedLeadId(null), 2500);
              const lid = String(msg.lead_id);

              // Contract signed — move lead to "signed" tab immediately
              if (msg.action === 'Contrat signé') {
                setTimeout(async () => {
                  try {
                    const updated = await apiClient.get(`/api/v1/tracking/leads/${lid}`);
                    if (updated && updated.id) {
                      const oldLead = leadsRef.current.find(l => String(l.id) === lid);
                      setLeads(prev => prev.map(l => String(l.id) === lid ? { ...l, ...updated, status: 'signed' } : l));
                      if (oldLead && oldLead.status !== 'signed') {
                        triggerFlyAnimation(lid, oldLead, 'signed');
                        triggerLeadMovedNotif(oldLead, 'signed');
                      }
                    }
                  } catch {}
                }, 300);
                break;
              }

              // Contract expired — re-fetch lead to update contract status
              if (msg.action === 'Contrat expiré') {
                setTimeout(async () => {
                  try {
                    const updated = await apiClient.get(`/api/v1/tracking/leads/${lid}`);
                    if (updated && updated.id) {
                      setLeads(prev => prev.map(l => String(l.id) === lid ? { ...l, ...updated } : l));
                      // Re-fetch contracts for this lead
                      if (typeof fetchLeadContracts === 'function') fetchLeadContracts(updated.id);
                    }
                  } catch {}
                }, 300);
                break;
              }

              // Default: debounced single-lead re-fetch for real-time sync
              if (leadFetchTimers.current[lid]) clearTimeout(leadFetchTimers.current[lid]);
              leadFetchTimers.current[lid] = setTimeout(async () => {
                delete leadFetchTimers.current[lid];
                try {
                  const updated = await apiClient.get(`/api/v1/tracking/leads/${lid}`);
                  if (updated && updated.id) {
                    setLeads(prev => {
                      const exists = prev.some(l => String(l.id) === lid);
                      if (exists) {
                        return prev.map(l => String(l.id) === lid ? { ...l, ...updated } : l);
                      } else {
                        return [...prev, updated];
                      }
                    });
                  }
                } catch (err) {
                  if (err.status === 404 || err.status === 403) {
                    setLeads(prev => prev.filter(l => String(l.id) !== lid));
                  }
                }
              }, 300);
            }
            break;
          }
          case 'setter_placed_r1':
          case 'setter_placed_r2':
          case 'setter_called': {
            if (msg.assigned_to && msg.assigned_to.toLowerCase() !== sheetId.toLowerCase()) {
              const transferredId = String(msg.lead_id);
              setLeads(prev => prev.filter(l => String(l.id) !== transferredId));
              setSelectedLead(prev => String(prev) === transferredId ? null : prev);
              break;
            }
            // Un setter vient d'appeler un lead du sales propriétaire de la sheet.
            // Refetch le lead pour récupérer les valeurs serveur officielles
            // (`setter_called_by_name`, `setter_called_at`, `setter_call_count`)
            // — le payload WS contient `setter_name` mais pas le timestamp serveur.
            // Highlight bref + remontée en tête de liste via le tri sur `setter_called_at`.
            if (!msg.lead_id) break;
            const lid = String(msg.lead_id);
            setHighlightedLeadId(lid);
            setTimeout(() => setHighlightedLeadId(null), 2500);
            if (leadFetchTimers.current[lid]) clearTimeout(leadFetchTimers.current[lid]);
            leadFetchTimers.current[lid] = setTimeout(async () => {
              delete leadFetchTimers.current[lid];
              try {
                const updated = await apiClient.get(`/api/v1/tracking/leads/${lid}`);
                if (updated && updated.id) {
                  setLeads(prev => {
                    const exists = prev.some(l => String(l.id) === lid);
                    if (exists) return prev.map(l => String(l.id) === lid ? { ...l, ...updated } : l);
                    return [...prev, updated];
                  });
                }
              } catch (err) {
                if (err.status === 404 || err.status === 403) {
                  setLeads(prev => prev.filter(l => String(l.id) !== lid));
                }
              }
            }, 300);
            break;
          }
          case 'tab_change':
            if (msg.email === user.email) break;
            setRemoteUserTabs(prev => ({ ...prev, [msg.email]: msg.tab }));
            break;
          case 'lead_focus':
            if (msg.email === user.email) break;
            if (msg.lead_id) {
              const cursorColor = getCursorColor(msg.email);
              setRemoteLeadFocus(prev => ({ ...prev, [msg.email]: { lead_id: String(msg.lead_id), full_name: msg.full_name, color: cursorColor } }));
            } else {
              setRemoteLeadFocus(prev => { const next = { ...prev }; delete next[msg.email]; return next; });
            }
            break;
          case 'global_notification':
            window.dispatchEvent(new CustomEvent('global_notification', { detail: msg.notification }));
            break;
          case 'sms_notification': {
            // Live SMS confirmation/error — anchored popover (no persistence anywhere)
            console.log('[WS] sms_notification received:', msg);
            const notif = {
              id: `sms-${msg.lead_id}-${msg.sms_type}-${msg.sent_at || Date.now()}`,
              status: msg.status, // 'pending' | 'sent' | 'failed'
              lead_id: msg.lead_id,
              lead_name: msg.lead_name || '',
              lead_phone: msg.lead_phone || '',
              sms_type: msg.sms_type,
              sms_text: msg.sms_text || '',
              segments: msg.segments || 1,
              error: msg.error || null,
              sent_at: msg.sent_at || new Date().toISOString(),
            };
            // If a popover is already showing for this lead+type, update it in place (pending → sent/failed)
            // so the same UI smoothly transitions instead of opening a second popover.
            setSmsNotifPopover(prev => {
              if (prev && prev.lead_id === notif.lead_id && prev.sms_type === notif.sms_type) {
                return { ...notif, openedAt: prev.openedAt };
              }
              return { ...notif, openedAt: Date.now() };
            });
            if (smsNotifTimerRef.current) clearTimeout(smsNotifTimerRef.current);
            if (notif.status === 'pending') {
              // After 5s: if no real sent/failed arrived, flip to "will be sent" (not "sent")
              const fallbackKey = `${notif.lead_id}:${notif.sms_type}`;
              smsNotifTimerRef.current = setTimeout(() => {
                setSmsNotifPopover(prev => {
                  if (!prev || `${prev.lead_id}:${prev.sms_type}` !== fallbackKey || prev.status !== 'pending') return prev;
                  return { ...prev, status: 'queued' }; // "Le message sera envoyé"
                });
                // Auto-close 2s after transitioning to queued
                setTimeout(() => closeSmsPopover(), 2000);
              }, 5000);
            } else {
              // Real sent/failed — show for 2s then close
              const dwell = notif.status === 'sent' ? 2000 : 5000;
              smsNotifTimerRef.current = setTimeout(() => closeSmsPopover(), dwell);
            }
            break;
          }
          case 'invitation_revoked':
            if (msg.target_email === user.email) {
              setContractErrorModal({ message: 'Vos accès ont été révoqués. Vous allez être redirigé vers votre tracking sheet.', isNdaMissing: false });
              setTimeout(() => { window.location.href = '/tracking-sheet'; }, 2500);
            }
            break;
          case 'calendar_settings':
          case 'calendar_settings_update':
            setCalSettings(prev => ({ ...prev, r3_enabled: msg.r3_enabled, calendar_enabled: msg.calendar_enabled }));
            break;
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = (e) => {
      setWsConnected(false);
      if (e.code === 4001) console.warn('[WS] Room full (max 3)');
    };

    // Send own cursor position (throttled ~15/sec)
    let lastSend = 0;
    const handleMouseMove = (e) => {
      if (!ws || ws.readyState !== 1) return;
      if (Date.now() - lastSend < 66) return;
      lastSend = Date.now();
      ws.send(JSON.stringify({ type: 'cursor_move', x: e.clientX, y: e.clientY }));
    };
    document.addEventListener('mousemove', handleMouseMove);

    // Idle cursor cleanup (hide after 30s without movement)
    const idleInterval = setInterval(() => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(email => {
          if (Date.now() - next[email].lastSeen > 30000) delete next[email];
        });
        return next;
      });
    }, 5000);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      clearInterval(idleInterval);
      if (ws.readyState === 1) ws.close();
      wsRef.current = null;
    };
  }, [loading]);

  // ── LEAD STATE ────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [commonVoicemailLeads, setCommonVoicemailLeads] = useState([]); // pool "Répondeur commun"
  const [commonPoolLoading, setCommonPoolLoading] = useState(false);
  const [claimingId, setClaimingId] = useState(null); // lead en cours de prise
  const [commonPoolSearch, setCommonPoolSearch] = useState(""); // recherche dans le pool commun
  const [commonPoolTotal, setCommonPoolTotal] = useState(0); // vrai total du pool (non plafonné à 500)
  const [myManualSetters, setMyManualSetters] = useState([]); // mes setters en mode MANUEL (pour le bouton "Donner à un setter")
  const leadsRef = useRef([]);
  useEffect(() => { leadsRef.current = leads; }, [leads]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedLead, setSelectedLead] = useState(null);
  useEffect(() => {
    if (!selectedLead) return;
    let alive = true;
    apiClient.get(`/api/v1/owner-integration/leads/${selectedLead}/saved`).then(saved => {
      if (alive) setIntakeSaved(previous => (previous[selectedLead]?.revision || 0) > (saved.revision || 0) ? previous : ({ ...previous, [selectedLead]: { available: saved.available, validated: saved.validated, revision: saved.revision } }));
    }).catch(() => { /* Explicit consultation reports errors and never presents an empty document. */ });
    return () => { alive = false; };
  }, [selectedLead]);
  const [creaPopup, setCreaPopup] = useState(null);
  const leadCreative = useLeadCreative(selectedLead);
  useEffect(() => {
    if (!selectedLead || !intakeRollout?.available) return;
    let alive = true;
    apiClient.get(`/api/v1/owner-integration/leads/${selectedLead}`).then(context => {
      if (!alive) return;
      setIntakeContexts(previous => ({ ...previous, [selectedLead]: context }));
      setIntakeReady(previous => ({ ...previous, [selectedLead]: context.ready }));
    }).catch(() => { /* Explicit send/declare actions retry and surface errors. */ });
    return () => { alive = false; };
  }, [selectedLead, intakeRollout?.available, leads.find(l => l.id === selectedLead)?.contract_signed_at]);

  // Sale booking is shared by every sales account, independently of intake rollout.
  useEffect(() => {
    if (!selectedLead) return;
    let alive = true;
    apiClient.get(`/api/v1/owner-integration/leads/${selectedLead}/journey`).then(journey => {
      if (alive) setIntakeJourneys(previous => ({ ...previous, [selectedLead]: journey }));
    }).catch(() => { /* Declaration retries and surfaces errors before booking. */ });
    return () => { alive = false; };
  }, [selectedLead, leads.find(l => l.id === selectedLead)?.contract_signed_at]);

  const [copiedField, setCopiedField] = useState(null); // 'phone-{id}' or 'email-{id}'
  const [exitingCards, setExitingCards] = useState(new Set());
  const [animatingBadges, setAnimatingBadges] = useState(new Set());
  const [editingNotes, setEditingNotes] = useState({});
  const [tabKey, setTabKey] = useState(0); // forces re-animation on tab switch
  const prevCountsRef = useRef(null);
  const [sendingContract, setSendingContract] = useState(null); // lead.id or null
  // Date facultative à imprimer dans le contrat, par lead. Vide = date du jour,
  // comportement historique inchangé. { [lead_id]: 'YYYY-MM-DD' }
  const [contractDates, setContractDates] = useState({});
  const [navNotif, setNavNotif] = useState(null); // 'sending' | 'sent' | null
  const [resendingContract, setResendingContract] = useState(null); // lead.id or null
  const [cancelingContract, setCancelingContract] = useState(null); // contract.id or null
  const [leadContracts, setLeadContracts] = useState({}); // { [lead_id]: contract[] }
  const [contractSenders, setContractSenders] = useState({}); // { [user_id]: full_name }
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [signingCard, setSigningCard] = useState(null); // lead.id when signing animation plays
  const [completedSticker, setCompletedSticker] = useState(false); // triggers sticker stamp animation on completed container icon
  const [calendarError, setCalendarError] = useState(null); // { leadId, message } — shown when Google Calendar returns 409
  const [kpis, setKpis] = useState(null); // { leads_assigned, leads_treated, closing_r1, closing_audit, conversion_rate, revenue, ... }
  const [noteJustSaved, setNoteJustSaved] = useState(null); // lead.id — triggers mynote sticker appear animation
  const [flyingCard, setFlyingCard] = useState(null); // { lead, sourceRect, dx, dy, catColor, destCatIndex }
  const [glowingTab, setGlowingTab] = useState(null); // category index receiving a card
  // Onglets en rail (11/11/2026, « bien refaire les onglets, vraiment clean ») : un pouce blanc glisse sous l'onglet
  // actif. Sa place est mesurée sur l'onglet lui-même, remesurée quand le rail change de largeur ou de contenu.
  const tabRailRef = useRef(null);
  const [tabThumb, setTabThumb] = useState(null);
  const flyCleanupRef = useRef([]);
  const prevTabRef = useRef(0); // track previous tab for tabDrop animation
  const [droppingTab, setDroppingTab] = useState(null); // index of tab that just became inactive
  const detailContainerRef = useRef(null); // portal target for detail panel (separate card)
  const [contractErrorModal, setContractErrorModal] = useState(null); // { message, isNdaMissing } or null
  const [qualDropdown, setQualDropdown] = useState(null); // lead id with open qualification dropdown
  const [qualDropdownPos, setQualDropdownPos] = useState({ x: 0, y: 0 });
  const [spotlightOpen, setSpotlightOpen] = useState(false); // Ctrl+F search overlay
  const [calSettings, setCalSettings] = useState(() => {
    // Load from localStorage for instant render (r3 tab visibility)
    try { const saved = localStorage.getItem('calSettings'); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [calSettingsLoading, setCalSettingsLoading] = useState(false);
  const [calSettingsSaving, setCalSettingsSaving] = useState(false);
  const [calSettingsSaved, setCalSettingsSaved] = useState(false);
  const [relanceSettings, setRelanceSettings] = useState(null);
  const [relanceLoading, setRelanceLoading] = useState(false);
  const [relanceSaving, setRelanceSaving] = useState(false);
  const [relanceSaved, setRelanceSaved] = useState(false);
  const [relanceError, setRelanceError] = useState(null);
  const [spotlightQuery, setSpotlightQuery] = useState('');
  const spotlightInputRef = useRef(null);
  const [prioDropdown, setPrioDropdown] = useState(null); // lead id with open priority dropdown
  const [sansSuiteModal, setSansSuiteModal] = useState(null); // { leadId } — sans suite comment modal
  const [r1ShortcutContract, setR1ShortcutContract] = useState(null); // lead id — show contract UI in R1 tab
  const [sansSuiteComment, setSansSuiteComment] = useState('');
  // ── SPEECH-TO-TEXT (notes + sans suite modal) ──────────────────────────────
  const [micRecording, setMicRecording] = useState(false);
  const [micTranscribing, setMicTranscribing] = useState(false);
  const [micError, setMicError] = useState(null); // flash error message
  const micRecorderRef = useRef(null);
  const micChunksRef = useRef([]);
  // Dictée en direct (11/11/2026) : la reconnaissance vocale du navigateur montre le texte pendant qu'on parle, et ce
  // texte part dans le commentaire dès l'arrêt (12/11/2026). La transcription du serveur n'est plus qu'un secours :
  // navigateur sans reconnaissance vocale, écoute interrompue par une erreur, ou rien d'entendu.
  const [micLive, setMicLive] = useState('');
  const micLiveRef = useRef('');
  const micRecognitionRef = useRef(null);
  const micLiveStart = () => {
    micLiveRef.current = ''; setMicLive('');
    const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    micRecognitionRef.current = createLiveListener({ Recognition: Recognition || undefined, onText: (text) => { micLiveRef.current = text; setMicLive(text); } });
    micRecognitionRef.current.start();
  };
  const micLiveStop = () => {
    micRecognitionRef.current?.cancel();
    micRecognitionRef.current = null;
  };
  const getMicMimeType = () => {
    for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', '']) {
      if (!t || MediaRecorder.isTypeSupported(t)) return t || undefined;
    }
    return undefined;
  };
  const micStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: {channelCount:1,echoCancellation:true,noiseSuppression:true} });
      const mimeType = getMicMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      micChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) micChunksRef.current.push(e.data); };
      mr.start();
      micRecorderRef.current = mr;
      setMicRecording(true);
      setMicError(null);
      micLiveStart();
    } catch (err) {
      console.warn('Microphone error:', err);
      setMicError('Micro non autorisé');
      setTimeout(() => setMicError(null), 3000);
    }
  };
  const micStopAndTranscribe = (onText) => {
    const mr = micRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    // L'écoute en direct rend sa dernière phrase pendant que l'enregistrement se ferme.
    const listener = micRecognitionRef.current;
    micRecognitionRef.current = null;
    const heard = listener ? listener.finish() : Promise.resolve({ text: micLiveRef.current, trusted: false });
    mr.onstop = async () => {
      setMicRecording(false);
      const { text: live, trusted } = await heard;
      // Le texte entendu en direct part tout de suite dans le commentaire (dev 12/11/2026 : « pour l'avoir dans le
      // texte, ça met énormément de temps »). Le serveur ne transcrit l'enregistrement que si l'écoute a décroché.
      if (trusted) {
        onText(live);
        micLiveRef.current = ''; setMicLive('');
        mr.stream.getTracks().forEach(t => t.stop());
        return;
      }
      setMicTranscribing(true);
      const ext = (mr.mimeType || '').includes('mp4') ? 'recording.mp4' : (mr.mimeType || '').includes('ogg') ? 'recording.ogg' : 'recording.webm';
      const blob = new Blob(micChunksRef.current, { type: mr.mimeType || 'audio/webm' });
      try {
        const formData = new FormData();
        formData.append('audio', blob, ext);
        const token = apiClient.getToken();
        const resp = await fetch(`${apiClient.baseUrl}/api/v1/tracking/transcribe`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData,
        });
        if (!resp.ok) {
          const errBody = await resp.text().catch(() => '');
          console.error(`Transcription HTTP ${resp.status}:`, errBody);
          let errDetail = '';
          try { const j = JSON.parse(errBody); errDetail = j.detail || j.message || j.error || ''; } catch { errDetail = errBody.slice(0, 80); }
          if (live) { onText(live); return; }
          setMicError(`Erreur ${resp.status}${errDetail ? ' : ' + errDetail : resp.status === 401 ? ' (non autorisé)' : resp.status === 413 ? ' (fichier trop gros)' : resp.status === 404 ? ' (endpoint introuvable)' : ''}`);
          setTimeout(() => setMicError(null), 5000);
          return;
        }
        const data = await resp.json();
        if (data.text) { onText(data.text); }
        else if (live) { onText(live); }
        else { setMicError('Aucun texte détecté'); setTimeout(() => setMicError(null), 3000); }
      } catch (err) {
        console.error('Transcription error:', err);
        if (live) { onText(live); return; }
        setMicError(err.message === 'Failed to fetch' ? 'Erreur réseau' : 'Erreur de transcription');
        setTimeout(() => setMicError(null), 4000);
      }
      finally { setMicTranscribing(false); micLiveRef.current = ''; setMicLive(''); }
      mr.stream.getTracks().forEach(t => t.stop());
    };
    mr.stop();
    mr.stream.getTracks().forEach(t => t.stop());
  };
  const micCleanup = () => {
    if (micRecorderRef.current?.state === 'recording') { micRecorderRef.current.stream.getTracks().forEach(t => t.stop()); micRecorderRef.current.stop(); }
    micLiveStop(); micLiveRef.current = ''; setMicLive('');
    setMicRecording(false); setMicTranscribing(false);
  };
  const [prioDropdownPos, setPrioDropdownPos] = useState({ x: 0, y: 0 });
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, icon, color, confirmLabel, onConfirm } or null
  const [duplicateLeadModal, setDuplicateLeadModal] = useState(false); // pop-up anti-doublon (création CC ou édition email/tél sur un lead déjà existant)

  // ── SALE DECLARATION MODAL (signed tab) ────────────────────────────────────
  const [showSaleModal, setShowSaleModal] = useState(null); // lead.id when modal is open
  const [rescheduleNotice, setRescheduleNotice] = useState(null);
  const [reschedRdv, setReschedRdv] = useState(null); // { leadId, kind } RDV post-signature à reprogrammer (créneau + dispo agenda)
  const [onbAvailOpen, setOnbAvailOpen] = useState(false); // consultation des dispos onboarding avant le contrat (29/09)
  // billingStructures ('une'|'plusieurs') + discount (null|false|true) + discountValue (texte
  // libre "5 %") = questions facturation posées à l'étape 'questions' (après les créneaux),
  // destinées à la description de l'event RDV Onboarding (agenda facturation@).
  const [saleForm, setSaleForm] = useState({ email: '', paymentModality: 'M', employeeRange: '', billingStructures: '', structuresCount: '', discount: null, discountValue: '' });
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  // Déclaration en 3 étapes : 'form' -> 'lancement' (créneau Opti'Lex : L. Gentaire, ou H. Moraru si 20+) -> 'onboarding' (créneau facturation@)
  const [saleStep, setSaleStep] = useState('form');
  const [saleIntake, setSaleIntake] = useState(null);
  const [salePreparation, setSalePreparation] = useState(null);
  const [saleReservationError, setSaleReservationError] = useState('');
  const saleRequestBusy = useRef(false);
  const [saleSlots, setSaleSlots] = useState({ onboarding: null, lancement: null }); // "YYYY-MM-DDTHH:MM"
  const [saleSuccess, setSaleSuccess] = useState(false);
  const EMPLOYEE_RANGES = [
    '1-2','3-5','6-10','11-19','20-29','30-39','40-49','50-74','75-99',
    '100-149','150-199','200-249','250-299','300-349','350-400',
  ];

  const [saleClientNumero, setSaleClientNumero] = useState(null);

  const applySalePreparation = (leadId, preparation) => {
    setSalePreparation(preparation);
    if (!preparation) return;
    const p = preparation.payload;
    setSaleForm({email:p.email, paymentModality:p.payment_mode === 'MONTHLY' ? 'M' : 'A', employeeRange:p.employee_band,
      billingStructures:p.billing_structures, structuresCount:p.structures_count || '', discount:p.discount !== 'Non', discountValue:p.discount === 'Non' ? '' : p.discount});
    setSaleSlots({onboarding:preparation.slot, lancement:null});
    setIntakeJourneys(previous => ({...previous, [leadId]:{...previous[leadId], preparation}}));
    setSaleStep('reserved');
  };
  const reserveSaleAppointment = async (leadId) => {
    if (saleRequestBusy.current) return;
    saleRequestBusy.current = true; setSaleSubmitting(true); setSaleReservationError('');
    try {
      const payload = salePreparation?.payload || {
        email:saleForm.email.trim().toLowerCase(), payment_mode:saleForm.paymentModality === 'M' ? 'MONTHLY' : 'YEARLY',
        employee_band:saleForm.employeeRange, billing_structures:saleForm.billingStructures,
        structures_count:saleForm.billingStructures === 'plusieurs' ? saleForm.structuresCount : null,
        discount:saleForm.discount ? saleForm.discountValue.trim() : 'Non',
      };
      const result = await apiClient.post(`/api/v1/owner-integration/leads/${leadId}/sale-preparation`, {...payload, slot:salePreparation?.slot || saleSlots.onboarding});
      applySalePreparation(leadId, result.preparation);
    } catch (error) {
      // The server may have saved the reservation even if the HTTP response was lost.
      try {
        const saved = await apiClient.get(`/api/v1/owner-integration/leads/${leadId}/sale-preparation`);
        if (saved.preparation) applySalePreparation(leadId, saved.preparation);
        else {setSalePreparation(null); setSaleStep('onboarding');}
      } catch { /* Leave the form intact; repeating POST uses the same durable intent. */ }
      setSaleReservationError(error.message || 'Impossible de confirmer la réservation. Vérifiez son état avant de continuer.');
    } finally {saleRequestBusy.current = false; setSaleSubmitting(false);}
  };

  const handleSaleSubmit = async (leadId, documentsWaiver = null, documentsWaiverNote = '') => {
    if (saleRequestBusy.current) return;
    saleRequestBusy.current = true;
    setSaleSubmitting(true);
    try {
      const user = apiClient.getUser();
      const lead = leads.find(l => l.id === leadId);
      const paymentMode = saleForm.paymentModality === 'M' ? 'MONTHLY' : 'YEARLY';
      const emailVal = saleForm.email.trim().toLowerCase();

      // Backend — create client + trigger n8n webhooks server-side (fire-and-forget)
      let clientNumero = null;
      try {
        const res = await apiClient.post(`/api/v1/tracking/leads/${leadId}/declare-sale`, {
          email: emailVal,
          payment_mode: paymentMode,
          employee_band: saleForm.employeeRange,
          ...(saleOnboardingOnly ? {integration_revision: saleIntake?.revision} : {}),
          // Questions facturation (étape 'questions') -> description de l'event Onboarding.
          billing_structures: saleForm.billingStructures || null,
          structures_count: saleForm.billingStructures === 'plusieurs' ? (saleForm.structuresCount || null) : null,
          discount: saleForm.discount === true ? ((saleForm.discountValue || '').trim() || 'Oui') : (saleForm.discount === false ? 'Non' : null),
          // Aucune pièce : motif choisi dans le bloc « Déclarer la vente sans documents » de l'étape documents (J-4 ou moins).
          ...(documentsWaiver ? { documents_waiver: documentsWaiver } : {}),
          ...(documentsWaiverNote ? { documents_waiver_note: documentsWaiverNote } : {}),
        });
        clientNumero = res.client_numero || null;
      } catch (err) {
        const msg = err?.message || err?.detail || '';
        if (err?.status === 400) { alert(msg || 'Choisissez le rendez-vous onboarding + facturation avant de déclarer la vente.'); setSaleSubmitting(false); saleRequestBusy.current = false; return; }
        if (err?.status === 409) { alert(msg || 'Un client avec cet email existe déjà.'); setSaleSubmitting(false); saleRequestBusy.current = false; return; }
        if (err?.status === 403 || err?.status === 404) { alert(msg || 'Lead introuvable ou accès refusé.'); setSaleSubmitting(false); saleRequestBusy.current = false; return; }
        console.error('declare-sale failed:', err);
        alert(msg || 'Erreur lors de la déclaration de vente.');
        setSaleSubmitting(false); saleRequestBusy.current = false;
        return;
      }

      // Success
      setSaleClientNumero(clientNumero);
      setSaleSuccess(true);
      if (salePreparation) setIntakeJourneys(previous => ({...previous, [leadId]:{...previous[leadId], preparation:{...salePreparation, status:'finalized'}}}));
      setPortalRevision(value => value + 1);
      setTimeout(() => { setSaleSuccess(false); setSaleClientNumero(null); setShowSaleModal(null); setSaleForm({ email: '', paymentModality: 'M', employeeRange: '', billingStructures: '', structuresCount: '', discount: null, discountValue: '' }); setSaleStep('form'); setSaleSlots({ onboarding: null, lancement: null }); }, 2500);
    } catch (e) { console.error('Sale submit error:', e); }
    setSaleSubmitting(false); saleRequestBusy.current = false;
  };

  // Étape finale : pose les 2 créneaux choisis sur le lead (même convention naïve que le
  // DateTimePicker), PUIS déclare la vente via le flux INCHANGÉ (declare-sale + webhooks).
  const handleSaleSubmitWithSlots = async (leadId) => {
    setSaleSubmitting(true);
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, {
        rdv_onboarding_date: saleSlots.onboarding,
        ...(!saleOnboardingOnly ? { rdv_lancement_date: saleSlots.lancement } : {}),
      });
      // Reflète les dates choisies dans l'état local -> les pickers de reprogrammation
      // (affichés seulement quand les dates sont posées) apparaissent aussitôt.
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, rdv_onboarding_date: saleSlots.onboarding, ...(!saleOnboardingOnly ? { rdv_lancement_date: saleSlots.lancement } : {}) } : l));
    } catch (e) {
      console.error('patch rdv dates failed:', e);
      alert("Impossible d'enregistrer les créneaux. Réessaie.");
      setSaleSubmitting(false);
      return;
    }
    await handleSaleSubmit(leadId); // gère success + reset + setSaleSubmitting(false)
  };

  // ── WEBSOCKET: PRESENCE + CURSORS + TOASTS ────────────────────────────────
  const [remoteCursors, setRemoteCursors] = useState({}); // { email: { full_name, x, y, lastSeen, color } }
  const [remoteUserTabs, setRemoteUserTabs] = useState({}); // { email: 'r1' }
  const [remoteLeadFocus, setRemoteLeadFocus] = useState({}); // { email: { lead_id, full_name, color } }
  const [actionToasts, setActionToasts] = useState([]); // [{ id, user_name, action, lead_id, email, ts }]
  const [presenceUsers, setPresenceUsers] = useState([]); // [{ email, full_name }]
  const [wsConnected, setWsConnected] = useState(false);
  const [highlightedLeadId, setHighlightedLeadId] = useState(null);
  const wsRef = useRef(null);
  const leadFetchTimers = useRef({}); // debounce re-fetch per lead_id
  const cursorColorsRef = useRef({});
  const CURSOR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#d946ef', '#84cc16'];
  const getCursorColor = (email) => {
    if (!cursorColorsRef.current[email]) {
      // Hash email to get a stable, unique color index
      let hash = 0;
      for (let i = 0; i < email.length; i++) { hash = ((hash << 5) - hash) + email.charCodeAt(i); hash |= 0; }
      cursorColorsRef.current[email] = CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
    }
    return cursorColorsRef.current[email];
  };

  // ── SIDEBAR NAV + FORM STATE ────────────────────────────────────────────
  const [cancelledExpanded, setCancelledExpanded] = useState(false);
  // R1 tab — "Traité par le setter" container : collapsed par défaut, mirror du
  // container "Annulé". Toggle œil/chevron pour show/hide.
  const [setterPlacedExpanded, setSetterPlacedExpanded] = useState(false);
  // R2 tab — "R2 Landing" container (Broad LP / BTP LP) : expanded par defaut.
  const [r2LandingExpanded, setR2LandingExpanded] = useState(true);
  // R1 tab — "R1 Landing" container (Broad LP) : etat plie/deplie distinct de R2.
  const [r1LandingExpanded, setR1LandingExpanded] = useState(true);
  // R2 tab — "R2 Webinaire" container : expanded par défaut pour visibilité
  // immédiate (leads issus des bookings webinaire avec R2 déjà placé par le
  // prospect). Mêmes mécaniques collapsible que cancelled/setter_placed.
  const [r2WebinaireExpanded, setR2WebinaireExpanded] = useState(true);
  // R1 tab — "R1 Webinaire" container (anciens webinaires, dev 12/11/2026) : état plié/déplié distinct de R2.
  const [r1WebinaireExpanded, setR1WebinaireExpanded] = useState(true);
  // Onglet Signés — conteneurs par mois de signature : { [monthKey]: bool } override
  // du défaut (mois en cours ouvert, autres mois repliés).
  const [signedMonthOpen, setSignedMonthOpen] = useState({});
  // Onglet Nouveau lead — conteneur "Donnés" (leads donnés à un setter) : replié
  // par défaut, séparé de la liste "à traiter". Additif, pur affichage.
  const [givenLeadsOpen, setGivenLeadsOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState(initialView || 'leads');

  // ── TRACKING SHEETS MANAGEMENT (admin, HoS only) ──────────────────────────
  const [allSheets, setAllSheets] = useState([]); // [{ email, full_name, lead_count, status, team_id, avatar_url }]
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [ghostMode, setGhostMode] = useState(false);
  const [selectedSheetEmail, setSelectedSheetEmail] = useState(null); // email of sheet being viewed
  const [sheetInvitations, setSheetInvitations] = useState([]); // invitations for current killed sheet
  const [viewingSheetStatus, setViewingSheetStatus] = useState(null); // 'active' | 'killed' for the sheet being viewed
  const [reassignTarget, setReassignTarget] = useState(null); // { leadId, showDropdown: true }
  const [assignableUsers, setAssignableUsers] = useState([]); // users available for reassignment
  const [solarTeams, setSolarTeams] = useState([]); // teams for solar system view
  const [solarHovered, setSolarHovered] = useState(null); // email string
  const [solarTooltipPos, setSolarTooltipPos] = useState({ x: 0, y: 0 }); // tooltip position
  const [solarPaused, setSolarPaused] = useState(false); // pause rotation on hover
  const [inviteModal, setInviteModal] = useState(null); // { sheetEmail } or null
  const [inviteSearch, setInviteSearch] = useState('');
  const [myInvitations, setMyInvitations] = useState([]); // invitations received by current user
  // Wait for backend fix — finalized invitations should not be returned by GET /tracking/invitations

  const fetchMyInvitations = useCallback(async () => {
    try {
      const resp = await apiClient.get('/api/v1/tracking/invitations');
      const myEmail = apiClient.getUser()?.email;
      const mine = (resp?.invitations || []).filter(inv => inv.status === 'pending' && inv.invited_email === myEmail);
      setMyInvitations(mine);
    } catch {}
  }, []);

  // Fetch invitations on mount + when switching to notifications tab
  useEffect(() => { fetchMyInvitations(); }, []);
  useEffect(() => { if (sidebarView === 'notifications') fetchMyInvitations(); }, [sidebarView]);

  // Refresh invitations when a sheet_invitation notification arrives via WebSocket
  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.type === 'sheet_invitation') fetchMyInvitations();
    };
    window.addEventListener('global_notification', handler);
    return () => window.removeEventListener('global_notification', handler);
  }, [fetchMyInvitations]);
  const currentUser = apiClient.getUser();
  const canManageSheets = currentUser?.role === 'admin' || currentUser?.role === 'head_of_sales' || currentUser?.role === 'head_of_sales_manager';
  const canManageLeads = currentUser?.role === 'admin' || currentUser?.role === 'head_of_sales_manager';
  const isAdmin = currentUser?.role === 'admin';

  // Pop-up des RDV à qualifier (06/10/2026) : à l'ouverture de sa propre sheet, une fois par chargement.
  // Obligatoire depuis le 15/10/2026 (dev : « s'ils ne qualifient pas tous leurs rendez-vous, ils ne pourront pas
  // accéder à leur tracking sheet ») : plus de report, la fenêtre ne se ferme qu'une fois tout qualifié. Ses RDV à lui
  // seulement ; la feuille d'un autre (vue d'administration) n'ouvre jamais la pop-up.
  useEffect(() => {
    if (qualifyDeckChecked.current || isAdminView || !leads.length || !currentUser?.id) return;
    if (!['sales', 'head_of_sales', 'head_of_sales_manager'].includes(currentUser.role)) return;
    qualifyDeckChecked.current = true;
    const items = ownRdvsToQualify(leads, currentUser.email);
    if (items.length) setQualifyDeck(items);
  }, [leads, isAdminView, currentUser]);
  const closeQualifyDeck = useCallback(() => setQualifyDeck(null), []);

  const fetchAllSheets = async () => {
    setSheetsLoading(true);
    try {
      const resp = await apiClient.get('/api/v1/tracking/sheets');
      const sheets = resp.sheets || [];
      // Build avatar map from multiple sources (same as PerfClosing)
      const avatarMap = {};
      const normalize = (n) => (n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const addToMap = (name, avatar) => {
        if (!name || !avatar) return;
        const norm = normalize(name);
        avatarMap[norm] = avatar;
        norm.split(/\s+/).forEach(part => { if (part.length >= 3 && !avatarMap[part]) avatarMap[part] = avatar; });
      };
      // Source 1: getUsers()
      try {
        const users = await apiClient.getUsers();
        (users || []).forEach(u => addToMap(u.full_name || u.name, u.avatar_url || u.slack_image || u.photo_url || ''));
      } catch {}
      // Source 2: leaderboard (all time)
      try {
        const lb = await apiClient.getLeaderboardStats('all');
        (lb.all_sellers || []).forEach(s => addToMap(s.name, s.avatar_url));
        (lb.teams || []).forEach(t => {
          addToMap(t.captain?.name, t.captain?.avatar_url);
          (t.members || []).forEach(m => addToMap(m.name, m.avatar_url));
        });
      } catch {}
      // Match sheets to avatars
      sheets.forEach(s => {
        if (!s.avatar_url) {
          const norm = normalize(s.full_name);
          if (avatarMap[norm]) { s.avatar_url = avatarMap[norm]; return; }
          // Fallback: match by any part of name (first/last name)
          const parts = norm.split(/\s+/);
          for (const part of parts) {
            if (part.length >= 3 && avatarMap[part]) { s.avatar_url = avatarMap[part]; return; }
          }
        }
      });
      setAllSheets(sheets);
    } catch (e) { console.warn('Failed to fetch sheets:', e); }
    setSheetsLoading(false);
  };

  const handleKillSheet = async (email) => {
    try {
      await apiClient.post(`/api/v1/tracking/sheets/${encodeURIComponent(email)}/kill`);
      setAllSheets(prev => prev.map(s => s.email === email ? { ...s, status: 'killed' } : s));
    } catch (e) { console.warn('Kill sheet failed:', e); }
  };

  const handleRestoreSheet = async (email) => {
    try {
      await apiClient.post(`/api/v1/tracking/sheets/${encodeURIComponent(email)}/restore`);
      setAllSheets(prev => prev.map(s => s.email === email ? { ...s, status: 'active' } : s));
    } catch (e) { console.warn('Restore sheet failed:', e); }
  };

  const handleReassignLead = async (leadId, toEmail) => {
    try {
      await apiClient.post(`/api/v1/tracking/leads/${leadId}/reassign`, { assigned_to: toEmail });
      // Remove lead from current view (it moved to the other sheet)
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setSelectedLead(null);
      setReassignTarget(null);
    } catch (e) {
      console.warn('Reassign failed:', e);
      setContractErrorModal({ message: 'Erreur lors de la réaffectation. ' + (e?.message || ''), isNdaMissing: false });
    }
  };

  // Mode MANUEL : donner (ou retirer) ce lead à un setter manuel. assigned_to inchangé.
  const giveLeadToSetter = async (leadId, setterId) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, manual_setter_id: setterId } : l)));
    try {
      const q = setterId ? `?setter_id=${setterId}` : '';
      await apiClient.put(`/api/v1/tracking/leads/${leadId}/give-to-setter${q}`, {});
    } catch (e) {
      console.warn('give-to-setter failed:', e);
      refreshData().catch(() => {}); // rollback par refetch
    }
  };

  // ── RÉPONDEUR COMMUN (pool global) ────────────────────────────────────────
  // Fetch du pool des répondeurs anciens (communs à tous les sales).
  const fetchCommonPool = useCallback(async () => {
    setCommonPoolLoading(true);
    try {
      const r = await apiClient.get('/api/v1/tracking/common-voicemail-pool');
      setCommonVoicemailLeads(Array.isArray(r?.leads) ? r.leads : []);
      setCommonPoolTotal(typeof r?.total === 'number' ? r.total : (Array.isArray(r?.leads) ? r.leads.length : 0));
    } catch (e) {
      console.warn('common-voicemail-pool fetch failed:', e);
    } finally {
      setCommonPoolLoading(false);
    }
  }, []);
  // Fetch au MONTAGE (compteur de la sidebar juste) + refresh à chaque ouverture
  // de la vue "Répondeur commun" (fraîcheur : d'autres ont pu prendre des leads).
  useEffect(() => { fetchCommonPool(); }, [fetchCommonPool]);
  useEffect(() => {
    if (sidebarView === 'common_pool') fetchCommonPool();
  }, [sidebarView, fetchCommonPool]);
  // Prise EXCLUSIVE d'un répondeur du pool (premier arrivé). Optimiste + rollback.
  const claimCommonVoicemail = async (leadId) => {
    setClaimingId(leadId);
    const _prevPool = commonVoicemailLeads;
    const _prevTotal = commonPoolTotal;
    setCommonVoicemailLeads(prev => prev.filter(l => l.id !== leadId)); // optimiste
    setCommonPoolTotal(t => Math.max(0, t - 1)); // compteur -1
    try {
      await apiClient.post(`/api/v1/tracking/leads/${leadId}/claim-common-voicemail`, {});
    } catch (e) {
      console.warn('claim-common-voicemail failed:', e);
      setCommonVoicemailLeads(_prevPool); // échec de la PRISE seulement -> on remet le lead
      setCommonPoolTotal(_prevTotal);
      setClaimingId(null);
      return;
    }
    // Succès : la prise tient (le lead a quitté le pool) -> on NE re-fetch PAS le pool (il est
    // plafonné, un re-fetch le remplirait et ferait rebondir le compteur). refreshData en
    // best-effort pour que le lead pris apparaisse dans "Nouveau lead".
    refreshData().catch(() => {});
    setClaimingId(null);
  };

  const handleInviteSales = async (sheetEmail, invitedEmail) => {
    try {
      await apiClient.post('/api/v1/tracking/invitations', { sheet_email: sheetEmail, invited_email: invitedEmail });
      // Refresh invitations
      const resp = await apiClient.get(`/api/v1/tracking/invitations?sheet_email=${encodeURIComponent(sheetEmail)}`);
      setSheetInvitations(resp.invitations || []);
    } catch (e) { console.warn('Invite failed:', e); }
  };

  const handleRevokeInvitation = async (invitationId, sheetEmail) => {
    try {
      await apiClient.delete(`/api/v1/tracking/invitations/${invitationId}`);
      setSheetInvitations(prev => prev.filter(i => i.id !== invitationId));
    } catch (e) { console.warn('Revoke failed:', e); }
  };

  const enterSheet = (email) => {
    const ghostParam = isAdmin && ghostMode ? '&ghost=true' : '';
    window.location.href = `/tracking-sheet?sheet_id=${encodeURIComponent(email)}${ghostParam}`;
  }; // 'leads' | 'add_lead' | 'calendar' | 'notifications' | 'kpis' | 'campaigns'
  const [calendarReload, setCalendarReload] = useState(0); // recharge le calendrier après une absence déclarée
  // Vacances/absences : declarees par le sales lui-meme, visibles dans le calendrier
  const [myUnavailability, setMyUnavailability] = useState([]);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const fetchMyUnavailability = async () => {
    try {
      const data = await apiClient.get('/api/v1/users/me/unavailability');
      setMyUnavailability(Array.isArray(data) ? data : []);
    } catch (e) { console.warn('Failed to fetch unavailability:', e); }
  };
  useEffect(() => { fetchMyUnavailability(); }, []);
  const [formData, setFormData] = useState({ full_name: '', phone: '', email: '', sector: '', company_type: '' });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTags, setFilterTags] = useState([]); // multi-select: r1_result or r2_result values (e.g. ['no_show', 'done'])
  const [filterOrigins, setFilterOrigins] = useState([]); // multi-select: origin values (e.g. ['BTP', 'cc'])
  const [filterMobileOnly, setFilterMobileOnly] = useState(false); // toggle : ne garde que les leads avec un mobile français (06 / 07) ; fixes, 09, étrangers et sans numéro écartés
  const [filterStatuses, setFilterStatuses] = useState([]); // multi-select: ['r1_done', 'r1_not_done', 'r2_done', 'r2_not_done']
  const [filterCallTime, setFilterCallTime] = useState([]); // multi-select: ['matin', 'apres_midi', 'soir'] — first_call_at time-of-day filter
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [openFilter, setOpenFilter] = useState(''); // '' | 'tag' | 'status' | 'sort' — which dropdown is open
  const [showFilters, setShowFilters] = useState(true); // toggle filter sidebar visibility
  const [openFilterSections, setOpenFilterSections] = useState(new Set()); // which sidebar filter sections are open
  const [dismissedNotifs, setDismissedNotifs] = useState([]); // loaded from backend GET /notifications/dismissed
  const [backendPerfAlerts, setBackendPerfAlerts] = useState(null); // from GET /notifications/performance
  // SMS notifications (live via WebSocket sms_notification events)
  // SMS popover (live via WebSocket sms_notification events) — ephemeral, anchored to navbar notif item
  const [smsNotifPopover, setSmsNotifPopover] = useState(null); // current { id, status, lead_id, lead_name, lead_phone, sms_type, sms_text, segments, error, sent_at }
  const [smsNotifClosing, setSmsNotifClosing] = useState(false); // triggers exit animation
  const smsNotifTimerRef = useRef(null);
  const closeSmsPopover = () => {
    setSmsNotifClosing(true);
    setTimeout(() => { setSmsNotifPopover(null); setSmsNotifClosing(false); }, 450);
  };
  const [activeWorkflow, setActiveWorkflow] = useState(null); // { leadId, contactResult, appointmentResult, r1Result, r1FollowUp, r2Result, newDate }

  // ── INLINE EDIT STATE ──────────────────────────────────────────────────
  const [editingField, setEditingField] = useState(null); // { leadId, field, value } or null
  const editInputRef = useRef(null);
  // SIREN inline edit: backend 422 error message displayed below the input
  const [sirenEditError, setSirenEditError] = useState('');

  // ── NDA POPUP STATE ────────────────────────────────────────────────────
  const ndaRequest = useRef(0);
  const [ndaPopup, setNdaPopup] = useState(null); // { leadId } or null — which lead's NDA popup is open
  const [ndaData, setNdaData] = useState(null); // AI-prefilled company data for popup
  const [ndaLoading, setNdaLoading] = useState(false); // ai-prefill loading state
  const [ndaPappersUrl, setNdaPappersUrl] = useState(''); // pappers URL after prefill
  const [ndaError, setNdaError] = useState('');
  const [ndaSuccess, setNdaSuccess] = useState(false);
  const [portalRevision, setPortalRevision] = useState(0);

  const [ndaGenerating, setNdaGenerating] = useState(false); // PDF generation in progress
  // ── Nouveau flux NDA (convention v2, 2026-08-20) : le prefill n'est plus
  // optionnel — étapes guidées : 'siren' (saisie/flag création) → 'dirigeants'
  // (choix de la/des personnes en face) → 'form' (infos préremplies, éditables).
  const [ndaStep, setNdaStep] = useState('form'); // 'siren' | 'dirigeants' | 'form'
  const [ndaSirenInput, setNdaSirenInput] = useState('');
  useEffect(()=>{
    if(!ndaPopup || !intakeContexts[ndaPopup.leadId]?.required) return;
    const previous=document.activeElement, overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const card=document.querySelector('.sj-nda-dialog');
    card?.setAttribute('tabindex','-1'); card?.focus();
    const onKey=e=>{
      if(e.key==='Escape'&&!ndaGenerating){e.preventDefault();ndaRequest.current++;setNdaPopup(null);setNdaData(null);}
      if(e.key!=='Tab'||!card)return;
      const nodes=[...card.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea')].filter(n=>n.getClientRects().length);
      if(!nodes.length){e.preventDefault();return;}
      if(e.shiftKey&&(document.activeElement===nodes[0]||document.activeElement===card)){e.preventDefault();nodes.at(-1).focus();}
      else if(!e.shiftKey&&(document.activeElement===nodes.at(-1)||document.activeElement===card)){e.preventDefault();nodes[0].focus();}
    };
    document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[ndaPopup?.leadId,ndaStep,ndaGenerating]);

  const [ndaDirigeants, setNdaDirigeants] = useState([]); // [{fullName, role}] renvoyés par Pappers
  const [ndaSelectedDirs, setNdaSelectedDirs] = useState([]); // indices des dirigeants retenus
  // ── Onglet « Options » de la page Détails (sociétés couvertes — Annexe 1
  // de la convention Opti'Lex, décochables ; flag société en création).
  const [detailOptionsOpen, setDetailOptionsOpen] = useState(false);
  const [coveredCompanies, setCoveredCompanies] = useState(null); // null = pas encore chargé
  const [coveredLoading, setCoveredLoading] = useState(false);
  const [manualCompany, setManualCompany] = useState({ denomination: '', siren: '' });

  const loadCoveredCompanies = async (leadId) => {
    setCoveredLoading(true);
    try {
      const d = await apiClient.get(`/api/v1/tracking/leads/${leadId}/covered-companies`);
      setCoveredCompanies(d.companies || []);
    } catch (e) {
      console.warn('Chargement sociétés couvertes échoué:', e);
      setCoveredCompanies([]);
    } finally {
      setCoveredLoading(false);
    }
  };

  const toggleCoveredCompany = async (leadId, cc) => {
    // Optimiste + rollback : décocher = la société sort de l'Annexe 1.
    setCoveredCompanies(prev => prev.map(c => c.id === cc.id ? { ...c, selected: !cc.selected } : c));
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}/covered-companies/${cc.id}`, { selected: !cc.selected });
    } catch (e) {
      setCoveredCompanies(prev => prev.map(c => c.id === cc.id ? { ...c, selected: cc.selected } : c));
      console.error('Toggle société couverte échoué:', e);
    }
  };

  const addManualCoveredCompany = async (leadId) => {
    const deno = manualCompany.denomination.trim();
    if (!deno) return;
    try {
      const d = await apiClient.post(`/api/v1/tracking/leads/${leadId}/covered-companies`, {
        denomination: deno,
        siren: manualCompany.siren.trim() || null,
      });
      setCoveredCompanies(d.companies || []);
      setManualCompany({ denomination: '', siren: '' });
    } catch (e) {
      console.error('Ajout société manuel échoué:', e);
    }
  };

  const toggleLeadInCreation = async (lead) => {
    const next = !lead.company_in_creation;
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { company_in_creation: next });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, company_in_creation: next } : l));
    } catch (e) {
      console.error('Flag société en création échoué:', e);
    }
  };

  // Reset de l'onglet Options quand on change de lead sélectionné.
  useEffect(() => {
    setDetailOptionsOpen(false);
    setCoveredCompanies(null);
    setManualCompany({ denomination: '', siren: '' });
  }, [selectedLead]);

  // Chantier réactivité : ouvrir le détail d'un lead = « traité » (stoppe le
  // SLA 5 min, ouvre la fenêtre de 3 jours). Fire-and-forget, idempotent côté
  // serveur, silencieux si l'utilisateur n'est pas le sales assigné.
  useEffect(() => {
    if (!selectedLead) return;
    pingTreated(selectedLead);
  }, [selectedLead]);

  // ── CAMPAIGN STATE ──────────────────────────────────────────────────────
  const [openCampaign, setOpenCampaign] = useState(null); // campaign object or null
  const [campaignRect, setCampaignRect] = useState(null); // source DOMRect for animation
  const [campaignClosing, setCampaignClosing] = useState(false); // closing animation flag

  // ── DERIVED DATA ──────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const counts = {};
    CATEGORIES.forEach(cat => { counts[cat.key] = 0; });
    // Onglet Nouveau lead : on ne compte PAS les leads donnés à un setter
    // (manual_setter_id) — ce ne sont plus des leads que le sales doit traiter,
    // ils vivent dans le conteneur "Donnés". Les autres onglets comptent normalement.
    leads.forEach(l => {
      if (counts[l.status] === undefined) return;
      if (l.status === 'new' && l.manual_setter_id) return;
      counts[l.status]++;
    });
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const catKey = CATEGORIES[activeTab].key;
    let result = leads.filter(l => l.status === catKey && !exitingCards.has(l.id));
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(l =>
        (l.full_name && l.full_name.toLowerCase().includes(q)) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.phone && l.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      );
    }
    // Filter by origin (niche)
    if (filterOrigins.length > 0) {
      result = result.filter(l => filterOrigins.includes(l.origin));
    }
    // Filter "Téléphones mobiles" : numéro normalisé 06 / 07 (+33, 0033…), un champ à plusieurs numéros est gardé
    // dès qu'un numéro est un mobile ; fixes, 09, numéros étrangers et leads sans numéro sont écartés.
    if (filterMobileOnly) {
      result = result.filter(l => isMobilePhone(l.phone));
    }
    // Filter by tag (qualification result) — tab-contextual field
    if (filterTags.length > 0) {
      if (catKey === 'r1') {
        result = result.filter(l => filterTags.includes(l.r1_result));
      } else if (catKey === 'r2') {
        result = result.filter(l => filterTags.includes(l.r2_result));
      } else {
        result = result.filter(l => filterTags.includes(l.r1_result) || filterTags.includes(l.r2_result));
      }
    }
    // Filter by qualification status (multi-select)
    if (filterStatuses.length > 0) {
      result = result.filter(l => {
        return filterStatuses.some(s => {
          if (s === 'r1_scheduled') { const dp = l.r1 ? l.r1.slice(0,10) < parisToday() : false; return (!l.r1_result || l.r1_result === 'rescheduled') && !dp; }
          if (s === 'r1_waiting') { const dp = l.r1 ? l.r1.slice(0,10) < parisToday() : false; return l.r1_result === 'no_show' || ((!l.r1_result || l.r1_result === 'rescheduled') && dp); }
          if (s === 'r1_done') return l.r1_result === 'done';
          if (s === 'r1_cancelled') return l.r1_result === 'cancelled';
          if (s === 'r1_setter_placed') return l.r1_placed_by_setter_id != null;
          if (s === 'r1_not_done') return !l.r1_result || l.r1_result !== 'done';
          if (s === 'r2_scheduled') { const dp = l.r2 ? l.r2.slice(0,10) < parisToday() : false; return (!l.r2_result || l.r2_result === 'reporte') && !dp; }
          if (s === 'r2_pending') { const dp = l.r2 ? l.r2.slice(0,10) < parisToday() : false; return l.r2_result === 'no_show' || ['comptable', 'associe', 'reflexion', 'relire_contrat', 'pas_decision_jour', 'tresorerie'].includes(l.r2_result) || ((!l.r2_result || l.r2_result === 'reporte') && dp); }
          if (s === 'r2_done') return l.r2_result === 'done';
          if (s === 'r2_cancelled') return l.r2_result === 'pas_interesse' || l.r2_result === 'annule';
          if (s === 'r2_not_done') return !l.r2_result || l.r2_result !== 'done';
          if (s === 'prio_high') return (l.lead_priority || 'medium') === 'high';
          if (s === 'prio_medium') return (l.lead_priority || 'medium') === 'medium';
          if (s === 'prio_low') return (l.lead_priority || 'medium') === 'low';
          if (s === 'contacted') return !!l.first_contact_date;
          if (s === 'not_contacted') return !l.first_contact_date;
          return false;
        });
      });
    }
    // Filter by first_call_at time-of-day (voicemail/callback tabs)
    if (filterCallTime.length > 0 && (catKey === 'voicemail' || catKey === 'callback')) {
      result = result.filter(l => {
        if (!l.first_call_at) return false;
        const h = new Date(l.first_call_at).getHours();
        return filterCallTime.some(t => {
          if (t === 'matin') return h >= 8 && h < 12;
          if (t === 'apres_midi') return h >= 12 && h < 18;
          if (t === 'soir') return h >= 18 || h < 8;
          return false;
        });
      });
    }
    // Sort: signed tab by most recent signature, others by assigned_at
    if (catKey === 'signed') {
      result = [...result].sort((a, b) => (b.contract_signed_at || b.assigned_at || '').localeCompare(a.contract_signed_at || a.assigned_at || ''));
    } else if (sortOrder === 'oldest') {
      result = [...result].sort((a, b) => (a.assigned_at || '').localeCompare(b.assigned_at || ''));
    } else {
      result = [...result].sort((a, b) => (b.assigned_at || '').localeCompare(a.assigned_at || ''));
    }
    return result;
  }, [leads, activeTab, exitingCards, searchQuery, filterTags, filterStatuses, filterOrigins, filterMobileOnly, filterCallTime, sortOrder]);

  // Dismiss a notification (optimistic + backend persist)
  const dismissNotif = (key) => {
    setDismissedNotifs(prev => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
    apiClient.post('/api/v1/notifications/dismiss', { key }).catch(e => console.warn('Dismiss failed:', e));
  };

  // Notification badges: count leads with meetings today per tab
  const tabNotifications = useMemo(() => {
    const notifs = {};
    CATEGORIES.forEach(cat => { notifs[cat.key] = 0; });
    leads.forEach(l => {
      if (l.status === 'r1' && toDateOnly(l.r1) === TODAY) notifs.r1++;
      if (l.status === 'r2' && toDateOnly(l.r2) === TODAY) notifs.r2++;
    });
    return notifs;
  }, [leads]);

  // Weekly performance alerts (from backend, with client-side fallback)
  const perfAlerts = useMemo(() => {
    const LABELS = {
      r1_closing: { name: 'R1', threshold: 60, warnColor: '#f59e0b', warnMsg: 'Trop de R1 annulés.' },
      r2_closing: { name: 'R2', threshold: 80, warnColor: '#fb923c', warnMsg: 'Trop de no-shows R2.' },
      signature_closing: { name: 'signature', threshold: 33, warnColor: '#ef4444', warnMsg: 'Objectif 1/3 non atteint.' },
    };

    if (backendPerfAlerts) {
      return backendPerfAlerts.map(a => {
        const cfg = LABELS[a.type] || { name: a.type, threshold: a.threshold, warnColor: '#ef4444', warnMsg: '' };
        return {
          key: a.key,
          type: 'perf',
          icon: a.good ? '✓' : '⚠',
          color: a.good ? '#10b981' : cfg.warnColor,
          title: a.good ? `Bon closing ${cfg.name} : ${a.rate}%` : `Closing ${cfg.name} faible : ${a.rate}%`,
          desc: a.good
            ? `Objectif ${a.threshold}% atteint`
            : `${a.rate}% — objectif ${a.threshold}% non atteint. ${cfg.warnMsg}`,
        };
      });
    }

    // Fallback: client-side calculation
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const weekNum = Math.ceil(((now - jan4) / 86400000 + jan4.getDay() + 1) / 7);
    const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    const alerts = [];
    const r1Total = leads.filter(l => l.r1_result).length;
    const r1Done = leads.filter(l => l.r1_result === 'done').length;
    const r1Rate = r1Total > 0 ? Math.round((r1Done / r1Total) * 100) : null;
    if (r1Rate !== null) {
      const good = r1Rate >= 60;
      alerts.push({ key: `perf-r1-${weekKey}`, type: 'perf', icon: good ? '✓' : '⚠', color: good ? '#10b981' : '#f59e0b',
        title: good ? `Bon closing R1 : ${r1Rate}%` : `Closing R1 faible : ${r1Rate}%`,
        desc: good ? `${r1Done}/${r1Total} R1 effectués — objectif 60% atteint` : `${r1Done}/${r1Total} R1 effectués — objectif 60% non atteint. Trop de R1 annulés.` });
    }
    const r2Total = leads.filter(l => l.r2_result).length;
    const r2Done = leads.filter(l => l.r2_result === 'done').length;
    const r2Rate = r2Total > 0 ? Math.round((r2Done / r2Total) * 100) : null;
    if (r2Rate !== null) {
      const good = r2Rate >= 80;
      alerts.push({ key: `perf-r2-${weekKey}`, type: 'perf', icon: good ? '✓' : '⚠', color: good ? '#10b981' : '#fb923c',
        title: good ? `Bon closing R2 : ${r2Rate}%` : `Closing R2 faible : ${r2Rate}%`,
        desc: good ? `${r2Done}/${r2Total} R2 effectués — objectif 80% atteint` : `${r2Done}/${r2Total} R2 effectués — objectif 80% non atteint. Trop de no-shows.` });
    }
    const signed = leads.filter(l => l.status === 'signed').length;
    const sigRate = r2Done > 0 ? Math.round((signed / r2Done) * 100) : null;
    if (sigRate !== null) {
      const good = sigRate >= 33;
      alerts.push({ key: `perf-sig-${weekKey}`, type: 'perf', icon: good ? '✓' : '⚠', color: good ? '#10b981' : '#ef4444',
        title: good ? `Bon closing signature : ${sigRate}%` : `Closing signature faible : ${sigRate}%`,
        desc: good ? `${signed}/${r2Done} signés après R2 — objectif 1/3 atteint` : `${signed}/${r2Done} signés après R2 — objectif 1/3 non atteint.` });
    }
    return alerts;
  }, [leads, backendPerfAlerts]);

  // Auto-dismiss all notifications when user visits the Notifications view
  useEffect(() => {
    if (sidebarView !== 'notifications') return;
    const meetingKeys = leads
      .filter(l => (l.status === 'r1' && toDateOnly(l.r1) === TODAY) || (l.status === 'r2' && toDateOnly(l.r2) === TODAY))
      .map(l => l.status === 'r1' ? `r1-${l.id}-${TODAY}` : `r2-${l.id}-${TODAY}`);
    const allKeys = [...meetingKeys, ...perfAlerts.map(a => a.key)];
    const unread = allKeys.filter(k => !dismissedNotifs.includes(k));
    if (unread.length > 0) {
      unread.forEach(k => dismissNotif(k));
    }
  }, [sidebarView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Badge bounce when counts change
  useEffect(() => {
    if (prevCountsRef.current) {
      const changed = new Set();
      CATEGORIES.forEach((cat, i) => {
        if (prevCountsRef.current[cat.key] !== tabCounts[cat.key]) changed.add(i);
      });
      if (changed.size > 0) {
        setAnimatingBadges(changed);
        setTimeout(() => setAnimatingBadges(new Set()), 350);
      }
    }
    prevCountsRef.current = { ...tabCounts };
  }, [tabCounts]);

  // ── SCROLL SELECTED PILL INTO VIEW ──────────────────────────────────────────
  useEffect(() => {
    if (selectedLead) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`lead-pill-${selectedLead}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }, [selectedLead]);

  // ── FLYING CARD ANIMATION (FLIP shared-element transition) ───────────────
  const triggerFlyAnimation = (leadId, lead, newStatus) => {
    flyCleanupRef.current.forEach(clearTimeout);
    flyCleanupRef.current = [];
    const pillEl = document.getElementById(`lead-pill-${leadId}`);
    const srcEl = pillEl;
    const destCatIdx = CATEGORIES.findIndex(c => c.key === newStatus);
    const tabEl = document.querySelector(`[data-tab-key="${newStatus}"]`);
    if (!srcEl || !tabEl || destCatIdx === -1) return;
    const badgeEl = tabEl.querySelector('[data-tab-badge]');
    const sourceRect = srcEl.getBoundingClientRect();
    const destRect = (badgeEl || tabEl).getBoundingClientRect();
    const dx = (destRect.left + destRect.width / 2) - (sourceRect.left + sourceRect.width / 2);
    const dy = (destRect.top + destRect.height / 2) - (sourceRect.top + sourceRect.height / 2);
    setFlyingCard({
      lead: { full_name: lead.full_name, origin: lead.origin, cc_sector: lead.cc_sector },
      sourceRect: { left: sourceRect.left, top: sourceRect.top, width: sourceRect.width, height: sourceRect.height },
      dx, dy,
      catColor: CATEGORIES[destCatIdx].color,
      destCatIndex: destCatIdx,
      wasExpanded: false,
    });
    flyCleanupRef.current = [
      setTimeout(() => setGlowingTab(destCatIdx), 520),
      setTimeout(() => setFlyingCard(null), 820),
      setTimeout(() => setGlowingTab(null), 1060),
    ];
  };

  useEffect(() => {
    if (!flyingCard) return;
    const el = document.getElementById('flying-card-clone');
    if (!el) return;
    const { dx, dy } = flyingCard;
    // Apple Genie suction — exaggerated stretch + trapezoid pinch
    // perspective(600px) = very close camera → heavy 3D distortion on rotateX
    // Phase 1 (0-22%): card stretches tall + top edges pinch hard = visible trapezoid
    // Phase 2 (22-100%): funnel compresses toward destination tab
    el.animate([
      { transform: 'perspective(600px) translate3d(0, 0, 0) rotateX(0deg) scaleX(1) scaleY(1)', opacity: 1 },
      { transform: `perspective(600px) translate3d(0, ${dy * 0.005}px, 0) rotateX(6deg) scaleX(0.96) scaleY(1.18)`, opacity: 1, offset: 0.06 },
      { transform: `perspective(600px) translate3d(0, ${dy * 0.01}px, 0) rotateX(12deg) scaleX(0.91) scaleY(1.28)`, opacity: 1, offset: 0.13 },
      { transform: `perspective(600px) translate3d(${dx * 0.04}px, ${dy * 0.04}px, 0) rotateX(16deg) scaleX(0.86) scaleY(1.18)`, opacity: 1, offset: 0.20 },
      { transform: `perspective(600px) translate3d(${dx * 0.22}px, ${dy * 0.14}px, 0) rotateX(24deg) scaleX(0.62) scaleY(0.82)`, opacity: 0.97, offset: 0.32 },
      { transform: `perspective(600px) translate3d(${dx * 0.48}px, ${dy * 0.34}px, 0) rotateX(36deg) scaleX(0.32) scaleY(0.55)`, opacity: 0.92, offset: 0.46 },
      { transform: `perspective(600px) translate3d(${dx * 0.74}px, ${dy * 0.60}px, 0) rotateX(46deg) scaleX(0.11) scaleY(0.28)`, opacity: 0.70, offset: 0.62 },
      { transform: `perspective(600px) translate3d(${dx * 0.91}px, ${dy * 0.84}px, 0) rotateX(54deg) scaleX(0.03) scaleY(0.10)`, opacity: 0.35, offset: 0.78 },
      { transform: `perspective(600px) translate3d(${dx}px, ${dy}px, 0) rotateX(60deg) scaleX(0.01) scaleY(0.02)`, opacity: 0.08 },
    ], { duration: 740, easing: 'cubic-bezier(0.22, 0, 0.68, 0.35)', fill: 'forwards' });
  }, [flyingCard]);

  // Cleanup fly timers on unmount
  useEffect(() => () => { flyCleanupRef.current.forEach(clearTimeout); }, []);

  // ── CONTRACT FETCH ────────────────────────────────────────────────────────
  const fetchLeadContracts = async (leadId) => {
    try {
      // Every contract of the lead, whoever sent it (see utils/leadContracts).
      const { list, senders } = await fetchContractsOfLead(apiClient, leadId);
      setLeadContracts(prev => ({ ...prev, [leadId]: list }));
      setContractSenders(prev => ({ ...prev, ...senders }));
      return list;
    } catch {
      setLeadContracts(prev => ({ ...prev, [leadId]: [] }));
      return [];
    }
  };

  // Fetch contracts from R1 too: sending a contract does not create an R2.
  // Auto-move leads with signed contracts to "signed" tab
  const r1CatIndex = CATEGORIES.findIndex(c => c.key === 'r1');
  const r2CatIndex = CATEGORIES.findIndex(c => c.key === 'r2');
  const r3CatIndex = CATEGORIES.findIndex(c => c.key === 'r3');
  useEffect(() => {
    if (activeTab !== r1CatIndex && activeTab !== r2CatIndex && activeTab !== r3CatIndex) return;
    const contractLeads = leads.filter(l => activeTab === r1CatIndex ? l.status === 'r1' : l.status === 'r2' || l.status === 'r3');
    if (contractLeads.length === 0) return;
    setLoadingContracts(true);
    Promise.all(contractLeads.map(async (l) => {
      const contracts = await fetchLeadContracts(l.id);
      const hasSigned = contracts.some(c => c.yousign_status === 'done');
      if (hasSigned) {
        apiClient.patch(`/api/v1/tracking/leads/${l.id}`, { status: 'signed' }).catch(() => {});
        setLeads(prev => prev.map(ld => ld.id === l.id ? { ...ld, status: 'signed' } : ld));
      }
    })).finally(() => setLoadingContracts(false));
  }, [activeTab, leads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SUPABASE REALTIME: contract status updates (R1 + R2 + R3) ─────────────────
  useEffect(() => {
    if (activeTab !== r1CatIndex && activeTab !== r2CatIndex && activeTab !== r3CatIndex) return;
    const contractLeads = leads.filter(l => activeTab === r1CatIndex ? l.status === 'r1' : l.status === 'r2' || l.status === 'r3');
    if (contractLeads.length === 0) return;

    const contractLeadIds = contractLeads.map(l => l.id);
    const channel = supabase
      .channel('contract-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'contracts' },
        (payload) => {
          const updated = payload.new;
          if (!updated.lead_id || !contractLeadIds.includes(updated.lead_id)) return;
          fetchLeadContracts(updated.lead_id);
          // Auto-move lead to "signed" tab when contract is signed
          if (updated.yousign_status === 'done') {
            apiClient.patch(`/api/v1/tracking/leads/${updated.lead_id}`, { status: 'signed' }).catch(() => {});
            setSigningCard(updated.lead_id);
            setTimeout(() => {
              setSigningCard(null);
              const lead = leads.find(l => l.id === updated.lead_id);
              if (lead) triggerFlyAnimation(updated.lead_id, lead, 'signed');
              if (selectedLead === updated.lead_id) setSelectedLead(null);
              setExitingCards(prev => new Set(prev).add(updated.lead_id));
            }, 700);
            setTimeout(() => {
              setLeads(prev => prev.map(l => l.id === updated.lead_id ? { ...l, status: 'signed' } : l));
              setExitingCards(prev => { const s = new Set(prev); s.delete(updated.lead_id); return s; });
            }, 1550);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, leads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── TAB KEYBOARD NAVIGATION ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K — open spotlight search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSpotlightOpen(true);
        setSpotlightQuery('');
        setTimeout(() => spotlightInputRef.current?.focus(), 50);
        return;
      }
      if (e.key === 'Escape' && spotlightOpen) { setSpotlightOpen(false); return; }
      if (isTypingTarget(document.activeElement)) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleTabChange(Math.min(activeTab + 1, CATEGORIES.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleTabChange(Math.max(activeTab - 1, 0));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Toggle "effectués" filter (done tag)
        setFilterTags(prev => prev.includes('done') ? prev.filter(t => t !== 'done') : [...prev, 'done']);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, spotlightOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HANDLERS ──────────────────────────────────────────────────────────────
  // Place du pouce des onglets. `ready` : pas de glissement à la première mesure (il apparaît à sa place).
  useLayoutEffect(() => {
    const rail = tabRailRef.current;
    if (!rail) { setTabThumb(null); return undefined; }
    const place = () => {
      const el = rail.querySelector('[data-tab-active="true"]');
      setTabThumb((prev) => {
        if (!el) return null;
        const next = { left: el.offsetLeft, width: el.offsetWidth, ready: !!prev };
        return prev && prev.left === next.left && prev.width === next.width && prev.ready ? prev : next;
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [activeTab, sidebarView, tabCounts, calSettings?.r3_enabled]);

  // L'onglet actif reste visible dans sa rangée : au changement d'onglet seulement, et sans déplacer la page.
  useLayoutEffect(() => {
    const rail = tabRailRef.current;
    revealInRail(rail, rail?.querySelector('[data-tab-active="true"]'));
  }, [activeTab, sidebarView]);

  const handleTabChange = (idx) => {
    if (idx === activeTab) return;
    setDroppingTab(activeTab);
    prevTabRef.current = activeTab;
    setSelectedLead(null);
    setActiveTab(idx);
    setTabKey(k => k + 1);
    setFilterTags([]);
    setFilterStatuses([]);
    setFilterOrigins([]);
    setFilterCallTime([]);
    setOpenFilter('');
    // Clear dropping state after animation completes
    setTimeout(() => setDroppingTab(null), 320);
    // Broadcast lead deselection + tab change to other WebSocket users
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'lead_focus', lead_id: null }));
    }
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'tab_change', tab: CATEGORIES[idx]?.key || 'new' }));
    }
  };

  const copyToClipboard = (text, fieldKey, leadId) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1500);
    });
    if (leadId) pingTreated(leadId);
  };

  const triggerLeadMovedNotif = (lead, newStatus) => {
    // « Injoignable » sort le lead de la feuille (aucun onglet, c'est voulu) : on le dit au lieu de le laisser disparaître en silence.
    const destCat = CATEGORIES.find(c => c.key === (EXTRA_STATUS_MAP[newStatus] || newStatus))
      || (newStatus === 'unreachable' ? { label: 'Injoignable, sorti de votre feuille', color: '#8b867e' } : null);
    if (!destCat || !lead) return;
    const firstName = (lead.full_name || '').split(' ')[0];
    if (newStatus === 'r1' || newStatus === 'r2' || newStatus === 'r3') {
      const rdvType = newStatus === 'r1' ? 'R1' : newStatus === 'r2' ? 'R2' : 'R3';
      setNavNotif({ type: 'calendar_created', firstName, rdvType });
    } else {
      setNavNotif({ type: 'lead_moved', name: lead.full_name, destLabel: destCat.label, destColor: destCat.color });
    }
    setTimeout(() => setNavNotif(null), 3000);
  };

  const handleStatusChange = async (leadId, newStatus) => {
    if (newStatus === CATEGORIES[activeTab].key) return;
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { status: newStatus });
    } catch (err) {
      console.error("Erreur changement statut:", err);
      return;
    }
    if (newStatus === 'signed') {
      setSigningCard(leadId);
      setTimeout(() => {
        setSigningCard(null);
        const lead = leads.find(l => l.id === leadId);
        if (lead) { triggerFlyAnimation(leadId, lead, 'signed'); triggerLeadMovedNotif(lead, 'signed'); }
        if (selectedLead === leadId) setSelectedLead(null);
        setExitingCards(prev => new Set(prev).add(leadId));
      }, 700);
      setTimeout(() => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
      }, 1550);
    } else {
      const lead = leads.find(l => l.id === leadId);
      if (lead) { triggerFlyAnimation(leadId, lead, newStatus); triggerLeadMovedNotif(lead, newStatus); }
      if (selectedLead === leadId) setSelectedLead(null);
      setExitingCards(prev => new Set(prev).add(leadId));
      setTimeout(() => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
      }, 900);
    }
  };

  const handleNotesSave = async (leadId) => {
    setNotesError(null);
    const newNotes = editingNotes[leadId];
    if (newNotes === undefined) return;
    const hadNotes = leads.find(l => l.id === leadId)?.notes?.trim();
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { notes: newNotes });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, notes: newNotes } : l));
      setEditingNotes(prev => { const n = { ...prev }; delete n[leadId]; return n; });
      // Trigger sticker animation if note was just added (didn't have one before)
      if (!hadNotes && newNotes?.trim()) {
        setNoteJustSaved(leadId);
        setTimeout(() => setNoteJustSaved(null), 800);
      }
      return true;
    } catch (err) {
      setNotesError({leadId,message:"Le commentaire n’a pas été enregistré. Votre texte est conservé ; réessayez."});
      console.error("Erreur sauvegarde notes:", err);
      return false;
    }
  };

  const dateChangeTimers = useRef({}); // debounce per lead+field
  const dateChangeBefore = useRef({}); // valeur avant modification, par lead+champ
  const handleDateChange = async (leadId, field, value) => {
    const backendField = field === 'r1' ? 'r1_date' : field === 'r2' ? 'r2_date' : field === 'r3' ? 'r3_date' : field;
    const key = `${leadId}-${field}`;
    // La date d'avant, gardée pour y revenir si le serveur refuse (audit 11/11/2026 : un refus restait invisible).
    if (!(key in dateChangeBefore.current)) dateChangeBefore.current[key] = leads.find(l => l.id === leadId)?.[field];
    // Optimistic update immediately
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } : l));
    // Debounce the PATCH — cancel previous timer for same lead+field
    if (dateChangeTimers.current[key]) clearTimeout(dateChangeTimers.current[key]);
    dateChangeTimers.current[key] = setTimeout(async () => {
      delete dateChangeTimers.current[key];
      const before = dateChangeBefore.current[key];
      delete dateChangeBefore.current[key];
      try {
        const response = await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { [backendField]: value || null });
        if (response?.calendar_conflict) setCalendarError({ leadId, message: response.calendar_conflict.message || 'La date est enregistrée, mais un autre rendez-vous occupe ce créneau dans votre agenda.' });
        else setCalendarError(prev => (prev?.leadId === leadId ? null : prev));
      } catch (err) {
        console.error("Erreur mise à jour date:", err);
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: before } : l));
        setCalendarError({ leadId, message: err?.status === 409 ? 'Ce créneau est indisponible. La date n’a pas été changée.' : 'La date n’a pas pu être enregistrée. Elle est revenue à sa valeur précédente.' });
      }
    }, 500);
  };

  const handleEmployeeRangeChange = async (leadId, range) => {
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { employee_range: range });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, employee_range: range } : l));
    } catch (err) {
      console.error("Erreur mise à jour tranche:", err);
    }
  };

  const handleDocsReceivedToggle = async (leadId, currentValue) => {
    const newValue = !currentValue;
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, docs_received: newValue } : l));
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { docs_received: newValue });
    } catch (err) {
      console.error("Erreur mise à jour docs_received:", err);
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, docs_received: currentValue } : l));
    }
  };

  const handleSendContract = async (lead, intakeConfirmed = false) => {
    setSendingContract(lead.id);
    try {
      // Date choisie : envoyée seulement si le commercial l'a saisie. Sans elle,
      // la charge utile est strictement celle d'avant et le contrat porte la
      // date du jour.
      if (!intakeConfirmed && !await checkIntakeBeforeSend(lead.id, { type: "send" })) { setNavNotif(null); return; }
      if (!lead.employee_range) { setNavNotif(null); throw new Error('Choisissez le nombre de salariés avant de continuer.'); }
      const chosenDate = contractDates[lead.id];
      setNavNotif('sending');
      await apiClient.post('/api/v1/contracts/send', {
        lead_id: lead.id,
        employee_range: lead.employee_range,
        ...(chosenDate ? { contract_display_date: chosenDate } : {}),
      });
      await fetchLeadContracts(lead.id);
      // Sending a contract never schedules or qualifies an appointment.
      setR1ShortcutContract(null);
      setNavNotif('sent'); // triggers check animation → auto-clears after 2.5s in navbar
      // Clear navNotif from parent side after navbar has finished its animation
      setTimeout(() => setNavNotif(null), 3000);
    } catch (err) {
      console.error("Erreur envoi contrat:", err);
      reportContractError(err, lead.id, { type: 'send' });
      setNavNotif(null);
    } finally {
      setSendingContract(null);
    }
  };

  const handleResendContract = async (contractId, leadId, intakeConfirmed = false) => {
    if (!intakeConfirmed) {
      try { if (!await checkIntakeBeforeSend(leadId, { type: "resend", contractId })) return; }
      catch (error) { reportContractError(error, leadId, { type: 'resend', contractId }, { preparation: true }); return; }
    }
    setConfirmModal({
      title: 'Renvoyer le contrat ?',
      message: 'Un nouveau contrat sera créé et envoyé au client. L\'ancien sera annulé.',
      icon: '↻', color: '#fb923c', confirmLabel: 'Renvoyer',
      onConfirm: async () => {
        setConfirmModal(null);
        setResendingContract(leadId);
        setNavNotif('sending');
        try {
          // Le renvoi crée un nouveau contrat : on lui transmet le choix courant
          // du commercial. Champ vidé = null = date du jour, choix explicite.
          await apiClient.post(`/api/v1/contracts/${contractId}/resend`, {
            contract_display_date: contractDates[leadId] || null,
          });
          await fetchLeadContracts(leadId);
          setNavNotif('sent');
        } catch (err) {
          console.error("Erreur renvoi contrat:", err);
          setNavNotif(null);
          reportContractError(err, leadId, { type: 'resend', contractId });
        } finally {
          setResendingContract(null);
        }
      },
    });
  };

  const handleCancelContract = (contractId, leadId) => {
    setConfirmModal({
      title: 'Annuler ce contrat ?',
      message: 'Le client ne pourra plus signer ce contrat. Cette action est irréversible.',
      icon: '✕', color: '#ef4444', confirmLabel: 'Annuler le contrat',
      onConfirm: async () => {
        setConfirmModal(null);
        setCancelingContract(contractId);
        try {
          await apiClient.post(`/api/v1/contracts/${contractId}/cancel`);
          await fetchLeadContracts(leadId);
        } catch (err) {
          console.error("Erreur annulation contrat:", err);
          reportContractError(err, leadId, null, { operation: 'cancel' });
        } finally {
          setCancelingContract(null);
        }
      },
    });
  };

  // ── WORKFLOW HANDLER ─────────────────────────────────────────────────────
  const workflowSubmittingRef = useRef(false);
  const handleWorkflowSubmit = async (leadId, patchData, {strict = false} = {}) => {
    // Prevent double-submit (double-click, etc.)
    if (workflowSubmittingRef.current) {
      if (strict) throw new Error("Un enregistrement est en cours. Réessayez dans un instant.");
      return;
    }
    workflowSubmittingRef.current = true;
    setTimeout(() => { workflowSubmittingRef.current = false; }, 2000);
    const currentStatus = CATEGORIES[activeTab].key;
    const newStatus = patchData.status;
    // Check email required for R1/R2 date changes
    if (patchData.r1_date || patchData.r2_date) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && !lead.email) {
        if (strict) { workflowSubmittingRef.current = false; throw new Error("Ajoutez l’email du prospect dans sa fiche avant de fixer un rendez-vous."); }
        setCalendarError({ leadId, message: "Remplissez l'email du prospect avant de fixer un rendez-vous" });
        setTimeout(() => setCalendarError(null), 5000);
        return;
      }
    }
    let resp;
    try {
      resp = await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, patchData);
    } catch (err) {
      console.error("Erreur workflow:", err);
      if (strict) {
        workflowSubmittingRef.current = false;
        throw new Error(err.status === 409 ? 'Le créneau n’a pas pu être confirmé. Vérifiez l’agenda avant de réessayer.' : 'La qualification n’a pas pu être enregistrée. Vos choix sont conservés ; réessayez.');
      }
      // Handle 409 — commercial is busy on this slot
      if (err.status === 409) {
        const detail = err.data?.detail;
        const busyMsg = typeof detail === 'string' ? detail : detail?.message || "Vous êtes déjà occupé(e) sur ce créneau. Le rendez-vous a quand même été créé sur votre agenda.";
        setCalendarError({ leadId, message: busyMsg });
        setTimeout(() => setCalendarError(null), 5000);
      }
      return;
    }
    // Update meet_link from backend response
    if (resp) {
      const meetFields = {};
      if (resp.r1_meet_link) meetFields.r1_meet_link = resp.r1_meet_link;
      if (resp.r2_meet_link) meetFields.r2_meet_link = resp.r2_meet_link;
      if (resp.r1_event_id) meetFields.r1_event_id = resp.r1_event_id;
      if (resp.r2_event_id) meetFields.r2_event_id = resp.r2_event_id;
      // Rappel daté : le serveur tient le compteur de réaffectations (règle des 3 jours) ; on le reprend pour que la mention s'affiche aussitôt.
      if ('callback_description' in patchData && resp.lead?.callback_shifts != null) meetFields.callback_shifts = resp.lead.callback_shifts;
      if (Object.keys(meetFields).length > 0) {
        patchData = { ...patchData, ...meetFields };
      }
    }
    setActiveWorkflow(null);
    if (newStatus && newStatus !== currentStatus) {
      if (newStatus === 'signed') {
        setSigningCard(leadId);
        setTimeout(() => {
          setSigningCard(null);
          const lead = leads.find(l => l.id === leadId);
          if (lead) { triggerFlyAnimation(leadId, lead, 'signed'); triggerLeadMovedNotif(lead, 'signed'); }
          if (selectedLead === leadId) setSelectedLead(null);
          setExitingCards(prev => new Set(prev).add(leadId));
        }, 700);
        setTimeout(() => {
          setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patchData } : l));
          setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
        }, 1550);
      } else {
        const lead = leads.find(l => l.id === leadId);
        if (lead) { triggerFlyAnimation(leadId, lead, newStatus); triggerLeadMovedNotif(lead, newStatus); }
        if (selectedLead === leadId) setSelectedLead(null);
        setExitingCards(prev => new Set(prev).add(leadId));
        setTimeout(() => {
          setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patchData } : l));
          setExitingCards(prev => { const s = new Set(prev); s.delete(leadId); return s; });
        }, 900);
      }
    } else {
      // Update in place (no tab change)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...patchData } : l));
      // Trigger completed sticker animation when R1/R2 marked as done
      if (patchData.r1_result === 'done' || patchData.r2_result === 'done') {
        setCompletedSticker(true);
        setTimeout(() => setCompletedSticker(false), 600);
      }
    }
  };

  const formatDate = (d) => {
    if (!d) return null;
    const date = new Date(d.slice(0,10)+'T12:00:00Z');
    return date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" });
  };

  // ── SIDEBAR FORM HANDLERS ──────────────────────────────────────────────
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  };

  const handleFormSubmit = async () => {
    if (!formData.full_name.trim()) { setFormError('Le nom complet est requis'); return false; }
    if (!formData.phone.trim()) { setFormError('Le numéro de téléphone est requis'); return false; }
    setFormSubmitting(true);
    setFormError('');
    try {
      const payload = { full_name: formData.full_name.trim(), phone: formData.phone.trim() };
      if (formData.email.trim()) payload.email = formData.email.trim();
      if (formData.sector.trim()) payload.sector = formData.sector.trim();
      if (formData.company_type.trim()) payload.company_type = formData.company_type.trim();
      // Admin viewing another commercial's sheet → assign to that commercial
      if (isAdminView && viewingSheetId) payload.assigned_to = viewingSheetId;
      const resp = await apiClient.post('/api/v1/tracking/leads', payload);
      const newLead = resp.lead;
      if (newLead) {
        setLeads(prev => [...prev, {
          ...newLead,
          full_name: newLead.full_name || newLead.client || '',
          r1: newLead.r1_date || newLead.r1 || null,
          r2: newLead.r2_date || newLead.r2 || null,
        }]);
      }
      setFormSuccess(true);
      setFormData({ full_name: '', phone: '', email: '', sector: '', company_type: '' });
      setTimeout(() => setFormSuccess(false), 2500);
      return true;
    } catch (err) {
      // Anti-doublon backend (409 duplicate_lead) → pop-up « recherchez avec Cmd+F »
      if (err?.status === 409 && err?.data?.detail?.code === 'duplicate_lead') {
        setDuplicateLeadModal(true);
        return false;
      }
      console.error("Erreur création lead:", err);
      const detail = err?.response?.data?.detail || err?.data?.detail;
      const message = (typeof detail === 'string' && detail) || err?.message || "Erreur lors de la création du lead";
      setFormError(message);
      return false;
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── INLINE FIELD EDIT ──────────────────────────────────────────────────
  const startFieldEdit = (leadId, field, currentValue) => {
    setEditingField({ leadId, field, value: currentValue || '' });
    setTimeout(() => editInputRef.current?.focus(), 50);
  };
  const saveFieldEdit = async () => {
    if (!editingField) return;
    const { leadId, field, value } = editingField;
    const trimmed = value.trim();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) { setEditingField(null); return; }
    // No change → just close
    if (trimmed === (lead[field] || '').trim()) { setEditingField(null); return; }
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { [field]: trimmed || null });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: trimmed || null } : l));
    } catch (err) {
      // Anti-doublon backend : email/tél déjà portés par un autre lead → pop-up,
      // la valeur n'est pas appliquée.
      if (err?.status === 409 && err?.data?.detail?.code === 'duplicate_lead') {
        setDuplicateLeadModal(true);
      }
      console.error('Erreur mise à jour champ:', err);
    }
    setEditingField(null);
  };
  const cancelFieldEdit = () => { setEditingField(null); setSirenEditError(''); };
  // Rendre prioritaire un autre numéro ou un autre e-mail du lead (12/11/2026) : c'est le téléphone / l'e-mail du lead
  // qui sert aux SMS, aux relances et au contrat, donc on l'enregistre par la même route que la modification du champ
  // (mêmes contrôles, même pop-up anti-doublon). Rend vrai si le lead porte bien la nouvelle valeur.
  const promoteLeadContact = (leadId) => async (field, value) => {
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { [field]: value });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, [field]: value } : l));
      return true;
    } catch (err) {
      if (err?.status === 409 && err?.data?.detail?.code === 'duplicate_lead') setDuplicateLeadModal(true);
      console.error('Erreur changement de contact prioritaire:', err);
      return false;
    }
  };

  // ── SIREN INLINE EDIT (dedicated path: digit-only, ""-clear, 422-aware) ──
  // Generic saveFieldEdit sends `null` to clear, but the backend SIREN field
  // expects "" for clear. We also surface backend 422 messages discreetly.
  const saveSirenEdit = async () => {
    if (!editingField || editingField.field !== 'siren') return;
    const { leadId, value } = editingField;
    const normalized = normalizeSiren(value); // strip non-digits, may be ""
    // Only accept empty (clear) or exactly 9 digits — UI prevents > 9 input
    if (normalized.length !== 0 && normalized.length !== 9) {
      setSirenEditError('SIREN = 9 chiffres');
      return;
    }
    const lead = leads.find(l => l.id === leadId);
    if (!lead) { setEditingField(null); setSirenEditError(''); return; }
    // No change → just close
    if (normalized === (lead.siren || '')) { setEditingField(null); setSirenEditError(''); return; }
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, { siren: normalized });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, siren: normalized || null } : l));
      setEditingField(null);
      setSirenEditError('');
    } catch (err) {
      // 422 → invalid format; surface inline without closing the editor
      const msg = err?.data?.detail || err?.message || 'SIREN invalide';
      setSirenEditError(typeof msg === 'string' ? msg : 'SIREN invalide');
    }
  };

  // ── NDA POPUP HANDLERS ──────────────────────────────────────────────────
  const NDA_LEGAL_FORMS = ["SARL", "SAS", "SASU", "SA", "EURL", "SCI", "SNC", "EI"];
  const NDA_BUSINESS_TYPES = [
    "Ambulance", "Micro créche", "Dentiste", "Pharmacie", "Salle de sport",
    "Esthétique", "Tech", "Hôtellerie", "Grande Distribution", "Tertiaire",
    "BTP", "Boulangerie", "Immobilier", "Restauration", "Générales",
  ];
  const toSchemaLegalForm = (lf) => (lf === "EI" ? "Autre" : lf);

  const openNdaPopup = (lead, nextAction = null, returnToIntake = false) => {
    setNdaPopup({ leadId: lead.id, nextAction, returnToIntake, regenerating: !!lead.has_client_data || returnToIntake });
    setNdaPappersUrl('');
    setNdaData({
      legalName: lead.company_name || '',
      legalForm: 'SARL',
      siren: lead.siren || '',
      rcsCity: '',
      email: lead.email || '',
      phone: lead.phone || '',
      headOffice: { line1: '', postalCode: '', city: '', country: 'France' },
      representatives: [{ fullName: lead.full_name || '', role: 'Gérant' }],
      businessType: 'Générales',
      isInRegistration: !!lead.company_in_creation,
    });
    setNdaError('');
    setNdaSuccess(false);
    setNdaLoading(false);
    setNdaGenerating(false);
    // Aiguillage du nouveau flux (2026-08-20) : SIREN connu → prefill AUTO ;
    // société en création → form manuel ; sinon → étape saisie du SIREN.
    setNdaDirigeants([]);
    setNdaSelectedDirs([]);
    setNdaSirenInput(lead.siren || '');
    const sirenDigits = normalizeSiren(lead.siren || '');
    if (lead.company_in_creation) {
      setNdaStep('form');
    } else if (sirenDigits.length === 9 && isValidSiren(sirenDigits)) {
      setNdaStep('siren');
      runAutoPrefill(sirenDigits);
    } else {
      setNdaStep('siren');
    }
  };

  // Prefill automatique via SIREN (le bouton manuel n'existe plus). En cas de
  // plusieurs dirigeants, on passe par l'étape de sélection ; sinon direct au
  // formulaire prérempli. En échec, rester à l’identification de la société.
  const runAutoPrefill = async (sirenDigits) => {
    const request=++ndaRequest.current;
    setNdaLoading(true);
    setNdaError('');
    try {
      const data = await apiClient.post('/api/v1/contracts/ai-prefill-by-siren', { siren: sirenDigits });
      if(request!==ndaRequest.current)return;
      if (!data?.legal_name?.trim()) throw Object.assign(new Error('Entreprise introuvable'), {status:404});
      const updates = {};
      if (data.legal_name) updates.legalName = data.legal_name;
      if (data.legal_form) {
        const match = NDA_LEGAL_FORMS.find(f => f.toUpperCase() === data.legal_form.toUpperCase());
        if (match) updates.legalForm = match;
      }
      if (data.siren) updates.siren = data.siren;
      if (data.rcs_city) updates.rcsCity = data.rcs_city;
      if (data.address) {
        updates.headOffice = {
          line1: data.address.line1 || '',
          postalCode: data.address.postal_code || '',
          city: data.address.city || '',
          country: data.address.country || 'France',
        };
      }
      if (data.business_type && NDA_BUSINESS_TYPES.includes(data.business_type)) {
        updates.businessType = data.business_type;
      }
      const reps = ndaRepresentatives(data);
      setNdaError(data.representative_notice || '');
      setNdaData(prev => ({ ...prev, ...updates }));
      if (data.pappers_url) setNdaPappersUrl(data.pappers_url);
      setNdaSuccess(true);
      if (reps.length > 1) {
        // Plusieurs dirigeants → le sales choisit qui il a en face de lui.
        setNdaDirigeants(reps);
        setNdaSelectedDirs([]);
        setNdaStep('dirigeants');
      } else {
        setNdaData(prev => ({ ...prev, representatives: reps.length ? reps : [emptyRepresentative()] }));
        setNdaStep('form');
      }
    } catch (err) {
      if(request!==ndaRequest.current)return;
      if (err?.status === 404) {
        setNdaError("Aucune entreprise trouvée pour ce SIREN. Vérifiez le numéro, ou choisissez \"En cours d'immatriculation\" si la société est en création.");
      } else {
        setNdaError('La recherche est momentanément indisponible. Réessayez pour vérifier ce SIREN.');
      }
      setNdaSuccess(false);
      setNdaSirenInput(sirenDigits);
      setNdaStep('siren');
    } finally {
      if(request===ndaRequest.current)setNdaLoading(false);
    }
  };

  // Étape SIREN : saisie dans le pop-up → enregistrée sur le lead (page
  // Détails) puis prefill auto. Ou flag « société en création » → form manuel.
  const handleNdaSirenContinue = async () => {
    if (!ndaPopup) return;
    const digits = normalizeSiren(ndaSirenInput);
    if (digits.length !== 9 || !isValidSiren(digits)) { setNdaError('SIREN invalide — 9 chiffres attendus.'); return; }
    setNdaError('');
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${ndaPopup.leadId}`, { siren: digits });
      setLeads(prev => prev.map(l => l.id === ndaPopup.leadId ? { ...l, siren: digits } : l));
    } catch (err) {
      if (err?.status === 409 && err?.data?.detail?.code === 'duplicate_lead') { setDuplicateLeadModal(true); return; }
      console.warn('Enregistrement SIREN sur le lead échoué (non bloquant):', err);
    }
    setNdaData(prev => ({ ...prev, siren: digits }));
    setNdaStep('siren');
    runAutoPrefill(digits);
  };

  const handleNdaInCreation = async () => {
    if (!ndaPopup) return;
    try {
      await apiClient.patch(`/api/v1/tracking/leads/${ndaPopup.leadId}`, { company_in_creation: true });
      setLeads(prev => prev.map(l => l.id === ndaPopup.leadId ? { ...l, company_in_creation: true } : l));
    } catch (err) {
      console.warn('Flag société en création non enregistré (non bloquant):', err);
    }
    setNdaData(prev => ({ ...prev, isInRegistration: true, siren: '' }));
    setNdaError('');
    setNdaStep('form');
  };

  // (handleNdaPrefill supprimé le 2026-08-20 : le prefill est désormais
  //  automatique — voir runAutoPrefill / nouveau flux NDA.)

  const handleNdaGenerate = async () => {
    if (!ndaData || !ndaPopup || ndaGenerating || ndaLoading) return;
    const lead = leads.find(l => l.id === ndaPopup.leadId);
    if (!lead) return;
    if (!ndaData.legalName.trim()) { setNdaError('La raison sociale est requise'); return; }
    if (!ndaData.siren.trim() && !ndaData.isInRegistration) { setNdaError('Le SIREN est requis (ou cochez "En cours d\'immatriculation")'); return; }
    setNdaGenerating(true);
    setNdaError('');
    try {
      // Save company_name to lead if changed
      if (ndaData.legalName !== (lead.company_name || '')) {
        await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { company_name: ndaData.legalName });
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, company_name: ndaData.legalName } : l));
      }
      // Build payload same as ContractNew
      const { businessType: _bt, ...rest } = ndaData;
      const payloadCompany = {
        ...rest,
        legalForm: toSchemaLegalForm(ndaData.legalForm),
        rcsCity: ndaData.legalForm === 'EI' ? '' : ndaData.rcsCity,
        siren: ndaData.isInRegistration ? '' : ndaData.siren,
        isInRegistration: ndaData.isInRegistration || false,
      };
      // Generate PDF
      const blob = await generateSavedNda({
        company: payloadCompany, meta: { typeEntreprise: ndaData.businessType || 'Général' },
        leadId: lead.id, apiClient,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NDA_${ndaData.legalName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Convention v2 : récupère via Pappers TOUTES les sociétés des dirigeants
      // retenus (Annexe 1, tout coché par défaut) — fire-and-forget, décochable
      // ensuite dans l'onglet Options de la page Détails. Pas de fetch pour une
      // société en création (pas de SIREN). Une régénération conserve les choix
      // existants : relancer la découverte les remplacerait par « tout coché ».
      if (!ndaData.isInRegistration && !ndaPopup.regenerating) {
        const dirs = ndaData.representatives.map(r => (r.fullName || '').trim()).filter(Boolean);
        if (dirs.length) {
          const discovery = apiClient.post(`/api/v1/tracking/leads/${lead.id}/covered-companies/fetch`, { dirigeants: dirs });
          if (ndaPopup.nextAction || isGuidedLead(lead)) { try { await discovery; } catch { throw new Error('Les sociétés du client n’ont pas pu être récupérées. Réessayez la préparation du NDA pour compléter la fiche.'); } }
          else discovery.catch(e => console.warn('Sociétés couvertes (annexe) non récupérées:', e));
        }
      }
      if (ndaPopup.nextAction) {
        const unchanged = await checkIntakeBeforeSend(lead.id,ndaPopup.nextAction);
        if (unchanged) throw new Error('Le parcours de ce dossier a changé. Fermez puis rouvrez le dossier avant de continuer.');
      }
      if (!ndaPopup.nextAction && ndaPopup.returnToIntake) await openIntake(lead.id);
      // Success → close popup
      ndaRequest.current++;setNdaPopup(null);
      setNdaData(null);
      // Refresh leads to get updated sector
      refreshData().catch(() => {});
    } catch (err) {
      console.error('Erreur NDA:', err);
      setNdaError(err?.message || 'Erreur réseau lors de la génération');
    } finally {
      setNdaGenerating(false);
    }
  };

  // ── LOADING (blank screen — text only after 3s) ─────────────────────────────
  if (loading) {
    return <div style={{ minHeight: "100vh", background: C.surface }} />;
  }

  const activeCat = CATEGORIES[activeTab];

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="ts-owner" style={{
      padding: 0,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      fontFeatureSettings: "'cv11','ss01'",
      background: C.surface,
    }}>
      {/* Keyframe animations */}
      <style>{`
        html:not(.dark-mode), body:not(.dark-mode) { background: #f4f2ef !important; }
        html.dark-mode, body.dark-mode { background: #141414 !important; }
        /* Calendrier du sélecteur de date en mode sombre (il est rendu dans le body). */
        html.dark-mode .fr-calendar { background: #262626; color: #f2f2f2; border-color: #3a3a3a; box-shadow: 0 14px 34px rgba(0,0,0,.5); }
        html.dark-mode .fr-calendar button:hover { background: #3a3a3a; }
        html.dark-mode .fr-calendar-grid button[aria-pressed=true] { background: #ededed; color: #141414; }
        html.dark-mode .fr-calendar-grid small { color: #7d7d7d; }
        html.dark-mode .fr-date-control .fr-date-trigger:hover { background: #3a3a3a; }
        /* Dossier du contrat dans la fiche (composant du board) : textes et survol en mode sombre. */
        html.dark-mode .ts-contract .cf-title, html.dark-mode .ts-contract .cf-status { color: #f2f2f2; }
        html.dark-mode .ts-contract .cf-sub { color: #7d7d7d; }
        html.dark-mode .ts-contract .cf.is-clickable:hover { background: #262626; }
        html.dark-mode body:has(.ts-owner) *::-webkit-scrollbar { width: 10px !important; height: 10px !important; }
        html.dark-mode body:has(.ts-owner) *::-webkit-scrollbar-track,
        html.dark-mode body:has(.ts-owner) *::-webkit-scrollbar-corner { background: transparent !important; }
        html.dark-mode body:has(.ts-owner) *::-webkit-scrollbar-thumb {
          background: #3a3a3a !important; border: 3px solid transparent !important;
          border-radius: 999px !important; background-clip: padding-box !important;
        }
        html.dark-mode body:has(.ts-owner) *:hover::-webkit-scrollbar-thumb { background-color: #4a4a4a !important; }
        html.dark-mode body:has(.ts-owner) *::-webkit-scrollbar-thumb:hover { background-color: #6b6b6b !important; }
        @supports not selector(::-webkit-scrollbar) {
          html.dark-mode body:has(.ts-owner) * { scrollbar-width: thin; scrollbar-color: #3a3a3a transparent; }
        }
        /* Barres de défilement en pilule (STYLE-OWNER §8), mode clair, fenêtres et menus du body compris. */
        html:not(.dark-mode) body:has(.ts-owner) *::-webkit-scrollbar { width: 10px !important; height: 10px !important; }
        html:not(.dark-mode) body:has(.ts-owner) *::-webkit-scrollbar-track,
        html:not(.dark-mode) body:has(.ts-owner) *::-webkit-scrollbar-corner { background: transparent !important; }
        html:not(.dark-mode) body:has(.ts-owner) *::-webkit-scrollbar-thumb {
          background: #e3ded6 !important; border: 3px solid transparent !important;
          border-radius: 999px !important; background-clip: padding-box !important;
        }
        html:not(.dark-mode) body:has(.ts-owner) *:hover::-webkit-scrollbar-thumb { background-color: #cfc9c0 !important; }
        html:not(.dark-mode) body:has(.ts-owner) *::-webkit-scrollbar-thumb:hover { background-color: #a8a39b !important; }
        @supports not selector(::-webkit-scrollbar) {
          html:not(.dark-mode) body:has(.ts-owner) * { scrollbar-width: thin; scrollbar-color: #d8d3cb transparent; }
        }
        @keyframes pageReveal {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes tabFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes solarOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes solarFadeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes iconWiggle { 0%,72%,100% { transform: rotate(0deg); } 78% { transform: rotate(-10deg); } 84% { transform: rotate(9deg); } 90% { transform: rotate(-5deg); } 96% { transform: rotate(3deg); } }
        @keyframes cardStaggerIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stickerRoll {
          0%   { transform: perspective(800px) rotateY(-90deg); transform-origin: right center; opacity: 0; filter: brightness(0.6); }
          40%  { transform: perspective(800px) rotateY(-20deg); transform-origin: right center; opacity: 1; filter: brightness(0.85); }
          70%  { transform: perspective(800px) rotateY(8deg);   transform-origin: right center; filter: brightness(1.05); }
          85%  { transform: perspective(800px) rotateY(-3deg);  transform-origin: right center; filter: brightness(1); }
          100% { transform: perspective(800px) rotateY(0deg);   transform-origin: right center; opacity: 1; filter: brightness(1); }
        }
        @keyframes noteStickIn {
          0%   { opacity: 0; transform: scale(0.7) translateY(-8px); }
          60%  { opacity: 1; transform: scale(1.04) translateY(1px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cardSlideOut {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          30%  { opacity: 0.8; transform: translateX(0) scale(0.97); }
          100% { opacity: 0; transform: translateX(50px) translateY(-6px) scale(0.94); max-height: 0; margin-bottom: 0; padding: 0; overflow: hidden; border-width: 0; }
        }
        @keyframes expandIn {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 800px; }
        }
        @keyframes badgePop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        @keyframes notifPulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
          70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes smsPopoverIn {
          0%   { opacity: 0; transform: translateX(-18px) scale(0.86); filter: blur(6px); }
          55%  { opacity: 1; transform: translateX(3px) scale(1.015); filter: blur(0); }
          100% { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
        }
        @keyframes smsPopoverOut {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(14px) scale(0.96); }
        }
        @keyframes smsNotifExpand {
          0%   { opacity: 0; max-height: 0; transform: translateY(-4px); }
          60%  { opacity: 1; }
          100% { opacity: 1; max-height: 360px; transform: translateY(0); }
        }
        @keyframes smsNotifSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes smsCheckPop {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes smsDotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%           { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes navDotPulse {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40%           { opacity: 1; transform: translateY(-3px); }
        }
        @keyframes notifBadgeFlash {
          0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          15%  { transform: scale(1.6); box-shadow: 0 0 12px 4px rgba(239,68,68,0.4); }
          30%  { transform: scale(0.9); }
          45%  { transform: scale(1.3); box-shadow: 0 0 8px 2px rgba(239,68,68,0.3); }
          60%  { transform: scale(1); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes emptyFade {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes gentlePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
        @keyframes loaderSpin { to { transform: rotate(360deg); } }
        @keyframes modalOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalCardIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1) translateY(0); }
        }
        @keyframes modalCardInFlex {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes noteExpand {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 300px; }
        }
        @keyframes sidebarReveal {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes checkmarkDraw {
          0%   { stroke-dashoffset: 24; opacity: 0; }
          40%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes successPulse {
          0%   { transform: scale(0.8); opacity: 0; }
          50%  { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes signatureStroke {
          0%   { stroke-dashoffset: 200; opacity: 0; }
          10%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes signatureFade {
          0%   { opacity: 1; transform: scale(1); }
          70%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.92) translateY(-6px); }
        }
        @keyframes signedGlow {
          0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
          30%  { box-shadow: 0 0 0 4px rgba(52,211,153,0.25); }
          100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
        }
        /* Cartes arrondies qui défilent (fiche du lead, fenêtres) : la barre s'arrête avant les coins au lieu de les traverser
           (dev 11/11/2026 : « le scroll est mal placé »). */
        body:has(.ts-owner) .pc-scroll::-webkit-scrollbar-track,
        body:has(.ts-owner) .ts-scroll-card::-webkit-scrollbar-track,
        body:has(.ts-owner) .sj-dialog::-webkit-scrollbar-track,
        body:has(.ts-owner) .sj-nda-dialog::-webkit-scrollbar-track { margin: 20px 0 !important; }
        .ts-tabrail { scrollbar-width: none; }
        .ts-tabrail::-webkit-scrollbar { display: none !important; }
        @keyframes tabReceive {
          0%   { transform: translateY(0); }
          30%  { transform: translateY(3px); }
          60%  { transform: translateY(-1px); }
          100% { transform: translateY(0); }
        }
        @keyframes badgeReceive {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.5); }
          65%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes tabLift {
          0%   { transform: translateY(0); }
          55%  { transform: translateY(-11px); }
          80%  { transform: translateY(-7px); }
          100% { transform: translateY(-8px); }
        }
        @keyframes tabDrop {
          0%   { transform: translateY(-8px); }
          50%  { transform: translateY(2px); }
          80%  { transform: translateY(-1px); }
          100% { transform: translateY(0); }
        }
        @keyframes contentReveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes campaignCardIn {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        /* ── Copied toast animation ───────────────────── */
        @keyframes copiedToastIn {
          0%   { opacity: 0; transform: translateY(4px) scale(0.9); }
          30%  { opacity: 1; transform: translateY(-1px) scale(1.02); }
          50%  { transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes copiedToastOut {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-6px) scale(0.92); }
        }
        /* ── Workflow split animations ─────────────────── */
        @keyframes wfSplitIn {
          0%   { opacity: 0; transform: translateY(6px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wfParentShrink {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.85) translateY(-4px); }
        }
        @keyframes wfSelectedPulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.06); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes wfDateCardIn {
          0%   { opacity: 0; max-height: 0; transform: translateY(-8px); }
          100% { opacity: 1; max-height: 300px; transform: translateY(0); }
        }
        /* Carte « Planifier le rappel » : plus haute que celles des RDV (description, mention de la règle des 3 jours, erreur) */
        @keyframes wfRecallCardIn {
          0%   { opacity: 0; max-height: 0; transform: translateY(-8px); }
          100% { opacity: 1; max-height: 640px; transform: translateY(0); }
        }
        @keyframes detailSlideIn {
          from { opacity: 0; transform: translateX(30px) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes detailSlideOut {
          from { opacity: 1; transform: translateX(0) scale(1); }
          to   { opacity: 0; transform: translateX(30px) scale(0.97); }
        }
        @keyframes avatarPulse {
          0%   { box-shadow: 0 0 0 0 rgba(43,41,39,0.2); }
          70%  { box-shadow: 0 0 0 10px rgba(43,41,39,0); }
          100% { box-shadow: 0 0 0 0 rgba(43,41,39,0); }
        }
        @keyframes campaignOpen {
          0% {
            left: var(--cr-left); top: var(--cr-top);
            width: var(--cr-width); height: var(--cr-height);
            border-radius: 24px; opacity: 0.85;
            transform: translate(0, 0);
          }
          100% {
            left: 50%; top: 50%;
            width: min(92vw, 860px); height: min(88vh, 720px);
            border-radius: 20px; opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        .leads-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .leads-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .leads-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 4px;
        }
        .leads-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.22);
        }
      `}</style>

      {/* La barre du haut n'existe plus (menu de gauche) : seules les bulles d'action restent, aussi dans la vue CEO. */}
      <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} notification={navNotif} centerShift={embedMode ? 0 : 28} toastOnly />

      {/* ── FLYING CARD CLONE (Genie effect transition) ───────────────────── */}
      {flyingCard && (
        <div
          id="flying-card-clone"
          style={{
            position: 'fixed',
            zIndex: 99999,
            left: flyingCard.sourceRect.left,
            top: flyingCard.sourceRect.top,
            width: flyingCard.sourceRect.width,
            height: flyingCard.sourceRect.height,
            borderRadius: '20px',
            background: darkMode ? 'rgba(30,31,40,0.97)' : 'rgba(255,255,255,0.98)',
            border: `1.5px solid ${flyingCard.catColor}40`,
            boxShadow: `0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px ${flyingCard.catColor}15`,
            pointerEvents: 'none',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            willChange: 'transform, opacity',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {/* Top row — pill content */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: flyingCard.wasExpanded ? '16px 20px' : '0 18px',
            height: flyingCard.wasExpanded ? 'auto' : '100%',
            gap: '10px',
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: flyingCard.catColor, flexShrink: 0 }} />
            <span style={{
              fontSize: flyingCard.wasExpanded ? '15px' : '14px', fontWeight: 500, color: C.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {flyingCard.lead.full_name}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px', borderRadius: '50px',
              fontSize: '10px', fontWeight: 500,
              background: (ORIGIN_COLORS[flyingCard.lead.origin] || DEFAULT_ORIGIN).bg,
              color: (ORIGIN_COLORS[flyingCard.lead.origin] || DEFAULT_ORIGIN).text,
              flexShrink: 0,
            }}>
              {originDisplay(flyingCard.lead.origin, flyingCard.lead.cc_sector)}
            </span>
          </div>
          {/* Expanded: subtle content placeholder lines */}
          {flyingCard.wasExpanded && (
            <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ height: 10, width: '30%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />
                <div style={{ height: 10, width: '25%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)' }} />
                <div style={{ height: 10, width: '20%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ height: 10, width: '40%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)' }} />
                <div style={{ height: 10, width: '22%', borderRadius: 5, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PAGE CONTAINER ──────────────────────────────────────────────────── */}
      <div style={{
        animation: 'pageReveal 0.5s cubic-bezier(0.4,0,0.2,1) both',
      }}>

        {/* ── FLEX ROW: sidebar + board + detail panel ──────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '100vh' }}>

          {/* ── LEFT SIDEBAR (full height) — hidden in CEO embed mode ──────── */}
          {/* Menu de gauche partagé (09/11/2026) : les vues de la sheet, « Mes pages », notifications et profil.
              Les vues et leurs règles sont celles d'avant, à l'identique ; seul l'habillage change. */}
          {!embedMode && (
            <SheetSidebar
              views={[
              { key: 'leads', label: 'Mes leads', iconSrc: iconMyLead, accent: C.accent, keepColor: true },
              { key: 'common_pool', label: 'Barrage répondeur', accent: '#06b6d4', iconNode: (active) => (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              ) },
              { key: 'calendar', label: 'Calendrier', iconSrc: iconCalendrier, accent: '#3b82f6' },
              // Prospection (06/10/2026) : l'outil des setters, sur la sheet du commercial lui-même seulement.
              ...(isAdminView ? [] : [
                { key: 'prospect_search', label: 'Trouver des contacts', accent: C.accent, iconNode: (active) => (
                  <UserSearch size={19} strokeWidth={2} color={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} />
                ) },
                { key: 'prospect_lists', label: 'Mes listes', accent: C.accent, iconNode: (active) => (
                  <ListChecks size={19} strokeWidth={2} color={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} />
                ) },
              ]),
              { key: 'email', label: 'Relance', iconSrc: iconEmail, accent: C.accent },
              { key: 'ai_bilan', label: 'Bilan IA', accent: '#E8A317', iconNode: (active) => (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.9L18.8 9.8 13.9 11.7 12 16.6 10.1 11.7 5.2 9.8 10.1 7.9z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>
              ) },
              // « KPIs & Stats » et « Mes préférences » retirés du menu (dev 11/11/2026). Les chiffres restent dans le bandeau du haut.
              // Préférences de secteur (06/10/2026) : le dev les voit et les modifie toutes, chaque sales les siennes.
              ...(currentUser?.role === 'admin' ? [{ key: 'sales_prefs', label: 'Préférences sales', accent: C.accent, iconNode: (active) => (
                <SlidersHorizontal size={19} strokeWidth={2} color={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} />
              ) }] : []),
              ...(['head_of_sales_manager', 'admin'].includes(currentUser?.role) ? [
                { key: 'funnel_leads', label: 'Funnel Leads', accent: '#8b5cf6', iconNode: (active) => (
                  <Funnel size={19} strokeWidth={2} color={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} />
                ) },
                { key: 'perf_sales', label: 'Perf Sales', accent: '#2563eb', iconNode: (active) => (
                  <ChartNoAxesCombined size={19} strokeWidth={2} color={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} />
                ) },
              ] : []),
              ...(['head_of_sales_manager', 'head_of_sales', 'admin'].includes(currentUser?.role) ? [{ key: 'recordings', label: 'Enregistrements sales', accent: '#0891b2', iconNode: (active) => (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={active ? (darkMode ? '#141414' : '#ffffff') : (darkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z" /><rect x="2" y="6" width="14" height="12" rx="2" ry="2" /></svg>
              ) }] : []),
              ...(canManageLeads ? [{ key: 'leads_management', label: 'Gestion des leads', iconSrc: iconFuse, accent: '#6366f1', keepColor: true, iconSize: 19 }] : []),
              ...(canManageSheets ? [{ key: 'sheets', label: 'Tracking Sheets', iconSrc: iconSheets, accent: '#8b5cf6' }] : []),
            ].map(v => ({
                ...v,
                // « Rappels et alertes » ne figure plus au menu (dev 09/11/2026) : les notifications passent par la ligne
                // Notifications du menu ; la vue reste ouverte par lien (?view=notifications, invitation à une sheet).
                badge: v.key === 'leads' ? { value: leads.length, tone: 'muted' } : v.badgeCount > 0 ? { value: v.badgeCount, tone: 'alert' } : undefined,
              }))}
              activeView={sidebarView}
              onView={(key) => { setSidebarView(key); if (key !== 'leads') setSelectedLead(null); }}
              headerExtra={(collapsed) => <SidebarAvailability C={C} darkMode={darkMode} collapsed={collapsed} targetEmail={viewingSheetId || undefined} />}
              C={C} darkMode={darkMode} setDarkMode={setDarkMode}
            />
          )}

        {/* ── RIGHT COLUMN (single top card + content row) ─────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: embedMode ? '8px 8px 8px 8px' : '8px 8px 8px 0', gap: 12 }}>

          {/* ── KPI HEADER CARD : les 7 indicateurs répartis sur toute la largeur (09/11/2026, plus de navbar au milieu) ── */}
          <div style={{ height: 76, background: C.bg, borderRadius: 18, flexShrink: 0, border: `1px solid ${isAdminView ? '#8b5cf640' : C.border}`, marginLeft: 8, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
            {isAdminView && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
                <button onClick={() => { window.location.href = embedMode ? '/ceo' : '/tracking-sheet'; }} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = C.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
                  Retour
                </button>
                <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 500 }}>
                  {viewingSheetId}
                </span>
                {new URLSearchParams(window.location.search).get('ghost') === 'true' && (
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 6, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>GHOST</span>
                )}
              </div>
            )}
            {!isAdminView && kpis && (() => {
              const left = [
                { label: 'Leads', value: kpis.leads_assigned ?? '—' },
                { label: 'Traités', value: kpis.leads_treated ?? '—' },
                { label: 'Closing R1', value: kpis.closing_r1 != null ? `${kpis.closing_r1.toFixed(1)}%` : '—' },
              ];
              const right = [
                { label: 'R1 Placés', value: kpis.closing_r1_placed != null ? `${kpis.closing_r1_placed.toFixed(1)}%` : '—' },
                { label: 'Closing Audit', value: kpis.closing_audit != null ? `${kpis.closing_audit.toFixed(1)}%` : '—' },
                { label: 'Conv. Globale', value: kpis.conversion_rate != null ? `${kpis.conversion_rate.toFixed(1)}%` : '—' },
                { label: 'Revenu', value: kpis.revenue != null ? `${kpis.revenue.toLocaleString('fr-FR')}€` : '—' },
              ];
              const renderKpi = (kpi, i, arr) => {
                const valStr = String(kpi.value);
                const fs = valStr.length > 8 ? 15 : valStr.length > 5 ? 17 : 20;
                return (
                <div key={kpi.label} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', padding: '0 12px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: fs, fontWeight: 500, color: C.text, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{kpi.value}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{kpi.label}</span>
                </div>
                );
              };
              const all = [...left, ...right];
              return <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>{all.map(renderKpi)}</div>;
            })()}
          </div>

          <IntegrationRollout state={intakeRollout} onChange={setIntakeRollout} />

          {/* ── CONTENT ROW (board + detail panel side by side) ──────────────── */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0, marginLeft: 8 }}>

          {/* ── INNER BOARD WRAPPER ──────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {/* ── MAIN CONTENT CARD ────────────────────────────────────────────── */}
          <div style={{ flex: 1, background: C.bg, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── ONGLETS : un rail d'une seule ligne, pouce blanc sous l'onglet actif, compteurs en chiffres discrets ── */}
          {sidebarView === 'leads' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px',
              borderBottom: `1px solid ${C.border}`,
              background: 'transparent',
              zIndex: 3,
              minWidth: 0,
            }}>
              <div ref={tabRailRef} className="ts-tabrail" role="tablist" aria-label="Catégories de leads" style={{
                position: 'relative', display: 'flex', gap: 2, padding: 3, borderRadius: 12, minWidth: 0,
                background: darkMode ? '#181818' : '#f4f2ee', overflowX: 'auto',
              }}>
              {tabThumb && (
                <span aria-hidden="true" style={{
                  position: 'absolute', top: 3, bottom: 3, left: 0, width: tabThumb.width, transform: `translateX(${tabThumb.left}px)`,
                  borderRadius: 9, background: darkMode ? '#343434' : '#ffffff',
                  boxShadow: darkMode ? 'none' : '0 1px 2px rgba(28,27,25,0.10), 0 0 0 1px rgba(28,27,25,0.03)',
                  transition: tabThumb.ready ? 'transform 0.32s cubic-bezier(0.2,0.75,0.3,1), width 0.32s cubic-bezier(0.2,0.75,0.3,1)' : 'none',
                  pointerEvents: 'none',
                }} />
              )}
              {CATEGORIES.filter(cat => cat.key !== 'r3' || calSettings?.r3_enabled === true).map((cat, idx) => {
                const realIdx = CATEGORIES.indexOf(cat);
                const isActive = realIdx === activeTab;
                const count = tabCounts[cat.key];
                const badgeBounce = animatingBadges.has(realIdx);
                return (
                  <button
                    key={cat.key}
                    data-tab-key={cat.key}
                    data-tab-active={isActive ? 'true' : undefined}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(realIdx)}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                      flexShrink: 0,
                      padding: '7px 12px',
                      borderRadius: 9,
                      border: 'none',
                      background: 'transparent',
                      color: isActive ? C.text : C.muted,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'color 0.2s ease',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      zIndex: 1,
                      fontFamily: 'inherit',
                      letterSpacing: '-0.01em',
                      animation: glowingTab === realIdx ? 'tabReceive 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = C.text; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = C.muted; }}
                  >
                    <span>{cat.label}</span>
                    <span data-tab-badge="" style={{
                      display: 'inline-block', fontSize: 11.5, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                      color: isActive ? C.secondary : (darkMode ? '#5c5c5c' : '#b5aea4'),
                      transition: 'color 0.2s ease',
                      animation: badgeBounce ? 'badgePop 0.3s ease both' : (glowingTab === idx ? 'badgeReceive 0.45s cubic-bezier(0.34,1.56,0.64,1) both' : 'none'),
                      fontFamily: 'inherit',
                    }}>
                      {count}
                    </span>
                  </button>
                );
              })}
              </div>
              {/* Qui regarde la feuille en ce moment : au bout des onglets, là où l'on travaille les leads (avant le 11/11/2026,
                  une pastille flottait en bas de l'écran sans lien avec rien). */}
              {presenceUsers.length > 0 && (
                <div title={`${presenceUsers.length} en ligne sur cette feuille : ${presenceUsers.map(u => u.full_name || u.email).join(', ')}`}
                  style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    {presenceUsers.slice(0, 3).map((u, i) => (
                      <span key={u.email} style={{
                        width: 24, height: 24, borderRadius: '50%', border: `2px solid ${C.bg}`, boxSizing: 'border-box',
                        background: getCursorColor(u.email), display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 500, color: '#fff', marginLeft: i > 0 ? -7 : 0,
                      }}>
                        {(u.full_name || u.email).charAt(0).toUpperCase()}
                      </span>
                    ))}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.muted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    {presenceUsers.length} en ligne
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── INNER BOARD ───────────────────────────────────────────────────── */}
          <div style={{
            background: 'transparent',
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}>

          {/* ── RIGHT MAIN CONTENT ──────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ADD LEAD view removed — now a modal (see end of component) */}


        {/* ════ VIEW: KPIs ════════════════════════════════════════════════ */}
        {/* Pour admin / head_of_sales / head_of_sales_manager : affiche le tableau */}
        {/* Perf Sales (composant isole, aucune logique metier touchee). */}
        {/* Pour les autres roles : conserve le mockup d'origine. */}
        {sidebarView === 'kpis' && ['admin', 'head_of_sales', 'head_of_sales_manager'].includes(currentUser?.role) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <PerfSalesTable darkMode={darkMode} C={C} />
          </div>
        )}

        {/* ════ VIEW: PRÉFÉRENCES DE SECTEUR (dev : toutes ; sales : les siennes) ═══ */}
        {sidebarView === 'sales_prefs' && currentUser?.role === 'admin' && (
          <div style={{ flex: 1, overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <SalesPreferences mode="all" C={C} darkMode={darkMode} />
          </div>
        )}
        {sidebarView === 'my_prefs' && !isAdminView && ['sales', 'head_of_sales', 'head_of_sales_manager'].includes(currentUser?.role) && (
          <div style={{ flex: 1, overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <SalesPreferences mode="me" C={C} darkMode={darkMode} />
          </div>
        )}

        {/* Pages de pilotage intégrées : le menu et les leads de la tracking sheet restent en place. */}
        {['funnel_leads', 'perf_sales'].includes(sidebarView) && ['head_of_sales_manager', 'admin'].includes(currentUser?.role) && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <React.Suspense fallback={<div role="status" style={{ padding: 24, color: C.muted }}>Chargement…</div>}>
              {sidebarView === 'funnel_leads' ? <FunnelLeads embed /> : <MonitoringPerf embed />}
            </React.Suspense>
          </div>
        )}

        {/* ════ VIEW: ENREGISTREMENTS SALES (embed — head of sales/admin) ═══════ */}
        {sidebarView === 'recordings' && ['head_of_sales_manager', 'head_of_sales', 'admin'].includes(currentUser?.role) && (
          <div style={{ flex: 1, overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <CeoSalesRecordingsView embed />
          </div>
        )}

        {/* ════ VIEW: RÉPONDEUR COMMUN (pool global des répondeurs anciens) ═══ */}
        {sidebarView === 'common_pool' && (() => {
          const _q = commonPoolSearch.trim().toLowerCase();
          const shown = _q
            ? commonVoicemailLeads.filter((l) => (
                (l.full_name || '').toLowerCase().includes(_q) ||
                (l.company_name || l.company || '').toLowerCase().includes(_q) ||
                String(l.phone || '').replace(/\s/g, '').includes(_q.replace(/\s/g, ''))
              ))
            : commonVoicemailLeads;
          return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 48px', animation: 'tabFadeIn 0.3s ease-out both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#06b6d4', flexShrink: 0 }} />
                <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Barrage répondeur commun</h2>
              </div>
              <CommonVoicemailPool
                leads={shown}
                loading={commonPoolLoading}
                claimingId={claimingId}
                onClaim={claimCommonVoicemail}
                canClaim={!embedMode}
                C={C}
                darkMode={darkMode}
              />
            </div>
          );
        })()}
        {sidebarView === 'kpis' && !['admin', 'head_of_sales', 'head_of_sales_manager'].includes(currentUser?.role) && (
          <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              KPIs & Statistiques
            </h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px' }}>
              Vos performances de prospection
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'Leads total', value: leads.length, color: C.accent },
                { label: 'R1 placés', value: tabCounts.r1 || 0, color: '#3b82f6' },
                { label: 'R2 placés', value: tabCounts.r2 || 0, color: '#fb923c' },
                { label: 'Signés', value: tabCounts.signed || 0, color: '#10b981' },
                { label: 'Non traités', value: tabCounts.new || 0, color: '#6366f1' },
                { label: 'Non pertinents', value: tabCounts.not_relevant || 0, color: '#f87171' },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  background: darkMode ? '#181818' : '#fff', borderRadius: 12,
                  border: `1px solid ${C.border}`, padding: '18px 20px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    {kpi.label}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 500, color: kpi.color, letterSpacing: '-0.02em' }}>
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ VIEW: BILAN IA ════════════════════════════════════════════ */}
        {/* ════ VIEW: PROSPECTION (06/10/2026) ══════════════════════════════
            « Trouver des contacts » et « Mes listes », comme chez les setters ; l'export crée les leads
            dans les Nouveaux leads du commercial. */}
        {!isAdminView && (sidebarView === 'prospect_search' || sidebarView === 'prospect_lists') && (
          <SalesProspection view={sidebarView} C={C} darkMode={darkMode} onNavigate={setSidebarView}
            onOpenLeads={() => { setSidebarView('leads'); setActiveTab(Math.max(0, CATEGORIES.findIndex(c => c.key === 'new'))); refreshData().catch(() => {}); }} />
        )}

        {sidebarView === 'ai_bilan' && (
          <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <MyWeeklyBilan name={currentUser?.name} avatarUrl={currentUser?.avatar_url} team={currentUser?.team} />
          </div>
        )}

        {/* ════ VIEW: CAMPAIGNS (retiré de la sidebar — panneau conservé inerte) ══ */}
        {sidebarView === 'campaigns' && (() => {
          const MOCK_CAMPAIGNS = [];
          return (
          <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              Campagnes marketing
            </h2>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px' }}>
              Vue sur les campagnes marketing en cours
            </p>

            {/* Campaign cards grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 18 }}>
              {MOCK_CAMPAIGNS.map((camp, i) => (
                <div
                  key={camp.id}
                  data-campaign-id={camp.id}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setCampaignRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
                    setOpenCampaign(camp);
                  }}
                  style={{
                    position: 'relative',
                    borderRadius: 18,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    aspectRatio: '3 / 4',
                    animation: `campaignCardIn 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.08}s both`,
                    boxShadow: darkMode
                      ? '0 3px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25)'
                      : '0 3px 16px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = darkMode ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.14)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = darkMode ? '0 3px 16px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.25)' : '0 3px 16px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)'; }}
                >
                  {/* Background image */}
                  <img
                    src={camp.image}
                    alt=""
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      objectFit: 'cover', objectPosition: 'center',
                      transform: 'scale(1.06)',
                    }}
                  />
                  {/* Dark overlay */}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.03) 0%, rgba(0,0,0,0.4) 100%)' }} />

                  {/* Status pill */}
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    padding: '3px 10px', borderRadius: 20,
                    fontSize: 10, fontWeight: 500,
                    background: '#10b981', color: '#fff',
                    boxShadow: '0 2px 6px rgba(16,185,129,0.35)',
                  }}>
                    {camp.status}
                  </div>

                  {/* Glass banner */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    padding: '14px 16px',
                    background: darkMode ? 'rgba(30,31,40,0.6)' : 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(20px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                    borderTop: darkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.4)',
                  }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: darkMode ? '#f2f2f2' : '#1c1b19',
                      letterSpacing: '-0.01em', lineHeight: 1.25,
                    }}>
                      {camp.niche}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 500, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                      marginTop: 3,
                    }}>
                      Lancée le {camp.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          );
        })()}

        {creaPopup && (
          <CreativePopup
            creative={creaPopup.creative}
            triggerRect={creaPopup.rect}
            darkMode={darkMode}
            onClose={() => setCreaPopup(null)}
          />
        )}

        {/* ════ CAMPAIGN FULLSCREEN DETAIL (Apple open animation) ══════════ */}
        {(openCampaign || campaignClosing) && (() => {
          const camp = openCampaign || {};
          return createPortal(
            <>
              {/* Backdrop dim */}
              <div
                onClick={() => {
                  setCampaignClosing(true);
                  setTimeout(() => { setOpenCampaign(null); setCampaignClosing(false); setCampaignRect(null); }, 380);
                }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 99990,
                  background: 'rgba(0,0,0,0.5)',
                  opacity: campaignClosing ? 0 : 1,
                  transition: 'opacity 0.38s ease',
                }}
              />
              {/* Expanding card → fullscreen */}
              <div
                style={{
                  position: 'fixed', zIndex: 99991,
                  ...(campaignClosing && campaignRect ? {
                    left: campaignRect.left, top: campaignRect.top,
                    width: campaignRect.width, height: campaignRect.height,
                    borderRadius: 14,
                  } : {
                    left: '50%', top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(92vw, 860px)', height: 'min(88vh, 720px)',
                    borderRadius: 14,
                  }),
                  background: C.bg,
                  overflow: 'hidden',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.15)',
                  transition: campaignClosing
                    ? 'all 0.38s cubic-bezier(0.4, 0, 0.6, 1)'
                    : 'none',
                  animation: !campaignClosing ? 'campaignOpen 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
                  '--cr-left': campaignRect ? `${campaignRect.left}px` : '50%',
                  '--cr-top': campaignRect ? `${campaignRect.top}px` : '50%',
                  '--cr-width': campaignRect ? `${campaignRect.width}px` : '860px',
                  '--cr-height': campaignRect ? `${campaignRect.height}px` : '260px',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Hero image */}
                <div style={{ position: 'relative', height: 260, flexShrink: 0, overflow: 'hidden' }}>
                  <img
                    src={camp.image}
                    alt=""
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
                      transform: 'scale(1.05)',
                    }}
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.45) 100%)',
                  }} />
                  {/* Close button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCampaignClosing(true);
                      setTimeout(() => { setOpenCampaign(null); setCampaignClosing(false); setCampaignRect(null); }, 380);
                    }}
                    style={{
                      position: 'absolute', top: 16, right: 16,
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', fontSize: 18, fontWeight: 400,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; }}
                  ><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                  {/* Glass title overlay */}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0,
                    padding: '20px 32px',
                    background: darkMode ? 'rgba(30,31,40,0.5)' : 'rgba(255,255,255,0.45)',
                    backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                    borderTop: darkMode ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.4)',
                  }}>
                    <div style={{ fontSize: 26, fontWeight: 500, color: darkMode ? '#f2f2f2' : '#1c1b19', letterSpacing: '-0.02em' }}>
                      Campagne — {camp.niche}
                    </div>
                    <div style={{ fontSize: 12, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)', marginTop: 3 }}>
                      Campagne lancée le {camp.date}
                    </div>
                  </div>
                </div>

                {/* Detail content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 32px' }}>
                  {[
                    { label: 'Objectif', value: camp.objectif },
                    { label: 'Angle', value: camp.angle },
                    { label: 'Canaux', value: camp.canaux },
                    { label: 'Message', value: camp.message },
                    { label: 'CTA', value: camp.cta },
                    { label: 'Statut', value: camp.status },
                  ].map((row, idx) => (
                    <div key={row.label} style={{
                      marginBottom: 18,
                      opacity: 0, animation: `tabFadeIn 0.35s ease ${0.15 + idx * 0.05}s forwards`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        {row.label}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text, lineHeight: 1.55 }}>
                        {row.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>,
            document.body
          );
        })()}

        {/* ════ VIEW: CALENDAR ═════════════════════════════════════════════
            Calendrier interne (05/10/2026) : agenda Google du commercial (copie synchronisée côté serveur,
            lecture seule) + ses RDV du CRM avec leurs détails internes, ses rappels et ses absences. */}
        {sidebarView === 'calendar' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px 28px', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <InternalCalendar
              view="sales"
              C={C}
              darkMode={darkMode}
              asUser={isAdminView ? viewingSheetId : undefined}
              reloadKey={calendarReload}
              onOpenLead={(leadId) => { setSidebarView('leads'); setTimeout(() => setSelectedLead(leadId), 100); }}
              onQualify={isAdminView ? undefined : (ev) => openCalendarQualification(ev)}
              toolbarExtra={(
                <button onClick={() => setShowVacationModal(true)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: myUnavailability.length > 0 ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent', color: C.text, cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                  title="Déclarer mes absences"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="10" y1="14" x2="14" y2="18" />
                    <line x1="14" y1="14" x2="10" y2="18" />
                  </svg>
                  <span>Mes absences</span>
                  {myUnavailability.length > 0 && <span style={{ background: darkMode ? '#f2f2f2' : '#1c1b19', color: darkMode ? '#141414' : '#fff', borderRadius: 8, padding: '0 6px', fontSize: 10, fontWeight: 500 }}>{myUnavailability.length}</span>}
                </button>
              )}
            />
          </div>
        )}

        {/* ════ MODAL: Mes absences (declaration vacances) ═══════════════ */}
        {showVacationModal && <AbsenceDialog dark={darkMode} onClose={() => setShowVacationModal(false)} onChanged={() => { fetchMyUnavailability(); setCalendarReload((n) => n + 1); }} />}

        {/* ════ VIEW: NOTIFICATIONS ═══════════════════════════════════════ */}
        {sidebarView === 'notifications' && (() => {
          const r1Today = leads.filter(l => l.status === 'r1' && toDateOnly(l.r1) === TODAY);
          const r2Today = leads.filter(l => l.status === 'r2' && toDateOnly(l.r2) === TODAY);
          const meetingNotifs = [
            ...r1Today.map(l => ({ id: l.id, key: `r1-${l.id}-${TODAY}`, type: 'meeting', notifType: 'r1', full_name: l.full_name, company: l.company, time: (l.r1 || '').slice(11, 16), color: '#3b82f6', lead: l })),
            ...r2Today.map(l => ({ id: l.id, key: `r2-${l.id}-${TODAY}`, type: 'meeting', notifType: 'r2', full_name: l.full_name, company: l.company, time: (l.r2 || '').slice(11, 16), color: '#fb923c', lead: l })),
          ];
          // Separate new (unread) vs history (read) for perf alerts
          const newMeetings = meetingNotifs.filter(n => !dismissedNotifs.includes(n.key));
          const newPerf = perfAlerts.filter(n => !dismissedNotifs.includes(n.key));
          const historyPerf = perfAlerts.filter(n => dismissedNotifs.includes(n.key));
          const hasNew = newMeetings.length > 0 || newPerf.length > 0;
          let idx = 0;

          // Render a perf alert card (used in both new and history)
          const renderPerfCard = (alert, i, isRead) => (
            <div key={alert.key} onClick={() => { if (!isRead) dismissNotif(alert.key); }} style={{
              padding: '14px 16px', borderRadius: 14, cursor: isRead ? 'default' : 'pointer',
              background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff',
              border: `1px solid ${C.border}`, borderLeft: `3px solid ${isRead ? C.muted : alert.color}`,
              opacity: isRead ? 0.6 : 1,
              transition: 'all 0.15s', animation: `cardStaggerIn 0.3s ease ${i * 50}ms both`,
            }}
              onMouseEnter={(e) => { if (!isRead) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = C.shadow; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{alert.icon === '✓' ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: isRead ? C.muted : C.text }}>{alert.title}</div>
                </div>
                {!isRead && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: alert.color, flexShrink: 0, boxShadow: `0 0 6px ${alert.color}50` }} />
                )}
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.5, paddingLeft: 26 }}>
                {alert.desc}
              </div>
              {!isRead && (
                <div style={{ fontSize: 10, color: C.accent, marginTop: 8, paddingLeft: 26, fontWeight: 500 }}>
                  Cliquer pour marquer comme lu
                </div>
              )}
            </div>
          );

          return (
            <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
              <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                Rappels et alertes
              </h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 24px' }}>Rendez-vous du jour et alertes performance</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ══ NOUVELLES ══ */}
                {hasNew && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, animation: 'notifPulse 2s ease-in-out infinite' }} />
                      Nouvelles
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Meetings today */}
                      {newMeetings.map(notif => {
                        const i = idx++;
                        return (
                          <div key={notif.key} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                            borderRadius: 14, background: darkMode ? 'rgba(255,255,255,0.04)' : '#fff',
                            border: `1px solid ${C.border}`, cursor: 'pointer',
                            transition: 'all 0.15s', animation: `cardStaggerIn 0.3s ease ${i * 50}ms both`,
                          }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = C.shadow; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                            onClick={() => { dismissNotif(notif.key); setSidebarView('leads'); setActiveTab(CATEGORIES.findIndex(c => c.key === notif.notifType)); setSelectedLead(notif.lead); }}
                          >
                            <div style={{ width: 9, height: 9, borderRadius: '50%', background: notif.color, flexShrink: 0, boxShadow: `0 0 8px ${notif.color}60`, animation: 'notifPulse 2s ease-in-out infinite' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.full_name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{notif.company || 'Entreprise non renseignée'}</div>
                            </div>
                            <span style={{ padding: '3px 9px', borderRadius: 50, fontSize: 10.5, fontWeight: 500, background: `${notif.color}12`, color: notif.color, border: `1.5px solid ${notif.color}30`, flexShrink: 0 }}>
                              {notif.notifType === 'r1' ? 'R1' : 'R2'}
                            </span>
                            {notif.time && <span style={{ fontSize: 12, fontWeight: 500, color: notif.color, flexShrink: 0 }}>{notif.time}</span>}
                          </div>
                        );
                      })}

                      {/* New performance alerts */}
                      {newPerf.map(alert => renderPerfCard(alert, idx++, false))}
                    </div>
                  </div>
                )}

                {/* ══ EMPTY STATE ══ */}
                {!hasNew && historyPerf.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', borderRadius: 16, border: `1.5px dashed ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Aucune notification</p>
                  </div>
                )}

                {/* ══ INVITATIONS ══ */}
                {(() => {
                  if (myInvitations.length === 0) return null;
                  return (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        Invitations
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {myInvitations.map((inv, i) => (
                          <div key={inv.id} style={{
                            padding: '16px 18px', borderRadius: 14,
                            background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                            border: `1px solid ${C.border}`,
                            animation: `cardStaggerIn 0.3s ease ${i * 50}ms both`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <span style={{ fontSize: 15 }}>📋</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Invitation à réaffecter</div>
                                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                                  Sheet de <strong>{inv.sheet_email}</strong>
                                  {inv.inviter_name && <> — invité par {inv.inviter_name}</>}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={() => {
                                window.location.href = `/tracking-sheet?sheet_id=${encodeURIComponent(inv.sheet_email)}`;
                              }} style={{
                                flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 500,
                                fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
                                background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                color: C.secondary, transition: 'all 0.15s',
                              }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)'; e.currentTarget.style.color = C.text; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; e.currentTarget.style.color = C.secondary; }}
                              >Accéder à la sheet</button>
                              <button onClick={async () => {
                                try {
                                  await apiClient.post(`/api/v1/tracking/invitations/${inv.id}/complete`);
                                  // Re-fetch to get clean state from backend
                                  await fetchMyInvitations();
                                } catch (e) { console.warn('Complete invitation failed:', e); }
                              }} style={{
                                padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                                fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
                                border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
                                transition: 'all 0.15s',
                              }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = C.text; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
                              >Finaliser</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* ══ HISTORIQUE ══ */}
                {historyPerf.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                      Historique
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {historyPerf.map(alert => renderPerfCard(alert, idx++, true))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ════ VIEW: RELANCE — Calendar Settings ═════════════════════════════ */}
        {sidebarView === 'email' && (() => {
          // Fetch settings on first view
          if (!calSettings && !calSettingsLoading) {
            setCalSettingsLoading(true);
            apiClient.get('/api/v1/tracking/calendar-settings').then(data => {
              setCalSettings(data);
            }).catch(() => {
              setCalSettings({ calendar_enabled: true, r1_title_template: '', r1_description_template: '', r1_duration: 30, r2_title_template: '', r2_description_template: '', r2_duration: 60 });
            }).finally(() => setCalSettingsLoading(false));
          }
          const updateField = (key, value) => setCalSettings(prev => ({ ...prev, [key]: value }));
          const saveSettings = async () => {
            if (!calSettings) return;
            setCalSettingsSaving(true);
            try {
              await apiClient.put('/api/v1/tracking/calendar-settings', calSettings);
              setCalSettingsSaved(true);
              setTimeout(() => setCalSettingsSaved(false), 2000);
            } catch (e) { console.warn('Save calendar settings failed:', e); }
            setCalSettingsSaving(false);
          };
          const inputStyle = {
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: darkMode ? C.subtle : '#faf9f7',
            color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
            transition: 'border-color 0.2s',
          };
          const textareaStyle = { ...inputStyle, minHeight: 200, resize: 'vertical', lineHeight: 1.5 };
          const labelStyle = { fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' };
          return (
          <div style={{ flex: 1, padding: '32px 32px', overflowY: 'auto', animation: 'tabFadeIn 0.3s ease-out both',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          }}>
            <div style={{ maxWidth: 1100 }}>
              <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                Paramètres Calendar
              </h2>
              <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px' }}>
                Configurez vos rendez-vous Google Calendar
              </p>

              {calSettingsLoading || !calSettings ? (
                <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* Toggle */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Google Calendar</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Créer automatiquement des événements pour les R1/R2</div>
                    </div>
                    <button onClick={async () => {
                      const newVal = !calSettings.calendar_enabled;
                      updateField('calendar_enabled', newVal);
                      try { await apiClient.put('/api/v1/tracking/calendar-settings', { calendar_enabled: newVal }); } catch {}
                    }} style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: calSettings.calendar_enabled ? (darkMode ? '#10b981' : '#2b2927') : (darkMode ? '#3a3a3a' : '#ddd8d0'),
                      position: 'relative', transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3,
                        left: calSettings.calendar_enabled ? 23 : 3,
                        transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>

                  {/* R3 toggle */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Rendez-vous R3</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Activer les R3 (troisième rendez-vous de suivi)</div>
                    </div>
                    <button onClick={async () => {
                      const newVal = !calSettings.r3_enabled;
                      updateField('r3_enabled', newVal);
                      try { await apiClient.put('/api/v1/tracking/calendar-settings', { r3_enabled: newVal }); } catch {}
                    }} style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: calSettings.r3_enabled ? (darkMode ? '#8b5cf6' : '#2b2927') : (darkMode ? '#3a3a3a' : '#ddd8d0'),
                      position: 'relative', transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3,
                        left: calSettings.r3_enabled ? 23 : 3,
                        transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>

                  {/* R1 + R2 Settings side by side */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, opacity: calSettings.calendar_enabled ? 1 : 0.4, pointerEvents: calSettings.calendar_enabled ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
                  {/* R1 Settings */}
                  <div style={{
                    padding: '20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Premier rendez-vous</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Titre de l'événement</label>
                        <input value={calSettings.r1_title_template} onChange={(e) => updateField('r1_title_template', e.target.value)}
                          placeholder="OWNER – Pré-audit : échange initial ({name})" style={inputStyle}
                          onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                          onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Description</label>
                        <textarea value={calSettings.r1_description_template} onChange={(e) => updateField('r1_description_template', e.target.value)}
                          placeholder="Réservé par&#10;{name}&#10;{email}&#10;{phone}" style={textareaStyle}
                          onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                          onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Durée</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[15, 30].map(d => (
                            <button key={d} onClick={() => updateField('r1_duration', d)} style={{
                              padding: '8px 20px', borderRadius: 8, border: `1px solid ${calSettings.r1_duration === d ? C.accent : C.border}`,
                              background: calSettings.r1_duration === d ? 'rgba(59,130,246,0.08)' : 'transparent',
                              color: calSettings.r1_duration === d ? C.accent : C.secondary,
                              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}>{d} min</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* R2 Settings */}
                  <div style={{
                    padding: '20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Audit</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Titre de l'événement</label>
                        <input value={calSettings.r2_title_template} onChange={(e) => updateField('r2_title_template', e.target.value)}
                          placeholder="AUDIT : {name} & Owner (optimisation fiscale/sociale)" style={inputStyle}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#fb923c'}
                          onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Description</label>
                        <textarea value={calSettings.r2_description_template} onChange={(e) => updateField('r2_description_template', e.target.value)}
                          placeholder="Réservé par&#10;{name}&#10;{email}&#10;{phone}" style={textareaStyle}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#fb923c'}
                          onBlur={(e) => e.currentTarget.style.borderColor = C.border}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Durée</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[30, 60].map(d => (
                            <button key={d} onClick={() => updateField('r2_duration', d)} style={{
                              padding: '8px 20px', borderRadius: 8, border: `1px solid ${calSettings.r2_duration === d ? '#fb923c' : C.border}`,
                              background: calSettings.r2_duration === d ? 'rgba(251,146,60,0.08)' : 'transparent',
                              color: calSettings.r2_duration === d ? '#fb923c' : C.secondary,
                              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            }}>{d} min</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Variables — third column */}
                  <div style={{ padding: '20px 16px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, alignSelf: 'start' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Variables</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {['{name}', '{email}', '{phone}'].map(v => (
                        <button key={v} onClick={() => { navigator.clipboard.writeText(v); setCopiedField('calvar-' + v); setTimeout(() => setCopiedField(null), 1500); }}
                          style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6, background: copiedField === 'calvar-' + v ? 'rgba(16,185,129,0.12)' : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), color: copiedField === 'calvar-' + v ? '#10b981' : C.accent, fontFamily: 'monospace', textAlign: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
                        >{copiedField === 'calvar-' + v ? 'Copié ✓' : v}</button>
                      ))}
                    </div>
                  </div>
                  {/* R3 settings — only visible when R3 enabled */}
                  {calSettings.r3_enabled && (
                    <div style={{
                      padding: '20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`,
                      opacity: calSettings.calendar_enabled ? 1 : 0.4, pointerEvents: calSettings.calendar_enabled ? 'auto' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Suivi R3</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div>
                          <label style={labelStyle}>Titre de l'événement</label>
                          <input value={calSettings.r3_title_template || ''} onChange={(e) => updateField('r3_title_template', e.target.value)}
                            placeholder="R3 - Suivi : {name} & Owner" style={inputStyle}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = C.border} />
                        </div>
                        <div>
                          <label style={labelStyle}>Description</label>
                          <textarea value={calSettings.r3_description_template || ''} onChange={(e) => updateField('r3_description_template', e.target.value)}
                            placeholder="Réservé par&#10;{name}&#10;{email}&#10;{phone}" style={textareaStyle}
                            onFocus={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                            onBlur={(e) => e.currentTarget.style.borderColor = C.border} />
                        </div>
                        <div>
                          <label style={labelStyle}>Durée</label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {[15, 30].map(d => (
                              <button key={d} onClick={() => updateField('r3_duration', d)} style={{
                                padding: '8px 20px', borderRadius: 8, border: `1px solid ${(calSettings.r3_duration || 15) === d ? '#8b5cf6' : C.border}`,
                                background: (calSettings.r3_duration || 15) === d ? 'rgba(139,92,246,0.08)' : 'transparent',
                                color: (calSettings.r3_duration || 15) === d ? '#8b5cf6' : C.secondary,
                                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                              }}>{d} min</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>{/* end grid R1+R2 */}

                  {/* Save button */}
                  <button onClick={saveSettings} disabled={calSettingsSaving} style={{
                    padding: '12px 24px', borderRadius: 10, border: 'none',
                    background: calSettingsSaved ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                    color: calSettingsSaved ? '#fff' : C.text,
                    fontSize: 14, fontWeight: 500, cursor: calSettingsSaving ? 'wait' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.2s', alignSelf: 'flex-start',
                  }}
                    onMouseEnter={(e) => { if (!calSettingsSaved) { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)'; } }}
                    onMouseLeave={(e) => { if (!calSettingsSaved) { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; } }}
                  >{calSettingsSaving ? 'Enregistrement...' : calSettingsSaved ? 'Enregistré ✓' : 'Enregistrer'}</button>

                  {/* ═══ RELANCES EMAIL ═══ */}
                  <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                      Relances email
                    </h2>
                    <p style={{ fontSize: 13, color: C.muted, margin: '0 0 20px' }}>
                      Envoi automatique d'emails de relance aux prospects
                    </p>

                    {(() => {
                      // Fetch relance settings on first view
                      if (!relanceSettings && !relanceLoading) {
                        setRelanceLoading(true);
                        apiClient.get('/api/v1/tracking/relance-settings').then(data => {
                          setRelanceSettings(data);
                        }).catch(() => {
                          setRelanceSettings({ relances_enabled: false, sms_enabled: false, sms_mode: 'manual', sms_repondeur_template: '', sms_noshow_enabled: false, sms_noshow_template: '', sms_reminder_enabled: false, sms_reminder_template: '', relance1_subject: '', relance1_body: '', relance2_subject: '', relance2_body: '', sms_max_single: 276, sms_max_split: 552, sms_split_marker: '[SPLIT]', sms_split_enabled: true });
                        }).finally(() => setRelanceLoading(false));
                      }
                      if (!relanceSettings) return <div style={{ padding: 20, textAlign: 'center', color: C.muted }}>Chargement...</div>;

                      const updateRelance = (key, value) => { setRelanceError(null); setRelanceSettings(prev => ({ ...prev, [key]: value })); };
                      const saveRelance = async () => {
                        if (!relanceSettings) return;
                        setRelanceSaving(true);
                        setRelanceError(null);
                        try {
                          await apiClient.put('/api/v1/tracking/relance-settings', relanceSettings);
                          setRelanceSaved(true);
                          setTimeout(() => setRelanceSaved(false), 2000);
                        } catch (e) {
                          console.warn('Save relance settings failed:', e);
                          const msg = e?.data?.detail || e?.message || 'Erreur lors de l\'enregistrement.';
                          setRelanceError(msg);
                          setTimeout(() => setRelanceError(null), 6000);
                        }
                        setRelanceSaving(false);
                      };

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {/* Toggle */}
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`,
                          }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Relances automatiques</div>
                              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Envoyer des emails de relance après le R1 et avant le R2</div>
                            </div>
                            <button onClick={async () => {
                              const newVal = !relanceSettings.relances_enabled;
                              updateRelance('relances_enabled', newVal);
                              try { await apiClient.put('/api/v1/tracking/relance-settings', { relances_enabled: newVal }); } catch {}
                            }} style={{
                              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                              background: relanceSettings.relances_enabled ? (darkMode ? '#3b82f6' : '#2b2927') : (darkMode ? '#3a3a3a' : '#ddd8d0'),
                              position: 'relative', transition: 'background 0.2s',
                            }}>
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                position: 'absolute', top: 3,
                                left: relanceSettings.relances_enabled ? 23 : 3,
                                transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }} />
                            </button>
                          </div>

                          {/* Relance templates */}
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
                            opacity: relanceSettings.relances_enabled ? 1 : 0.4,
                            pointerEvents: relanceSettings.relances_enabled ? 'auto' : 'none',
                            transition: 'opacity 0.3s',
                          }}>
                            {/* Relance 1 */}
                            <div style={{ padding: '20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Relance 1</span>
                                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 50, background: 'rgba(59,130,246,0.08)', color: '#3b82f6' }}>Au placement du R2</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                  <label style={labelStyle}>Objet</label>
                                  <input value={relanceSettings.relance1_subject || ''} onChange={(e) => updateRelance('relance1_subject', e.target.value)}
                                    placeholder="OWNER - Préparation de votre Audit" style={inputStyle}
                                    onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                                    onBlur={(e) => e.currentTarget.style.borderColor = C.border} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Corps de l'email</label>
                                  <textarea value={relanceSettings.relance1_body || ''} onChange={(e) => updateRelance('relance1_body', e.target.value)}
                                    placeholder="Bonjour {lead_name},&#10;&#10;Suite à notre échange..." style={textareaStyle}
                                    onFocus={(e) => e.currentTarget.style.borderColor = C.accent}
                                    onBlur={(e) => e.currentTarget.style.borderColor = C.border} />
                                </div>
                              </div>
                            </div>

                            {/* Relance 2 */}
                            <div style={{ padding: '20px', borderRadius: 12, background: C.bg, border: `1px solid ${C.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Relance 2</span>
                                <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 50, background: 'rgba(251,146,60,0.08)', color: '#fb923c' }}>48h avant R2</span>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                  <label style={labelStyle}>Objet</label>
                                  <input value={relanceSettings.relance2_subject || ''} onChange={(e) => updateRelance('relance2_subject', e.target.value)}
                                    placeholder="Urgent – documents nécessaires pour votre Audit" style={inputStyle}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#fb923c'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = C.border} />
                                </div>
                                <div>
                                  <label style={labelStyle}>Corps de l'email</label>
                                  <textarea value={relanceSettings.relance2_body || ''} onChange={(e) => updateRelance('relance2_body', e.target.value)}
                                    placeholder="Bonjour {lead_name},&#10;&#10;Votre rendez-vous d'audit approche..." style={textareaStyle}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#fb923c'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = C.border} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Variables info */}
                          <div style={{ padding: '14px 16px', borderRadius: 10, background: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginBottom: 6 }}>Variables disponibles</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {['{lead_name}', '{commercial_last_name}', '{commercial_email}', '{r2_date_formatted}', '{r2_time}', '{rdv_date}', '{rdv_time}'].map(v => (
                                <button key={v} onClick={() => { navigator.clipboard.writeText(v); setCopiedField('relvar-' + v); setTimeout(() => setCopiedField(null), 1500); }}
                                  style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: copiedField === 'relvar-' + v ? 'rgba(16,185,129,0.12)' : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), color: copiedField === 'relvar-' + v ? '#10b981' : C.accent, fontFamily: 'monospace', textAlign: 'center', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
                                >{copiedField === 'relvar-' + v ? 'Copié ✓' : v}</button>
                              ))}
                            </div>
                          </div>

                          {/* Error toast */}
                          {relanceError && (
                            <div style={{
                              padding: '12px 16px', borderRadius: 10,
                              background: darkMode ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)',
                              border: '1px solid rgba(239,68,68,0.30)',
                              color: '#ef4444', fontSize: 13, fontWeight: 500,
                              display: 'flex', alignItems: 'center', gap: 10,
                              animation: 'toastSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
                            }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              <span style={{ flex: 1 }}>{relanceError}</span>
                              <button onClick={() => setRelanceError(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                            </div>
                          )}

                          {/* Save */}
                          <button onClick={saveRelance} disabled={relanceSaving} style={{
                            padding: '12px 24px', borderRadius: 10, border: 'none',
                            background: relanceSaved ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                            color: relanceSaved ? '#fff' : C.text,
                            fontSize: 14, fontWeight: 500, cursor: relanceSaving ? 'wait' : 'pointer',
                            fontFamily: 'inherit', transition: 'all 0.2s', alignSelf: 'flex-start',
                          }}>{relanceSaving ? 'Enregistrement...' : relanceSaved ? 'Enregistré ✓' : 'Enregistrer les relances'}</button>

                          <BookingSettings C={C} darkMode={darkMode} />
                        </div>
                      );
                    })()}
                  </div>

                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* ════ VIEW: LEADS MANAGEMENT (admin + head_of_sales_manager only) ═══ */}
        {sidebarView === 'leads_management' && canManageLeads && (
          <div style={{ flex: 1, overflow: 'auto', animation: 'tabFadeIn 0.3s ease-out both' }}>
            <LeadsManagement embedded={true} darkModeOverride={darkMode} C={C} />
          </div>
        )}

        {/* ════ VIEW: TRACKING SHEETS MANAGEMENT ══════════════════════════════ */}
        {sidebarView === 'sheets' && canManageSheets && (() => {
          if (allSheets.length === 0 && !sheetsLoading) fetchAllSheets();
          if (solarTeams.length === 0 && allSheets.length > 0) {
            apiClient.get('/api/v1/teams').then(data => setSolarTeams(data || [])).catch(() => {});
          }
          // Group sheets by team
          const normalize = (n) => (n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          const findSheet = (name, email) => allSheets.find(s => s.email === email || (name && normalize(s.full_name).includes(normalize(name).split(' ')[0])));

          const renderSheetRow = (sheet, isCaptain) => {
            if (!sheet) return null;
            const isKilled = sheet.status === 'killed';
            return (
              <div key={sheet.email} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 12, border: `1px solid ${isKilled ? (darkMode ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.12)') : C.border}`,
                background: isKilled ? (darkMode ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)') : (darkMode ? 'rgba(255,255,255,0.02)' : '#fff'),
                transition: 'all 0.2s', cursor: 'pointer',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : '#faf9f7'}
                onMouseLeave={(e) => e.currentTarget.style.background = isKilled ? (darkMode ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.02)') : (darkMode ? 'rgba(255,255,255,0.02)' : '#fff')}
                onClick={() => enterSheet(sheet.email)}
              >
                {sheet.avatar_url ? (
                  <img src={sheet.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, filter: isKilled ? 'grayscale(1)' : 'none', opacity: isKilled ? 0.5 : 1, transition: 'all 0.3s' }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: isKilled ? '#a8a39b' : (darkMode ? '#6366f1' : '#2b2927'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
                    {(sheet.full_name || '?').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: isKilled ? C.muted : C.text }}>{sheet.full_name || sheet.email}</span>
                    {isCaptain && <span style={{ fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted }}>CHEF</span>}
                    {isKilled && <span style={{ fontSize: 9, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>KILLED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{sheet.lead_count || 0} leads</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  {isAdmin && !isKilled && (
                    <button onClick={() => handleKillSheet(sheet.email)} style={{
                      padding: '5px 10px', borderRadius: 8, border: 'none', fontSize: 10.5, fontWeight: 500,
                      background: darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)', color: '#ef4444',
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)'; e.currentTarget.style.color = '#ef4444'; }}
                    >Kill</button>
                  )}
                  {isAdmin && isKilled && (
                    <>
                      <button onClick={() => handleRestoreSheet(sheet.email)} style={{
                        padding: '5px 10px', borderRadius: 8, border: 'none', fontSize: 10.5, fontWeight: 500,
                        background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)', color: '#10b981',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)'; e.currentTarget.style.color = '#10b981'; }}
                      >Réactiver</button>
                      <button onClick={async () => {
                        setInviteModal({ sheetEmail: sheet.email }); setInviteSearch('');
                        if (assignableUsers.length === 0) { try { const r = await apiClient.getAssignableUsers(); setAssignableUsers(Array.isArray(r) ? r : (r?.users || [])); } catch {} }
                      }} style={{
                        padding: '5px 10px', borderRadius: 8, border: 'none', fontSize: 10.5, fontWeight: 500,
                        background: darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.06)', color: '#8b5cf6',
                        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#8b5cf6'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.06)'; e.currentTarget.style.color = '#8b5cf6'; }}
                      >Inviter</button>
                    </>
                  )}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.3, flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
              </div>
            );
          };

          return (
            <div style={{ padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, color: C.text, margin: 0 }}>Tracking Sheets</h2>
                  <p style={{ fontSize: 13, color: C.muted, margin: '4px 0 0' }}>Équipes commerciales</p>
                </div>
                {isAdmin && (
                  <button onClick={() => setGhostMode(!ghostMode)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                    border: `1px solid ${ghostMode ? '#8b5cf6' : C.border}`,
                    background: ghostMode ? 'rgba(139,92,246,0.1)' : 'transparent',
                    color: ghostMode ? '#8b5cf6' : C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      {ghostMode ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></> : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>}
                    </svg>
                    {ghostMode ? 'Ghost actif' : 'Ghost'}
                  </button>
                )}
              </div>

              {sheetsLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Chargement...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {solarTeams.filter(team => {
                    if (isAdmin) return true;
                    const normUser = normalize(currentUser?.full_name || currentUser?.name || '');
                    const captName = normalize(team.captain?.name);
                    if (captName && normUser && captName.includes(normUser.split(' ')[0])) return true;
                    return (team.members || []).some(m => normalize(m.name).includes(normUser.split(' ')[0]));
                  }).map(team => (
                    <div key={team.id || team.label}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: team.color || C.accent }} />
                        <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{team.label}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18 }}>
                        {renderSheetRow(findSheet(team.captain?.name, team.captain?.email), true)}
                        {(team.members || []).map(m => renderSheetRow(findSheet(m.name, m.email), false))}
                      </div>
                    </div>
                  ))}

                  {/* Sheets without a team */}
                  {(() => {
                    const teamEmails = new Set();
                    solarTeams.forEach(t => {
                      const cap = findSheet(t.captain?.name, t.captain?.email);
                      if (cap) teamEmails.add(cap.email);
                      (t.members || []).forEach(m => { const ms = findSheet(m.name, m.email); if (ms) teamEmails.add(ms.email); });
                    });
                    const orphans = allSheets.filter(s => !teamEmails.has(s.email));
                    if (orphans.length === 0) return null;
                    return (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.muted }} />
                          <span style={{ fontSize: 14, fontWeight: 500, color: C.muted }}>Autres</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18 }}>
                          {orphans.map(s => renderSheetRow(s, false))}
                        </div>
                      </div>
                    );
                  })()}

                  {allSheets.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontSize: 13 }}>Aucune tracking sheet trouvée</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ════ VIEW: LEADS (content) ═══════════════════════════════════════ */}
        {sidebarView === 'leads' && (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── FILTER SIDEBAR (pixel-match Freshsales) ────────────────────── */}
        {showFilters && (() => {
          const catKey = CATEGORIES[activeTab].key;
          const R1_TAGS = [
            { value: 'no_show', label: 'Client absent', color: '#f59e0b' },
            { value: 'rescheduled', label: 'Reporté', color: '#3b82f6' },
            { value: 'to_reschedule', label: 'À reprogrammer', color: '#8b867e' },
            { value: 'done', label: 'R1 effectué', color: '#10b981' },
            { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
          ];
          const R2_TAGS = [
            { value: 'no_show', label: 'Client absent', color: '#f59e0b' },
            { value: 'done', label: 'R2 effectué', color: '#10b981' },
            { value: 'comptable', label: 'Avis du comptable', color: '#8b5cf6' },
            { value: 'associe', label: 'Avis d’un associé', color: '#6366f1' },
            { value: 'reflexion', label: 'Temps de réflexion', color: '#3b82f6' },
            { value: 'tresorerie', label: 'Trésorerie à prévoir', color: '#f59e0b' },
            { value: 'reporte', label: 'Reporté', color: '#fb923c' },
            { value: 'a_reporter', label: 'À reprogrammer', color: '#8b867e' },
            { value: 'pas_interesse', label: 'Pas intéressé', color: '#ef4444' },
            { value: 'annule', label: 'Annulé', color: '#ef4444' },
          ];
          const tagOptions = catKey === 'r1' ? R1_TAGS : catKey === 'r2' ? R2_TAGS : catKey === 'new' ? [] : [...R1_TAGS, ...R2_TAGS.filter(t => t.value !== 'done' && t.value !== 'no_show')];
          const prioOptions = [{ value: 'prio_high', label: 'High', color: '#ef4444' }, { value: 'prio_medium', label: 'Medium', color: '#f59e0b' }, { value: 'prio_low', label: 'Low', color: '#a8a39b' }];
          const statusOptions = catKey === 'new'
            ? prioOptions
            : catKey === 'r1'
              ? [{ value: 'r1_scheduled', label: 'Planifiés', color: '#3b82f6' }, { value: 'r1_waiting', label: 'En attente', color: '#f59e0b' }, { value: 'r1_done', label: 'Effectués', color: '#10b981' }, { value: 'r1_cancelled', label: 'Annulés', color: '#ef4444' }, { value: 'r1_setter_placed', label: 'Traité par le setter', color: '#8b5cf6' }, ...prioOptions]
              : catKey === 'r2'
                ? [{ value: 'r2_scheduled', label: 'Planifiés', color: '#fb923c' }, { value: 'r2_pending', label: 'En attente', color: '#f59e0b' }, { value: 'r2_done', label: 'Effectués', color: '#10b981' }, { value: 'r2_cancelled', label: 'Annulés', color: '#ef4444' }, ...prioOptions]
                : catKey === 'r3'
                  ? [{ value: 'r2_scheduled', label: 'Planifiés', color: '#8b5cf6' }, { value: 'r2_pending', label: 'En attente', color: '#f59e0b' }, { value: 'r2_done', label: 'Effectués', color: '#10b981' }, { value: 'r2_cancelled', label: 'Annulés', color: '#ef4444' }, ...prioOptions]
                  : prioOptions;

          // Shared colors
          const greyBorder = darkMode ? '#3a3a3a' : '#d4d4d8';
          const accentDot = darkMode ? '#ededed' : '#2b2927';
          const optionsBg = darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';

          // Toggle a filter section open/closed (stable state, survives re-renders)
          const toggleSection = (key) => setOpenFilterSections(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          });

          // Render a filter item row (icon + label + chevron)
          const renderFilterRow = (key, icon, label, hasChildren) => {
            const isOpen = openFilterSections.has(key);
            return (
              <div
                onClick={() => hasChildren ? toggleSection(key) : null}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px 9px 16px', cursor: hasChildren ? 'pointer' : 'default',
                }}
              >
                <span style={{ color: C.muted, flexShrink: 0, display: 'flex', alignItems: 'center' }}>{icon}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: isOpen ? 600 : 500, color: C.text }}>{label}</span>
                {hasChildren && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(0)' : 'rotate(-90deg)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
            );
          };

          // Render radio option
          const renderRadio = (selected, label, color, onClick) => (
            <div onClick={onClick} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0',
              cursor: 'pointer', fontSize: 13, color: C.text, fontFamily: 'inherit',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selected ? (color || accentDot) : greyBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.15s',
              }}>
                {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color || accentDot }} />}
              </div>
              <span style={{ fontWeight: selected ? 500 : 400, color: selected ? C.text : C.secondary }}>{label}</span>
            </div>
          );

          // Options container (mini grey container with radius)
          const renderOptionsBox = (children) => (
            <div style={{
              margin: '0 10px 10px 16px', padding: '8px 12px 8px 26px',
              background: optionsBg, borderRadius: 10,
            }}>
              {children}
            </div>
          );

          return (
              <div style={{
                width: 220, flexShrink: 0, alignSelf: 'flex-start',
                background: darkMode ? C.bg : '#faf9f7',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                marginTop: 10, marginLeft: 4,
                overflowY: 'auto', display: 'flex', flexDirection: 'column',
                scrollbarWidth: 'thin', scrollbarColor: `${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} transparent`,
                boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
              }}>

              {/* ── "Filtres" title ── */}
              <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>Filtres</span>
              </div>

              {/* ═══ GROUP: PROPRIÉTÉS DU LEAD ═══ */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ padding: '14px 14px 8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Propriétés du lead</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>

                {/* Qualification */}
                {tagOptions.length > 0 && (
                  <>
                    {renderFilterRow('qualification', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>, 'Qualification', true)}
                    {openFilterSections.has('qualification') && renderOptionsBox(
                      tagOptions.map(opt => <div key={opt.value}>{renderRadio(filterTags.includes(opt.value), opt.label, opt.color, () => setFilterTags(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]))}</div>)
                    )}
                  </>
                )}

                {/* Statut */}
                {statusOptions.length > 0 && (
                  <>
                    {renderFilterRow('statut', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, catKey === 'new' ? 'Priorité' : 'Statut & Priorité', true)}
                    {openFilterSections.has('statut') && renderOptionsBox(
                      statusOptions.map(opt => <div key={opt.value}>{renderRadio(filterStatuses.includes(opt.value), opt.label, opt.color, () => setFilterStatuses(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]))}</div>)
                    )}
                  </>
                )}

                {/* Origine */}
                {renderFilterRow('origine', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, 'Origine', true)}
                {openFilterSections.has('origine') && (() => {
                  const uniqueOrigins = [...new Set(leads.map(l => l.origin).filter(Boolean))].sort();
                  return renderOptionsBox(
                    uniqueOrigins.map(o => (
                      <div key={o}>{renderRadio(filterOrigins.includes(o), o, C.accent, () => setFilterOrigins(prev => prev.includes(o) ? prev.filter(v => v !== o) : [...prev, o]))}</div>
                    ))
                  );
                })()}

                {/* Téléphones mobiles — tous les onglets. Toggle binaire : ne garde que les leads dont le
                    numéro normalisé est un mobile français (06 / 07, +33, 0033…) ; fixes, 09, numéros
                    étrangers et leads sans numéro sont masqués. */}
                {renderFilterRow('phone_type', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>, 'Téléphones mobiles', true)}
                {openFilterSections.has('phone_type') && renderOptionsBox([
                  <div key="phone_type_toggle">{renderRadio(filterMobileOnly, 'Uniquement les mobiles (06 / 07)', C.accent, () => setFilterMobileOnly(v => !v))}</div>,
                  filterMobileOnly && (
                    <div key="phone_type_hint" style={{ fontSize: 12, color: C.muted, padding: '2px 0 4px 26px', lineHeight: 1.45 }}>
                      <div>{filteredLeads.length} lead{filteredLeads.length > 1 ? 's' : ''} affiché{filteredLeads.length > 1 ? 's' : ''}</div>
                      <div>Fixes, 09 et sans numéro masqués</div>
                    </div>
                  ),
                ])}
              </div>

              {/* ═══ GROUP: TRI & DATES ═══ */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <div style={{ padding: '14px 14px 8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tri & dates</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>

                {/* Ordre */}
                {renderFilterRow('ordre', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>, 'Ordre', true)}
                {openFilterSections.has('ordre') && renderOptionsBox(
                  [{ value: 'newest', label: 'Plus récents' }, { value: 'oldest', label: 'Plus anciens' }].map(opt => <div key={opt.value}>{renderRadio(sortOrder === opt.value, opt.label, null, () => setSortOrder(opt.value))}</div>)
                )}

                {/* Heure du 1er appel (voicemail/callback only) */}
                {(catKey === 'voicemail' || catKey === 'callback') && (
                  <>
                    {renderFilterRow('call_time', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>, 'Heure du 1er appel', true)}
                    {openFilterSections.has('call_time') && renderOptionsBox(
                      [{ value: 'matin', label: 'Matin (8h–12h)', color: '#f59e0b' }, { value: 'apres_midi', label: 'Après-midi (12h–18h)', color: '#3b82f6' }, { value: 'soir', label: 'Soir (18h–8h)', color: '#8b5cf6' }].map(opt => (
                        <div key={opt.value}>{renderRadio(filterCallTime.includes(opt.value), opt.label, opt.color, () => setFilterCallTime(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value]))}</div>
                      ))
                    )}
                  </>
                )}

                {/* Date d'assignation */}
                {renderFilterRow('date_assign', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, "Date d'assignation", false)}

                {/* Dernière activité */}
                {renderFilterRow('last_activity', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, 'Dernière activité', false)}
              </div>

              {/* ═══ GROUP: AUTRES ═══ */}
              <div>
                <div style={{ padding: '14px 14px 8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Autres</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>

                {renderFilterRow('notes', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, 'Notes', false)}
              </div>

              <div style={{ flex: 1 }} />

              {/* Clear all — bottom */}
              {(filterTags.length > 0 || filterStatuses.length > 0 || filterOrigins.length > 0 || filterMobileOnly || filterCallTime.length > 0 || sortOrder !== 'newest') && (
                <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => { setFilterTags([]); setFilterStatuses([]); setFilterOrigins([]); setFilterMobileOnly(false); setFilterCallTime([]); setSortOrder('newest'); }} style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    border: `1px solid ${C.accent}40`, background: `${C.accent}08`, color: C.accent,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = `${C.accent}18`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = `${C.accent}08`; }}
                  >Effacer tous les filtres</button>
                </div>
              )}
              </div>
          );
        })()}


        {/* ── LEFT: Lead list ──────────────────────────────────────────── */}
        <div className="leads-scroll" style={{
          flex: 1,
          minWidth: 0,
          padding: '24px 24px 32px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.12) transparent',
        }}>
          {/* Tab header */}
          <div key={`header-${tabKey}`} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            animation: 'tabFadeIn 0.3s ease-out both',
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: activeCat.dotColor || activeCat.color,
              flexShrink: 0,
            }} />
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 500,
                color: C.text,
                letterSpacing: '-0.01em',
              }}>
                {activeCat.label}
              </h2>
              <p style={{
                margin: '2px 0 0',
                fontSize: '13px',
                color: C.muted,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {activeCat.description} — {filterMobileOnly ? `${filteredLeads.length} sur ${tabCounts[activeCat.key]}` : tabCounts[activeCat.key]} lead{tabCounts[activeCat.key] !== 1 ? 's' : ''}
                <button
                  onClick={() => setShowAddLeadModal(true)}
                  title="Ajouter un lead"
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    border: `1px solid ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.05)' : '#ffffff',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0, padding: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'; }}
                >
                  <div style={{
                    width: 32, height: 32,
                    backgroundColor: C.muted,
                    WebkitMaskImage: `url(${iconPlus})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center',
                    maskImage: `url(${iconPlus})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center',
                    transition: 'background-color 0.15s',
                  }} />
                </button>
              </p>
            </div>
          </div>

          {/* Search bar + filters */}
          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Search input row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Hide/Show Filters toggle */}
              <button
                onClick={() => setShowFilters(prev => !prev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 10px', borderRadius: 8, flexShrink: 0,
                  border: `1px solid ${C.border}`, background: C.bg,
                  color: C.secondary, fontSize: 11.5, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.secondary; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                  <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
                </svg>
                {showFilters ? 'Masquer filtres' : 'Afficher filtres'}
              </button>

              <div style={{ width: 200, flexShrink: 0, position: 'relative' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 30px',
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff',
                    color: C.text,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = C.accent;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accent}15`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                    color: C.muted, fontSize: '13px', lineHeight: 1, fontFamily: 'inherit',
                  }}>×</button>
                )}
              </div>

              {/* Filter buttons */}
              {(() => {
                const catKey = CATEGORIES[activeTab].key;
                const R1_TAGS = [
                  { value: 'no_show', label: 'Client absent', color: '#f59e0b' },
                  { value: 'rescheduled', label: 'Reporté', color: '#3b82f6' },
                  { value: 'to_reschedule', label: 'À reprogrammer', color: '#8b867e' },
                  { value: 'done', label: 'R1 effectué', color: '#10b981' },
                  { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
                ];
                const R2_TAGS = [
                  { value: 'no_show', label: 'Client absent', color: '#f59e0b' },
                  { value: 'done', label: 'R2 effectué', color: '#10b981' },
                  { value: 'comptable', label: 'Avis du comptable', color: '#8b5cf6' },
                  { value: 'associe', label: 'Avis d’un associé', color: '#6366f1' },
                  { value: 'reflexion', label: 'Temps de réflexion', color: '#3b82f6' },
                  { value: 'tresorerie', label: 'Trésorerie à prévoir', color: '#f59e0b' },
                  { value: 'reporte', label: 'Reporté', color: '#fb923c' },
                  { value: 'a_reporter', label: 'À reprogrammer', color: '#8b867e' },
                  { value: 'pas_interesse', label: 'Pas intéressé', color: '#ef4444' },
                  { value: 'annule', label: 'Annulé', color: '#ef4444' },
                ];
                const tagOptions = catKey === 'r1' ? R1_TAGS : catKey === 'r2' ? R2_TAGS : catKey === 'new' ? [] : [...R1_TAGS, ...R2_TAGS.filter(t => t.value !== 'done' && t.value !== 'no_show')];
                const prioOpts = [{ value: 'prio_high', label: 'High', color: '#ef4444' }, { value: 'prio_medium', label: 'Medium', color: '#f59e0b' }, { value: 'prio_low', label: 'Low', color: '#a8a39b' }];
                const statusOptions = catKey === 'new'
                  ? prioOpts
                  : catKey === 'r1'
                    ? [{ value: 'r1_scheduled', label: 'Planifiés', color: '#3b82f6' }, { value: 'r1_waiting', label: 'En attente', color: '#f59e0b' }, { value: 'r1_done', label: 'Effectués', color: '#10b981' }, { value: 'r1_cancelled', label: 'Annulés', color: '#ef4444' }, { value: 'r1_setter_placed', label: 'Traité par le setter', color: '#8b5cf6' }, ...prioOpts]
                    : catKey === 'r2'
                      ? [{ value: 'r2_scheduled', label: 'Planifiés', color: '#fb923c' }, { value: 'r2_pending', label: 'En attente', color: '#f59e0b' }, { value: 'r2_done', label: 'Effectués', color: '#10b981' }, { value: 'r2_cancelled', label: 'Annulés', color: '#ef4444' }, ...prioOpts]
                      : catKey === 'r3'
                        ? [{ value: 'r2_scheduled', label: 'Planifiés', color: '#8b5cf6' }, { value: 'r2_pending', label: 'En attente', color: '#f59e0b' }, { value: 'r2_done', label: 'Effectués', color: '#10b981' }, { value: 'r2_cancelled', label: 'Annulés', color: '#ef4444' }, ...prioOpts]
                        : prioOpts;
                const hasTagFilter = tagOptions.length > 0;
                const hasStatusFilter = statusOptions.length > 0;
                const toggleTag = (val) => setFilterTags(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
                const toggleStatus = (val) => setFilterStatuses(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

                return (
                  <>
                    {hasTagFilter && (
                      <button onClick={() => setOpenFilter(prev => prev === 'tag' ? '' : 'tag')} style={{
                        width: 34, height: 34, borderRadius: 10, border: `1px solid ${filterTags.length > 0 ? C.accent : C.border}`,
                        background: filterTags.length > 0 ? `${C.accent}12` : (darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                        color: filterTags.length > 0 ? C.accent : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', flexShrink: 0, position: 'relative',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                        onMouseLeave={(e) => { if (!filterTags.length) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; } }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        {filterTags.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: C.accent, color: C.onAccent, fontSize: 9, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterTags.length}</span>}
                      </button>
                    )}
                    {hasStatusFilter && (
                      <button onClick={() => setOpenFilter(prev => prev === 'status' ? '' : 'status')} style={{
                        width: 34, height: 34, borderRadius: 10, border: `1px solid ${filterStatuses.length > 0 ? C.accent : C.border}`,
                        background: filterStatuses.length > 0 ? `${C.accent}12` : (darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                        color: filterStatuses.length > 0 ? C.accent : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s', flexShrink: 0, position: 'relative',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                        onMouseLeave={(e) => { if (!filterStatuses.length) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; } }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        {filterStatuses.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: C.accent, color: C.onAccent, fontSize: 9, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{filterStatuses.length}</span>}
                      </button>
                    )}
                    <button onClick={() => setOpenFilter(prev => prev === 'sort' ? '' : 'sort')} style={{
                      width: 34, height: 34, borderRadius: 10, border: `1px solid ${sortOrder === 'oldest' ? C.accent : C.border}`,
                      background: sortOrder === 'oldest' ? `${C.accent}12` : (darkMode ? 'rgba(255,255,255,0.04)' : '#ffffff'),
                      color: sortOrder === 'oldest' ? C.accent : C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={(e) => { if (sortOrder !== 'oldest') { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.muted; } }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><polyline points={sortOrder === 'newest' ? '19 12 12 19 5 12' : '5 12 12 5 19 12'} />
                      </svg>
                    </button>
                  </>
                );
              })()}
            </div>

            {/* ── Dropdown: Tag filter (multi-select, tab-contextual) ── */}
            {openFilter === 'tag' && (() => {
              const catKey = CATEGORIES[activeTab].key;
              const R1_TAGS = [
                { value: 'no_show', label: 'Client absent', color: '#f59e0b' },
                { value: 'rescheduled', label: 'Reporté', color: '#3b82f6' },
                { value: 'to_reschedule', label: 'À reprogrammer', color: '#8b867e' },
                { value: 'done', label: 'R1 effectué', color: '#10b981' },
                { value: 'cancelled', label: 'Annulé', color: '#ef4444' },
              ];
              const R2_TAGS = [
                { value: 'no_show', label: 'Client absent', color: '#f59e0b' },
                { value: 'done', label: 'R2 effectué', color: '#10b981' },
                { value: 'comptable', label: 'Avis du comptable', color: '#8b5cf6' },
                { value: 'associe', label: 'Avis d’un associé', color: '#6366f1' },
                { value: 'reflexion', label: 'Temps de réflexion', color: '#3b82f6' },
                { value: 'tresorerie', label: 'Trésorerie à prévoir', color: '#f59e0b' },
                { value: 'reporte', label: 'Reporté', color: '#fb923c' },
                { value: 'a_reporter', label: 'À reprogrammer', color: '#8b867e' },
                { value: 'pas_interesse', label: 'Pas intéressé', color: '#ef4444' },
                { value: 'annule', label: 'Annulé', color: '#ef4444' },
              ];
              const opts = catKey === 'r1' ? R1_TAGS : catKey === 'r2' ? R2_TAGS : [...R1_TAGS, ...R2_TAGS.filter(t => t.value !== 'done' && t.value !== 'no_show')];
              return (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px',
                  borderRadius: 12, border: `1px solid ${C.border}`, background: darkMode ? C.bg : '#fff',
                  animation: 'wfSplitIn 0.2s ease both', alignItems: 'center',
                }}>
                  {opts.map(opt => {
                    const sel = filterTags.includes(opt.value);
                    return (
                      <button key={opt.value} onClick={() => setFilterTags(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])} style={{
                        padding: '4px 10px', borderRadius: 50, border: `1.5px solid ${sel ? opt.color : 'transparent'}`,
                        background: sel ? `${opt.color}18` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        color: sel ? opt.color : C.text, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.12s',
                      }}>{opt.label}</button>
                    );
                  })}
                  {filterTags.length > 0 && (
                    <button onClick={() => setFilterTags([])} style={{
                      padding: '3px 8px', borderRadius: 50, border: 'none',
                      background: 'none', color: C.muted, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'inherit', textDecoration: 'underline',
                    }}>Effacer</button>
                  )}
                </div>
              );
            })()}

            {/* ── Dropdown: Status filter (multi-select, tab-contextual) ── */}
            {openFilter === 'status' && (() => {
              const catKey = CATEGORIES[activeTab].key;
              const opts = catKey === 'new'
                ? [{ value: 'contacted', label: 'Contacté', color: '#10b981' }, { value: 'not_contacted', label: 'Pas contacté', color: '#a8a39b' }]
                : catKey === 'r1'
                  ? [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#a8a39b' }]
                  : catKey === 'r2'
                    ? [{ value: 'r2_scheduled', label: 'Planifiés', color: '#fb923c' }, { value: 'r2_pending', label: 'En attente', color: '#f59e0b' }, { value: 'r2_done', label: 'Effectués', color: '#10b981' }, { value: 'r2_cancelled', label: 'Annulés', color: '#ef4444' }]
                    : [{ value: 'r1_done', label: 'R1 qualifié', color: '#3b82f6' }, { value: 'r1_not_done', label: 'R1 non qualifié', color: '#a8a39b' }, { value: 'r2_done', label: 'R2 qualifié', color: '#fb923c' }, { value: 'r2_not_done', label: 'R2 non qualifié', color: '#a8a39b' }];
              return (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px',
                  borderRadius: 12, border: `1px solid ${C.border}`, background: darkMode ? C.bg : '#fff',
                  animation: 'wfSplitIn 0.2s ease both', alignItems: 'center',
                }}>
                  {opts.map(opt => {
                    const sel = filterStatuses.includes(opt.value);
                    return (
                      <button key={opt.value} onClick={() => setFilterStatuses(prev => prev.includes(opt.value) ? prev.filter(v => v !== opt.value) : [...prev, opt.value])} style={{
                        padding: '4px 10px', borderRadius: 50, border: `1.5px solid ${sel ? opt.color : 'transparent'}`,
                        background: sel ? `${opt.color}18` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        color: sel ? opt.color : C.text, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.12s',
                      }}>{opt.label}</button>
                    );
                  })}
                  {filterStatuses.length > 0 && (
                    <button onClick={() => setFilterStatuses([])} style={{
                      padding: '3px 8px', borderRadius: 50, border: 'none',
                      background: 'none', color: C.muted, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'inherit', textDecoration: 'underline',
                    }}>Effacer</button>
                  )}
                </div>
              );
            })()}

            {/* ── Dropdown: Sort order ── */}
            {openFilter === 'sort' && (
              <div style={{
                display: 'flex', gap: 6, padding: '10px 12px',
                borderRadius: 12, border: `1px solid ${C.border}`, background: darkMode ? C.bg : '#fff',
                animation: 'wfSplitIn 0.2s ease both',
              }}>
                {[
                  { value: 'newest', label: 'Plus récents', icon: '↓' },
                  { value: 'oldest', label: 'Plus anciens', icon: '↑' },
                ].map(opt => {
                  const sel = sortOrder === opt.value;
                  return (
                    <button key={opt.value} onClick={() => { setSortOrder(opt.value); setOpenFilter(''); }} style={{
                      flex: 1, padding: '6px 12px', borderRadius: 50, border: `1.5px solid ${sel ? C.accent : 'transparent'}`,
                      background: sel ? `${C.accent}15` : (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                      color: sel ? C.accent : C.text, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      <span style={{ fontSize: 13 }}>{opt.icon}</span>{opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active filters summary — removable chips */}
            {(filterTags.length > 0 || filterStatuses.length > 0) && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {filterTags.map(tag => {
                  const label = tag === 'no_show' ? 'Client absent' : tag === 'rescheduled' ? 'Reporté' : (tag === 'to_reschedule' || tag === 'a_reporter') ? 'À reprogrammer' : tag === 'done' ? 'Effectué' : tag === 'cancelled' ? 'Annulé' : tag === 'comptable' ? 'Comptable' : tag === 'associe' ? 'Associé' : tag === 'reflexion' ? 'Réflexion' : tag === 'tresorerie' ? 'Trésorerie' : tag === 'reporte' ? 'Reporté R2' : tag === 'pas_interesse' ? 'Pas intéressé' : tag === 'annule' ? 'Annulé R2' : tag;
                  return (
                    <span key={`tag-${tag}`} onClick={() => setFilterTags(prev => prev.filter(v => v !== tag))} style={{
                      padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                      background: `${C.accent}12`, color: C.accent, border: `1px solid ${C.accent}30`,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      {label} ×
                    </span>
                  );
                })}
                {filterStatuses.map(s => {
                  const label = s === 'r1_done' ? 'R1 qualifié' : s === 'r1_not_done' ? 'R1 non qualifié' : s === 'r2_done' ? 'R2 qualifié' : s === 'r2_not_done' ? 'R2 non qualifié' : s === 'contacted' ? 'Contacté' : s === 'not_contacted' ? 'Pas contacté' : s;
                  return (
                    <span key={`st-${s}`} onClick={() => setFilterStatuses(prev => prev.filter(v => v !== s))} style={{
                      padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                      background: `${C.accent}12`, color: C.accent, border: `1px solid ${C.accent}30`,
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      {label} ×
                    </span>
                  );
                })}
                {(filterTags.length + filterStatuses.length > 1) && (
                  <span onClick={() => { setFilterTags([]); setFilterStatuses([]); }} style={{
                    padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                    color: C.muted, textDecoration: 'underline',
                  }}>
                    Tout effacer
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Lead cards — with grouped containers for R1/R2 tabs */}
          {(() => {
            const isR1Tab = activeCat.key === 'r1';
            const isR2Tab = activeCat.key === 'r2';
            const isR3Tab = activeCat.key === 'r3';
            const isCallTab = activeCat.key === 'callback' || activeCat.key === 'voicemail';
            const isGroupedTab = isR1Tab || isR2Tab || isR3Tab || isCallTab;

            // R1 groups — leads with past date + no result go to pending.
            // Conteneur "Traité par le setter" (option B — exclusif tant que non
            // qualifié par sales) : un lead avec `r1_placed_by_setter_id` non null
            // est dans son propre container TANT QUE r1_result est null/rescheduled.
            // Dès que le sales qualifie (`r1_result = done/no_show/cancelled`), le
            // lead migre naturellement dans Planifiés/Pending/Effectués/Annulés.
            // Le badge "Traité par {prénom}" reste sur la card via
            // `r1_placed_by_setter_name` peu importe le bucket → trace préservée.
            const todayDate = parisToday();
            const isDatePast = (d) => { if (!d) return false; const ds = typeof d === 'string' ? d.slice(0, 10) : ''; return ds && ds < todayDate; };
            const isSetterPlaced = (l) => l.r1_placed_by_setter_id != null;
            const isSetterPlacedUnqualified = (l) => isSetterPlaced(l) && (!l.r1_result || l.r1_result === 'rescheduled');
            // Landing pages dynamiques (Broad LP, BTP LP, etc.) : origin finit par " LP".
            // RDV R1 pris directement depuis la LP (/live) → propre conteneur "R1 Landing".
            const isLandingLead = (l) => (l.origin || '').toLowerCase().trimEnd().endsWith(' lp');
            // Anciens webinaires (dev 12/11/2026) : R1 posé par un setter sur un inscrit d'un ancien webinaire, puis
            // affecté à la main dans Gestion des leads. Conteneur "R1 Webinaire" en tête de l'onglet, comme
            // "R2 Webinaire" ; le lead y reste tant que son R1 n'est pas qualifié, à la place de "Traité par …".
            // L'origine ne commence pas par "webinaire" : ces leads ne vont pas dans "R2 Webinaire".
            const isR1Webinaire = (l) => (l.origin || '').trim().toLowerCase() === 'anciens webinaires' && (!l.r1_result || l.r1_result === 'rescheduled');
            const isSetApart = (l) => isSetterPlacedUnqualified(l) || isR1Webinaire(l);
            const r1Webinaire  = isR1Tab ? filteredLeads.filter(isR1Webinaire) : [];
            const r1SetterPlaced = isR1Tab ? filteredLeads.filter(l => isSetterPlacedUnqualified(l) && !isR1Webinaire(l)) : [];
            const r1Landing    = isR1Tab ? filteredLeads.filter(l => !isSetApart(l) && (!l.r1_result || l.r1_result === 'rescheduled') && !isDatePast(l.r1) && isLandingLead(l)) : [];
            const r1Scheduled  = isR1Tab ? filteredLeads.filter(l => !isSetApart(l) && (!l.r1_result || l.r1_result === 'rescheduled') && !isDatePast(l.r1) && !isLandingLead(l)) : [];
            const r1Pending    = isR1Tab ? filteredLeads.filter(l => !isSetApart(l) && (l.r1_result === 'no_show' || l.r1_result === 'to_reschedule' || ((!l.r1_result || l.r1_result === 'rescheduled') && isDatePast(l.r1)))) : [];
            const r1Cancelled  = isR1Tab ? filteredLeads.filter(l => l.r1_result === 'cancelled') : [];
            const r1Completed  = isR1Tab ? filteredLeads.filter(l => l.r1_result === 'done') : [];

            // R2 groups
            const R2_PENDING_STATES = ['comptable', 'associe', 'reflexion', 'relire_contrat', 'pas_decision_jour', 'tresorerie'];
            const r2ScheduledAll = isR2Tab ? filteredLeads.filter(l => (!l.r2_result || l.r2_result === 'reporte') && !isDatePast(l.r2)) : [];
            // Sous-groupe webinaire : R2 planifiés dont origin commence par 'Webinaire'.
            // Affichés dans leur propre container en HAUT de l'onglet pour visibilité
            // immédiate (RDV placé par le prospect, sales doit savoir tout de suite).
            const isWebinaireLead = (l) => (l.origin || '').toLowerCase().startsWith('webinaire');
            const r2Webinaire  = isR2Tab ? r2ScheduledAll.filter(isWebinaireLead) : [];
            const r2Landing    = isR2Tab ? r2ScheduledAll.filter(isLandingLead) : [];
            const r2Scheduled  = isR2Tab ? r2ScheduledAll.filter(l => !isWebinaireLead(l) && !isLandingLead(l)) : [];
            const r2Pending    = isR2Tab ? filteredLeads.filter(l => l.r2_result === 'a_reporter' || l.r2_result === 'no_show' || R2_PENDING_STATES.includes(l.r2_result) || ((!l.r2_result || l.r2_result === 'reporte') && isDatePast(l.r2))) : [];
            const r2Cancelled  = isR2Tab ? filteredLeads.filter(l => l.r2_result === 'pas_interesse' || l.r2_result === 'annule') : [];
            const r2Completed  = isR2Tab ? filteredLeads.filter(l => l.r2_result === 'done') : [];

            // R3 groups (same logic as R2)
            const R3_PENDING_STATES = ['comptable', 'associe', 'reflexion', 'relire_contrat', 'pas_decision_jour', 'tresorerie'];
            const r3Scheduled  = isR3Tab ? filteredLeads.filter(l => (!l.r3_result || l.r3_result === 'reporte') && !isDatePast(l.r3)) : [];
            const r3Pending    = isR3Tab ? filteredLeads.filter(l => l.r3_result === 'a_reporter' || l.r3_result === 'no_show' || R3_PENDING_STATES.includes(l.r3_result) || ((!l.r3_result || l.r3_result === 'reporte') && isDatePast(l.r3))) : [];
            const r3Cancelled  = isR3Tab ? filteredLeads.filter(l => l.r3_result === 'pas_interesse' || l.r3_result === 'annule') : [];
            const r3Completed  = isR3Tab ? filteredLeads.filter(l => l.r3_result === 'done') : [];

            // Call attempt groups (callback + voicemail tabs)
            // Conteneur dédié "Traité par le setter" : leads pour lesquels un setter
            // a déjà passé un appel (`setter_called_by` non null). Ces leads sont
            // exclus des 3 conteneurs tentatives pour éviter le doublon.
            const callBySetter = isCallTab ? filteredLeads.filter(l => l.setter_called_by != null) : [];
            const callLow     = isCallTab ? filteredLeads.filter(l => l.setter_called_by == null && (l.call_attempts || 0) <= 2) : [];
            const callMedium  = isCallTab ? filteredLeads.filter(l => l.setter_called_by == null && (l.call_attempts || 0) >= 3 && (l.call_attempts || 0) <= 5) : [];
            const callHigh    = isCallTab ? filteredLeads.filter(l => l.setter_called_by == null && (l.call_attempts || 0) >= 6) : [];

            // Label dynamique du container "Traité par le setter" (R1).
            // 1 setter unique → "Traité par {prénom}" (premier token du nom complet).
            // 2+ setters distincts → "Traité par les setters" (fallback collectif).
            // Aucun nom dispo (data corrompue) → "Traité par le setter" (fallback générique).
            const setterPlacedLabel = (() => {
              const names = [...new Set(r1SetterPlaced.map(l => l.r1_placed_by_setter_name).filter(Boolean))];
              if (names.length === 0) return 'Traité par le setter';
              if (names.length === 1) return `Traité par ${names[0].split(' ')[0]}`;
              return 'Traité par les setters';
            })();

            // Unified groups array for the active tab
            const groups = isR1Tab ? [
              // Container "R1 Webinaire" en TÊTE : anciens webinaires affectés à la main, R1 déjà posé par un
              // setter (dev 12/11/2026). Même couleur et même mécanique que "R2 Webinaire". Affiché si non vide.
              ...(r1Webinaire.length > 0 ? [{
                key: 'webinaire', leads: r1Webinaire, label: 'R1 Webinaire',
                color: '#8b5cf6',
              }] : []),
              // Container "R1 Landing" en TÊTE : leads Broad LP, RDV R1 pris directement
              // depuis la landing page (/live). Couleur cyan (cohérent avec "R2 Landing").
              // Affiché uniquement si non vide.
              ...(r1Landing.length > 0 ? [{
                key: 'landing', leads: r1Landing, label: 'R1 Landing',
                color: '#06b6d4',
              }] : []),
              { key: 'scheduled', leads: r1Scheduled, label: 'Planifiés', color: '#3b82f6' },
              // Container "Traité par le setter" — positionné juste après Planifiés
              // pour que le sales voie immédiatement les R1 placés par les setters
              // (qui demandent généralement plus d'attention que les Annulés).
              // Listing exclusif des leads dont r1_placed_by_setter_id est non null.
              // Label dynamique selon le ou les setters présents (cf. setterPlacedLabel).
              { key: 'setter_placed', leads: r1SetterPlaced, label: setterPlacedLabel, color: '#8b5cf6' },
              { key: 'pending',   leads: r1Pending,   label: 'En attente', color: '#f59e0b' },
              { key: 'completed', leads: r1Completed, label: 'Effectués',  color: '#10b981' },
              { key: 'cancelled', leads: r1Cancelled, label: 'Annulés',     color: '#ef4444' },
            ] : isR2Tab ? [
              // Container "R2 Webinaire" en TÊTE : leads issus des bookings
              // webinaire (origin commence par 'Webinaire'), RDV déjà placé
              // par le prospect lui-même. Couleur violet pour distinction.
              // Affiché uniquement si non vide. Collapsible (default expanded).
              ...(r2Webinaire.length > 0 ? [{
                key: 'webinaire', leads: r2Webinaire, label: 'R2 Webinaire',
                color: '#8b5cf6',
              }] : []),
              // Container "R2 Landing" : leads Broad LP / BTP LP, RDV pris directement
              // depuis landing page (/live, /btp). Couleur cyan pour distinction.
              ...(r2Landing.length > 0 ? [{
                key: 'landing', leads: r2Landing, label: 'R2 Landing',
                color: '#06b6d4',
              }] : []),
              { key: 'scheduled', leads: r2Scheduled, label: 'Planifiés', color: '#fb923c' },
              { key: 'pending',   leads: r2Pending,   label: 'En attente', color: '#f59e0b' },
              { key: 'completed', leads: r2Completed, label: 'Effectués',  color: '#10b981' },
              { key: 'cancelled', leads: r2Cancelled, label: 'Annulés',     color: '#ef4444' },
            ] : isR3Tab ? [
              { key: 'scheduled', leads: r3Scheduled, label: 'Planifiés', color: '#8b5cf6' },
              { key: 'pending',   leads: r3Pending,   label: 'En attente', color: '#f59e0b' },
              { key: 'completed', leads: r3Completed, label: 'Effectués',  color: '#10b981' },
              { key: 'cancelled', leads: r3Cancelled, label: 'Annulés',     color: '#ef4444' },
            ] : isCallTab ? [
              // Conteneur "Traité par le setter" : ambre, en tête, uniquement si non vide.
              // canBulkMove=false : ces leads sont en cours de retravail setter, pas de
              // bascule en masse vers Non-pertinents.
              ...(callBySetter.length > 0 ? [{
                key: 'call_setter', leads: callBySetter, label: 'Traité par le setter',
                color: '#f59e0b', canBulkMove: false,
              }] : []),
              { key: 'call_low',    leads: callLow,    label: '1 à 2 tentatives',   color: '#3b82f6', canBulkMove: true },
              { key: 'call_medium', leads: callMedium, label: '3 à 5 tentatives',   color: '#f59e0b', canBulkMove: true },
              { key: 'call_high',   leads: callHigh,   label: '6+ tentatives',       color: '#ef4444', canBulkMove: true },
            ] : [];

            // Renders a single lead card (reused for both groups)
            const renderLeadCard = (lead, index) => {
              const isExiting = exitingCards.has(lead.id);
              const isSelected = selectedLead === lead.id;
              const origin = ORIGIN_COLORS[lead.origin] || DEFAULT_ORIGIN;
              // Check if a remote user is focusing this lead
              const remoteFocuser = Object.values(remoteLeadFocus).find(f => f.lead_id === String(lead.id));
              const isRemoteFocused = !!remoteFocuser;
              const focusColor = remoteFocuser?.color || '#6366f1';
              return (
                  <div
                    key={lead.id}
                    id={`lead-card-${lead.id}`}
                    style={{
                      position: 'relative',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      border: `1px solid ${highlightedLeadId === String(lead.id) ? '#f59e0b' : isRemoteFocused ? focusColor : isSelected ? (darkMode ? C.accent + '50' : '#cfc9c0') : (darkMode ? 'rgba(255,255,255,0.06)' : '#ece9e4')}`,
                      background: highlightedLeadId === String(lead.id)
                        ? (darkMode ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)')
                        : isRemoteFocused
                        ? `${focusColor}15`
                        : isSelected
                        ? (darkMode ? `${C.accent}12` : '#f4f2ee')
                        : (darkMode ? 'rgba(255,255,255,0.04)' : '#faf9f7'),
                      boxShadow: highlightedLeadId === String(lead.id)
                        ? '0 0 0 2px rgba(245,158,11,0.3), 0 4px 12px rgba(245,158,11,0.15)'
                        : isRemoteFocused
                        ? `0 0 0 2px ${focusColor}40, 0 4px 12px ${focusColor}20`
                        : undefined,
                      transition: 'all 0.3s ease',
                      animation: signingCard === lead.id
                        ? 'signedGlow 0.8s ease both'
                        : isExiting
                          ? 'cardSlideOut 0.35s cubic-bezier(0.22,1,0.36,1) both'
                          : `cardStaggerIn 0.5s cubic-bezier(0.34,1.56,0.64,1) ${index * 40}ms both`,
                      cursor: 'pointer',
                      overflow: isExiting ? 'hidden' : 'visible',
                    }}
                    onMouseEnter={(e) => {
                      if (!isExiting && !isSelected) {
                        e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.3)' : '#ddd8d0';
                        e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : '#f4f2ee';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = darkMode ? 'rgba(255,255,255,0.06)' : '#ece9e4';
                        e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : '#faf9f7';
                      }
                    }}
                    onClick={() => {
                      if (!isExiting) {
                        const newVal = isSelected ? null : lead.id;
                        setSelectedLead(newVal);
                        // Broadcast lead focus to other WS users
                        if (wsRef.current && wsRef.current.readyState === 1) {
                          wsRef.current.send(JSON.stringify({ type: 'lead_focus', lead_id: newVal ? String(newVal) : null }));
                        }
                      }
                    }}
                  >

                    {/* ═══ NOTE STICKER ═══ */}
                    {lead.notes && lead.notes.trim() && (
                      <img
                        src={mynoteIcon}
                        alt="Note"
                        style={{
                          position: 'absolute',
                          top: -7,
                          left: -14,
                          width: 50,
                          height: 50,
                          objectFit: 'contain',
                          pointerEvents: 'auto',
                          zIndex: 2,
                          filter: darkMode ? `${imgDark} drop-shadow(0 1px 3px rgba(0,0,0,0.4))` : 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))',
                          transition: 'transform 0.2s ease',
                          cursor: 'pointer',
                          ...(noteJustSaved === lead.id ? { animation: 'noteStickIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both' } : {}),
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        // Le commentaire à un clic depuis la ligne (11/11/2026) : sur un lead du parcours guidé, la note ouvre
                        // directement la fenêtre de commentaire ; sinon le clic ouvre la fiche, où la note se lit et se modifie.
                        title="Ouvrir le commentaire"
                        tabIndex={0}
                        onClick={(e) => {
                          if (isAdminView || !isGuidedLead(lead)) return;
                          e.stopPropagation();
                          setNotesError(null);
                          setEditingNotes(prev => ({ ...prev, [lead.id]: prev[lead.id] ?? lead.notes ?? '' }));
                          setCommentLeadId(lead.id);
                        }}
                      />
                    )}

                    {/* ═══ PILL VIEW ═══ */}
                    <div
                      id={`lead-pill-${lead.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '11px 18px',
                        overflow: 'hidden',
                        minWidth: 0,
                      }}
                    >
                      {/* Category color dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: activeCat.dotColor || activeCat.color,
                        flexShrink: 0,
                      }} />

                      {/* Name */}
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        color: isSelected ? C.accent : C.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: '60px',
                        maxWidth: 240,
                        flexShrink: 0,
                        letterSpacing: '-0.01em',
                        transition: 'color 0.2s ease',
                      }}>
                        {lead.full_name}
                      </span>
                      {/* Ligne allégée (dev 11/11/2026) : nom, société, origine, téléphone ; effectif et secteur se lisent dans la
                          fiche de droite, la date perd son année, le SMS reçu n'est plus qu'une pastille à compteur. */}
                      {lead.company_name && (
                        <span style={{ fontSize: 12.5, color: C.muted, minWidth: 0, flexShrink: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.company_name}
                        </span>
                      )}

                      {/* Origin badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '2px 8px', borderRadius: '50px',
                        fontSize: '10px', fontWeight: 500,
                        background: origin.bg, color: origin.text,
                        flexShrink: 0,
                      }}>
                        {originDisplay(lead.origin, lead.cc_sector)}
                      </span>
                      {/* Lead reçu d'un collègue : la mention, discrète. */}
                      <TransferTag lead={lead} darkMode={darkMode} compact />

                      {/* Compact info pills */}
                      <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
                      <span
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.phone, `phone-card-${lead.id}`, lead.id); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', color: copiedField === `phone-card-${lead.id}` ? '#10b981' : C.secondary, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500, flexShrink: 0, cursor: lead.phone ? 'pointer' : 'default', borderRadius: 6, padding: '1px 5px', margin: '-1px -5px', transition: 'color 0.2s, background 0.15s' }}
                        onMouseEnter={(e) => { if (lead.phone) e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        title={lead.phone ? 'Copier le numéro' : ''}
                      >
                        {copiedField === `phone-card-${lead.id}` ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.45 }}>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        )}
                        {copiedField === `phone-card-${lead.id}` ? (
                          <span style={{ fontSize: 10, fontWeight: 500, color: '#10b981', fontFamily: 'inherit', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
                        ) : lead.phone}
                      </span>
                      {/* Google Meet link */}
                      {(lead.r1_meet_link || lead.r2_meet_link) && (
                        <>
                          <span style={{ width: '1px', height: '14px', background: C.border, flexShrink: 0 }} />
                          <a
                            href={lead.r2_meet_link || lead.r1_meet_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Rejoindre le Google Meet"
                            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 6, padding: '2px 4px', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <img src={meetIcon} alt="Meet" style={{ width: 18, height: 18, objectFit: 'contain' }} />
                          </a>
                        </>
                      )}

                      {/* Spacer */}
                      <div style={{ flex: 1 }} />

                      {/* SMS count badge */}
                      {lead.sms_count > 0 && (
                        <span title={`${lead.sms_count} SMS envoyé${lead.sms_count > 1 ? 's' : ''}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '2px 7px', borderRadius: 7, fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                          background: darkMode ? 'rgba(16,185,129,0.15)' : '#e2f6ea',
                          color: darkMode ? '#10b981' : '#0b7a4b', border: `1px solid ${darkMode ? 'rgba(16,185,129,0.2)' : '#c3ebd3'}`,
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          {lead.sms_count}
                        </span>
                      )}

                      {/* Badge "issu des répondeurs communs" */}
                      {lead.from_common_pool && (
                        <span title="Récupéré depuis le pool des répondeurs communs" style={{
                          display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                          padding: '2px 9px', borderRadius: 50, fontSize: 10, fontWeight: 500,
                          background: darkMode ? 'rgba(6,182,212,0.16)' : 'rgba(6,182,212,0.1)',
                          color: '#0891b2', border: '1px solid rgba(6,182,212,0.25)',
                        }}>issu des répondeurs</span>
                      )}

                      {/* Résultat du rendez-vous : une étiquette pastel à point, aux mots des fenêtres de qualification, R3 compris
                          (audit 11/11/2026 : plus d'emoji ni de pilule vive, et le même vocabulaire que la fenêtre). */}
                      {['r1', 'r2', 'r3'].includes(activeCat.key) && lead[`${activeCat.key}_result`] && (() => {
                        const stage = activeCat.key.toUpperCase();
                        const RESULT_TAGS = {
                          done: ['vert', `${stage} effectué`], no_show: ['jaune', 'Client absent'],
                          rescheduled: ['peche', 'Reporté'], reporte: ['peche', 'Reporté'], to_reschedule: ['beige', 'À reprogrammer'], a_reporter: ['beige', 'À reprogrammer'],
                          cancelled: ['rouge', 'Annulé'], annule: ['rouge', 'Annulé'], pas_interesse: ['rouge', 'Pas intéressé'],
                          comptable: ['bleu', 'Avis du comptable'], associe: ['bleu', 'Avis d’un associé'], reflexion: ['bleu', 'Temps de réflexion'],
                          relire_contrat: ['bleu', 'Relire le contrat'], pas_decision_jour: ['beige', 'Décision en attente'], tresorerie: ['jaune', 'Trésorerie à prévoir'],
                        };
                        const tag = RESULT_TAGS[lead[`${activeCat.key}_result`]];
                        if (!tag) return null;
                        const tone = (darkMode
                          ? { vert: ['rgba(16,185,129,.14)', '#7cc49b', 'rgba(16,185,129,.25)'], rouge: ['rgba(239,68,68,.14)', '#f3a6a3', 'rgba(239,68,68,.26)'], jaune: ['rgba(234,179,8,.14)', '#e3c76a', 'rgba(234,179,8,.26)'],
                              peche: ['rgba(251,146,60,.14)', '#e8a877', 'rgba(251,146,60,.26)'], bleu: ['rgba(59,130,246,.14)', '#8fb8ee', 'rgba(59,130,246,.26)'], beige: ['#262626', '#a3a3a3', '#3a3a3a'] }
                          : { vert: ['#e2f6ea', '#0b7a4b', '#c3ebd3'], rouge: ['#fde6e6', '#c5221f', '#f6caca'], jaune: ['#fbf1c2', '#7a5a05', '#f0e09a'],
                              peche: ['#fde9da', '#c2500e', '#f8d4ba'], bleu: ['#e4f0fd', '#1b6fd0', '#c9e0fa'], beige: ['#f1eee9', '#4a4540', '#e3ded6'] })[tag[0]];
                        return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '2px 8px', borderRadius: 7, fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                            background: tone[0], color: tone[1], border: `1px solid ${tone[2]}` }}>
                            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />{tag[1]}
                          </span>
                        );
                      })()}

                      {/* Call timestamps (voicemail/callback). Two pills side-by-side:
                          "1er" = first_call_at (existing, now shows date + time) in indigo,
                          "Dernier" = last_call_at (new field) in teal. The sales rep
                          needs to know when they last tried — not just the first attempt. */}
                      {(activeCat.key === 'voicemail' || activeCat.key === 'callback') && lead.first_call_at && (() => {
                        const d = new Date(lead.first_call_at);
                        const dd = parisParts(d).day;
                        const mo = parisParts(d).month;
                        const hh = parisParts(d).hour;
                        const mi = parisParts(d).minute;
                        return (
                          <span title={`Premier appel : ${d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' })} à ${hh}h${mi}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 500, flexShrink: 0,
                            background: darkMode ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)',
                            color: '#6366f1',
                          }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            1er {dd}/{mo} {hh}h{mi}
                          </span>
                        );
                      })()}
                      {(activeCat.key === 'voicemail' || activeCat.key === 'callback') && lead.last_call_at && lead.last_call_at !== lead.first_call_at && (() => {
                        // Hide "Dernier" when it equals "1er" — avoids the redundant
                        // case after a single call (or on backfilled historical rows
                        // where backend set last = first). Absence carries meaning:
                        // no "Dernier" pill ⇒ rep has only called once.
                        const d = new Date(lead.last_call_at);
                        const dd = parisParts(d).day;
                        const mo = parisParts(d).month;
                        const hh = parisParts(d).hour;
                        const mi = parisParts(d).minute;
                        return (
                          <span title={`Dernier appel : ${d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' })} à ${hh}h${mi}`} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 50, fontSize: 10, fontWeight: 500, flexShrink: 0,
                            background: darkMode ? 'rgba(20,184,166,0.14)' : 'rgba(20,184,166,0.08)',
                            color: '#14b8a6',
                          }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Dernier {dd}/{mo} {hh}h{mi}
                          </span>
                        );
                      })()}

                      {/* Bandeau setter — wording contextuel selon l'onglet :
                          - Onglet R1 (lead.r1_placed_by_setter_id) → "Traité par X"
                            (le setter a placé le R1, son boulot est terminé sur ce lead).
                          - Onglet R2 (lead.r2_placed_by_setter_id) → "Traité par X"
                            (idem côté R2).
                          - Onglets Répondeurs / Callback / autres (lead.setter_called_by) →
                            "En traitement par X ×N" (le setter est en cours d'appel).
                          Signal fort pour éviter qu'un sales appelle un lead qu'un setter
                          est en train de retravailler ou a déjà traité. Lecture seule.
                          Fallback nom = 'Setter' tant que le backend n'expose pas
                          `r1_placed_by_setter_name` / `r2_placed_by_setter_name`. */}
                      {(() => {
                        let label = null;
                        let setterName = null;
                        let originStep = null; // 'R1' | 'R2' — pour préciser tooltip quand fallback
                        let cnt = 0;
                        if (activeCat.key === 'r1' && lead.r1_placed_by_setter_id) {
                          label = 'Traité par';
                          setterName = lead.r1_placed_by_setter_name || 'Setter';
                          originStep = 'R1';
                        } else if (activeCat.key === 'r2' && lead.r2_placed_by_setter_id) {
                          label = 'Traité par';
                          setterName = lead.r2_placed_by_setter_name || 'Setter';
                          originStep = 'R2';
                        } else if (activeCat.key === 'r2' && lead.r1_placed_by_setter_id) {
                          // Fallback R2 tab : le R2 a été placé par le sales mais le R1
                          // originel venait d'un setter. Trace préservée pour le suivi.
                          label = 'Traité par';
                          setterName = lead.r1_placed_by_setter_name || 'Setter';
                          originStep = 'R1';
                        } else if (activeCat.key === 'signed' && (lead.r2_placed_by_setter_id || lead.r1_placed_by_setter_id)) {
                          // Tab Signés : préserve la trace setter de bout en bout. R2
                          // setter prime sur R1 (étape la plus avancée).
                          label = 'Traité par';
                          if (lead.r2_placed_by_setter_id) {
                            setterName = lead.r2_placed_by_setter_name || 'Setter';
                            originStep = 'R2';
                          } else {
                            setterName = lead.r1_placed_by_setter_name || 'Setter';
                            originStep = 'R1';
                          }
                        } else if (lead.setter_called_by_name || lead.setter_called_by) {
                          label = 'En traitement par';
                          setterName = lead.setter_called_by_name || lead.setter_called_by || 'Setter';
                          cnt = Number(lead.setter_call_count || 0);
                        }
                        if (!label) return null;
                        const tooltipParts = [`${label} ${setterName}`];
                        if (originStep) tooltipParts.push(`${originStep} placé par ce setter`);
                        if (cnt > 0) tooltipParts.push(`Tentatives setter : ${cnt}`);
                        if (label === 'En traitement par' && lead.setter_called_at) {
                          try {
                            const sd = new Date(lead.setter_called_at);
                            const sdd = String(sd.getDate()).padStart(2, '0');
                            const smo = String(sd.getMonth() + 1).padStart(2, '0');
                            const shh = String(sd.getHours()).padStart(2, '0');
                            const smi = String(sd.getMinutes()).padStart(2, '0');
                            tooltipParts.push(`Dernier appel setter : ${sdd}/${smo} ${shh}h${smi}`);
                          } catch {}
                        }
                        return (
                          <span title={tooltipParts.join(' • ')} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 50, fontSize: 10.5, fontWeight: 500, flexShrink: 0,
                            background: darkMode ? 'rgba(245,158,11,0.20)' : 'rgba(245,158,11,0.13)',
                            color: '#d97706',
                            border: `1.5px solid ${darkMode ? 'rgba(245,158,11,0.45)' : 'rgba(245,158,11,0.35)'}`,
                            letterSpacing: '0.01em',
                            boxShadow: darkMode ? '0 0 0 1px rgba(245,158,11,0.10)' : '0 1px 2px rgba(245,158,11,0.10)',
                          }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 11l18-5v12L3 14v-3z" />
                              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                            </svg>
                            {label} {setterName}{cnt > 1 ? ` ×${cnt}` : ''}
                          </span>
                        );
                      })()}

                      {/* Right side indicators (la note a déjà son papier collé sur la ligne) */}
                      {(lead.r1 || lead.r2) && (
                        <span style={{
                          fontSize: '10px', fontWeight: 500,
                          padding: '2px 7px', borderRadius: 7,
                          background: lead.r2 ? (darkMode ? 'rgba(251,146,60,0.12)' : 'rgba(251,146,60,0.08)') : (darkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)'),
                          color: lead.r2 ? '#fb923c' : '#3b82f6',
                          flexShrink: 0, whiteSpace: 'nowrap',
                        }}>
                          {lead.r2 ? 'R2' : 'R1'} {String(formatDate(lead.r2 || lead.r1) || '').replace(/ \d{4}$/, '')}
                        </span>
                      )}
                      <span style={{
                        fontSize: '11px', color: C.muted, flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                      }} title={formatDate(lead.created_at)}>
                        {String(formatDate(lead.created_at) || '').replace(/ \d{4}$/, '')}
                      </span>

                      {/* Selection chevron */}
                      <span style={{
                        fontSize: '12px', color: isSelected ? C.accent : C.muted, flexShrink: 0,
                        transition: 'color 0.2s ease',
                        display: 'flex', alignItems: 'center',
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </div>

                    {/* Signing animation overlay */}
                    {signingCard === lead.id && (
                      <div style={{
                        position: 'absolute', bottom: 8, right: 12, zIndex: 10,
                        pointerEvents: 'none', animation: 'signatureFade 1.1s ease-in both',
                      }}>
                        <svg width="60" height="24" viewBox="0 0 90 36" fill="none">
                          <path d="M5 28 C 12 8, 18 32, 26 16 S 34 4, 42 20 Q 50 34, 58 14 C 64 6, 70 26, 80 10"
                            stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" fill="none"
                            strokeDasharray="200" strokeDashoffset="0"
                            style={{ animation: 'signatureStroke 0.8s ease-out both' }} />
                        </svg>
                      </div>
                    )}


                  </div>
                );
              };

            return (
              <div key={`cards-${tabKey}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredLeads.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', animation: 'emptyFade 0.4s ease both' }}>
                    <p style={{ color: C.muted, fontSize: '14px', margin: 0 }}>
                      {searchQuery.trim() ? 'Aucun résultat pour cette recherche' : 'Aucun lead dans cette catégorie'}
                    </p>
                  </div>
                ) : isGroupedTab ? (
                  (() => {
                    let runningIdx = 0;
                    return (
                      <>
                        {groups.map(grp => {
                          const startIdx = runningIdx;
                          runningIdx += grp.leads.length;
                          if (grp.leads.length === 0) return null;
                          const isCancelled = grp.key === 'cancelled';
                          const isSetterPlacedGrp = grp.key === 'setter_placed';
                          const isWebinaireGrp = grp.key === 'webinaire';
                          const isLandingGrp = grp.key === 'landing';
                          // Conteneurs collapsibles (mirror du pattern "Annulé") :
                          // cancelled + setter_placed + webinaire + landing → toggle œil/chevron au click.
                          const isCollapsible = isCancelled || isSetterPlacedGrp || isWebinaireGrp || isLandingGrp;
                          const isExpanded = isCancelled
                            ? cancelledExpanded
                            : isSetterPlacedGrp
                              ? setterPlacedExpanded
                              : isWebinaireGrp
                                ? (isR1Tab ? r1WebinaireExpanded : r2WebinaireExpanded)
                                : isLandingGrp
                                  ? (isR1Tab ? r1LandingExpanded : r2LandingExpanded)
                                  : true;
                          const toggleCollapse = isCancelled
                            ? () => setCancelledExpanded(prev => !prev)
                            : isSetterPlacedGrp
                              ? () => setSetterPlacedExpanded(prev => !prev)
                              : isWebinaireGrp
                                ? () => (isR1Tab ? setR1WebinaireExpanded : setR2WebinaireExpanded)(prev => !prev)
                                : isLandingGrp
                                  ? () => (isR1Tab ? setR1LandingExpanded : setR2LandingExpanded)(prev => !prev)
                                  : undefined;
                          const isCollapsed = isCollapsible && !isExpanded;
                          return (
                            <div key={grp.key} style={{
                              border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e3ded6'}`,
                              borderRadius: 14,
                              background: darkMode ? 'rgba(255,255,255,0.04)' : '#faf9f7',
                              padding: isCollapsed ? '14px 10px' : '14px 10px 10px',
                              marginBottom: 8,
                              cursor: isCollapsible ? 'pointer' : undefined,
                            }}
                              onClick={toggleCollapse}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isCollapsed ? 0 : 10, padding: '0 6px' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  padding: grp.key === 'completed' ? '4px 4px 4px 14px' : '4px 14px', borderRadius: 50,
                                  border: `1.5px solid ${grp.color}35`,
                                  background: `${grp.color}10`,
                                  fontSize: 12.5, fontWeight: 500, color: grp.color,
                                }}>{grp.label}{grp.key === 'completed' && <span style={{ width: 28, height: 28, overflow: 'hidden', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: -1 }}><img src={completedIcon} alt="" style={{ width: 84, height: 84 }} /></span>}</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{grp.leads.length}</span>
                                <div style={{ flex: 1 }} />
                                {grp.canBulkMove && (
                                  <button onClick={(e) => {
                                    e.stopPropagation();
                                    if (!window.confirm(`Envoyer les ${grp.leads.length} leads vers Non-pertinents ?`)) return;
                                    grp.leads.forEach(l => {
                                      handleStatusChange(l.id, 'not_relevant');
                                      apiClient.patch(`/api/v1/tracking/leads/${l.id}`, { notes: (l.notes ? l.notes + '\n' : '') + "N'a jamais répondu" }).catch(() => {});
                                    });
                                  }} style={{
                                    padding: '3px 8px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 500,
                                    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                                  }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; }}
                                  >Tout → Non-pertinent</button>
                                )}
                                {isCollapsible ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
                                    style={{ transition: 'transform 0.25s ease', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }}>
                                    <path d="m6 9 6 6 6-6" />
                                  </svg>
                                ) : (
                                  <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45 }}>
                                      <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                                    </svg>
                                    <span style={{ fontSize: 15, color: C.muted, lineHeight: 1, fontWeight: 300 }}>+</span>
                                  </>
                                )}
                              </div>
                              {!isCollapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={isCollapsible ? (e) => e.stopPropagation() : undefined}>
                                  {[...grp.leads].sort((a, b) => {
                                    // Conteneur "Traité par le setter" : tri par
                                    // setter_called_at desc (plus récent en haut).
                                    if (grp.key === 'call_setter') {
                                      const sa = a.setter_called_at ? new Date(a.setter_called_at).getTime() : 0;
                                      const sb = b.setter_called_at ? new Date(b.setter_called_at).getTime() : 0;
                                      return sb - sa;
                                    }
                                    // Tous les autres groupes : priorité métier classique.
                                    const prioOrder = { high: 0, medium: 1, low: 2 };
                                    return (prioOrder[a.lead_priority] ?? 1) - (prioOrder[b.lead_priority] ?? 1);
                                  }).map((lead, i) => renderLeadCard(lead, startIdx + i))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()
                ) : activeCat.key === 'signed' ? (
                  (() => {
                    const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
                    const now = new Date();
                    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
                    // Regroupe par mois de SIGNATURE (contract_signed_at, fallback assigned_at).
                    const gmap = new Map();
                    filteredLeads.forEach((lead) => {
                      const raw = lead.contract_signed_at || lead.assigned_at;
                      const d = raw ? new Date(raw) : null;
                      const valid = d && !isNaN(d.getTime());
                      const key = valid ? `${d.getFullYear()}-${d.getMonth()}` : 'nodate';
                      if (!gmap.has(key)) gmap.set(key, { key, y: valid ? d.getFullYear() : 0, m: valid ? d.getMonth() : -1, nodate: !valid, leads: [] });
                      gmap.get(key).leads.push(lead);
                    });
                    // Conteneurs triés desc par (année, mois) ; "Sans date" toujours en dernier.
                    const grps = [...gmap.values()].sort((a, b) => (a.nodate - b.nodate) || (b.y - a.y) || (b.m - a.m));
                    // Seul le mois en cours reste ouvert ; sinon le mois daté le plus récent.
                    const firstDated = grps.find((g) => !g.nodate);
                    const defaultKey = grps.some((g) => g.key === currentKey) ? currentKey : (firstDated && firstDated.key);
                    return grps.map((g) => {
                      const isOpen = g.key in signedMonthOpen ? signedMonthOpen[g.key] : (g.key === defaultKey);
                      const label = g.nodate ? 'Sans date' : `${MONTHS_FR[g.m]} ${g.y}`;
                      return (
                        <div key={g.key} style={{
                          border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e3ded6'}`,
                          borderRadius: 14,
                          background: darkMode ? 'rgba(255,255,255,0.04)' : '#faf9f7',
                          padding: isOpen ? '14px 10px 10px' : '14px 10px',
                          marginBottom: 8, cursor: 'pointer',
                        }} onClick={() => setSignedMonthOpen((prev) => ({ ...prev, [g.key]: !isOpen }))}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isOpen ? 10 : 0, padding: '0 6px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500, border: `1.5px solid ${activeCat.color}35`, background: `${activeCat.color}10`, color: activeCat.color, textTransform: 'capitalize' }}>{label}</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{g.leads.length}</span>
                            <div style={{ flex: 1 }} />
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ transition: 'transform 0.25s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }}><path d="m6 9 6 6 6-6" /></svg>
                          </div>
                          {isOpen && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                              {g.leads.map((lead, i) => renderLeadCard(lead, i))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()
                ) : activeCat.key === 'new' ? (
                  (() => {
                    // Onglet Nouveau lead : on sépare les leads "à traiter" (non donnés)
                    // des leads DONNÉS à un setter (manual_setter_id != null). Ces derniers
                    // vont dans un conteneur "Donnés" replié par défaut. Purement additif.
                    const byPrio = (arr) => [...arr].sort((a, b) => {
                      const prioOrder = { high: 0, medium: 1, low: 2 };
                      return (prioOrder[a.lead_priority] ?? 1) - (prioOrder[b.lead_priority] ?? 1);
                    });
                    const toProcess = byPrio(filteredLeads.filter((l) => !l.manual_setter_id));
                    const given = byPrio(filteredLeads.filter((l) => l.manual_setter_id));
                    return (
                      <>
                        {toProcess.map((lead, i) => renderLeadCard(lead, i))}
                        {given.length > 0 && (
                          <div style={{
                            border: `1.5px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e3ded6'}`,
                            borderRadius: 14,
                            background: darkMode ? 'rgba(255,255,255,0.04)' : '#faf9f7',
                            padding: givenLeadsOpen ? '14px 10px 10px' : '14px 10px',
                            marginTop: 8, marginBottom: 8, cursor: 'pointer',
                          }} onClick={() => setGivenLeadsOpen((o) => !o)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: givenLeadsOpen ? 10 : 0, padding: '0 6px' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 500, border: `1.5px solid ${C.border}`, background: darkMode ? 'rgba(255,255,255,0.05)' : '#f0f1f3', color: C.muted }}>Donnés</span>
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.muted }}>{given.length}</span>
                              <div style={{ flex: 1 }} />
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ transition: 'transform 0.25s ease', transform: givenLeadsOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }}><path d="m6 9 6 6 6-6" /></svg>
                            </div>
                            {givenLeadsOpen && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                                {given.map((lead, i) => renderLeadCard(lead, i))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  [...filteredLeads].sort((a, b) => {
                    const prioOrder = { high: 0, medium: 1, low: 2 };
                    return (prioOrder[a.lead_priority] ?? 1) - (prioOrder[b.lead_priority] ?? 1);
                  }).map((lead, i) => renderLeadCard(lead, i))
                )}
              </div>
            );
          })()}
        </div>{/* end left column */}

        {/* ── RIGHT: Lead Detail Panel (portaled to separate card) ──────── */}
        {detailContainerRef.current && (() => {
          const lead = selectedLead ? leads.find(l => l.id === selectedLead) : null;
          if (!lead) return null;
          const origin = ORIGIN_COLORS[lead.origin] || DEFAULT_ORIGIN;
          const notesVal = editingNotes[lead.id] !== undefined ? editingNotes[lead.id] : lead.notes;
          // La description d'un rappel daté (onglets « À rappeler » et « Répondeurs ») est une note : elle va dans la carte « Note », pas dans l'en-tête.
          const recallText = (activeCat.key === 'callback' || activeCat.key === 'voicemail') ? recallNote(lead) : '';
          const notesShown = !!lead.notes && (isGuidedLead(lead) || !editingNotes.hasOwnProperty(lead.id));
          const leadTab = panelTab.leadId === lead.id ? panelTab.tab : 'infos';
          const selectStyle = {
            padding: '7px 28px 7px 12px', borderRadius: '10px', border: `1px solid ${C.border}`,
            background: darkMode ? '#181818' : '#fff', color: C.text, fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            appearance: 'none', WebkitAppearance: 'none', fontFamily: 'inherit', outline: 'none', width: '100%',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(C.muted)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
          };
          return createPortal(
          <div
            key={`detail-${lead.id}`}
            className="pc-scroll"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              overflowY: 'auto',
              overflowX: 'hidden',
              animation: 'detailSlideIn 0.4s cubic-bezier(0.4,0,0.2,1) both',
              background: C.bg,
              height: '100%',
              maxHeight: 'calc(100vh - 120px)',
            }}
          >
            <div style={{ padding: '10px 20px 20px' }}>

              {/* Close button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <button
                  onClick={() => {
                    setSelectedLead(null); setActiveWorkflow(null);
                    if (wsRef.current && wsRef.current.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'lead_focus', lead_id: null }));
                  }}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', border: 'none',
                    background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: C.muted, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'; e.currentTarget.style.color = C.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = C.muted; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Bouton créa — flotte sous la croix, sans pousser le contenu du lead */}
              <div style={{ position: 'relative', height: 0, zIndex: 5 }}>
                <CreativeButton
                  data={leadCreative.data}
                  loading={leadCreative.loading}
                  iconActive={iconCreaActive}
                  iconEmpty={iconCreaEmpty}
                  darkMode={darkMode}
                  size={54}
                  style={{ position: 'absolute', top: 2, right: -14 }}
                  onOpen={(creative, rect) => setCreaPopup({ creative, rect })}
                />
              </div>

              {/* ─── PROFILE HEADER — avatar à gauche, identité (nom + société + SIREN)
                   poussée à droite (demande dev 02/09). L'image couvre les 3 lignes. ─── */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <img src={leadAvatar(lead.full_name, lead.id, lead.origin, lead.campaign_name)} alt="" width={64} height={64}
                style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0, objectFit: 'cover', marginTop: 4, filter: imgDark }} />
              <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
                {/* Origin badge above name — rendu aussi pendant l'édition du nom,
                    sinon le bloc remonte d'une ligne (retour dev 02/09). */}
                <span style={{
                  padding: '1px 7px', borderRadius: 50, fontSize: 10, fontWeight: 500,
                  background: origin.bg, color: origin.text, marginBottom: 3, alignSelf: 'flex-start',
                }}>
                  {originDisplay(lead.origin, lead.cc_sector)}
                </span>
                {/* Name (editable) */}
                {editingField?.leadId === lead.id && editingField?.field === 'full_name' ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 3, paddingRight: 52 }}>
                    {/* paddingRight : la coche et la croix s'arrêtent avant le
                        tampon Meta (position absolue au coin), sinon il les recouvre. */}
                    <input aria-label="Nom et prénom du lead" ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                      style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, color: C.text, letterSpacing: '-0.02em', border: `1px solid ${C.accent}`, borderRadius: 8, padding: '3px 8px', background: C.bg, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button aria-label="Enregistrer le nom" title="Enregistrer le nom" onClick={saveFieldEdit} style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 6, border: 'none', background: C.accent, color: C.onAccent, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={2.2} aria-hidden="true" /></button>
                    <button aria-label="Annuler la modification du nom" title="Annuler la modification du nom" onClick={cancelFieldEdit} style={{ width: 26, height: 26, flexShrink: 0, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                  </div>
                ) : (
                  <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, paddingRight: 52 }}>
                    <h3 style={{ margin: 0, minWidth: 0, overflowWrap: 'anywhere', fontSize: 17, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>
                      {lead.full_name}
                    </h3>
                    <button onClick={() => startFieldEdit(lead.id, 'full_name', lead.full_name)} title="Modifier le nom"
                      style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 5, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, transition: 'opacity 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.4; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                  </>
                )}
                {/* Company name with building icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {/* Company name (editable inline) */}
                  {editingField?.leadId === lead.id && editingField?.field === 'company_name' ? (
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <input ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                        placeholder="Nom de la société"
                        style={{ width: 160, fontSize: 12, color: C.text, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '2px 7px', background: C.bg, fontFamily: 'inherit', outline: 'none', fontWeight: 500 }}
                      />
                      <button onClick={saveFieldEdit} style={{ width: 20, height: 20, borderRadius: 4, border: 'none', background: C.accent, color: C.onAccent, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={2.2} aria-hidden="true" /></button>
                      <button onClick={cancelFieldEdit} style={{ width: 20, height: 20, borderRadius: 4, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                    </div>
                  ) : (
                    <span
                      onClick={() => startFieldEdit(lead.id, 'company_name', lead.company_name)}
                      title={lead.company_name ? 'Modifier la société' : 'Ajouter le nom de la société'}
                      style={{
                        fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                        color: '#949293',
                        fontStyle: lead.company_name ? 'normal' : 'italic',
                        fontSize: 13, fontWeight: 500,
                        borderRadius: 6, padding: '1px 5px', margin: '-1px -5px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <img src={iconBuilding} alt="" style={{ width: 16, height: 16, marginTop: -1 }} />
                      {lead.company_name || '+ Société'}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </span>
                  )}
                </div>
                {/* Rappel daté (16/10/2026) : quand le sales a convenu de rappeler le prospect (callback_at est l'heure de Paris, lue telle quelle) ; ce qui a été dit est dans la carte « Note ».
                    NON rétroactif : seuls les rappels posés avec la nouvelle fenêtre ont une description enregistrée (même vide) ; les anciens rappels (setters, ancien parcours) n'en ont pas et ne changent pas. */}
                {(activeCat.key === 'callback' || activeCat.key === 'voicemail') && lead.callback_description != null && recallWhen(lead.callback_at) && (() => {
                  const late = recallInPast(String(lead.callback_at).slice(0, 16));
                  return (
                    <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: late ? (darkMode ? '#f87171' : '#b91c1c') : (darkMode ? '#fbbf24' : '#b45309') }}>Rappel prévu : {recallWhen(lead.callback_at)}{late ? ' (dépassé)' : ''}</span>
                    </div>
                  );
                })()}
              </div>

              {/* ─── SIREN (detail card only — NOT shown in sidebar list) ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: -6, marginBottom: 12 }}>
                {editingField?.leadId === lead.id && editingField?.field === 'siren' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <img src={iconSiren} alt="" style={{ width: 23, height: 13, opacity: 0.85, flexShrink: 0 }} />
                      <input
                        ref={editInputRef}
                        value={editingField.value}
                        onChange={(e) => {
                          // Only digits, max 9 chars
                          const onlyDigits = e.target.value.replace(/\D+/g, '').slice(0, 9);
                          setEditingField(prev => ({ ...prev, value: onlyDigits }));
                          if (sirenEditError) setSirenEditError('');
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveSirenEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                        placeholder="123456789"
                        inputMode="numeric"
                        maxLength={9}
                        style={{
                          flex: 1, fontSize: 13, fontWeight: 500, color: C.text,
                          border: `1px solid ${C.accent}`, borderRadius: 6,
                          padding: '3px 8px', background: C.bg, fontFamily: 'inherit',
                          outline: 'none', letterSpacing: '0.02em',
                        }}
                      />
                      <button onClick={saveSirenEdit} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: C.accent, color: C.onAccent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={2.2} aria-hidden="true" /></button>
                      <button onClick={cancelFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                    </div>
                    {/* Discreet hint while typing 1-8 chars; only show if no backend error */}
                    {!sirenEditError && editingField.value.length > 0 && editingField.value.length < 9 && (
                      <div style={{ fontSize: 10, color: C.muted, fontStyle: 'italic', marginLeft: 27 }}>
                        SIREN = 9 chiffres
                      </div>
                    )}
                    {sirenEditError && (
                      <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 500, marginLeft: 27 }}>
                        {sirenEditError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <img src={iconSiren} alt="" style={{ width: 23, height: 13, opacity: 0.85, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 12, fontWeight: 500,
                      color: '#949293',
                      fontStyle: lead.siren ? 'normal' : 'italic',
                      letterSpacing: lead.siren ? '0.02em' : 'normal',
                    }}>
                      {lead.siren ? formatSiren(lead.siren) : '+ Siren'}
                    </span>
                    <button
                      onClick={() => { setSirenEditError(''); startFieldEdit(lead.id, 'siren', lead.siren || ''); }}
                      title={lead.siren ? 'Modifier le SIREN' : 'Ajouter le SIREN'}
                      style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4, transition: 'opacity 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.4; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  </div>
                )}
              </div>
              </div>
              </div>

              {/* ─── STATS ROW ─── */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1,
                borderRadius: 14, overflow: 'hidden', marginBottom: 16,
                background: C.border, border: `1px solid ${C.border}`,
                animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.08s both',
              }}>
                {[
                  { label: 'Salariés', value: lead.headcount || '—' },
                  { label: 'CA', value: lead.revenue || '—' },
                  // Date d'ENTRÉE du lead (created_at), pas la date d'assignation : c'est ce qui
                  // intéresse le sales (quand le lead est arrivé). created_at = 100% peuplé sur les
                  // leads assignés, et aucun lead assigné n'est dans le batch de migration.
                  { label: 'Entrée', value: formatDate(lead.created_at) || '—' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    padding: '10px 6px', textAlign: 'center',
                    background: darkMode ? '#181818' : '#faf9f7',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text, letterSpacing: '-0.01em' }}>{stat.value}</div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* ─── VOLETS DE LA FICHE : l'essentiel d'abord, les documents et le commentaire chacun dans le leur (dev 11/11/2026 :
                   « bien prioriser les informations, quitte à avoir plusieurs slides »). Les trois volets restent montés : on
                   ne fait que les montrer ou les cacher, aucune saisie en cours n'est perdue. ─── */}
              {(() => {
                const tabs = [['infos', 'Infos'], ['documents', 'Documents'], ['commentaire', 'Commentaire']];
                return (
                  <div role="tablist" aria-label="Volets de la fiche" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, padding: 3, marginBottom: 16, borderRadius: 12, background: darkMode ? '#181818' : '#f1eee9' }}>
                    {tabs.map(([key, label]) => {
                      const on = leadTab === key;
                      return (
                        <button key={key} type="button" role="tab" aria-selected={on} onClick={() => { setPanelTab({ leadId: lead.id, tab: key }); if (key === 'documents' && !leadContracts[lead.id]) fetchLeadContracts(lead.id); }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 6px', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: 12.5, fontWeight: 500, color: on ? C.text : C.muted, background: on ? (darkMode ? '#3a3a3a' : '#ffffff') : 'transparent',
                            boxShadow: on && !darkMode ? '0 1px 2px rgba(28,27,25,0.06)' : 'none', transition: 'background 0.2s ease, color 0.2s ease' }}>
                          {label}
                          {key === 'commentaire' && !!(lead.notes && lead.notes.trim()) && <span style={{ width: 5, height: 5, borderRadius: '50%', background: on ? C.text : C.muted }} title="Un commentaire est enregistré" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div style={{ display: leadTab === 'documents' ? 'block' : 'none', animation: 'contentReveal 0.3s cubic-bezier(0.4,0,0.2,1) both' }}>
                {/* Contrat envoyé au client : même dossier que dans le board Owner Opti'Lex et la fiche Finance (clic = lecture du PDF).
                    Lecture seule ; l'envoi, la relance et l'annulation restent dans le volet Infos, inchangés. */}
                {(() => {
                  const contract = (leadContracts[lead.id] || []).find(c => ['done', 'ongoing'].includes(c.yousign_status)) || (leadContracts[lead.id] || [])[0];
                  if (!contract) return null;
                  const TONES = { done: ['Signé', '#0b7a4b'], ongoing: ['En signature', '#1b6fd0'], expired: ['Expiré', '#c2500e'], canceled: ['Annulé', '#8b867e'], failed: ['Échec', '#c5221f'] };
                  const folder = (key, label, title, status, signedAt) => {
                    const tone = TONES[status];
                    if (!tone) return { key, label, title, empty: true, available: false,
                      status: <span style={{ fontWeight: 400, color: '#a8a39b' }}>Pas de contrat</span> };
                    const when = status === 'done' ? signedAt : contract.sent_at;
                    const date = when ? `le ${formatDate(when)}` : '';
                    return { key, label, title, openLabel: `Ouvrir : ${title}`, signed: status === 'done', available: ['done', 'ongoing'].includes(status),
                      statusText: [tone[0], date].filter(Boolean).join(' '),
                      status: <><b style={{ color: tone[1] }}>{tone[0]}</b>{date}</>,
                      sub: status === 'ongoing' ? 'en attente de signature' : '' };
                  };
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: darkMode ? C.muted : '#a8a39b' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>
                        Contrat
                      </div>
                      {/* Le sales ne consulte que le contrat Owner (dev 11/11/2026) : la convention Opti'Lex n'est pas proposée ici. */}
                      <div className="ts-contract">
                        <ContractFolders contractId={contract.id} group={`lead-${lead.id}`} items={[
                          folder('owner', 'Owner', 'Contrat Owner', contract.yousign_status, contract.signed_at),
                        ]} />
                      </div>
                    </div>
                  );
                })()}
                {intakeRollout?.available
                  ? <LeadDocuments key={`docs-${lead.id}`} leadId={lead.id} lead={lead} revision={portalRevision} dark={darkMode}
                      fallback={<p style={{ margin: '4px 2px 16px', fontSize: 12.5, lineHeight: 1.55, color: C.muted }}>Le dépôt de documents s’ouvre une fois le NDA rempli pour ce lead.</p>} />
                  : <p style={{ margin: '4px 2px 16px', fontSize: 12.5, lineHeight: 1.55, color: C.muted }}>Le dépôt de documents n’est pas encore activé pour ce dossier.</p>}
              </div>

              <div style={{ display: leadTab === 'infos' ? 'block' : 'none' }}>
              {/* Les notes se lisent dès la première page de la fiche (demande des sales, 12/11/2026) : la note du rappel
                  et le commentaire du lead, en lecture ; « Modifier » ouvre le volet Commentaire, où ils se saisissent. */}
              {(recallText || notesShown) && (
                <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 14, fontSize: 13.5, background: darkMode ? '#181818' : '#f7f5f2', animation: 'contentReveal 0.3s cubic-bezier(0.4,0,0.2,1) both' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{recallText && !notesShown ? 'Note du rappel' : 'Commentaire'}</span>
                    <button type="button" onClick={() => setPanelTab({ leadId: lead.id, tab: 'commentaire' })}
                      style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500, color: C.muted }}>
                      Modifier
                    </button>
                  </div>
                  {recallText && <SalesNotesView value={recallText}/>}
                  {recallText && notesShown && <div style={{ height: 1, margin: '8px 0', background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />}
                  {notesShown && <SalesNotesView value={lead.notes}/>}
                  {notesShown && lead.notes_updated_at && formatNoteDate(lead.notes_updated_at) && (
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: 'right' }}>Modifié {formatNoteDate(lead.notes_updated_at)}</div>
                  )}
                </div>
              )}
              {intakeSaved[lead.id]?.available && <div style={{ marginBottom: 14 }}>
                <IntegrationButton consult ready={intakeSaved[lead.id].validated} onClick={() => openSavedIntake(lead.id)} />
              </div>}

              {intakeRollout?.available && <PortalAccess key={lead.id} leadId={lead.id} revision={portalRevision} />}
              {/* ─── APPELS : combien de fois, quand pour la dernière fois, et le premier en retrait. Une seule ligne discrète sous
                   les chiffres (dev 11/11/2026 : l'identité d'abord, l'historique d'appels « plus subtil, mais présent »). ─── */}
              {(activeCat.key === 'callback' || activeCat.key === 'voicemail') && (lead.call_attempts > 0 || lead.first_call_at || lead.last_call_at) && (() => {
                const when = (iso) => { const d = new Date(iso); return `${d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short' })} à ${parisParts(d).hour}h${parisParts(d).minute}`; };
                // Dernier appel masqué s'il est égal au premier (lead appelé une fois, ou lignes historiques reprises).
                const last = lead.last_call_at && lead.last_call_at !== lead.first_call_at ? lead.last_call_at : null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', marginTop: -6, marginBottom: 16, borderRadius: 12,
                    background: darkMode ? '#181818' : '#f7f5f2', fontSize: 12, color: C.secondary, fontVariantNumeric: 'tabular-nums' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {lead.call_attempts > 0 && <span style={{ fontWeight: 500, color: C.text }}>{lead.call_attempts} appel{lead.call_attempts > 1 ? 's' : ''}</span>}
                    {last && <span><span style={{ color: C.muted }}>Dernier</span> {when(last)}</span>}
                    {lead.first_call_at && <span style={{ marginLeft: 'auto', color: C.muted }}>{last ? '1er' : 'Appelé'} {when(lead.first_call_at)}</span>}
                  </div>
                );
              })()}

              {/* ─── INFO DETAILS ─── */}
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14,
                animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.12s both',
              }}>
                {/* Phone */}
                {editingField?.leadId === lead.id && editingField?.field === 'phone' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </div>
                    <input ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                      style={{ flex: 1, fontSize: 12, color: C.text, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '5px 8px', background: C.bg, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500, outline: 'none' }}
                    />
                    <button onClick={saveFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: C.accent, color: C.onAccent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={2.2} aria-hidden="true" /></button>
                    <button onClick={cancelFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                  </div>
                ) : (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 22, height: 22, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#949293" stroke="#949293" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </div>
                  <div onClick={() => copyToClipboard(lead.phone, `phone-detail-${lead.id}`, lead.id)} style={{ flex: 1, minWidth: 0, cursor: lead.phone ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Téléphone<PriorityTag leadId={lead.id} kind="phone" darkMode={darkMode} /></div>
                    <div style={{ fontSize: 12, color: C.text, fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 500 }}>{lead.phone || '—'}</div>
                  </div>
                  {copiedField === `phone-detail-${lead.id}` ? (
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 500, color: '#10b981', padding: '2px 10px', borderRadius: 50, background: darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
                  ) : (
                    <>
                      <ContactsToggle leadId={lead.id} kind="phone" C={C} darkMode={darkMode} readOnly={isAdminView} />
                      {lead.phone && (
                        <svg onClick={() => copyToClipboard(lead.phone, `phone-detail-${lead.id}`, lead.id)} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5, cursor: 'pointer' }} title="Copier">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                      <svg onClick={(e) => { e.stopPropagation(); startFieldEdit(lead.id, 'phone', lead.phone); }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.35, cursor: 'pointer', transition: 'opacity 0.15s' }} title="Modifier"
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.8; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.35; }}
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </>
                  )}
                </div>
                )}
                {/* Autres numéros du lead : cachés au repos, dépliés par le « +2 » du champ (le numéro du champ est le prioritaire) */}
                <LeadContactRows leadId={lead.id} kind="phone" mainValue={lead.phone} onPromote={promoteLeadContact(lead.id)} C={C} darkMode={darkMode} readOnly={isAdminView} />
                {/* Email */}
                {editingField?.leadId === lead.id && editingField?.field === 'email' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={iconEmailDetail} alt="" style={{ width: 17, height: 17, objectFit: 'contain', filter: imgDark }} />
                    </div>
                    <input ref={editInputRef} value={editingField.value} onChange={(e) => setEditingField(prev => ({ ...prev, value: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') cancelFieldEdit(); }}
                      style={{ flex: 1, fontSize: 12, color: C.text, border: `1px solid ${C.accent}`, borderRadius: 6, padding: '5px 8px', background: C.bg, fontFamily: 'inherit', outline: 'none' }}
                    />
                    <button onClick={saveFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: C.accent, color: C.onAccent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} strokeWidth={2.2} aria-hidden="true" /></button>
                    <button onClick={cancelFieldEdit} style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
                  </div>
                ) : (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: 22, height: 22, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img src={iconEmailDetail} alt="" style={{ width: 17, height: 17, objectFit: 'contain', filter: imgDark }} />
                  </div>
                  <div onClick={() => copyToClipboard(lead.email, `email-detail-${lead.id}`, lead.id)} style={{ flex: 1, minWidth: 0, cursor: lead.email ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Email<PriorityTag leadId={lead.id} kind="email" darkMode={darkMode} /></div>
                    <div style={{ fontSize: 12, color: C.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email || '—'}</div>
                  </div>
                  {copiedField === `email-detail-${lead.id}` ? (
                    <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 500, color: '#10b981', padding: '2px 10px', borderRadius: 50, background: darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', animation: 'copiedToastIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>Copié</span>
                  ) : (
                    <>
                      <ContactsToggle leadId={lead.id} kind="email" C={C} darkMode={darkMode} readOnly={isAdminView} />
                      {lead.email && (
                        <svg onClick={() => copyToClipboard(lead.email, `email-detail-${lead.id}`, lead.id)} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5, cursor: 'pointer' }} title="Copier">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                      <svg onClick={(e) => { e.stopPropagation(); startFieldEdit(lead.id, 'email', lead.email); }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.35, cursor: 'pointer', transition: 'opacity 0.15s' }} title="Modifier"
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.8; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.35; }}
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </>
                  )}
                </div>
                )}
                {/* Autres e-mails du lead : cachés au repos, dépliés par le « +2 » du champ (l'e-mail du champ est le prioritaire) */}
                <LeadContactRows leadId={lead.id} kind="email" mainValue={lead.email} onPromote={promoteLeadContact(lead.id)} C={C} darkMode={darkMode} readOnly={isAdminView} />
                {/* Sales Qualification */}
                {(() => {
                  const QUAL_OPTIONS = [
                    { key: 'lead', label: 'Lead', icon: iconQualLead },
                    { key: 'qualifie', label: 'Qualifié', icon: iconQualQualifie },
                    { key: 'proposition', label: 'Proposition', icon: iconQualProposition },
                    { key: 'negociation', label: 'Négociation', icon: iconQualNegociation },
                    { key: 'gagne', label: 'Gagné', icon: iconQualGagne },
                    { key: 'perdu', label: 'Perdu', icon: iconQualPerdu },
                    { key: 'sans_suite', label: 'Sans suite', icon: iconQualSansSuite },
                  ];
                  const current = lead.sales_qualification || 'lead';
                  const currentOpt = QUAL_OPTIONS.find(q => q.key === current) || QUAL_OPTIONS[0];
                  const isQualOpen = qualDropdown === lead.id;
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
                      <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                        <img src={iconScalier} alt="" style={{ width: 18, height: 18 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Qualification</div>
                        <button ref={el => { if (el) el._qualBtn = true; }} onClick={(e) => {
                          if (isQualOpen) { setQualDropdown(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setQualDropdownPos({ x: rect.left, y: rect.bottom + 4 });
                          setQualDropdown(lead.id);
                        }} style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0',
                          border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          <img src={currentOpt.icon} alt="" style={{ height: 18, objectFit: 'contain', filter: imgDark }} />
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Lead Priority */}
                {(() => {
                  const PRIO_OPTIONS = [
                    { key: 'high', icon: iconPrioHigh },
                    { key: 'medium', icon: iconPrioMedium },
                    { key: 'low', icon: iconPrioLow },
                  ];
                  const currentPrio = lead.lead_priority || 'medium';
                  const currentPrioOpt = PRIO_OPTIONS.find(p => p.key === currentPrio) || PRIO_OPTIONS[1];
                  const isPrioOpen = prioDropdown === lead.id;
                  return (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
                      <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                        <img src={iconPrio} alt="" style={{ width: 18, height: 18 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Priorité</div>
                        <button onClick={(e) => {
                          if (isPrioOpen) { setPrioDropdown(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setPrioDropdownPos({ x: rect.left, y: rect.bottom + 4 });
                          setPrioDropdown(lead.id);
                        }} style={{
                          display: 'flex', alignItems: 'center', gap: 5, padding: '2px 0',
                          border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                          <img src={currentPrioOpt.icon} alt="" style={{ height: 18, objectFit: 'contain', filter: imgDark }} />
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Sector */}
                {lead.sector && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 22, height: 22, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Secteur</div>
                      <div style={{ fontSize: 12, color: C.accent, fontWeight: 500 }}>{lead.sector}</div>
                    </div>
                  </div>
                )}
                {/* Google Meet */}
                {(lead.r1_meet_link || lead.r2_meet_link) && (
                  <a
                    href={lead.r2_meet_link || lead.r1_meet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                      borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: 22, height: 22, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <img src={meetIcon} alt="Meet" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Google Meet</div>
                      <div style={{ fontSize: 12, color: '#1a73e8', fontWeight: 500 }}>Rejoindre le meeting</div>
                    </div>
                  </a>
                )}
                {/* Setter qui a posé le RDV (demande dev 29/09) : le sales voit qui l'a placé et peut
                    le contacter en cas de souci. Lecture seule, additif. */}
                {(() => {
                  const r1 = lead.r1_placed_by_setter_name;
                  const r2 = lead.r2_placed_by_setter_name;
                  const rows = r1 && r2 && r1 === r2
                    ? [{ label: 'R1 et R2 posés par', name: r1, email: lead.r1_placed_by_setter_email || lead.r2_placed_by_setter_email }]
                    : [r1 && { label: 'R1 posé par', name: r1, email: lead.r1_placed_by_setter_email },
                       r2 && { label: 'R2 posé par', name: r2, email: lead.r2_placed_by_setter_email }].filter(Boolean);
                  return rows.map((r) => (
                    <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{r.name}</div>
                        {r.email && (
                          <a href={`mailto:${r.email}`} title={`Écrire à ${r.name}`}
                            style={{ fontSize: 11.5, color: C.accent, fontWeight: 500, textDecoration: 'none', overflowWrap: 'anywhere' }}>{r.email}</a>
                        )}
                      </div>
                    </div>
                  ));
                })()}
                {/* Dispos onboarding (demande dev 29/09) : consultation seule des créneaux d'Emilie et
                    Vincent, pour en parler au client avant le contrat. Le créneau se réserve toujours à la
                    déclaration de vente. Additif. */}
                <button type="button" onClick={() => setOnbAvailOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: 'none', background: 'transparent',
                    borderRadius: 8, padding: '4px 6px', margin: '-4px -6px', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Dispos onboarding</div>
                    {/* Les prénoms viennent du serveur (réglages d'agenda, liste des animateurs du moment) : aucun n'est écrit ici. */}
                    <div style={{ fontSize: 12, color: C.accent, fontWeight: 500 }}>{onboardingHostsLabel(calSettings?.onboarding_hosts)}</div>
                  </div>
                </button>
                {/* Mode MANUEL — donner ce lead à un setter (visible seulement si le sales
                    a au moins un setter en mode manuel ; 1 lead -> 1 setter). Additif. */}
                {myManualSetters.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 22, height: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5 }}>Donner à un setter</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {myManualSetters.map((s) => {
                          const active = String(lead.manual_setter_id || '') === String(s.setter_id);
                          return (
                            <button
                              key={s.setter_id}
                              onClick={() => giveLeadToSetter(lead.id, active ? null : s.setter_id)}
                              title={active ? 'Donné à ce setter — cliquer pour retirer' : `Donner ce lead à ${s.full_name}`}
                              style={{
                                fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                                fontFamily: 'inherit', transition: 'all 0.15s',
                                border: `1px solid ${active ? C.accent : C.border}`,
                                background: active ? `${C.accent}1a` : 'transparent',
                                color: active ? C.accent : C.text,
                              }}
                            >
                              {active ? '✓ ' : ''}{(s.full_name || s.email).split(' ')[0]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                <ReproLinkRow lead={lead} C={C} darkMode={darkMode} />
                {/* Transfert à un autre sales (dev 11/11/2026, « dans la partie Infos ») : de qui il a été reçu, le geste, l'historique replié. */}
                <LeadTransfer lead={lead} C={C} darkMode={darkMode} canGive={!isAdminView && activeCat.key !== 'signed'} onDone={() => {
                  // Le lead n'est plus à soi : il quitte la liste, la fiche se ferme (la confirmation s'est lue dans la ligne).
                  setLeads(prev => prev.filter(l => l.id !== lead.id));
                  setSelectedLead(null);
                }} />
              </div>

              {/* ─── CALENDAR ERROR ─── */}
              {calendarError?.leadId === lead.id && (
                <div style={{
                  padding: '9px 12px', borderRadius: 12, marginBottom: 10,
                  background: darkMode ? 'rgba(239,68,68,.14)' : '#fde6e6', color: darkMode ? '#f3a6a3' : '#c5221f',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                }}>
                  <TriangleAlert size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>{calendarError.message}</span>
                </div>
              )}

              {/* ─── CONTACTED INDICATOR (NEW tab) ─── */}
              {activeCat.key === 'new' && (
                <div style={{ marginBottom: 10, animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.14s both' }}>
                  {lead.first_contact_date ? (
                    <span style={{ fontSize: 11, color: C.accent, fontWeight: 500 }}>
                      Contacté le {formatDate(lead.first_contact_date)}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
                      Pas encore contacté
                    </span>
                  )}
                </div>
              )}

              {/* ─── RENDEZ-VOUS (dev 11/11/2026 : « simple, épuré, rassurant », d'après sa référence de frise) : un fil, un point par
                   rendez-vous, le prochain en point plein ; chaque ligne se déplie pour changer la date. ─── */}
              {(lead.r1 || lead.r2 || lead.r3) && (() => {
                const rows = [['r1', 'R1'], ['r2', 'R2'], ['r3', 'R3']].filter(([field]) => lead[field]).map(([field, label]) => ({ field, label, value: toDatetimeLocal(lead[field]) }));
                const upcoming = rows.filter(r => { const d = rdvDays(r.value); return d != null && d >= 0; }).sort((a, b) => a.value.localeCompare(b.value))[0];
                return (
                  <div style={{ marginBottom: 14, animation: 'contentReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) 0.16s both' }}>
                    <div style={{ marginBottom: 6, fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: darkMode ? C.muted : '#a8a39b' }}>Rendez-vous</div>
                    {rows.map((r, index) => (
                      <RdvRow key={r.field} first={index === 0} last={index === rows.length - 1} next={upcoming?.field === r.field} label={r.label} value={r.value}
                        onChange={(val) => handleDateChange(lead.id, r.field, val)} C={C} darkMode={darkMode} />
                    ))}
                  </div>
                );
              })()}

              </div>{/* fin du volet Infos, 1re partie */}

              <div style={{ display: leadTab === 'commentaire' ? 'block' : 'none', animation: 'contentReveal 0.3s cubic-bezier(0.4,0,0.2,1) both' }}>
              {/* ─── NOTES ─── (la note du rappel daté d'abord, puis les notes du lead ; pendant la saisie en ligne d'une note, la note du rappel reste visible) */}
              {!(recallText || notesShown) && !(lead.id in editingNotes) && (
                <p style={{ margin: '4px 2px 12px', fontSize: 12.5, lineHeight: 1.55, color: C.muted }}>Aucun commentaire pour l’instant. Notez les points clés de l’échange, les décisions et la prochaine étape.</p>
              )}
              {(recallText || notesShown) && (
                <div style={{
                  marginBottom: 12, padding: '14px 16px', borderRadius: 14, fontSize: 13.5,
                  background: darkMode ? '#181818' : '#f7f5f2',
                }}>
                  <span style={{ display: 'block', marginBottom: 6, fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' }}>{recallText && !notesShown ? 'Note du rappel' : 'Commentaire'}</span>
                  {recallText && <SalesNotesView value={recallText}/>}
                  {recallText && notesShown && <div style={{ height: 1, margin: '8px 0', background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }} />}
                  {notesShown && <SalesNotesView value={lead.notes}/>}
                  {notesShown && lead.notes_updated_at && formatNoteDate(lead.notes_updated_at) && (
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 6, textAlign: 'right', fontStyle: 'normal' }}>
                      Modifié {formatNoteDate(lead.notes_updated_at)}
                    </div>
                  )}
                </div>
              )}
              {editingNotes.hasOwnProperty(lead.id) && !isGuidedLead(lead) && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ position: 'relative' }}>
                    {isGuidedLead(lead) ? <SalesNotes value={notesVal} onChange={value=>setEditingNotes(prev=>({...prev,[lead.id]:value}))} dark={darkMode}/> : <textarea
                      value={notesVal}
                      onChange={(e) => setEditingNotes(prev => ({ ...prev, [lead.id]: e.target.value }))}
                      placeholder="Ajouter un commentaire..."
                      style={{
                        width: '100%', minHeight: 60, padding: '8px 40px 8px 10px', borderRadius: 8,
                        border: `1px solid ${C.border}`, background: darkMode ? '#262626' : '#f8f9fc',
                        color: C.text, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                        outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                      }}
                      onFocus={(e) => e.target.style.borderColor = C.accent}
                      onBlur={(e) => e.target.style.borderColor = C.border}
                    />}

                    <button type="button" onClick={() => {
                      if (micRecording) {
                        const lid = lead.id;
                        micStopAndTranscribe((text) => setEditingNotes(prev => ({ ...prev, [lid]: (prev[lid] ? prev[lid] + ' ' : '') + text })));
                      } else if (!micTranscribing) { micStartRecording(); }
                    }} disabled={micTranscribing}
                      style={{
                        position: 'absolute', right: 6, bottom: 6,
                        width: 28, height: 28, borderRadius: '50%', border: 'none',
                        background: micRecording ? '#ef4444' : micTranscribing ? C.muted : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                        color: micRecording ? '#fff' : micTranscribing ? '#fff' : C.muted,
                        cursor: micTranscribing ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        animation: micRecording ? 'gentlePulse 1.5s ease-in-out infinite' : 'none',
                      }}
                      title={micRecording ? 'Arrêter et transcrire' : micTranscribing ? 'Transcription...' : 'Dicter'}
                    >
                      {micTranscribing ? (
                        <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderTopColor: '#fff', borderRadius: '50%', animation: 'loaderSpin 0.8s linear infinite' }} />
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {micRecording ? (<><line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" /></>) : (
                            <><rect x="9" y="1" width="6" height="12" rx="3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>
                          )}
                        </svg>
                      )}
                    </button>
                    {micError && (
                      <div style={{ position: 'absolute', right: 40, bottom: 8, padding: '3px 10px', borderRadius: 6, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', animation: 'copiedToastIn 0.3s ease both' }}>{micError}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { micCleanup(); setEditingNotes(prev => { const n = { ...prev }; delete n[lead.id]; return n; }); }}
                      style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.secondary, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    >Annuler</button>
                    <button
                      onClick={() => handleNotesSave(lead.id)}
                      style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.accent, color: C.onAccent, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                    >Sauvegarder</button>
                  </div>
                </div>
              )}

              {notesError?.leadId===lead.id && <p className="sj-error" role="alert">{notesError.message}</p>}
              {(isGuidedLead(lead) || !(lead.id in editingNotes)) && !isAdminView && (
                <button type="button"
                  onClick={() => { setNotesError(null); setEditingNotes(prev => ({ ...prev, [lead.id]: prev[lead.id] ?? lead.notes ?? '' })); if (isGuidedLead(lead)) setCommentLeadId(lead.id); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginBottom: 16, padding: '10px 14px', borderRadius: 12, border: 'none',
                    background: darkMode ? '#ededed' : '#2b2927', color: darkMode ? '#141414' : '#ffffff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  {lead.notes && lead.notes.trim() ? 'Modifier le commentaire' : 'Écrire un commentaire'}
                </button>
              )}
              </div>{/* fin du volet Commentaire */}

              <div style={{ display: leadTab === 'infos' ? 'block' : 'none' }}>
              {/* ─── SEPARATOR ─── */}
              <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '2px 0 12px' }} />

              {/* ─── DOCS RECEIVED + QUALIFIER R2 (same row, R2 only) ─── */}
              {(activeCat.key === 'r2' || activeCat.key === 'r3') && (() => {
                const isR3 = activeCat.key === 'r3';
                const resultField = isR3 ? 'r3_result' : 'r2_result';
                const completedField = isR3 ? 'r3_completed_at' : 'r2_completed_at';
                const currentResult = isR3 ? lead.r3_result : lead.r2_result;
                const wfLocal = activeWorkflow?.leadId === lead.id ? activeWorkflow : null;
                const r2Options = [
                  { value: 'done',             label: isR3 ? 'R3 effectué' : 'R2 effectué',      icon: '✓' },
                  { value: 'comptable',        label: 'Parler comptable', icon: '🧮' },
                  { value: 'associe',          label: 'Parler associé',   icon: '🤝' },
                  { value: 'reflexion',        label: 'Doit réfléchir',   icon: '💭' },
                  { value: 'relire_contrat',   label: 'Relire contrat',   icon: '📄' },
                  { value: 'pas_decision_jour',label: 'Pas de décision',  icon: '⏸' },
                  { value: 'tresorerie',       label: 'Pb trésorerie',    icon: '💰' },
                  ...(isR3 ? [] : [{ value: 'no_show', label: 'Lapin (no-show)', icon: '🐇' }]),
                  { value: 'reporte',          label: 'R2 reporté',       icon: '↻' },
                  { value: 'pas_interesse',    label: 'Pas intéressé',    icon: '✕' },
                  { value: 'annule',           label: 'R2 annulé',        icon: '🚫' },
                ];
                // Parcours guidé (audit 11/11/2026) : le bouton parle comme la fenêtre, et n'annonce le contrat que lorsqu'elle le propose.
                const guidedResultLabel = { ...Object.fromEntries(QUALIFICATION_RESULTS.map(([value, label]) => [value, label])),
                  no_show: 'Client absent', reporte: 'Reporté', a_reporter: 'À reprogrammer', annule: 'Annulé' }[currentResult] || 'Résultat enregistré';
                const guidedToContract = ['done', 'relire_contrat'].includes(currentResult) && !['ongoing', 'done'].includes(leadContracts[lead.id]?.[0]?.yousign_status);
                const handleR2Select = (val) => {
                  if (!val) return;
                  if (val === 'done') return handleWorkflowSubmit(lead.id, { [resultField]: 'done', [completedField]: new Date().toISOString() });
                  if (val === 'reporte') return setActiveWorkflow({ leadId: lead.id, r2Result: 'reporte', newDate: '' });
                  if (val === 'pas_interesse') return handleWorkflowSubmit(lead.id, { [resultField]: 'pas_interesse' });
                  if (val === 'annule') return handleWorkflowSubmit(lead.id, { [resultField]: 'annule' });
                  handleWorkflowSubmit(lead.id, { [resultField]: val });
                };
                return (
                  <>
                    {isGuidedLead(lead) ? <button className="sj-qualify" style={{background:C.bg,color:C.text,borderColor:C.border}} onClick={()=>setQualificationDialog({lead,stage:isR3?'r3':'r2'})}><CalendarCheck2 size={22}/><span>{currentResult ? `Qualification du ${isR3?'R3':'R2'}` : `Qualifier le ${isR3?'R3':'R2'}`}<small>{currentResult ? `${guidedResultLabel} · ${guidedToContract ? 'Continuer vers le contrat' : 'Modifier'}` : 'Qualifiez le rendez-vous, puis préparez et envoyez le contrat'}</small></span><ChevronRight size={18}/></button> : <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      {/* Docs received toggle */}
                      <button
                        onClick={() => handleDocsReceivedToggle(lead.id, !!lead.docs_received)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                          padding: '7px 14px', borderRadius: 10,
                          border: `1px solid ${lead.docs_received ? '#10b981' : C.border}`,
                          background: lead.docs_received
                            ? (darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)')
                            : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'),
                          color: lead.docs_received ? '#10b981' : C.muted,
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                          transition: 'all 0.2s cubic-bezier(0.25,0.1,0.25,1)', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => {
                          if (!lead.docs_received) {
                            e.currentTarget.style.borderColor = darkMode ? 'rgba(16,185,129,0.4)' : 'rgba(16,185,129,0.3)';
                            e.currentTarget.style.color = '#10b981';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!lead.docs_received) {
                            e.currentTarget.style.borderColor = C.border;
                            e.currentTarget.style.color = C.muted;
                          }
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1.5px solid ${lead.docs_received ? '#10b981' : (darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')}`,
                          background: lead.docs_received ? '#10b981' : 'transparent',
                          transition: 'all 0.2s cubic-bezier(0.25,0.1,0.25,1)',
                        }}>
                          {lead.docs_received && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </span>
                        Documents reçus
                      </button>

                      {/* Qualifier R2 dropdown (inline) */}
                      {!(wfLocal?.r2Result === 'reporte') && (
                        <select
                          value=""
                          onChange={(e) => handleR2Select(e.target.value)}
                          style={{
                            flex: 1, minWidth: 180, padding: '8px 32px 8px 12px', borderRadius: 10,
                            border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                            fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                            outline: 'none', appearance: 'none', WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(C.muted)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                          }}
                          onFocus={(e) => { e.target.style.borderColor = '#fb923c'; e.target.style.boxShadow = '0 0 0 3px rgba(251,146,60,0.12)'; }}
                          onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
                        >
                          <option value="" disabled>{isR3 ? 'Qualifier le R3...' : 'Qualifier le R2...'}</option>
                          {r2Options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.icon}  {opt.label}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    </>}
                    {/* Reschedule date picker (when R2 reporté selected) */}
                    {wfLocal?.r2Result === 'reporte' && (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>↻</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#fb923c' }}>Reporter le R2</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={wfLocal.newDate ? wfLocal.newDate.slice(0, 10) : ''}
                              onChange={(e) => { const time = wfLocal.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <TimeSelect value={wfLocal.newDate?.slice(11, 16) || '09:00'} onChange={(t) => { const date = wfLocal.newDate?.slice(0, 10) || parisToday(); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + t })); }} C={C} darkMode={darkMode} />
                          </div>
                        </div>
                        {wfLocal.newDate && wfLocal.newDate.length >= 10 && (
                          <button onClick={() => handleWorkflowSubmit(lead.id, { r2_result: 'reporte', r2_date: wfLocal.newDate })}
                            style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#fb923c', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both', transition: 'transform 0.15s, box-shadow 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(251,146,60,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer nouvelle date</button>
                        )}
                        <button onClick={() => setActiveWorkflow(null)}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    )}

                    {/* Tranche salariale dans la fiche : seulement hors parcours guidé (audit dev 11/11/2026). Dans le parcours guidé,
                        c'est la fenêtre « Préparer le contrat » qui la demande ; la montrer ici faisait doublon. Elle ne revient
                        que si aucune fenêtre ne la demandera et qu'elle manque encore, pour ne jamais bloquer l'envoi. */}
                    {lead.r2_result && !intakeContexts[lead.id]?.required && (!isGuidedLead(lead) || (!!intakeContexts[lead.id] && !lead.employee_range)) && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>
                          Tranche salariale
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {EMPLOYEE_RANGES.map(range => {
                            const isSel = lead.employee_range === range;
                            return (
                              <button key={range}
                                onClick={() => handleEmployeeRangeChange(lead.id, range)}
                                aria-pressed={isSel}
                                style={{
                                  padding: '4px 9px', borderRadius: 7,
                                  border: `1px solid ${isSel ? C.accent : C.border}`,
                                  background: isSel ? C.accent : 'transparent',
                                  color: isSel ? C.onAccent : C.secondary,
                                  fontSize: 11, fontWeight: 500,
                                  cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease', fontFamily: 'inherit',
                                }}
                              >{range}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {/* Company count (only after qualification) */}
                    {lead.r2_result && !intakeContexts[lead.id]?.required && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 6 }}>
                          Nbr de sociétés
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={lead.company_count || ''}
                          placeholder="Ex: 3"
                          onChange={async (e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, company_count: val } : l));
                          }}
                          onBlur={async (e) => {
                            const val = e.target.value.trim();
                            if (val !== (lead._prevCompanyCount || '')) {
                              try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { company_count: val || null }); } catch {}
                            }
                          }}
                          onFocus={() => { lead._prevCompanyCount = lead.company_count || ''; }}
                          style={{
                            width: 80, padding: '6px 10px', borderRadius: 9,
                            border: `1px solid ${C.border}`,
                            background: C.bg,
                            color: C.text, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                            outline: 'none', transition: 'all 0.15s',
                          }}
                        />
                      </div>
                    )}
                  </>
                );
              })()}

              {/* ═══ NEW / CALLBACK / VOICEMAIL TAB WORKFLOW ═══ */}
              {(activeCat.key === 'new' || activeCat.key === 'callback' || activeCat.key === 'voicemail' || (activeCat.key === 'to_recontact' && isGuidedLead(lead))) && (() => {
                if (isGuidedLead(lead)) return <button className="sj-qualify" style={{background:C.bg,color:C.text,borderColor:C.border,marginBottom:16}} onClick={() => {setActiveWorkflow(null);setContactDialog({lead,category:activeCat.key});}}><PhoneCall size={22}/><span>{activeCat.key === 'to_recontact' ? 'Reprendre le contact' : 'Qualifier le contact'}<small>Résultat de l’appel et planification du R1 ou du R2</small></span><ChevronRight size={18}/></button>;
                const wf = activeWorkflow?.leadId === lead.id && !activeWorkflow?.callFlow ? activeWorkflow : null;
                const today = parisToday();
                // Preserve original first contact date if already set (callback/voicemail leads have been contacted before)
                const firstContactDate = lead.first_contact_date ? lead.first_contact_date.slice(0, 10) : today;
                const isReContact = activeCat.key === 'callback' || activeCat.key === 'voicemail';
                // On callback/voicemail tabs, "Répondeur" / "À rappeler" should NOT move the lead — just bump call_attempts.
                // We also send `status: activeCat.key` (voicemail or callback — same value as current tab) so the backend's
                // `last_call_at` hook fires. The hook is guarded by `status in ("voicemail", "callback")` in the payload;
                // sending the current status is a no-op for the lead's position but satisfies that condition.
                const bumpCallAttempts = async () => {
                  const currentLead = leads.find(l => l.id === lead.id) || lead;
                  const newAttempts = (currentLead.call_attempts || 0) + 1;
                  const nowIso = new Date().toISOString();
                  setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, call_attempts: newAttempts, first_contact_date: l.first_contact_date || today, last_call_at: nowIso, first_call_at: l.first_call_at || nowIso } : l));
                  try {
                    await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { call_attempts: newAttempts, first_contact_date: firstContactDate, status: activeCat.key });
                  } catch (e) { console.error('bump call_attempts failed:', e); }
                  setActiveWorkflow(null);
                };
                // « À rappeler » daté : même requête que la fenêtre guidée (contactQualificationPatch) ; sur un lead déjà en rappel / répondeur
                // la tentative s'ajoute et le lead reste dans son onglet. Une erreur reste affichée dans la carte, les choix sont conservés.
                const confirmCallback = async () => {
                  if (wf?.saving) return;
                  setActiveWorkflow(prev => ({ ...prev, saving: true, error: '' }));
                  try {
                    const current = leads.find(l => l.id === lead.id) || lead;
                    const patch = contactQualificationPatch(current, activeCat.key, { result: 'reached', next: 'callback', date: wf.newDate, note: wf.note });
                    await handleWorkflowSubmit(lead.id, patch, { strict: true });
                  } catch (e) {
                    setActiveWorkflow(prev => prev ? { ...prev, saving: false, error: e.message || 'Le rappel n’a pas pu être enregistré. Réessayez.' } : prev);
                  }
                };
                const wfPill = (label, color, icon, delay, onClick) => (
                  <button key={label} onClick={onClick} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 50,
                    border: 'none', background: darkMode ? `${color}22` : `${color}12`, color,
                    fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    animation: `wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) ${delay}ms both`,
                    transition: 'background 0.15s, transform 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? `${color}35` : `${color}20`; e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? `${color}22` : `${color}12`; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
                    {label}
                  </button>
                );
                return (
                  <div style={{ marginBottom: 16 }}>
                    {!wf ? (
                      <button
                        onClick={() => setActiveWorkflow({ leadId: lead.id, contactResult: '', appointmentResult: '', newDate: '' })}
                        style={{
                          width: '100%', padding: '10px 16px', borderRadius: 50, border: 'none',
                          background: darkMode ? '#ededed' : '#2b2927', color: darkMode ? '#141414' : '#ffffff', fontSize: 13, fontWeight: 500,
                          cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.background = darkMode ? '#ffffff' : '#1c1b19'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = darkMode ? '#ededed' : '#2b2927'; }}
                      >
                        {activeCat.key === 'new' ? 'Premier contact' : 'Re-contacter'}
                      </button>
                    ) : !wf.contactResult ? (
                      /* ── Step 1: Contact result pills ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, animation: 'wfSplitIn 0.3s ease both' }}>
                          Résultat du contact
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {wfPill('A décroché', '#10b981', '✓', 30, () => setActiveWorkflow(prev => ({ ...prev, contactResult: 'reached', appointmentResult: '', newDate: '' })))}
                          {wfPill('Répondeur', '#8b867e', '📞', 70, () => isReContact ? bumpCallAttempts() : handleWorkflowSubmit(lead.id, { first_contact_date: firstContactDate, contact_result: 'voicemail', status: 'voicemail' }))}
                          {wfPill('Non pertinent', '#ef4444', '✕', 110, () => handleWorkflowSubmit(lead.id, { first_contact_date: firstContactDate, contact_result: 'not_relevant', status: 'not_relevant' }))}
                          {wfPill('Non traitable', '#f59e0b', '⚠', 150, () => handleWorkflowSubmit(lead.id, { first_contact_date: firstContactDate, contact_result: 'not_processable', status: 'not_relevant' }))}
                          {wfPill('À relancer', '#14b8a6', '↻', 190, () => setActiveWorkflow(prev => ({ ...prev, contactResult: 'to_recontact', newDate: '' })))}
                          {wfPill('Injoignable', '#55514b', '🚫', 230, () => handleWorkflowSubmit(lead.id, { first_contact_date: firstContactDate, contact_result: 'unreachable', status: 'unreachable' }))}
                        </div>
                        <button onClick={() => setActiveWorkflow(null)}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', marginTop: 2, opacity: 0.7, animation: 'wfSplitIn 0.3s ease 200ms both' }}
                        >Annuler</button>
                      </div>
                    ) : wf.contactResult === 'to_recontact' ? (
                      /* ── Sous-étape: date approx. de relance (À relancer ≠ Non pertinent) ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', borderRadius: 16, background: darkMode ? 'rgba(20,184,166,0.08)' : 'rgba(20,184,166,0.05)', border: `1px solid ${darkMode ? 'rgba(20,184,166,0.22)' : 'rgba(20,184,166,0.15)'}`, animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>↻</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#0f9b8e' }}>Quand le recontacter ?</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: C.muted }}>Date approximative, modifiable plus tard.</div>
                        <input type="date" value={wf.newDate ? wf.newDate.slice(0, 10) : ''}
                          onChange={(e) => setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value }))}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                        />
                        {wf.newDate && wf.newDate.length >= 10 && (
                          <button onClick={() => handleWorkflowSubmit(lead.id, { first_contact_date: firstContactDate, status: 'to_recontact', recontact_date: wf.newDate.slice(0, 10) })}
                            style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#14b8a6', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}
                          >Confirmer → À relancer</button>
                        )}
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, contactResult: '', newDate: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    ) : wf.contactResult === 'reached' && !wf.appointmentResult ? (
                      /* ── Step 2: Follow-up pills ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, animation: 'wfSplitIn 0.3s ease both' }}>
                          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>✓ A décroché</span>
                          <span style={{ fontSize: 10, color: C.muted }}>→</span>
                          <span style={{ fontSize: 10, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Suite ?</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {wfPill('RDV R1', '#3b82f6', '📅', 30, () => setActiveWorkflow(prev => ({ ...prev, appointmentResult: 'appointment_set', newDate: '' })))}
                          {wfPill('R2 direct', '#fb923c', '⚡', 70, () => setActiveWorkflow(prev => ({ ...prev, appointmentResult: 'r2_direct', newDate: '' })))}
                          {wfPill('À rappeler', '#a8a39b', '↩', 110, () => setActiveWorkflow(prev => ({ ...prev, appointmentResult: 'callback_set', newDate: '', note: '', error: '' })))}
                          {wfPill('Pas intéressé', '#ef4444', '✕', 150, () => handleWorkflowSubmit(lead.id, { first_contact_date: firstContactDate, contact_result: 'reached', appointment_result: 'not_interested', status: 'not_relevant' }))}
                        </div>
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, contactResult: '', appointmentResult: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', marginTop: 2, opacity: 0.7, animation: 'wfSplitIn 0.3s ease 150ms both' }}
                        >← Retour</button>
                      </div>
                    ) : wf.contactResult === 'reached' && wf.appointmentResult === 'appointment_set' ? (
                      /* ── Step 3: Date picker for R1 ── */
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>📅</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6' }}>Planifier le R1</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date"
                              value={wf.newDate ? wf.newDate.slice(0, 10) : ''}
                              onChange={(e) => {
                                const time = wf.newDate?.slice(10) || 'T09:00';
                                setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time }));
                              }}
                              style={{
                                width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500,
                                border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                                fontFamily: 'inherit', outline: 'none',
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <TimeSelect value={wf.newDate?.slice(11, 16) || '09:00'} onChange={(t) => { const date = wf.newDate?.slice(0, 10) || parisToday(); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + t })); }} C={C} darkMode={darkMode} />
                          </div>
                        </div>
                        {wf.newDate && wf.newDate.length >= 10 && (
                          <button
                            onClick={() => handleWorkflowSubmit(lead.id, {
                              first_contact_date: firstContactDate,
                              contact_result: 'reached', appointment_result: 'appointment_set',
                              r1_date: wf.newDate, status: 'r1',
                            })}
                            style={{
                              padding: '10px 20px', borderRadius: 50, border: 'none',
                              background: darkMode ? '#3b82f6' : '#2b2927', color: '#fff', fontSize: 12.5, fontWeight: 500,
                              cursor: 'pointer', fontFamily: 'inherit',
                              animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                              transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer → R1</button>
                        )}
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, appointmentResult: '', newDate: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    ) : wf.contactResult === 'reached' && wf.appointmentResult === 'r2_direct' ? (
                      /* ── Step 3b: Date picker for R2 direct ── */
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>⚡</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#fb923c' }}>Planifier le R2 directement</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={wf.newDate ? wf.newDate.slice(0, 10) : ''}
                              onChange={(e) => { const time = wf.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <TimeSelect value={wf.newDate?.slice(11, 16) || '09:00'} onChange={(t) => { const date = wf.newDate?.slice(0, 10) || parisToday(); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + t })); }} C={C} darkMode={darkMode} />
                          </div>
                        </div>
                        {wf.newDate && wf.newDate.length >= 10 && (
                          <button onClick={() => handleWorkflowSubmit(lead.id, {
                              first_contact_date: firstContactDate, contact_result: 'reached', appointment_result: 'appointment_set',
                              r2_date: wf.newDate, status: 'r2',
                            })}
                            style={{
                              padding: '10px 20px', borderRadius: 50, border: 'none',
                              background: '#fb923c', color: '#fff', fontSize: 12.5, fontWeight: 500,
                              cursor: 'pointer', fontFamily: 'inherit',
                              animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                              transition: 'transform 0.15s, box-shadow 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(251,146,60,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer → R2</button>
                        )}
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, appointmentResult: '', newDate: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    ) : wf.contactResult === 'reached' && wf.appointmentResult === 'callback_set' ? (
                      /* ── Step 3c: date, heure et description du rappel (événement Google « Recall » posé côté serveur) ── */
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.07)',
                        border: `1px solid ${darkMode ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.22)'}`,
                        animation: 'wfRecallCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>↩</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: darkMode ? '#d8d3cb' : '#8b867e' }}>Planifier le rappel</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={wf.newDate ? wf.newDate.slice(0, 10) : ''} disabled={!!wf.saving}
                              onChange={(e) => { const time = wf.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value ? e.target.value + time : '', error: '' })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <TimeSelect value={wf.newDate?.slice(11, 16) || '09:00'} onChange={(t) => { const date = wf.newDate?.slice(0, 10) || parisToday(); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + t, error: '' })); }} C={C} darkMode={darkMode} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Description <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(facultatif)</span></div>
                          <textarea rows={2} maxLength={CALLBACK_NOTE_MAX} value={wf.note || ''} disabled={!!wf.saving}
                            onChange={(e) => setActiveWorkflow(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="Ce dont vous avez convenu avec le prospect…"
                            style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                          />
                        </div>
                        {(() => { const ruleNote = recallRuleNote(leads.find(l => l.id === lead.id) || lead); return ruleNote ? (
                          <div role="note" style={{ fontSize: 11.5, lineHeight: 1.4, padding: '8px 10px', borderRadius: 10, color: darkMode ? '#e8d49a' : '#6b5410', background: darkMode ? '#2f2a1b' : '#fbf5e4', border: `1px solid ${darkMode ? '#5a4c24' : '#e6d9b8'}` }}>
                            <div style={{ fontWeight: 500 }}>{ruleNote}</div>
                            <div>{CALLBACK_RULE_HELP}</div>
                          </div>
                        ) : null; })()}
                        {recallInPast(wf.newDate) && <div role="alert" style={{ fontSize: 11, fontWeight: 500, color: darkMode ? '#fca5a5' : '#b42318' }}>Cette heure est déjà passée.</div>}
                        {wf.error && <div role="alert" style={{ fontSize: 11, fontWeight: 500, color: darkMode ? '#fca5a5' : '#b42318' }}>{wf.error}</div>}
                        {wf.newDate && wf.newDate.length >= 10 && !recallInPast(wf.newDate) && (
                          <button disabled={!!wf.saving} onClick={confirmCallback}
                            style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#8b867e', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: wf.saving ? 'wait' : 'pointer', opacity: wf.saving ? 0.6 : 1, fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}
                          >{wf.saving ? 'Enregistrement…' : 'Confirmer → À rappeler'}</button>
                        )}
                        <button disabled={!!wf.saving} onClick={() => setActiveWorkflow(prev => ({ ...prev, appointmentResult: '', newDate: '', note: '', error: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* ═══ R1 TAB WORKFLOW ═══ */}
              {activeCat.key === 'r1' && (() => {
                const wfR2 = activeWorkflow?.leadId === lead.id && activeWorkflow?.r1Result === 'r2_set_standalone' ? activeWorkflow : null;
                const wf = activeWorkflow?.leadId === lead.id && !wfR2 ? activeWorkflow : null;
                const wfPill = (label, color, icon, delay, onClick, isImg) => (
                  <button key={label} onClick={onClick} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 50,
                    border: 'none', background: darkMode ? `${color}22` : `${color}12`, color,
                    fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    animation: `wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) ${delay}ms both`,
                    transition: 'background 0.15s, transform 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? `${color}35` : `${color}20`; e.currentTarget.style.transform = 'scale(1.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? `${color}22` : `${color}12`; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    {isImg ? (
                      <span style={{ width: 18, height: 18, display: 'inline-block', flexShrink: 0, position: 'relative', top: 1, backgroundColor: color, WebkitMaskImage: `url(${icon})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskImage: `url(${icon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                    ) : (
                      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
                    )}
                    {label}
                  </button>
                );
                return (
                  <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {!wf ? (
                      <>
                        {isGuidedLead(lead) ? <button className="sj-qualify" style={{background:C.bg,color:C.text,borderColor:C.border}} onClick={() => setQualificationDialog({lead,stage:'r1'})}><CalendarCheck2 size={22}/><span>{lead.r1_result ? 'Qualification du R1' : 'Qualifier le R1'}<small>{lead.r1_result ? 'Modifier le résultat ou planifier le R2' : 'Résultat du rendez-vous et planification du R2'}</small></span><ChevronRight size={18}/></button> : <button
                          onClick={() => setActiveWorkflow({ leadId: lead.id, r1Result: '', r1FollowUp: '', newDate: '' })}
                          style={{
                            width: '100%', padding: '10px 16px', borderRadius: 50,
                            border: `1px solid ${C.border}`, background: 'transparent',
                            color: C.text, fontSize: 13, fontWeight: 500,
                            cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; e.currentTarget.style.transform = 'scale(1.02)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; e.currentTarget.style.transform = 'scale(1)'; }}
                        >Qualifier le R1</button>}

                        {/* ── R2 placé: separate standalone button (only after R1 qualified) ── */}
                        {isGuidedLead(lead) || !lead.r1_result ? null : !wfR2 ? (
                          <button
                            onClick={() => setActiveWorkflow({ leadId: lead.id, r1Result: 'r2_set_standalone', newDate: '' })}
                            style={{
                              width: '100%', padding: '10px 16px', borderRadius: 50,
                              border: `1px solid ${darkMode ? 'rgba(251,146,60,0.3)' : 'rgba(251,146,60,0.25)'}`,
                              background: darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)',
                              color: '#fb923c', fontSize: 13, fontWeight: 500,
                              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(251,146,60,0.15)' : 'rgba(251,146,60,0.08)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)'; e.currentTarget.style.transform = 'scale(1)'; }}
                          ><span style={{ fontSize: 15, lineHeight: 1 }}>📅</span> R2 placé</button>
                        ) : (
                          /* ── R2 date picker (standalone) ── */
                          <div style={{
                            display: 'flex', flexDirection: 'column', gap: 10,
                            padding: '16px 18px', borderRadius: 16,
                            background: darkMode ? 'rgba(251,146,60,0.08)' : 'rgba(251,146,60,0.04)',
                            border: `1px solid ${darkMode ? 'rgba(251,146,60,0.2)' : 'rgba(251,146,60,0.12)'}`,
                            animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 15 }}>📅</span>
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#fb923c' }}>Planifier le R2</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                                <input type="date" value={wfR2.newDate ? wfR2.newDate.slice(0, 10) : ''}
                                  onChange={(e) => { const time = wfR2.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                                  style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                                <TimeSelect value={wfR2.newDate?.slice(11, 16) || '09:00'} onChange={(t) => { const date = wfR2.newDate?.slice(0, 10) || parisToday(); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + t })); }} C={C} darkMode={darkMode} />
                              </div>
                            </div>
                            {wfR2.newDate && wfR2.newDate.length >= 10 && (
                              <button onClick={() => handleWorkflowSubmit(lead.id, { r1_result: 'done', r1_completed_at: new Date().toISOString(), r1_follow_up: 'r2_set', r2_date: wfR2.newDate, status: 'r2' })}
                                style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#fb923c', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both', transition: 'transform 0.15s, box-shadow 0.15s' }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(251,146,60,0.35)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                              >Confirmer → R2</button>
                            )}
                            <button onClick={() => setActiveWorkflow(null)}
                              style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                            >← Retour</button>
                          </div>
                        )}

                        {/* ── Shortcut: Envoyer le contrat directly from R1 ── */}
                        {!isGuidedLead(lead) && (r1ShortcutContract === lead.id ? (() => {
                          const hasRange = !!lead.employee_range;
                          const ndaDone = !!(lead.has_client_data);
                          const isSending = sendingContract === lead.id;
                          const contracts = leadContracts[lead.id] || [];
                          const latestContract = contracts[0] || null;
                          const cStatus = latestContract?.yousign_status;
                          if (!leadContracts[lead.id] && typeof fetchLeadContracts === 'function') fetchLeadContracts(lead.id);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 14, border: `1px solid ${darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`, background: darkMode ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.02)', animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both' }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#10b981' }}>Envoi rapide du contrat</div>
                              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>Envoyez le contrat directement à l’issue du R1.</div>
                              <div style={{ fontSize: 10, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tranche salariale</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {EMPLOYEE_RANGES.map(range => {
                                  const isSel = lead.employee_range === range;
                                  return <button key={range} onClick={() => handleEmployeeRangeChange(lead.id, range)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: isSel ? 600 : 500, border: `1px solid ${isSel ? '#fb923c' : C.border}`, background: isSel ? 'rgba(251,146,60,0.1)' : 'transparent', color: isSel ? '#fb923c' : C.muted, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>{range}</button>;
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => openNdaPopup(lead)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ndaDone ? 'rgba(16,185,129,0.25)' : C.border}`, background: ndaDone ? 'rgba(16,185,129,0.04)' : 'transparent', color: ndaDone ? '#10b981' : C.accent, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>{ndaDone ? 'NDA généré ✓' : 'Générer NDA'}</button>
                                <button onClick={() => { if (!isSending && hasRange) handleSendContract(lead); }} disabled={!hasRange || isSending} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: hasRange && !isSending ? '#10b981' : (darkMode ? '#2e2e2e' : '#ece9e4'), color: hasRange && !isSending ? '#fff' : C.muted, fontSize: 11, fontWeight: 500, cursor: hasRange && !isSending ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: hasRange && !isSending ? 1 : 0.6 }}>{isSending ? 'Envoi...' : 'Envoyer le contrat'}</button>
                              </div>
                              {latestContract && <div style={{ fontSize: 11, color: cStatus === 'ongoing' ? '#3b82f6' : cStatus === 'done' ? '#10b981' : C.muted, fontWeight: 500 }}>{cStatus === 'ongoing' ? 'En attente de signature' : cStatus === 'done' ? 'Signé ✓' : cStatus}</div>}
                              <button onClick={() => setR1ShortcutContract(null)} style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}>← Fermer</button>
                            </div>
                          );
                        })() : (
                          <button onClick={() => intakeContexts[lead.id]?.required ? handleSendContract(lead) : setR1ShortcutContract(lead.id)} style={{ width: '100%', padding: '10px 16px', borderRadius: 50, border: `1px solid ${darkMode ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}`, background: darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)', color: '#10b981', fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.06)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)'; e.currentTarget.style.transform = 'scale(1)'; }}
                          >Envoyer le contrat</button>
                        ))}
                      </>
                    ) : !wf.r1Result ? (
                      /* ── Step 1: R1 qualification pills ── */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2, animation: 'wfSplitIn 0.3s ease both' }}>
                          Qualifier le R1
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          {wfPill('Lapin', '#f59e0b', rabbitIcon, 30, () => handleWorkflowSubmit(lead.id, { r1_result: 'no_show' }), true)}
                          {wfPill('Reporter', '#3b82f6', '↻', 70, () => setActiveWorkflow(prev => ({ ...prev, r1Result: 'rescheduled', newDate: '' })))}
                          {wfPill('R1 effectué', '#10b981', '✓', 110, () => handleWorkflowSubmit(lead.id, { r1_result: 'done', r1_completed_at: new Date().toISOString() }))}
                          {wfPill('Annulé', '#ef4444', '✕', 150, () => handleWorkflowSubmit(lead.id, { r1_result: 'cancelled' }))}
                        </div>
                        <button onClick={() => setActiveWorkflow(null)}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', marginTop: 2, opacity: 0.7, animation: 'wfSplitIn 0.3s ease 190ms both' }}
                        >Fermer</button>
                      </div>
                    ) : wf.r1Result === 'rescheduled' ? (
                      /* ── Reschedule: date picker ── */
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>↻</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6' }}>Reporter le R1</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={wf.newDate ? wf.newDate.slice(0, 10) : ''}
                              onChange={(e) => { const time = wf.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <TimeSelect value={wf.newDate?.slice(11, 16) || '09:00'} onChange={(t) => { const date = wf.newDate?.slice(0, 10) || parisToday(); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + t })); }} C={C} darkMode={darkMode} />
                          </div>
                        </div>
                        {wf.newDate && wf.newDate.length >= 10 && (
                          <button onClick={() => handleWorkflowSubmit(lead.id, { r1_result: 'rescheduled', r1_date: wf.newDate })}
                            style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: darkMode ? '#3b82f6' : '#2b2927', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', animation: 'wfSplitIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both', transition: 'transform 0.15s, box-shadow 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer nouvelle date</button>
                        )}
                        <button onClick={() => setActiveWorkflow(prev => ({ ...prev, r1Result: '', newDate: '' }))}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    ) : null}
                  </div>
                );
              })()}


              {/* ═══ Commenter et NDA : juste sous la qualification (dev 11/11/2026), avant le contrat et les SMS ═══ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 16px' }}>
                {(isGuidedLead(lead) || !editingNotes.hasOwnProperty(lead.id)) && (
                  <button
                    onClick={() => { setNotesError(null); setEditingNotes(prev => ({ ...prev, [lead.id]: prev[lead.id] ?? lead.notes ?? '' })); setPanelTab({ leadId: lead.id, tab: 'commentaire' }); if(isGuidedLead(lead)) setCommentLeadId(lead.id); }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 14px', borderRadius: 10, border: `1px solid ${C.border}`,
                      background: 'transparent', color: C.secondary,
                      fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.borderColor = C.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = C.border; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Commenter
                  </button>
                )}
                {(() => {
                  const ndaDone = !!(lead.has_client_data);
                  const ndaColor = ndaDone ? (darkMode ? '#7cc49b' : '#0b7a4b') : C.text;
                  return (
                <button
                  onClick={() => openNdaPopup(lead)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '9px 14px', borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: 'transparent',
                    color: ndaColor,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    transition: 'border-color 0.15s ease', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                >
                  {ndaDone ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  )}
                  {ndaDone ? 'Modifier / régénérer le NDA' : 'Générer NDA'}
                </button>
                  );
                })()}
              </div>

              {/* Dates pipeline (À relancer = recontact futur ; Non pertinent = écarté) */}
              {/* À relancer : la date de reprise, modifiable comme la fenêtre l'annonce (audit 11/11/2026). */}
              {activeCat.key === 'to_recontact' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: darkMode ? C.muted : '#a8a39b' }}>Relancer vers le</span>
                  <FrenchDateInput aria-label="Date de relance" floating value={lead.recontact_date || ''} style={{ width: 150 }}
                    onChange={async (date) => {
                      if (!date || date === lead.recontact_date) return;
                      const before = lead.recontact_date;
                      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, recontact_date: date } : l));
                      try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { recontact_date: date }); }
                      catch { setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, recontact_date: before } : l)); }
                    }} />
                </div>
              )}
              {activeCat.key === 'not_relevant' && lead.not_relevant_at && (
                <div style={{ fontSize: 11.5, fontWeight: 500, color: C.muted, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#f87171' }}>✕</span> Non pertinent depuis le {new Date(lead.not_relevant_at).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              )}

              {/* ═══ OTHER TABS: Déplacer vers (not for signed) ═══ */}
              {!['new', 'r1', 'r2', 'r3', 'signed', 'callback', 'voicemail'].includes(activeCat.key) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap', color: darkMode ? C.muted : '#a8a39b' }}>Déplacer vers</span>
                  <select value=""
                    onChange={(e) => { if (e.target.value) handleStatusChange(lead.id, e.target.value); }}
                    style={selectStyle}
                  >
                    <option value="" disabled>Choisir...</option>
                    {CATEGORIES.filter(cat => {
                      if (cat.key === activeCat.key || cat.key === 'signed') return false;
                      // Répondeurs & Non-pertinents can only go back to Nouveaux leads
                      if (activeCat.key === 'not_relevant') return cat.key === 'new';
                      if (activeCat.key === 'to_recontact') return cat.key === 'new';
                      if (activeCat.key === 'voicemail' || activeCat.key === 'callback') return cat.key === 'new' || cat.key === 'not_relevant';
                      return true;
                    }).map(cat => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* ═══ SMS : boutons Lapin et Répondeur (dev 08/10/2026) ═══ */}
              <LeadSmsActions lead={lead} catKey={activeCat.key} C={C} darkMode={darkMode}
                onUpdate={(patch) => setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, ...patch } : l))} />

              {/* ═══ PLACE R3 (R2 tab, after R2 effectué, only if R3 enabled) ═══ */}
              {activeCat.key === 'r2' && lead.r2_result === 'done' && calSettings?.r3_enabled && !isGuidedLead(lead) && (() => {
                const wfR3 = activeWorkflow?.leadId === lead.id && activeWorkflow?.r2Result === 'r3_set' ? activeWorkflow : null;
                return (
                  <div style={{ marginBottom: 16 }}>
                    {!wfR3 ? (
                      <button onClick={() => setActiveWorkflow({ leadId: lead.id, r2Result: 'r3_set', newDate: '' })} style={{
                        width: '100%', padding: '10px 16px', borderRadius: 50,
                        border: `1px solid ${darkMode ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.25)'}`,
                        background: darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
                        color: '#8b5cf6', fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)'; e.currentTarget.style.transform = 'scale(1)'; }}
                      ><span style={{ fontSize: 15, lineHeight: 1 }}>📅</span> Placer un R3</button>
                    ) : (
                      <div style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '16px 18px', borderRadius: 16,
                        background: darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
                        border: `1px solid ${darkMode ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.12)'}`,
                        animation: 'wfDateCardIn 0.3s cubic-bezier(0.25,0.1,0.25,1) both',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 15 }}>📅</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#8b5cf6' }}>Planifier le R3</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Date</div>
                            <input type="date" value={wfR3.newDate ? wfR3.newDate.slice(0, 10) : ''}
                              onChange={(e) => { const time = wfR3.newDate?.slice(10) || 'T09:00'; setActiveWorkflow(prev => ({ ...prev, newDate: e.target.value + time })); }}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12.5, fontWeight: 500, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: 'inherit', outline: 'none' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 9.5, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Heure</div>
                            <TimeSelect value={wfR3.newDate?.slice(11, 16) || '09:00'} onChange={(t) => { const date = wfR3.newDate?.slice(0, 10) || parisToday(); setActiveWorkflow(prev => ({ ...prev, newDate: date + 'T' + t })); }} C={C} darkMode={darkMode} />
                          </div>
                        </div>
                        {wfR3.newDate && wfR3.newDate.length >= 10 && (
                          <button onClick={() => handleWorkflowSubmit(lead.id, { r2_result: 'done', r2_completed_at: lead.r2_completed_at || new Date().toISOString(), r3_date: wfR3.newDate, status: 'r3' })}
                            style={{ padding: '10px 20px', borderRadius: 50, border: 'none', background: '#8b5cf6', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'transform 0.15s, box-shadow 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(139,92,246,0.35)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >Confirmer → R3</button>
                        )}
                        <button onClick={() => setActiveWorkflow(null)}
                          style={{ padding: '4px 0', border: 'none', background: 'transparent', color: C.muted, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'center', opacity: 0.7 }}
                        >← Retour</button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Contract status stays visible when sent directly from R1. */}
              {(activeCat.key === 'r2' || activeCat.key === 'r3' || (activeCat.key === 'r1' && leadContracts[lead.id]?.length > 0)) && (() => {
                const hasRange = !!lead.employee_range || !!intakeContexts[lead.id]?.required;
                const hasCompanyCount = !!lead.company_count;
                const isSending = sendingContract === lead.id;
                const isResending = resendingContract === lead.id;
                const contracts = leadContracts[lead.id] || [];
                const latestContract = contracts[0] || null;
                const status = latestContract?.yousign_status;
                const isCanceling = cancelingContract === latestContract?.id;
                // État du contrat en étiquette pastel à point (11/11/2026, style Owner) : fond, texte, liseré.
                const STATUS_TAGS = darkMode
                  ? { ongoing: ['rgba(59,130,246,.14)', '#8fb8ee', 'rgba(59,130,246,.26)'], done: ['rgba(16,185,129,.14)', '#7cc49b', 'rgba(16,185,129,.25)'], expired: ['rgba(251,146,60,.14)', '#e8a877', 'rgba(251,146,60,.26)'], failed: ['rgba(239,68,68,.14)', '#f3a6a3', 'rgba(239,68,68,.26)'] }
                  : { ongoing: ['#e4f0fd', '#1b6fd0', '#c9e0fa'], done: ['#e2f6ea', '#0b7a4b', '#c3ebd3'], expired: ['#fde9da', '#c2500e', '#f8d4ba'], failed: ['#fde6e6', '#c5221f', '#f6caca'] };
                const STATUS_LABELS = { ongoing: 'En attente de signature', done: 'Signé', expired: 'Expiré', canceled: 'Annulé', failed: 'Erreur', draft: 'Brouillon' };
                const badgeTone = STATUS_TAGS[status] || (darkMode ? ['#262626', '#a3a3a3', '#3a3a3a'] : ['#f1eee9', '#4a4540', '#e3ded6']);
                const badgeLabel = STATUS_LABELS[status] || status;
                const dangerInk = darkMode ? '#f3a6a3' : '#c5221f';
                const dangerSoft = darkMode ? 'rgba(239,68,68,.14)' : '#fde6e6';
                const contractNote = { fontSize: 12, color: C.muted, lineHeight: 1.5 };
                const daysLeft = latestContract?.expiry_date ? Math.ceil((new Date(latestContract.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                const actionBtnStyle = (color) => ({
                  padding: '6px 11px', borderRadius: 9, border: `1px solid ${C.border}`,
                  background: C.bg, color, fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease', fontFamily: 'inherit',
                });
                return (
                  <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 9, ...(latestContract ? { background: C.subtle, borderRadius: 14, padding: '12px 14px' } : {}) }}>

                    {latestContract && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px',
                          borderRadius: 7, fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
                          background: badgeTone[0], color: badgeTone[1], border: `1px solid ${badgeTone[2]}`,
                        }}><span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />{badgeLabel}</span>
                        {status === 'ongoing' && daysLeft !== null && <span style={{ fontSize: 12, color: C.muted }}>expire dans {daysLeft} jour{daysLeft !== 1 ? 's' : ''}</span>}
                        {status === 'done' && latestContract.signed_at && <span style={{ fontSize: 12, color: C.muted }}>le {formatDate(latestContract.signed_at)}</span>}
                        {status === 'expired' && latestContract.expired_at && <span style={{ fontSize: 12, color: C.muted }}>le {formatDate(latestContract.expired_at)}</span>}
                        {status === 'canceled' && latestContract.canceled_at && <span style={{ fontSize: 12, color: C.muted }}>le {formatDate(latestContract.canceled_at)}</span>}
                        {status === 'ongoing' && <span style={{ flexBasis: '100%', ...contractNote }}>{contractSentLine(latestContract, contractSenders)}.</span>}
                        {['canceled', 'expired', 'failed'].includes(status) && isGuidedLead(lead) && <span style={{ flexBasis: '100%', ...contractNote }}>Pour envoyer un nouveau contrat, rouvrez la qualification du rendez-vous et poursuivez vers le contrat.</span>}
                        {status === 'failed' && latestContract.yousign_error && <span style={{ flexBasis: '100%', ...contractNote, color: dangerInk }}>{presentContractError(latestContract.yousign_error, { pilot: !!intakeContexts[lead.id]?.required }).message}</span>}
                      </div>
                    )}
                    {/* View contract PDFs */}
                    {latestContract && (status === 'ongoing' || status === 'done') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(latestContract.documents || [{ doc_type: 'owner', name: 'Convention Owner' }]).filter(doc => doc.doc_type === 'owner').map(doc => { const docType = doc.doc_type; return (
                          <button key={docType} onClick={async () => {
                            try {
                              const token = apiClient.getToken();
                              const resp = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.ownertechnology.com'}/api/v1/contracts/${latestContract.id}/download/${docType}`, {
                                headers: { 'Authorization': `Bearer ${token}` },
                              });
                              if (!resp.ok) throw new Error('Download failed');
                              const blob = await resp.blob();
                              window.open(URL.createObjectURL(blob), '_blank');
                            } catch (e) { alert('Erreur lors du téléchargement du contrat'); console.error(e); }
                          }} title="Ouvrir le contrat" style={{
                            padding: '6px 11px', borderRadius: 9, border: `1px solid ${C.border}`,
                            background: C.bg, color: C.text, fontSize: 12, fontWeight: 500,
                            cursor: 'pointer', transition: 'border-color 0.15s ease', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                            {doc.name || 'Convention Owner'}
                          </button>
                        ); })}
                        {/* Annuler : discret, à droite ; la raison se lit au survol et dans la confirmation. */}
                        {status === 'ongoing' && (
                          <button onClick={() => !isCanceling && handleCancelContract(latestContract.id, lead.id)} disabled={isCanceling}
                            title="En cas d’erreur, annulez-le pour pouvoir en envoyer un autre"
                            style={{ marginLeft: 'auto', padding: '6px 9px', borderRadius: 9, border: 'none', background: 'transparent', color: dangerInk, fontSize: 12, fontWeight: 500, cursor: isCanceling ? 'default' : 'pointer', transition: 'background 0.15s ease', fontFamily: 'inherit' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = dangerSoft; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >{isCanceling ? 'Annulation…' : 'Annuler le contrat'}</button>
                        )}
                      </div>
                    )}

                    {/* Date du contrat, facultative, visible seulement quand l'envoi
                        est possible. Laissée vide, le contrat part daté du jour comme
                        avant. Remplie, c'est elle qui s'imprime dans le bloc de
                        signature des deux documents. Elle ne touche que le papier :
                        la date de signature CRM et les commissions restent réelles. */}
                    {!isGuidedLead(lead) && (!latestContract || ['draft', 'expired', 'canceled', 'failed'].includes(status)) && (() => {
                      const iso = contractDates[lead.id] || '';
                      // Date saisie à la main : on découpe la chaîne, jamais de
                      // new Date() qui décalerait d'un jour selon le fuseau.
                      const fr = iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>Date du contrat</span>
                          <input
                            type="date"
                            value={iso}
                            onChange={(e) => setContractDates(prev => ({ ...prev, [lead.id]: e.target.value }))}
                            style={{
                              padding: '4px 8px', borderRadius: 8,
                              border: `1px solid ${iso ? C.accent : C.border}`,
                              background: 'transparent', color: C.text,
                              fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                              transition: 'border-color 0.15s',
                            }}
                          />
                          <span style={{ fontSize: 10.5, color: iso ? C.accent : C.muted, transition: 'color 0.15s' }}>
                            {iso ? `Le contrat portera la date du ${fr}` : "Facultatif : vide, le contrat porte la date du jour"}
                          </span>
                          {iso && (
                            <button
                              onClick={() => setContractDates(prev => { const n = { ...prev }; delete n[lead.id]; return n; })}
                              style={{
                                padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.border}`,
                                background: 'transparent', color: C.muted, fontSize: 10,
                                fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                            >Effacer</button>
                          )}
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {!isGuidedLead(lead) && (status === 'expired' || status === 'canceled' || status === 'failed') && (
                        <button onClick={() => !isResending && handleResendContract(latestContract.id, lead.id)} disabled={isResending}
                          style={actionBtnStyle(C.text)}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                        >{isResending ? 'Renvoi...' : (status === 'failed' ? 'Réessayer' : 'Renvoyer')}</button>
                      )}
                      {/* First time — no contract ever sent */}
                      {!isGuidedLead(lead) && !latestContract && (
                        <>
                          {!isGuidedLead(lead) && <button onClick={() => openNdaPopup(lead)}
                            style={actionBtnStyle(C.text)}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                          >Générer NDA</button>}
                          <button
                            onClick={() => hasRange && !isSending ? handleSendContract(lead) : null}
                            disabled={!hasRange || isSending}
                            title={!hasRange ? "Sélectionnez une tranche salariale d'abord" : ''}
                            style={{
                              padding: '7px 12px', borderRadius: 9, border: 'none',
                              background: hasRange && !isSending ? C.accent : (darkMode ? '#2e2e2e' : '#ece9e4'),
                              color: hasRange && !isSending ? C.onAccent : C.muted,
                              fontSize: 12, fontWeight: 500,
                              cursor: hasRange && !isSending ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s', fontFamily: 'inherit',
                              opacity: hasRange && !isSending ? 1 : 0.6,
                              ...(isGuidedLead(lead)?{width:'100%',padding:'13px 16px',borderRadius:12,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:8}:{}),
                            }}
                          >{isSending ? 'Préparation…' : isGuidedLead(lead) ? 'Préparer le contrat' : 'Envoyer le contrat'}{isGuidedLead(lead)&&<ArrowRight size={17}/>}</button>
                        </>
                      )}
                      {/* Draft — treat like no contract */}
                      {!isGuidedLead(lead) && latestContract && status === 'draft' && (
                        <>
                          {!isGuidedLead(lead) && <button onClick={() => openNdaPopup(lead)}
                            style={actionBtnStyle(C.text)}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                          >Générer NDA</button>}
                          <button
                            onClick={() => hasRange && !isSending ? handleSendContract(lead) : null}
                            disabled={!hasRange || isSending}
                            style={{
                              padding: '7px 12px', borderRadius: 9, border: 'none',
                              background: hasRange && !isSending ? C.accent : (darkMode ? '#2e2e2e' : '#ece9e4'),
                              color: hasRange && !isSending ? C.onAccent : C.muted,
                              fontSize: 12, fontWeight: 500,
                              cursor: hasRange && !isSending ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s', fontFamily: 'inherit',
                              opacity: hasRange && !isSending ? 1 : 0.6,
                              ...(isGuidedLead(lead)?{width:'100%',padding:'13px 16px',borderRadius:12,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',gap:8}:{}),
                            }}
                          >{isSending ? 'Préparation…' : isGuidedLead(lead) ? 'Préparer le contrat' : 'Envoyer le contrat'}{isGuidedLead(lead)&&<ArrowRight size={17}/>}</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ═══ SIGNED TAB: Onboarding + Lancement + Déclarer vente ═══ */}
              {activeCat.key === 'signed' && (() => {
                // Les dates Onboarding/Lancement se choisissent désormais DANS le pop-up
                // de déclaration (créneaux libres de l'agenda) -> le bouton est actif dès
                // qu'un lead est signé. Les pickers libres ci-dessus restent pour la
                // reprogrammation APRÈS déclaration.
                const canDeclare = true;
                // Les pickers date/heure libres n'apparaissent qu'APRÈS déclaration (dates
                // posées) -> avant, seul le bouton Déclarer (qui ouvre le pop-up créneaux).
                const rdvDatesSet = canRescheduleAfterSale(lead, intakeJourneys[lead.id]);
                // Date d'onboarding réservée (partie 1 de la déclaration) : lisible et reprogrammable AVANT la déclaration de la vente.
                const onbDate = onboardingDateOf(lead, intakeJourneys[lead.id]);
                const onbAwaiting = onboardingAwaitingConfirmation(lead, intakeJourneys[lead.id]);
                // Statut contrats (Owner + Opti'Lex) — depuis la donnée du lead (marche en vue admin, sans fetch user-scopé).
                const _ownerDone = !!lead.contract_signed_at;   // onglet Signés -> Owner signé
                const _ol = lead.contract_optilex_status;        // null = contrat groupé (pré-split), pas de statut Opti'Lex séparé
                // Étiquettes pastel du style Owner (11/11/2026) : fond, texte, liseré.
                const SIGN_TONES = darkMode
                  ? { vert: ['rgba(16,185,129,.14)', '#7cc49b', 'rgba(16,185,129,.25)'], bleu: ['rgba(59,130,246,.14)', '#8fb8ee', 'rgba(59,130,246,.26)'], peche: ['rgba(251,146,60,.14)', '#e8a877', 'rgba(251,146,60,.26)'], rouge: ['rgba(239,68,68,.14)', '#f3a6a3', 'rgba(239,68,68,.26)'], beige: ['#262626', '#a3a3a3', '#3a3a3a'] }
                  : { vert: ['#e2f6ea', '#0b7a4b', '#c3ebd3'], bleu: ['#e4f0fd', '#1b6fd0', '#c9e0fa'], peche: ['#fde9da', '#c2500e', '#f8d4ba'], rouge: ['#fde6e6', '#c5221f', '#f6caca'], beige: ['#f1eee9', '#4a4540', '#e3ded6'] };
                const OL_COLORS = { done: 'vert', ongoing: 'bleu', scheduled: 'bleu', awaiting_owner_signature: 'beige', expired: 'peche', canceled: 'beige', failed: 'rouge' };
                const signTag = (tone) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 7, fontSize: 11.5, fontWeight: 500, whiteSpace: 'nowrap',
                  background: SIGN_TONES[tone][0], color: SIGN_TONES[tone][1], border: `1px solid ${SIGN_TONES[tone][2]}` });
                const signLabel = { fontSize: 10, fontWeight: 500, color: darkMode ? C.muted : '#a8a39b', textTransform: 'uppercase', letterSpacing: '0.09em' };
                const OL_LABELS = { done: 'Signé', ongoing: 'En attente de signature', scheduled: 'Envoi programmé', awaiting_owner_signature: 'En attente', expired: 'Expiré', canceled: 'Annulé', failed: 'Erreur' };
                // Split -> vrai statut Opti'Lex (signal de relance). Groupé (null) + Owner signé -> signé dans l'enveloppe Owner.
                const _grouped = !_ol && _ownerDone;
                const olTone = _ol ? (OL_COLORS[_ol] || 'beige') : (_grouped ? 'vert' : 'beige');
                const olLabel = _ol ? (OL_LABELS[_ol] || _ol) : (_grouped ? 'Signé (inclus au contrat Owner)' : '—');
                return (
                  <div style={{ marginBottom: 16 }}>

                    {_ownerDone && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ ...signLabel, marginBottom: 8 }}>Contrats</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={signTag('vert')}>
                            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />Owner : Signé
                          </span>
                          <span style={signTag(olTone)}>
                            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />Opti'Lex : {olLabel}
                          </span>
                          {_ol === 'done' && lead.contract_optilex_signed_at && <span style={{ fontSize: 11, color: C.muted }}>signé le {formatDate(lead.contract_optilex_signed_at)}</span>}
                        </div>
                      </div>
                    )}
                    <div style={{ ...signLabel, marginBottom: 10 }}>Post-signature</div>

                    {!rdvDatesSet && onbAwaiting && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '8px 12px', borderRadius: 12, background: C.subtle }}>
                        <span style={{ ...signLabel, whiteSpace: 'nowrap' }}>Onboarding</span>
                        <span role="status" style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: C.text }}>{fmtRdvLabel(onbDate)} · Réservation en cours de confirmation</span>
                      </div>
                    )}
                    {rdvDatesSet && (<>
                    {/* Reprogrammation disponible dès la réservation confirmée, avant comme après la déclaration de la vente. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '8px 12px', borderRadius: 12, background: C.subtle,
                      }}>
                        <span style={{ ...signLabel, whiteSpace: 'nowrap' }}>Onboarding</span>
                        <button type="button" onClick={() => setReschedRdv({ leadId: lead.id, kind: 'onboarding', twoStage: isSignedPilot(lead) })}
                          title="Reprogrammer (créneaux libres de l'agenda)"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8,
                            border: `1px solid ${C.border}`, background: C.bg, color: onbDate ? C.text : C.muted,
                            fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}>
                          <span>{onbDate ? `${fmtRdvLabel(onbDate)} · Reprogrammer` : 'Choisir un créneau'}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {rescheduleNotice?.leadId === lead.id && <p role="status" style={{color:C.text,fontSize:13}}>{rescheduleNotice.message}</p>}
                    {/* RDV Lancement : contrats historiques uniquement */}
                    {intakeJourneys[lead.id]?.onboarding_only === false && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '8px 12px', borderRadius: 12, background: C.subtle,
                      }}>
                        <span style={{ ...signLabel, whiteSpace: 'nowrap' }}>Lancement</span>
                        <button type="button" onClick={() => setReschedRdv({ leadId: lead.id, kind: 'lancement' })}
                          title="Reprogrammer (créneaux libres de l'agenda)"
                          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8,
                            border: `1px solid ${C.border}`, background: C.bg, color: lead.rdv_lancement_date ? C.text : C.muted,
                            fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'border-color 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.muted; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}>
                          <span>{lead.rdv_lancement_date ? fmtRdvLabel(lead.rdv_lancement_date) : 'Choisir un créneau'}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </button>
                      </div>
                    </div>}
                    </>)}


                    {/* Déclarer une vente button */}
                    <button className={isSignedPilot(lead)?'sj-declare-sale':undefined}
                      onClick={async () => {
                        if (!canDeclare) return;
                        try {
                          const journey = await apiClient.get(`/api/v1/owner-integration/leads/${lead.id}/journey`);
                          setSaleOnboardingOnly(journey.onboarding_only);
                          setSaleReservationError('');
                          const saved = journey.onboarding_only ? await apiClient.get(`/api/v1/owner-integration/leads/${lead.id}/sale-preparation`) : {preparation:null};
                          setSalePreparation(saved.preparation);
                          if (saved.preparation) {
                            setSaleIntake(null); applySalePreparation(lead.id, saved.preparation); setShowSaleModal(lead.id); return;
                          }
                          setIntakeJourneys(previous => ({ ...previous, [lead.id]: journey }));
                        } catch (error) {
                          setContractErrorModal({ message: error.message || 'Impossible de vérifier le parcours de ce dossier. Réessayez.', isNdaMissing: false });
                          return;
                        }
                        setSaleForm({ email: lead.email || '', paymentModality: 'M', employeeRange: lead.employee_range || '', billingStructures: '', structuresCount: '', discount: null, discountValue: '' });
                        setSaleIntake(null); setSaleStep('form'); setSaleSlots({ onboarding: null, lancement: null });
                        setShowSaleModal(lead.id);
                      }}
                      disabled={!canDeclare}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '10px 16px', borderRadius: 10, border: 'none', cursor: canDeclare ? 'pointer' : 'default',
                        background: canDeclare ? C.accent : (darkMode ? '#2e2e2e' : '#ece9e4'),
                        color: canDeclare ? C.onAccent : C.muted,
                        fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                        transition: 'all 0.2s ease', opacity: canDeclare ? 1 : 0.6,
                      }}
                      onMouseEnter={(e) => { if (canDeclare) e.currentTarget.style.opacity = '0.88'; }}
                      onMouseLeave={(e) => { if (canDeclare) e.currentTarget.style.opacity = '1'; }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      <span>{intakeJourneys[lead.id]?.preparation?.status === 'finalized' ? 'Vente déclarée' : intakeJourneys[lead.id]?.preparation ? 'Finaliser la déclaration' : 'Déclarer une vente'}{isSignedPilot(lead)&&<small>{intakeJourneys[lead.id]?.preparation?.status === 'finalized' ? 'Consulter la confirmation' : intakeJourneys[lead.id]?.preparation ? 'Reprendre le dossier enregistré' : 'Réserver le rendez-vous, puis finaliser le dossier'}</small>}</span>{isSignedPilot(lead)&&<ArrowRight size={20}/>}
                    </button>
                    {!canDeclare && (
                      <div style={{ fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
                        Remplissez les dates Onboarding et Lancement pour déclarer
                      </div>
                    )}

                    <div style={{ height: 1, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '14px 0 12px' }} />
                  </div>
                );
              })()}

              {/* ═══ REASSIGN (killed sheet or invitation) ═══ */}
              {isAdminView && (viewingSheetStatus === 'killed' || myInvitations.some(inv => inv.sheet_email === viewingSheetId)) && (
                <div style={{ marginTop: 16, padding: '14px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                    Réaffecter ce lead
                  </div>
                  {reassignTarget?.leadId === lead.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <select
                        onChange={(e) => { if (e.target.value) handleReassignLead(lead.id, e.target.value); }}
                        defaultValue=""
                        style={{
                          width: '100%', padding: '9px 12px', borderRadius: 10,
                          border: `1px solid ${C.border}`, background: darkMode ? C.subtle : '#fff',
                          color: C.text, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled>Choisir un destinataire...</option>
                        {assignableUsers.map(u => (
                          <option key={u.email} value={u.email}>{u.full_name || u.name} — {u.email}</option>
                        ))}
                      </select>
                      <button onClick={() => setReassignTarget(null)} style={{
                        padding: '6px 0', borderRadius: 8, border: `1px solid ${C.border}`,
                        background: 'transparent', color: C.muted, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>Annuler</button>
                    </div>
                  ) : (
                    <button onClick={async () => {
                      setReassignTarget({ leadId: lead.id });
                      if (assignableUsers.length === 0) {
                        try {
                          const resp = await apiClient.getAssignableUsers();
                          setAssignableUsers(Array.isArray(resp) ? resp : (resp?.users || []));
                        } catch {}
                      }
                    }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '10px 14px', borderRadius: 10,
                      border: `1px solid ${darkMode ? 'rgba(139,92,246,0.25)' : 'rgba(139,92,246,0.2)'}`,
                      background: darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
                      color: '#8b5cf6', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#8b5cf6'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)'; e.currentTarget.style.color = '#8b5cf6'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
                      </svg>
                      Réaffecter
                    </button>
                  )}
                </div>
              )}

              {/* ─── OPTIONS (convention v2 : sociétés couvertes / société en création) ─── */}
              {!isGuidedLead(lead) && !(activeCat.key === 'signed' && isSignedPilot(lead)) && <div style={{ marginTop: 18, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                <button
                  onClick={() => {
                    const next = !detailOptionsOpen;
                    setDetailOptionsOpen(next);
                    if (next && coveredCompanies === null) loadCoveredCompanies(lead.id);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                    border: 'none', background: 'transparent', color: C.muted,
                    fontSize: 11.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    letterSpacing: '0.02em',
                  }}
                >
                  <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: detailOptionsOpen ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▸</span>
                  Options
                </button>

                {detailOptionsOpen && (
                  <div style={{ padding: '8px 4px 4px' }}>
                    {/* Société en création */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.secondary, cursor: 'pointer', marginBottom: 12 }}>
                      <input type="checkbox" checked={!!lead.company_in_creation} onChange={() => toggleLeadInCreation(lead)} style={{ cursor: 'pointer' }} />
                      Société en cours de création (pas encore de SIREN)
                    </label>

                    {/* Sociétés couvertes (Annexe 1 de la convention Opti'Lex) */}
                    <div style={{ fontSize: 11, fontWeight: 500, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Sociétés couvertes par la convention
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
                      Toutes cochées par défaut — décochez celles sur lesquelles le client ne souhaite pas être suivi. Seules les cochées figurent dans l'annexe de la convention Opti'Lex.
                    </div>
                    {coveredLoading && <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>Chargement…</div>}
                    {!coveredLoading && coveredCompanies && coveredCompanies.length === 0 && (
                      <div style={{ fontSize: 12, color: C.muted, padding: '6px 0' }}>
                        Aucune société référencée — elles seront récupérées automatiquement à la génération du NDA.
                      </div>
                    )}
                    {!coveredLoading && coveredCompanies && coveredCompanies.map((cc) => (
                      <label key={cc.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8,
                        cursor: 'pointer', marginBottom: 4,
                        background: cc.selected ? (darkMode ? 'rgba(52,211,153,0.06)' : 'rgba(52,211,153,0.05)') : 'transparent',
                        border: `1px solid ${cc.selected ? (darkMode ? 'rgba(52,211,153,0.25)' : 'rgba(52,211,153,0.2)') : C.border}`,
                        opacity: cc.selected ? 1 : 0.6, transition: 'all 0.15s',
                      }}>
                        <input type="checkbox" checked={cc.selected} onChange={() => toggleCoveredCompany(lead.id, cc)} style={{ cursor: 'pointer' }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cc.denomination}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>{cc.siren ? `SIREN ${cc.siren}` : 'SIREN inconnu'}{cc.source === 'manual' ? ' · ajout manuel' : ''}</div>
                        </div>
                      </label>
                    ))}

                    {/* Ajout manuel */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <input value={manualCompany.denomination} placeholder="Ajouter une société…"
                        onChange={(e) => setManualCompany(prev => ({ ...prev, denomination: e.target.value }))}
                        style={{ flex: 2, padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: darkMode ? '#181818' : '#fff', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', minWidth: 0 }} />
                      <input value={manualCompany.siren} placeholder="SIREN"
                        onChange={(e) => setManualCompany(prev => ({ ...prev, siren: e.target.value.replace(/[^\d\s]/g, '') }))}
                        style={{ flex: 1, padding: '6px 9px', borderRadius: 8, border: `1px solid ${C.border}`, background: darkMode ? '#181818' : '#fff', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', minWidth: 0 }} />
                      <button onClick={() => addManualCoveredCompany(lead.id)} disabled={!manualCompany.denomination.trim()}
                        style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: manualCompany.denomination.trim() ? C.accent : C.muted, color: C.onAccent, fontSize: 12, fontWeight: 500, cursor: manualCompany.denomination.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>+</button>
                    </div>
                  </div>
                )}
              </div>}
              </div>{/* fin du volet Infos, 2e partie */}

            </div>{/* end detail padding */}
          </div>,
          detailContainerRef.current
          );
        })()}

        </div>
        )}

          </div>{/* end right main */}
        </div>{/* end inner board */}
          </div>{/* end main content card */}
          </div>{/* end inner board wrapper */}

          {/* ── DETAIL PANEL AREA (portal only) ──────────────────────────────── */}
          <div style={{
            width: selectedLead ? 396 : 0,
            flexShrink: 0,
            overflow: selectedLead ? 'visible' : 'hidden',
            transition: 'width 0.45s cubic-bezier(0.4,0,0.2,1), margin-left 0.45s cubic-bezier(0.4,0,0.2,1)',
            marginLeft: selectedLead ? 12 : 0,
            position: 'sticky',
            top: 8,
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 120px)',
          }}>
            {/* Portal target */}
            <div
              ref={detailContainerRef}
              style={{
                height: '100%',
                overflow: 'hidden',
                position: 'relative',
                borderRadius: 18,
                border: `1px solid ${C.border}`,
                background: C.bg,
              }}
            />
          </div>

          </div>{/* end content row */}
        </div>{/* end right column */}

        </div>{/* end flex row */}
      </div>{/* end outer wrapper */}

      {/* ════ MODAL: ADD LEAD ═══════════════════════════════════════════════ */}
      {showAddLeadModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: C.veil,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'modalOverlayIn 0.2s ease both',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddLeadModal(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto',
            background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow,
            padding: '28px 28px 24px',
            animation: 'modalCardInFlex 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 500, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Ajouter un lead</h2>
                <p style={{ fontSize: 12, color: C.muted, margin: '3px 0 0' }}>Créez un nouveau lead pour le cold call</p>
              </div>
              <button onClick={() => setShowAddLeadModal(false)} style={{
                width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`,
                background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, lineHeight: 1, fontFamily: 'inherit', transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
              >×</button>
            </div>

            {/* Form fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'full_name', label: 'Nom complet *', placeholder: 'Jean Dupont', type: 'text' },
                { key: 'phone', label: 'Téléphone *', placeholder: '06 12 34 56 78', type: 'tel' },
                { key: 'email', label: 'Email', placeholder: 'jean@example.com', type: 'email' },
                { key: 'sector', label: "Secteur d'activité", placeholder: 'Sélectionner...', type: 'select', options: ["Ambulance","Micro crèche","Dentiste","Pharmacie","Salle de sport","Esthétique","Tech","Hôtellerie","Grande Distribution","Tertiaire","BTP","Boulangerie","Immobilier","Restauration","Générales"] },
                { key: 'company_type', label: "Type d'entreprise", placeholder: 'Sélectionner...', type: 'select', options: ["SARL","SAS","SASU","SA","EURL","SCI","SNC","EI"] },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: 11.5, fontWeight: 500, color: C.secondary, marginBottom: 5, display: 'block' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.key]}
                      onChange={(e) => handleFormChange(field.key, e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10,
                        fontSize: 13, fontWeight: 500,
                        border: `1px solid ${C.border}`,
                        background: darkMode ? '#181818' : '#fff', color: formData[field.key] ? C.text : C.muted,
                        outline: 'none', fontFamily: 'inherit',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxSizing: 'border-box', cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(C.muted)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 12px center',
                        paddingRight: 36,
                      }}
                      onFocus={(e) => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                      onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
                    >
                      <option value="" disabled>{field.placeholder}</option>
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.key]}
                      onChange={(e) => handleFormChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: 10,
                        fontSize: 13, fontWeight: 500,
                        border: `1px solid ${C.border}`,
                        background: darkMode ? '#181818' : '#fff', color: C.text,
                        outline: 'none', fontFamily: 'inherit',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = `0 0 0 3px ${C.accent}15`; }}
                      onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.boxShadow = 'none'; }}
                    />
                  )}
                </div>
              ))}

              {formError && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: 0, fontWeight: 500 }}>{formError}</p>
              )}

              <button
                onClick={async () => {
                  const ok = await handleFormSubmit();
                  if (ok) setTimeout(() => setShowAddLeadModal(false), 1200);
                }}
                disabled={formSubmitting}
                style={{
                  width: '100%', padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: formSubmitting ? C.muted : (darkMode ? '#fff' : '#2b2927'),
                  color: darkMode ? '#141414' : '#fff', fontSize: 13, fontWeight: 500,
                  cursor: formSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                  opacity: formSubmitting ? 0.7 : 1, marginTop: 2,
                }}
                onMouseEnter={(e) => { if (!formSubmitting) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                {formSubmitting ? 'Ajout en cours...' : 'Ajouter le lead'}
              </button>

              {formSuccess && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)',
                  border: `1px solid ${darkMode ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  animation: 'toastSlideIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'successPulse 0.4s ease both', flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" fill="#10b981" opacity="0.15" />
                    <path d="M7 12.5l3 3 7-7" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray="24" strokeDashoffset="0" style={{ animation: 'checkmarkDraw 0.5s ease 0.15s both' }} />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#10b981' }}>Lead ajouté avec succès</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── NDA GENERATION POPUP ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {ndaPopup && ndaData && createPortal((() => {
        const lead = leads.find(l => l.id === ndaPopup.leadId);
        if (!lead) return null;
        const inputStyle = {
          width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
          border: `1px solid ${C.border}`, background: darkMode ? '#181818' : '#faf9f7',
          color: C.text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color 0.2s',
        };
        const labelStyle = { fontSize: isGuidedLead(lead) ? 11 : 9.5, fontWeight: 500, color: isGuidedLead(lead) ? C.secondary : C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 };
        const selectStyle = {
          ...inputStyle, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(C.muted)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: 30,
        };
        // ── Coquille commune (overlay + carte + header) des étapes du flux ──
        const stepShell = (children) => (
          <div className={isGuidedLead(lead)?`sj-nda-overlay ${darkMode?"sj-dark":""}`:undefined}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: C.veil,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'modalOverlayIn 0.25s ease both',
            }}
            onClick={(e) => { if (e.target === e.currentTarget && !ndaGenerating) { ndaRequest.current++;setNdaPopup(null); setNdaData(null); } }}
          >
            <div className={isGuidedLead(lead)?"sj-nda-dialog ts-scroll-card":"ts-scroll-card"} role="dialog" aria-modal="true" aria-label="Préparer le NDA" style={{
              width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
              background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
              boxShadow: C.sheetShadow, padding: '24px 28px',
              animation: 'modalCardInFlex 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 14, background: darkMode ? '#262626' : '#f4f2ee', color: C.text, flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: darkMode ? C.muted : '#a8a39b' }}>Contrat</div>
                    <h3 style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>Générer le NDA</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.muted }}>{lead.full_name}{lead.company_name ? ` · ${lead.company_name}` : ''}</p>
                  </div>
                </div>
                <button disabled={ndaGenerating} aria-label="Fermer le NDA" onClick={() => { ndaRequest.current++;setNdaPopup(null); setNdaData(null); }}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                ><X size={14} strokeWidth={2} aria-hidden="true" /></button>
              </div>
              {isGuidedLead(lead)&&<NdaProgress step={ndaStep}/>}
              {children}
            </div>
          </div>
        );

        // ── ÉTAPE 1 : SIREN manquant — saisie directe ou société en création ──
        if (ndaStep === 'siren') {
          return stepShell(
            <>
              <div className={isGuidedLead(lead)?'sj-nda-intro':undefined} style={{
                padding: '12px 14px', borderRadius: 12, marginBottom: 16, fontSize: 12.5, lineHeight: 1.55,
                background: darkMode ? 'rgba(251,146,60,0.10)' : 'rgba(251,146,60,0.08)',
                border: `1px solid ${darkMode ? 'rgba(251,146,60,0.25)' : 'rgba(251,146,60,0.2)'}`, color: C.secondary,
              }}>
                <b style={{ color: C.text }}>Identifiez la société</b><br />
                Renseignez son SIREN pour retrouver ses informations et préremplir le NDA, ou indiquez qu’elle est en cours de création.
              </div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: C.muted, marginBottom: 5 }}>SIREN (9 chiffres)</label>
              <input
                value={ndaSirenInput}
                onChange={(e) => setNdaSirenInput(e.target.value.replace(/[^\d\s]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleNdaSirenContinue(); }}
                placeholder="123 456 789" autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
              {ndaError && <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444' }}>{ndaError}</div>}
              <button className={isGuidedLead(lead)?"sj-nda-primary":undefined} onClick={handleNdaSirenContinue} disabled={ndaLoading}
                style={{ width: '100%', marginTop: 14, padding: '11px 0', borderRadius: 10, border: 'none', background: C.accent, color: C.onAccent, fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >{ndaLoading ? 'Recherche…' : 'Continuer'}{isGuidedLead(lead)&&<ArrowRight size={17}/>}</button>
              <button className={isGuidedLead(lead)?"sj-nda-secondary":undefined} disabled={ndaLoading} onClick={handleNdaInCreation}
                style={{ width: '100%', marginTop: 8, padding: '10px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >En cours d’immatriculation (pas encore de SIREN)</button>
            </>
          );
        }

        // ── ÉTAPE 2 : plusieurs dirigeants — qui a-t-il en face de lui ? ──
        if (ndaStep === 'dirigeants') {
          return stepShell(
            <>
              <div style={{ fontSize: 12.5, color: C.secondary, marginBottom: 12, lineHeight: 1.55 }}>
                Cette société a <b style={{ color: C.text }}>{ndaDirigeants.length} dirigeants</b>.
                Sélectionnez la ou les personnes avec qui vous êtes en contact — elles figureront sur le NDA et la convention.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {ndaDirigeants.map((d, i) => {
                  const checked = ndaSelectedDirs.includes(i);
                  return (
                    <label key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${checked ? C.accent : C.border}`,
                      background: checked ? (darkMode ? 'rgba(99,102,241,0.10)' : 'rgba(43,41,39,0.06)') : 'transparent',
                      transition: 'all 0.15s',
                    }}>
                      <input type="checkbox" checked={checked} style={{ cursor: 'pointer' }}
                        onChange={() => setNdaSelectedDirs(prev => checked ? prev.filter(x => x !== i) : [...prev, i])} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{d.fullName}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>{d.role}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <button
                onClick={() => {
                  const sel = ndaSelectedDirs.map(i => ndaDirigeants[i]);
                  if (!sel.length) return;
                  setNdaData(prev => ({ ...prev, representatives: sel }));
                  setNdaStep('form');
                }}
                disabled={!ndaSelectedDirs.length}
                style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: ndaSelectedDirs.length ? C.accent : C.muted, color: C.onAccent, fontSize: 13.5, fontWeight: 500, cursor: ndaSelectedDirs.length ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
              >Continuer</button>
            </>
          );
        }

        return (
          <div className={isGuidedLead(lead)?`sj-nda-overlay ${darkMode?"sj-dark":""}`:undefined}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: C.veil,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'modalOverlayIn 0.25s ease both',
            }}
            onClick={(e) => { if (e.target === e.currentTarget && !ndaGenerating) { ndaRequest.current++;setNdaPopup(null); setNdaData(null); } }}
          >
            <div className={isGuidedLead(lead)?"sj-nda-dialog ts-scroll-card":"ts-scroll-card"} role="dialog" aria-modal="true" aria-label="Préparer le NDA" style={{
              width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
              background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
              boxShadow: C.sheetShadow, padding: '24px 28px',
              animation: 'modalCardInFlex 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 14, background: darkMode ? '#262626' : '#f4f2ee', color: C.text, flexShrink: 0 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: darkMode ? C.muted : '#a8a39b' }}>Contrat</div>
                    <h3 style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>Générer le NDA</h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: C.muted }}>{lead.full_name}{lead.company_name ? ` · ${lead.company_name}` : ''}</p>
                  </div>
                </div>
                <button disabled={ndaGenerating} aria-label="Fermer le NDA" onClick={() => { ndaRequest.current++;setNdaPopup(null); setNdaData(null); }}
                  style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                ><X size={14} strokeWidth={2} aria-hidden="true" /></button>
              </div>

              {isGuidedLead(lead)&&<NdaProgress step={ndaStep}/>}
              {/* Statut du prefill automatique (plus de bouton manuel — 2026-08-20) */}
              <div style={{
                display: 'flex', gap: 8, marginBottom: 16, padding: '12px 14px', borderRadius: 12,
                background: darkMode ? 'rgba(99,102,241,0.08)' : 'rgba(43,41,39,0.06)',
                border: `1px solid ${darkMode ? 'rgba(99,102,241,0.2)' : 'rgba(43,41,39,0.12)'}`,
              }}>
                <div style={{ flex: 1, fontSize: 12, color: C.secondary }}>
                  {ndaLoading
                    ? <span><span style={{ fontWeight: 500, color: C.accent }}>Recherche Pappers en cours…</span> les informations vont se préremplir.</span>
                    : ndaData.isInRegistration
                      ? <span><span style={{ fontWeight: 500, color: C.accent }}>Société en création</span> — pas de SIREN, remplissez les informations manuellement.</span>
                      : ndaSuccess
                        ? <span><span style={{ fontWeight: 500, color: darkMode ? '#7cc49b' : '#0b7a4b' }}>Informations préremplies via Pappers</span> — vérifiez et ajustez si besoin avant de générer.</span>
                        : <span><span style={{ fontWeight: 500, color: C.accent }}>Saisie manuelle</span> — le préremplissage automatique n'a pas abouti.</span>}
                </div>
              </div>


              {/* Pappers link */}
              {ndaPappersUrl && (
                <a href={ndaPappersUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: 'flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                  fontSize: 12, fontWeight: 500, color: C.text, textDecoration: 'none',
                  padding: '5px 10px', borderRadius: 9, marginTop: -4,
                  border: `1px solid ${C.border}`, background: C.bg,
                  transition: 'border-color 0.15s ease',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = C.muted}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Voir sur Pappers
                </a>
              )}

              {/* Success / Error messages */}
              {ndaSuccess && !isGuidedLead(lead) && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: darkMode ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.15)`, fontSize: 12, color: '#10b981', fontWeight: 500, animation: 'toastSlideIn 0.3s ease both' }}>
                  Informations pré-remplies avec succès
                </div>
              )}
              {ndaError && (
                <div role="alert" style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: darkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)', border: `1px solid rgba(239,68,68,0.15)`, fontSize: 12, color: '#ef4444', fontWeight: 500 }}>
                  {ndaError}
                </div>
              )}

              {/* Form fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Row 1: Raison sociale + Forme juridique */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
                  <div>
                    <div style={labelStyle}>Raison sociale *</div>
                    <input value={ndaData.legalName} onChange={(e) => setNdaData(prev => ({ ...prev, legalName: e.target.value }))}
                      style={inputStyle} placeholder="Nom de la société"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Forme juridique</div>
                    <select value={ndaData.legalForm} onChange={(e) => setNdaData(prev => ({ ...prev, legalForm: e.target.value }))} style={selectStyle}>
                      {NDA_LEGAL_FORMS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: SIREN + Ville RCS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={labelStyle}>SIREN *</div>
                    <input value={ndaData.siren} onChange={(e) => setNdaData(prev => ({ ...prev, siren: e.target.value }))}
                      style={inputStyle} placeholder="123 456 789" disabled={ndaData.isInRegistration}
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Ville RCS</div>
                    <input value={ndaData.rcsCity} onChange={(e) => setNdaData(prev => ({ ...prev, rcsCity: e.target.value }))}
                      style={inputStyle} placeholder="Paris" disabled={ndaData.legalForm === 'EI'}
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                </div>

                {/* En cours d'immatriculation */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.secondary, cursor: 'pointer' }}>
                  <input type="checkbox" checked={ndaData.isInRegistration} onChange={(e) => {
                    const v = e.target.checked;
                    setNdaData(prev => ({ ...prev, isInRegistration: v }));
                    // Persiste le flag « société en création » sur le lead (visible
                    // aussi dans l'onglet Options de la page Détails).
                    apiClient.patch(`/api/v1/tracking/leads/${ndaPopup.leadId}`, { company_in_creation: v })
                      .then(() => setLeads(prev => prev.map(l => l.id === ndaPopup.leadId ? { ...l, company_in_creation: v } : l)))
                      .catch(err => console.warn('Flag en création non persisté:', err));
                  }} style={{ cursor: 'pointer' }} />
                  En cours d'immatriculation
                </label>

                {/* Address */}
                <div>
                  <div style={labelStyle}>Adresse du siège</div>
                  <input value={ndaData.headOffice.line1} onChange={(e) => setNdaData(prev => ({ ...prev, headOffice: { ...prev.headOffice, line1: e.target.value } }))}
                    style={{ ...inputStyle, marginBottom: 6 }} placeholder="Adresse"
                    onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 6 }}>
                    <input value={ndaData.headOffice.postalCode} onChange={(e) => setNdaData(prev => ({ ...prev, headOffice: { ...prev.headOffice, postalCode: e.target.value } }))}
                      style={inputStyle} placeholder="CP"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                    <input value={ndaData.headOffice.city} onChange={(e) => setNdaData(prev => ({ ...prev, headOffice: { ...prev.headOffice, city: e.target.value } }))}
                      style={inputStyle} placeholder="Ville"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                </div>

                {/* Representatives */}
                <div>
                  <div style={labelStyle}>Représentant</div>
                  {ndaData.representatives.map((rep, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 28px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <input value={rep.fullName} onChange={(e) => {
                        const reps = [...ndaData.representatives];
                        reps[i] = { ...reps[i], fullName: e.target.value, firstName: null, lastName: null };
                        setNdaData(prev => ({ ...prev, representatives: reps }));
                      }} style={inputStyle} placeholder="Nom complet"
                        onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                      />
                      <input value={rep.role} onChange={(e) => {
                        const reps = [...ndaData.representatives];
                        reps[i] = { ...reps[i], role: e.target.value };
                        setNdaData(prev => ({ ...prev, representatives: reps }));
                      }} style={inputStyle} placeholder="Fonction"
                        onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const reps = ndaData.representatives.filter((_, idx) => idx !== i);
                          setNdaData(prev => ({ ...prev, representatives: reps }));
                        }}
                        title="Supprimer ce représentant"
                        style={{
                          width: 28, height: 28, borderRadius: 6,
                          border: `1px solid ${C.border}`, background: 'transparent',
                          color: C.muted, fontSize: 16, lineHeight: 1, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                      >×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const reps = [...ndaData.representatives, { fullName: '', role: 'Gérant' }];
                      setNdaData(prev => ({ ...prev, representatives: reps }));
                    }}
                    style={{
                      marginTop: ndaData.representatives.length > 0 ? 4 : 0,
                      padding: '6px 10px', borderRadius: 6,
                      border: `1px dashed ${C.border}`, background: 'transparent',
                      color: C.muted, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                  >
                    + Ajouter un représentant
                  </button>
                </div>

                {/* Row: Email + Phone (from lead, editable here) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={labelStyle}>Email</div>
                    <input value={ndaData.email} onChange={(e) => setNdaData(prev => ({ ...prev, email: e.target.value }))}
                      style={inputStyle} placeholder="contact@example.com"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                  <div>
                    <div style={labelStyle}>Téléphone</div>
                    <input value={ndaData.phone} onChange={(e) => setNdaData(prev => ({ ...prev, phone: e.target.value }))}
                      style={inputStyle} placeholder="06 12 34 56 78"
                      onFocus={(e) => e.target.style.borderColor = C.accent} onBlur={(e) => e.target.style.borderColor = C.border}
                    />
                  </div>
                </div>

                {/* Business type */}
                <div>
                  <div style={labelStyle}>Type d'entreprise</div>
                  <select value={ndaData.businessType} onChange={(e) => setNdaData(prev => ({ ...prev, businessType: e.target.value }))} style={selectStyle}>
                    {NDA_BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Separator */}
              <div style={{ height: 1, background: C.border, margin: '18px 0' }} />

              {/* Actions */}
              <div className={isGuidedLead(lead)?'sj-nda-actions':undefined} style={{ display: 'flex', gap: 10, background:C.bg }}>
                <button disabled={ndaGenerating} aria-label="Fermer le NDA" onClick={() => { ndaRequest.current++;setNdaPopup(null); setNdaData(null); }}
                  style={{
                    flex: 1, padding: '11px 16px', borderRadius: 10, border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.secondary, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >Annuler</button>
                <button onClick={handleNdaGenerate} disabled={ndaGenerating || ndaLoading}
                  style={{
                    flex: 2, padding: '11px 16px', borderRadius: 10, border: 'none',
                    background: ndaGenerating ? C.muted : (darkMode ? '#fff' : '#2b2927'),
                    color: ndaGenerating ? '#fff' : (darkMode ? '#141414' : '#fff'),
                    fontSize: 13, fontWeight: 500, cursor: ndaGenerating ? 'wait' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!ndaGenerating) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >{ndaGenerating ? 'Préparation en cours…' : ndaPopup.nextAction ? 'Générer et continuer' : 'Générer le NDA'}</button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      {/* ── REMOTE CURSORS OVERLAY ──────────────────────────────────────────── */}
      {Object.entries(remoteCursors).map(([email, cur]) => (
        <div key={email} style={{
          position: 'fixed', left: cur.x, top: cur.y, zIndex: 99998, pointerEvents: 'none',
          transition: 'left 0.08s linear, top 0.08s linear',
        }}>
          {/* Cursor arrow — Figma style without stem */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))', transform: 'rotate(-12deg)' }}>
            <path d="M2 1L2 16L6.5 11.5L14 11.5L2 1Z" fill={cur.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          {/* Name label + current tab */}
          <div style={{
            position: 'absolute', left: 14, top: 14,
            background: cur.color, color: '#fff', fontSize: 10, fontWeight: 500,
            padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {(cur.full_name || email).split(' ')[0]}
            {remoteUserTabs[email] && (() => {
              const tabCat = CATEGORIES.find(c => c.key === remoteUserTabs[email]);
              return tabCat ? (
                <span style={{ opacity: 0.8, fontSize: 9, fontWeight: 500 }}>
                  · {tabCat.label}
                </span>
              ) : null;
            })()}
          </div>
          {/* Action toast bubble (if any active toast for this user) */}
          {actionToasts.filter(t => (t.email === email || t.user_name === cur.full_name)).map(toast => (
            <div key={toast.id} style={{
              position: 'absolute', left: 20, top: -28,
              background: darkMode ? '#2e2e2e' : '#fff', color: darkMode ? '#f2f2f2' : '#1c1b19',
              fontSize: 11, fontWeight: 500, padding: '5px 12px', borderRadius: 8, whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: `1px solid ${cur.color}40`,
              animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              {toast.action}{toast.lead_name ? ` sur ${toast.lead_name}` : ''}
            </div>
          ))}
        </div>
      ))}

      {/* Fallback toasts (no cursor visible for user) */}
      {actionToasts.filter(t => {
        const matchEmail = Object.keys(remoteCursors).find(e => e === t.email || remoteCursors[e]?.full_name === t.user_name);
        return !matchEmail;
      }).map((toast, i) => (
        <div key={toast.id} style={{
          position: 'fixed', top: 80 + i * 50, right: 20, zIndex: 99997,
          background: darkMode ? '#2e2e2e' : '#fff', color: darkMode ? '#f2f2f2' : '#1c1b19',
          fontSize: 12, fontWeight: 500, padding: '8px 16px', borderRadius: 10, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: `1px solid ${C.border}`,
          animation: 'fadeUp 0.3s cubic-bezier(0.16,1,0.3,1) both',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontWeight: 500 }}>{toast.user_name}</span>
          <span style={{ color: C.muted }}>·</span>
          <span>{toast.action}{toast.lead_name ? ` sur ${toast.lead_name}` : ''}</span>
        </div>
      ))}

      {/* ═══ SPOTLIGHT SEARCH (Ctrl+K) ═══ */}
      {spotlightOpen && createPortal(
        <>
          <div onClick={() => setSpotlightOpen(false)} style={{
            position: 'fixed', inset: 0, background: C.veil,
            zIndex: 9996, animation: 'modalOverlayIn 0.15s ease both',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 520, maxWidth: '90vw', maxHeight: '60vh',
            background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow,
            zIndex: 9997, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            animation: 'modalCardIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            {/* Search input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={spotlightInputRef}
                value={spotlightQuery}
                onChange={(e) => setSpotlightQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setSpotlightOpen(false); }}
                placeholder="Rechercher un lead dans tous les onglets..."
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 15, color: C.text, fontFamily: 'inherit', fontWeight: 500,
                }}
              />
              <span style={{ fontSize: 10, color: C.muted, padding: '2px 6px', borderRadius: 4, background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', fontWeight: 500 }}>ESC</span>
            </div>
            {/* Results */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
              {(() => {
                if (!spotlightQuery.trim()) return (
                  <div style={{ padding: '24px 18px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                    Tapez pour rechercher par nom, email ou téléphone
                  </div>
                );
                const q = spotlightQuery.toLowerCase().trim();
                const results = leads.filter(l =>
                  (l.full_name || '').toLowerCase().includes(q) ||
                  (l.email || '').toLowerCase().includes(q) ||
                  (l.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
                  (l.company_name || '').toLowerCase().includes(q)
                ).slice(0, 15);
                if (results.length === 0) return (
                  <div style={{ padding: '24px 18px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                    Aucun résultat pour "{spotlightQuery}"
                  </div>
                );
                return results.map((lead, idx) => {
                  const cat = CATEGORIES.find(c => c.key === lead.status) || CATEGORIES[0];
                  return (
                    <button key={lead.id} onClick={() => {
                      setSpotlightOpen(false);
                      // Switch to the correct tab
                      const tabIdx = CATEGORIES.findIndex(c => c.key === lead.status);
                      if (tabIdx >= 0 && tabIdx !== activeTab) handleTabChange(tabIdx);
                      // Select the lead
                      setSidebarView('leads');
                      setTimeout(() => {
                        setSelectedLead(lead.id);
                        // Scroll to the lead card
                        const el = document.getElementById(`lead-card-${lead.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 150);
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 18px',
                      border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'background 0.1s', textAlign: 'left',
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.full_name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.email || lead.phone || lead.company_name || ''}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 50,
                        background: `${cat.color}15`, color: cat.color, flexShrink: 0,
                      }}>{cat.label}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ═══ QUALIFICATION DROPDOWN (portaled) ═══ */}
      {qualDropdown && (() => {
        const lead = leads.find(l => l.id === qualDropdown);
        if (!lead) return null;
        const QUAL_OPTIONS = [
          { key: 'lead', label: 'Lead', icon: iconQualLead },
          { key: 'qualifie', label: 'Qualifié', icon: iconQualQualifie },
          { key: 'proposition', label: 'Proposition', icon: iconQualProposition },
          { key: 'negociation', label: 'Négociation', icon: iconQualNegociation },
          { key: 'gagne', label: 'Gagné', icon: iconQualGagne },
          { key: 'perdu', label: 'Perdu', icon: iconQualPerdu },
          { key: 'sans_suite', label: 'Sans suite', icon: iconQualSansSuite },
        ];
        const current = lead.sales_qualification || 'lead';
        return createPortal(
          <>
            <div onClick={() => setQualDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 9990 }} />
            <div style={{
              position: 'fixed', top: qualDropdownPos.y, left: qualDropdownPos.x, zIndex: 9991,
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14,
              boxShadow: C.popShadow,
              padding: 4, minWidth: 180,
            }}>
              {QUAL_OPTIONS.map(q => (
                <button key={q.key} onClick={async () => {
                  setQualDropdown(null);
                  if (q.key === 'sans_suite') {
                    setSansSuiteModal({ leadId: lead.id });
                    setSansSuiteComment('');
                    return;
                  }
                  const prev = current;
                  setLeads(p => p.map(l => l.id === lead.id ? { ...l, sales_qualification: q.key } : l));
                  try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { sales_qualification: q.key }); }
                  catch { setLeads(p => p.map(l => l.id === lead.id ? { ...l, sales_qualification: prev } : l)); }
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  background: current === q.key ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = current === q.key ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent'}
                >
                  <img src={q.icon} alt="" style={{ height: 20, objectFit: 'contain', filter: imgDark }} />
                </button>
              ))}
            </div>
          </>,
          document.body
        );
      })()}

      {/* ═══ PRIORITY DROPDOWN (portaled) ═══ */}
      {prioDropdown && (() => {
        const lead = leads.find(l => l.id === prioDropdown);
        if (!lead) return null;
        const PRIO_OPTIONS = [
          { key: 'high', icon: iconPrioHigh },
          { key: 'medium', icon: iconPrioMedium },
          { key: 'low', icon: iconPrioLow },
        ];
        const current = lead.lead_priority || 'medium';
        return createPortal(
          <>
            <div onClick={() => setPrioDropdown(null)} style={{ position: 'fixed', inset: 0, zIndex: 9990 }} />
            <div style={{
              position: 'fixed', top: prioDropdownPos.y, left: prioDropdownPos.x, zIndex: 9991,
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14,
              boxShadow: C.popShadow,
              padding: 4, minWidth: 140,
            }}>
              {PRIO_OPTIONS.map(p => (
                <button key={p.key} onClick={async () => {
                  setPrioDropdown(null);
                  const prev = current;
                  setLeads(pr => pr.map(l => l.id === lead.id ? { ...l, lead_priority: p.key } : l));
                  try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { lead_priority: p.key }); }
                  catch { setLeads(pr => pr.map(l => l.id === lead.id ? { ...l, lead_priority: prev } : l)); }
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px',
                  border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  background: current === p.key ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = current === p.key ? (darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)') : 'transparent'}
                >
                  <img src={p.icon} alt="" style={{ height: 20, objectFit: 'contain', filter: imgDark }} />
                </button>
              ))}
            </div>
          </>,
          document.body
        );
      })()}

      {/* ═══ INVITE MODAL ═══ */}
      {inviteModal && createPortal(
        <>
          <div onClick={() => setInviteModal(null)} style={{
            position: 'fixed', inset: 0, background: C.veil,
            zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
            width: 420, maxWidth: '90vw', maxHeight: '70vh', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 500, color: C.text, letterSpacing: '-0.02em' }}>Inviter un commercial</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Sélectionnez qui peut réaffecter les leads</div>
                </div>
                <button onClick={() => setInviteModal(null)} style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: C.muted, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
              </div>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round"
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input value={inviteSearch} onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Rechercher par nom ou email..."
                  style={{
                    width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10,
                    border: `1px solid ${C.border}`, background: darkMode ? C.subtle : '#faf9f7',
                    color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
            </div>
            {/* User list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
              {assignableUsers
                .filter(u => {
                  if (!inviteSearch) return true;
                  const q = inviteSearch.toLowerCase();
                  return (u.full_name || u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                })
                .map(u => (
                  <button key={u.email} onClick={async () => {
                    await handleInviteSales(inviteModal.sheetEmail, u.email);
                    setInviteModal(null);
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                    borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'background 0.15s', textAlign: 'left',
                  }}
                    onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: darkMode ? '#6366f1' : '#2b2927', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 12, fontWeight: 500,
                    }}>{(u.full_name || u.name || u.email || '?').slice(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{u.full_name || u.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{u.email}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" style={{ opacity: 0.3 }}>
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              {assignableUsers.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: C.muted, fontSize: 13 }}>Chargement...</div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ═══ SANS SUITE MODAL ═══ */}
      {sansSuiteModal && createPortal(
        <>
          <div onClick={() => { micCleanup(); setSansSuiteModal(null); }} style={{
            position: 'fixed', inset: 0, background: C.veil,
            zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
            width: 400, maxWidth: '90vw', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow,
            padding: '28px 24px 22px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: C.text, marginBottom: 6, letterSpacing: '-0.02em' }}>Sans suite</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Ajoutez un commentaire obligatoire avant d'archiver ce lead.</div>
            <div style={{ position: 'relative' }}>
              <textarea
                value={sansSuiteComment}
                onChange={(e) => setSansSuiteComment(e.target.value)}
                placeholder="Raison de la clôture sans suite..."
                style={{
                  width: '100%', minHeight: 100, padding: '10px 44px 10px 14px', borderRadius: 10,
                  border: `1px solid ${C.border}`, background: darkMode ? C.subtle : '#faf9f7',
                  color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                  lineHeight: 1.5,
                }}
                autoFocus
              />
              <button type="button" onClick={() => {
                if (micRecording) {
                  micStopAndTranscribe((text) => setSansSuiteComment(prev => (prev ? prev + ' ' : '') + text));
                } else if (!micTranscribing) { micStartRecording(); }
              }} disabled={micTranscribing}
                style={{
                  position: 'absolute', right: 8, bottom: 8,
                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                  background: micRecording ? '#ef4444' : micTranscribing ? C.muted : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                  color: micRecording ? '#fff' : micTranscribing ? '#fff' : C.muted,
                  cursor: micTranscribing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  animation: micRecording ? 'gentlePulse 1.5s ease-in-out infinite' : 'none',
                }}
                title={micRecording ? 'Arrêter et transcrire' : micTranscribing ? 'Transcription...' : 'Dicter votre commentaire'}
              >
                {micTranscribing ? (
                  <div style={{ width: 16, height: 16, border: `2px solid ${C.border}`, borderTopColor: '#fff', borderRadius: '50%', animation: 'loaderSpin 0.8s linear infinite' }} />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {micRecording ? (<><line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" /></>) : (
                      <><rect x="9" y="1" width="6" height="12" rx="3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></>
                    )}
                  </svg>
                )}
              </button>
              {micError && (
                <div style={{ position: 'absolute', right: 44, bottom: 10, padding: '4px 12px', borderRadius: 6, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', animation: 'copiedToastIn 0.3s ease both' }}>{micError}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { micCleanup(); setSansSuiteModal(null); }} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${C.border}`,
                background: 'transparent', color: C.muted, transition: 'all 0.15s',
              }}>Annuler</button>
              <button onClick={async () => {
                if (!sansSuiteComment.trim()) return;
                const leadId = sansSuiteModal.leadId;
                try {
                  await apiClient.patch(`/api/v1/tracking/leads/${leadId}`, {
                    sales_qualification: 'sans_suite',
                    notes: (leads.find(l => l.id === leadId)?.notes ? leads.find(l => l.id === leadId).notes + '\n' : '') + 'Sans suite : ' + sansSuiteComment.trim(),
                  });
                  await apiClient.post(`/api/v1/tracking/leads/${leadId}/archive`);
                  setLeads(prev => prev.filter(l => l.id !== leadId));
                  setSelectedLead(null);
                } catch (e) {
                  console.warn('Archive failed:', e);
                  setLeads(prev => prev.map(l => l.id === leadId ? { ...l, sales_qualification: 'sans_suite' } : l));
                }
                setSansSuiteModal(null);
              }} disabled={!sansSuiteComment.trim()} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                fontFamily: 'inherit', cursor: sansSuiteComment.trim() ? 'pointer' : 'not-allowed',
                border: 'none',
                background: sansSuiteComment.trim() ? (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                color: sansSuiteComment.trim() ? C.text : C.muted, transition: 'all 0.15s',
                opacity: sansSuiteComment.trim() ? 1 : 0.5,
              }}>Archiver</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ═══ CONFIRM MODAL (resend/cancel contract) ═══ */}
      {/* ── POP-UP ANTI-DOUBLON (lead déjà existant, création ou édition email/tél) ── */}
      {duplicateLeadModal && createPortal(
        <>
          <div onClick={() => setDuplicateLeadModal(false)} style={{
            position: 'fixed', inset: 0, background: C.veil,
            zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
            width: 400, maxWidth: '90vw', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow,
            padding: '32px 28px 26px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px',
                background: 'rgba(248,113,113,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>⚠️</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: C.text, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Ce lead existe déjà
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, letterSpacing: '-0.01em', maxWidth: 320, margin: '0 auto' }}>
                Un lead avec cet email ou ce numéro de téléphone existe déjà dans votre tracking sheet.
                Retrouvez-le avec une recherche <b style={{ color: C.text }}>⌘&nbsp;F</b> (Mac)
                ou <b style={{ color: C.text }}>Ctrl&nbsp;F</b> (PC) plutôt que d'en créer un nouveau.
              </div>
            </div>
            <button onClick={() => setDuplicateLeadModal(false)} style={{
              width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
              border: 'none', background: '#f87171', color: '#fff',
            }}>Compris</button>
          </div>
        </>,
        document.body
      )}

      {confirmModal && createPortal(
        <>
          <div onClick={() => setConfirmModal(null)} style={{
            position: 'fixed', inset: 0, background: C.veil,
            zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
            width: 420, maxWidth: '90vw', maxHeight: '88vh', overflowY: 'auto', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow,
            padding: '32px 28px 26px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px',
                background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 500, color: darkMode ? '#a3a3a3' : '#9d9890',
              }}>{confirmModal.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 500, color: C.text, marginBottom: 8, letterSpacing: '-0.02em' }}>
                {confirmModal.title}
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, letterSpacing: '-0.01em', maxWidth: 300, margin: '0 auto', whiteSpace: 'pre-line' }}>
                {confirmModal.message}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmModal(null)} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
                border: `1px solid ${C.border}`, background: 'transparent', color: C.muted,
                transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; }}
              >Annuler</button>
              <button onClick={confirmModal.onConfirm} style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
                border: 'none',
                background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                color: C.secondary,
                transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
              >{confirmModal.confirmLabel}</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ═══ CONTRACT ERROR MODAL ═══ */}
      {contractErrorModal && createPortal(
        <>
          <div onClick={() => setContractErrorModal(null)} style={{
            position: 'fixed', inset: 0, background: C.veil,
            zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both',
          }} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="contract-error-title" aria-describedby="contract-error-message" style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
            width: 420, maxWidth: '90vw', maxHeight: '88vh', overflowY: 'auto', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow,
            padding: '32px 28px 26px',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16, margin: '0 auto 16px',
                background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {contractErrorModal.isNdaMissing ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#a3a3a3' : '#9d9890'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="16"/><circle cx="12" cy="18" r="0.5"/></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={darkMode ? '#a3a3a3' : '#9d9890'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                )}
              </div>
              <div id="contract-error-title" style={{ fontSize: 17, fontWeight: 500, color: C.text, marginBottom: 8, letterSpacing: '-0.02em' }}>
                {contractErrorModal.title || (contractErrorModal.isNdaMissing ? 'NDA non généré' : 'Action impossible')}
              </div>
              <div id="contract-error-message" style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, letterSpacing: '-0.01em', maxWidth: 300, margin: '0 auto', whiteSpace: 'pre-line' }}>
                {contractErrorModal.message}
              </div>
            </div>
            {contractErrorModal.action && contractErrorModal.leadId && <button autoFocus onClick={correctContractInformation} style={{ width: '100%', padding: '12px 0', marginBottom: 8, borderRadius: 12, border: 'none', background: C.accent, color: C.onAccent, fontSize: 14, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>{contractErrorModal.action === 'nda' ? 'Ouvrir le NDA' : 'Corriger les informations'}</button>}
            <button autoFocus={!contractErrorModal.action} onClick={() => setContractErrorModal(null)} style={{
              width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
              background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              color: C.secondary,
              transition: 'all 0.2s ease',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'; }}
            >Revenir au dossier</button>
          </div>
        </>,
        document.body
      )}

      {/* ═══ SALE DECLARATION MODAL ═══ */}
      {/* Reprogrammation d'un RDV post-signature (onboarding/lancement) AVEC dispo agenda :
          même SaleSlotPicker qu'à la déclaration ; le PATCH rdv_*_date déplace l'event Google déjà câblé.
          fontFamily Inter reposée : createPortal(document.body) sort du conteneur de police. */}
      {reschedRdv?.twoStage && <OnboardingReschedule lead={leads.find(l => l.id === reschedRdv.leadId)} SlotPicker={SaleSlotPicker} C={C} darkMode={darkMode}
        onClose={() => setReschedRdv(null)} onSaved={result => {
          const leadId = reschedRdv.leadId;
          setLeads(previous => previous.map(l => l.id === leadId ? {...l, rdv_onboarding_date:result.new_dt} : l));
          setIntakeJourneys(previous => ({...previous, [leadId]:{...previous[leadId], preparation:result.preparation}}));
          setSalePreparation(previous => (previous && showSaleModal === leadId ? result.preparation : previous));
          setRescheduleNotice({leadId, message:result.notification_sent === false ? 'Rendez-vous reprogrammé. La notification au client reste à vérifier.' : 'Rendez-vous reprogrammé dans les agendas.'});
          setReschedRdv(null);
        }}/>}
      {reschedRdv && !reschedRdv.twoStage && createPortal((() => {
        const lead = leads.find(l => l.id === reschedRdv.leadId);
        if (!lead) return null;
        const kind = reschedRdv.kind;
        const field = kind === 'onboarding' ? 'rdv_onboarding_date' : 'rdv_lancement_date';
        const curVal = kind === 'onboarding' ? lead.rdv_onboarding_date : lead.rdv_lancement_date;
        const save = async (val) => {
          setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, [field]: val } : l));
          setReschedRdv(null);
          try { await apiClient.patch(`/api/v1/tracking/leads/${lead.id}`, { [field]: val || null }); }
          catch { setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, [field]: curVal } : l)); }
        };
        return (
          <>
            <div onClick={() => setReschedRdv(null)}
              style={{ position: 'fixed', inset: 0, background: C.veil, zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both' }} />
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
              width: 680, maxWidth: '92vw', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
              boxShadow: C.sheetShadow, padding: '28px 28px 24px',
              animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            }}>
              <button onClick={() => setReschedRdv(null)}
                style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', border: 'none',
                  background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted, fontSize: 14,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 500, color: C.text }}>Reprogrammer le RDV {kind === 'onboarding' ? 'Onboarding' : 'Lancement'}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Choisis un créneau libre · {kind === 'onboarding' ? 'facturation' : "Opti'Lex"}{lead.full_name ? ` · ${lead.full_name}` : ''}</div>
              </div>
              <SaleSlotPicker kind={kind} band={lead.employee_range}
                value={curVal ? toDatetimeLocal(curVal) : ''} onChange={save} C={C} darkMode={darkMode} />
            </div>
          </>
        );
      })(), document.body)}

      {/* Dispos onboarding : même calendrier qu'à la déclaration de vente, en consultation seule. */}
      {onbAvailOpen && createPortal(
        <>
          <div onClick={() => setOnbAvailOpen(false)}
            style={{ position: 'fixed', inset: 0, background: C.veil, zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both' }} />
          <div role="dialog" aria-modal="true" aria-label="Disponibilités onboarding" style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
            width: 680, maxWidth: '92vw', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
            boxShadow: C.sheetShadow, padding: '28px 28px 24px',
            animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          }}>
            <button onClick={() => setOnbAvailOpen(false)} aria-label="Fermer"
              style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: '50%', border: 'none',
                background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: C.muted, fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} strokeWidth={2} aria-hidden="true" /></button>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: C.text }}>Disponibilités onboarding</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{onboardingHostsChoice(calSettings?.onboarding_hosts)}, et facturation · pour information, le créneau se réserve à la déclaration de vente</div>
            </div>
            <SaleSlotPicker kind="onboarding" value="" onChange={() => {}} readOnly C={C} darkMode={darkMode} />
          </div>
        </>, document.body)}

      {commentLeadId && <NotesDialog dark={darkMode} lead={leads.find(l=>l.id===commentLeadId)} value={editingNotes[commentLeadId]||''} onChange={value=>setEditingNotes(p=>({...p,[commentLeadId]:value}))} error={notesError?.leadId===commentLeadId?notesError.message:null} onClose={()=>{micCleanup();setCommentLeadId(null);}} onSave={()=>handleNotesSave(commentLeadId)} recording={micRecording} transcribing={micTranscribing} liveText={micLive} micError={micError} onDictate={()=>{if(micRecording){const id=commentLeadId;micStopAndTranscribe(text=>setEditingNotes(p=>({...p,[id]:(p[id]?p[id]+' ':'')+text})));}else if(!micTranscribing)micStartRecording();}}/>}
      {contactDialog && <ContactQualificationDialog key={contactDialog.lead.id} {...contactDialog} dark={darkMode} onClose={() => setContactDialog(null)} onSave={async values => {
        const current = leads.find(l => l.id === contactDialog.lead.id);
        if (!current || !isGuidedLead(current) || current.status !== contactDialog.category) throw new Error('Le dossier a changé. Fermez cette fenêtre et rouvrez le contact.');
        const patch = contactQualificationPatch(current, contactDialog.category, values);
        await handleWorkflowSubmit(current.id, patch, {strict:true});
        setContactDialog(null);
      }}/>}
      {qualifyDeck && <DailyQualificationDeck items={qualifyDeck} dark={darkMode}
        onSave={(lead, stage, payload) => saveQualificationFor(lead, stage, payload, { quiet: true })}
        onClose={closeQualifyDeck} />}
      {qualificationDialog && (()=>{const {fromCalendar,...dialogProps}=qualificationDialog;const onSave=async payload=>{await saveQualification(payload);if(fromCalendar)setCalendarReload(v=>v+1);};return dialogProps.stage==='r1'?<R1QualificationDialog {...dialogProps} dark={darkMode} onClose={()=>setQualificationDialog(null)} onSave={onSave}/>:<QualificationDialog {...dialogProps} dark={darkMode} canPlaceR3={calSettings?.r3_enabled===true} onClose={()=>setQualificationDialog(null)} onSave={onSave}/>;})()}
      {intakeDialog && <IntegrationDialog key={intakeDialog.lead_id} context={intakeDialog}
        onEditNda={() => {
          const lead = leads.find(l => l.id === intakeDialog.lead_id);
          if (!lead) return;
          const action = intakeDialog.nextAction;
          setIntakeDialog(null);
          openNdaPopup(lead, action, true);
        }}
        contractDetails={{
          email: leads.find(l => l.id === intakeDialog.lead_id)?.email,
          employeeRange: leads.find(l => l.id === intakeDialog.lead_id)?.employee_range,
          displayDate: contractDates[intakeDialog.lead_id],
        }}
        onContractDateChange={value=>setContractDates(previous=>({...previous,[intakeDialog.lead_id]:value}))}
        onPrepared={preparation => setLeads(previous => previous.map(l => l.id === intakeDialog.lead_id ? { ...l, employee_range: preparation.employee_range } : l))}
        onSend={(preparation) => {
          const existingLead = leads.find(l => l.id === intakeDialog.lead_id);
          const lead = existingLead && { ...existingLead, employee_range: preparation?.employee_range || existingLead.employee_range };
          const action = intakeDialog.nextAction;
          setIntakeDialog(null);
          if (lead && action?.type === 'resend') handleResendContract(action.contractId, lead.id, true);
          else if (lead) handleSendContract(lead, true);
        }}
        onClose={() => setIntakeDialog(null)} onSaved={result => { setIntakeReady(previous => ({ ...previous, [intakeDialog.lead_id]: result.ready })); if (result.saved) setIntakeSaved(previous => ({ ...previous, [intakeDialog.lead_id]: { available: true, validated: result.ready, revision: result.revision } })); }} />}

      {showSaleModal && createPortal((() => {
        const lead = leads.find(l => l.id === showSaleModal);
        // Style Owner (11/11/2026) : un titre à gauche, des champs blancs à trait fin, les choix en pastilles, l'action
        // principale en bas à droite. Elle reste discrète tant qu'il manque une réponse.
        const saleHead = (title, sub) => (
          <div style={{ margin: '0 36px 20px 0' }}>
            <div style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.02em', color: C.text }}>{title}</div>
            {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>{sub}</div>}
          </div>
        );
        const saleLabel = { fontSize: 13, color: C.muted, display: 'block', marginBottom: 7 };
        const saleField = { width: '100%', padding: '10px 12px', borderRadius: 12, border: `1px solid ${darkMode ? C.border : '#e3ded6'}`, background: darkMode ? '#181818' : '#ffffff', color: C.text, fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s ease, box-shadow 0.2s ease' };
        const saleFocus = { onFocus: (e) => { e.target.style.borderColor = C.accent; e.target.style.boxShadow = darkMode ? '0 0 0 3px rgba(255,255,255,.08)' : '0 0 0 3px rgba(43,41,39,.08)'; }, onBlur: (e) => { e.target.style.borderColor = darkMode ? C.border : '#e3ded6'; e.target.style.boxShadow = 'none'; } };
        const salePill = (on, extra = {}) => ({ padding: '8px 0', borderRadius: 10, fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', cursor: 'pointer', minWidth: 0,
          border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accent : C.bg, color: on ? C.onAccent : C.text, transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease', ...extra });
        const salePrimary = (ready, busy = false) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          cursor: ready && !busy ? 'pointer' : 'default', background: ready ? C.accent : C.subtle, color: ready ? C.onAccent : C.muted, opacity: busy ? 0.7 : 1, transition: 'background 0.2s ease, color 0.2s ease' });
        const saleGhost = { height: 40, padding: '0 14px', borderRadius: 12, border: 'none', background: 'transparent', color: C.muted, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: saleSubmitting ? 'default' : 'pointer' };
        const saleFooter = { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 22 };
        return (
          <>
            <div onClick={() => { if (!saleSubmitting) { setShowSaleModal(null); setSaleSuccess(false); } }}
              style={{ position: 'fixed', inset: 0, background: C.veil, zIndex: 9998, animation: 'modalOverlayIn 0.25s ease both' }} />
            <div className={saleOnboardingOnly?'sj-sale-dialog':undefined} role="dialog" aria-modal="true" aria-label="Déclarer une vente" style={{
              boxSizing: saleOnboardingOnly ? 'border-box' : undefined,
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999,
              width: !saleOnboardingOnly && (saleStep === 'form' || saleStep === 'questions') ? 420 : 720, maxWidth: '92vw', maxHeight: '90dvh', overflowY: 'auto', background: C.bg, borderRadius: 22, border: `1px solid ${C.border}`,
              boxShadow: C.sheetShadow, padding: '28px 28px 24px',
              animation: 'modalCardIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
            }}>
              {/* Close */}
              <button onClick={() => { if (!saleSubmitting) { setShowSaleModal(null); setSaleSuccess(false); } }}
                aria-label="Fermer" style={{ position: 'absolute', top: 18, right: 18, width: 32, height: 32, borderRadius: 10, border: 'none',
                  background: 'transparent', color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s ease, color 0.15s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.subtle; e.currentTarget.style.color = C.text; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.muted; e.currentTarget.style.transform = 'none'; }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>

              {saleOnboardingOnly && !saleSuccess && <>
                <p className="sj-sale-part">{salePreparation?.status === 'finalized' ? 'Déclaration terminée' : ['handoff','documents'].includes(saleStep) ? 'Partie 2 sur 2 · Finaliser et déclarer la vente' : 'Partie 1 sur 2 · Sécuriser le rendez-vous'}</p>
                {saleStep !== 'reserved' && <SalesJourneySteps salePart={['handoff','documents'].includes(saleStep) ? 2 : 1} phase={saleStep === 'form' ? 'details' : saleStep === 'questions' ? 'billing' : ['handoff','documents'].includes(saleStep) ? saleStep : 'booking'} compact />}
              </>}
              {saleReservationError && saleStep !== 'reserved' && <div className="si-error" role="alert">{saleReservationError}</div>}
              {saleSuccess ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: darkMode ? 'rgba(16,185,129,.14)' : '#e2f6ea', color: darkMode ? '#7cc49b' : '#0b7a4b', margin: '0 auto 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'modalCardIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.02em', color: C.text, marginBottom: 6 }}>Vente déclarée</div>
                  {saleClientNumero && <div style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, marginBottom: 6, background: darkMode ? 'rgba(16,185,129,.14)' : '#e2f6ea', color: darkMode ? '#7cc49b' : '#0b7a4b', border: `1px solid ${darkMode ? 'rgba(16,185,129,.25)' : '#c3ebd3'}` }}>{saleClientNumero}</div>}
                  <div style={{ fontSize: 13, color: C.muted }}>La vente a été enregistrée avec succès</div>
                </div>
              ) : saleStep === 'reserved' ? (
                <SaleReservation preparation={salePreparation} busy={saleSubmitting} error={saleReservationError} onRetry={() => reserveSaleAppointment(showSaleModal)} onContinue={() => setSaleStep('handoff')} onClose={() => setShowSaleModal(null)}
                  onReschedule={() => setReschedRdv({ leadId: showSaleModal, kind: 'onboarding', twoStage: true })} />
              ) : saleStep === 'form' ? (
                <>
                  {saleHead('Déclarer une vente', lead?.full_name)}

                  {/* Email */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={saleLabel}>Email client</label>
                    <input value={saleForm.email} onChange={(e) => setSaleForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="client@exemple.com" type="email"
                      style={saleField} {...saleFocus}
                    />
                  </div>

                  <SalePaymentMode leadId={showSaleModal} dark={darkMode} value={saleForm.paymentModality} onChange={value => setSaleForm(p => ({ ...p, paymentModality: value }))} />

                  {/* Employee range grid */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={saleLabel}>Tranche salariale</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 4 }}>
                      {EMPLOYEE_RANGES.map(r => (
                        <button key={r} aria-pressed={saleForm.employeeRange === r} onClick={() => setSaleForm(p => ({ ...p, employeeRange: r }))}
                          style={salePill(saleForm.employeeRange === r, { padding: '7px 0', fontSize: 12 })}>{r}</button>
                      ))}
                    </div>
                  </div>

                  {/* Continuer -> choix des créneaux (dispo agenda). Ordre : Lancement d'abord. */}
                  <div style={saleFooter}>
                    <button onClick={() => setSaleStep(saleOnboardingOnly ? 'questions' : 'lancement')}
                      disabled={!saleForm.email.trim() || !saleForm.employeeRange}
                      style={salePrimary(!!(saleForm.email.trim() && saleForm.employeeRange))}
                    >Continuer<ArrowRight size={16} /></button>
                  </div>
                </>
              ) : saleStep === 'handoff' ? (
                <SaleIntake key={showSaleModal} leadId={showSaleModal} backLabel="Rendez-vous réservé" onBack={() => setSaleStep('reserved')} onSaved={value => {setSaleIntake(value); setSaleStep('documents');}} />
              ) : saleStep === 'documents' ? (
                <SaleDocuments leadId={showSaleModal} draft={saleIntake?.draft} onboardingAt={salePreparation?.slot} submitting={saleSubmitting} continueLabel="Déclarer la vente" onBack={() => setSaleStep('handoff')} onContinue={(documentsWaiver, documentsWaiverNote) => handleSaleSubmit(showSaleModal, documentsWaiver, documentsWaiverNote)} />
              ) : saleStep === 'questions' ? (
                <>
                  {/* Étape questions facturation (après les créneaux, avant la déclaration).
                      Réponses -> description de l'event RDV Onboarding (agenda facturation@).
                      Style STRICTEMENT identique à l'étape 'form' (header rond + iconWiggle,
                      labels 12px C.secondary, boutons segmentés C.accent). */}
                  {saleHead('Facturation', 'Deux précisions pour l’équipe facturation')}

                  {/* Q1 : une ou plusieurs structures (+ combien si plusieurs) */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={saleLabel}>La facturation porte sur</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ key: 'une', label: 'Une structure' }, { key: 'plusieurs', label: 'Plusieurs structures' }].map(opt => (
                        <button key={opt.key} onClick={() => setSaleForm(p => ({ ...p, billingStructures: opt.key, structuresCount: opt.key === 'une' ? '' : p.structuresCount }))}
                          aria-pressed={saleForm.billingStructures === opt.key} style={salePill(saleForm.billingStructures === opt.key, { flex: 1, padding: '9px 0', fontSize: 13 })}>{opt.label}</button>
                      ))}
                    </div>
                    {saleForm.billingStructures === 'plusieurs' && (
                      <div role="group" aria-label="Combien de structures ?" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: 4, marginTop: 8, animation: 'solarFadeIn 0.2s ease both' }}>
                        {['2', '3', '4', '5', '6', '7', '8', '9', '10+'].map(n => (
                          <button key={n} type="button" title={`${n} structures`} aria-pressed={(saleForm.structuresCount || '') === n} onClick={() => setSaleForm(p => ({ ...p, structuresCount: n }))}
                            style={salePill((saleForm.structuresCount || '') === n, { padding: '7px 0', fontSize: 12 })}>{n}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Q2 : réduction oui/non + valeur libre si oui */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={saleLabel}>Une réduction a été accordée ?</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ key: false, label: 'Non' }, { key: true, label: 'Oui' }].map(opt => (
                        <button key={String(opt.key)} onClick={() => setSaleForm(p => ({ ...p, discount: opt.key, discountValue: opt.key ? (p.discountValue || '') : '' }))}
                          aria-pressed={saleForm.discount === opt.key} style={salePill(saleForm.discount === opt.key, { flex: 1, padding: '9px 0', fontSize: 13 })}>{opt.label}</button>
                      ))}
                    </div>
                    {saleForm.discount === true && (
                      <input value={saleForm.discountValue || ''} onChange={(e) => setSaleForm(p => ({ ...p, discountValue: e.target.value }))}
                        placeholder="Laquelle ? ex : 5 %, 10 %, 1 mois offert…"
                        style={{ ...saleField, marginTop: 8 }} {...saleFocus}
                      />
                    )}
                  </div>

                  {/* Navigation : Retour -> créneau Onboarding · Déclarer (gaté par les réponses) */}
                  {(() => {
                    const qReady = !!saleForm.billingStructures
                      && (saleForm.billingStructures !== 'plusieurs' || !!(saleForm.structuresCount || ''))
                      && (saleForm.discount === false || (saleForm.discount === true && (saleForm.discountValue || '').trim()));
                    return (
                      <div style={saleFooter}>
                        <button onClick={() => setSaleStep(saleOnboardingOnly ? 'form' : 'onboarding')} disabled={saleSubmitting} style={{ ...saleGhost, marginRight: 'auto', marginLeft: -14 }}>Retour</button>
                        <button onClick={() => saleOnboardingOnly ? setSaleStep('onboarding') : handleSaleSubmitWithSlots(showSaleModal)} disabled={!qReady || saleSubmitting}
                          style={salePrimary(qReady, saleSubmitting)}>{saleSubmitting ? 'Déclaration…' : saleOnboardingOnly ? 'Choisir le rendez-vous' : 'Déclarer la vente'}{!saleSubmitting && <ArrowRight size={16} />}</button>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <>
                  {/* Étape créneau : Lancement (Opti'Lex) d'abord, puis Onboarding (facturation@) */}
                  {saleHead(saleStep === 'onboarding' ? 'RDV Onboarding' : 'RDV Lancement', `Choisis un créneau libre · ${saleStep === 'onboarding' ? `${onboardingHostsChoice(calSettings?.onboarding_hosts)}, et facturation` : "Opti'Lex"}`)}

                  <SaleSlotPicker key={saleStep} kind={saleStep} value={saleSlots[saleStep]} band={saleForm.employeeRange}
                    onChange={(v) => setSaleSlots(p => ({ ...p, [saleStep]: v }))} C={C} darkMode={darkMode} />

                  {/* Navigation : d'abord Lancement (cabinet Opti'Lex), puis Onboarding (facturation) */}
                  <div style={saleFooter}>
                    <button onClick={() => setSaleStep(saleOnboardingOnly ? 'questions' : saleStep === 'onboarding' ? 'lancement' : 'form')} disabled={saleSubmitting}
                      style={{ ...saleGhost, marginRight: 'auto', marginLeft: -14 }}>Retour</button>
                    {saleStep === 'lancement' ? (
                      <button onClick={() => setSaleStep('onboarding')} disabled={!saleSlots.lancement}
                        style={salePrimary(!!saleSlots.lancement)}>Suivant : Onboarding<ArrowRight size={16} /></button>
                    ) : (
                      <button onClick={() => saleOnboardingOnly ? reserveSaleAppointment(showSaleModal) : setSaleStep('questions')} disabled={!saleSlots.onboarding || saleSubmitting}
                        style={salePrimary(!!saleSlots.onboarding, saleSubmitting)}>{saleSubmitting ? "Réservation…" : saleOnboardingOnly ? "Confirmer et réserver le rendez-vous" : "Suivant : Questions"}{!saleSubmitting && <ArrowRight size={16} />}</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        );
      })(), document.body)}

      {/* ── ANCHORED SMS POPOVER (auto-opens from navbar notifications item) ── */}
      {smsNotifPopover && createPortal((() => {
        const n = smsNotifPopover;
        const segs = n.sms_text ? n.sms_text.split('[SPLIT]') : [''];
        const isPreparing = n.status === 'preparing';
        const isPending = n.status === 'pending';
        const isSent = n.status === 'sent';
        const isFailed = n.status === 'failed';
        const isQueued = n.status === 'queued';
        const isUnconfirmed = n.status === 'unconfirmed';
        const accentColor = isFailed || isUnconfirmed ? (isUnconfirmed ? '#f59e0b' : '#ef4444') : isSent ? '#10b981' : (darkMode ? '#ededed' : '#2b2927');
        const SMS_TYPE_LABELS = {
          sms_repondeur: 'SMS Répondeur',
          sms_noshow: 'SMS Lapin',
        };
        const subtitle = isUnconfirmed ? 'SMS non confirmé' : isFailed ? "Erreur d'envoi" : isSent ? 'Message envoyé' : isQueued ? 'Le message sera envoyé' : isPreparing ? 'En préparation…' : 'Envoi en cours…';
        const close = () => {
          if (smsNotifTimerRef.current) clearTimeout(smsNotifTimerRef.current);
          closeSmsPopover();
        };
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed', bottom: 24, left: 24, zIndex: 10000,
              width: 340, maxWidth: 'calc(100vw - 48px)',
              background: darkMode ? 'rgba(26,28,38,0.97)' : 'rgba(255,255,255,0.99)',
              backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 18,
              boxShadow: darkMode
                ? '0 20px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)'
                : '0 20px 60px rgba(15,23,42,0.18), 0 4px 16px rgba(15,23,42,0.08)',
              overflow: 'hidden',
              transformOrigin: 'left bottom',
              animation: smsNotifClosing
                ? 'smsPopoverOut 0.4s cubic-bezier(0.4, 0, 1, 1) both'
                : 'smsPopoverIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: `${accentColor}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                transition: 'background 0.4s ease',
              }}>
                <img src={iconMessage} alt="" style={{ width: 20, height: 20, display: 'block' }} />
                {(isPending || isPreparing) && (
                  <div style={{
                    position: 'absolute', right: -4, bottom: -4, width: 16, height: 16,
                    borderRadius: '50%', background: darkMode ? '#1f1f1f' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  }}>
                    <span style={{ display: 'inline-flex', gap: 1.5 }}>
                      <span style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: accentColor, animation: 'navDotPulse 1.2s ease-in-out 0s infinite' }} />
                      <span style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: accentColor, animation: 'navDotPulse 1.2s ease-in-out 0.2s infinite' }} />
                      <span style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: accentColor, animation: 'navDotPulse 1.2s ease-in-out 0.4s infinite' }} />
                    </span>
                  </div>
                )}
                {isUnconfirmed && (
                  <div style={{ position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, background: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(245,158,11,0.45)', animation: 'smsCheckPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                )}
                {isSent && (
                  <div style={{ position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(16,185,129,0.45)', animation: 'smsCheckPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
                {isQueued && (
                  <div style={{ position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, background: (darkMode ? '#ededed' : '#2b2927'), borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(43,41,39,0.45)', animation: 'smsCheckPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                )}
                {isFailed && (
                  <div style={{ position: 'absolute', right: -4, bottom: -4, width: 16, height: 16, background: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(239,68,68,0.45)', animation: 'smsCheckPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.lead_name || 'Prospect'}
                </div>
                <div style={{ fontSize: 11.5, color: isUnconfirmed ? '#f59e0b' : isFailed ? '#ef4444' : isSent ? '#10b981' : isQueued ? (darkMode ? '#ededed' : '#2b2927') : C.muted, marginTop: 1, fontWeight: 500, transition: 'color 0.4s ease' }}>
                  {SMS_TYPE_LABELS[n.sms_type] || 'SMS'} · {subtitle}
                </div>
              </div>
              <button onClick={close} style={{
                width: 24, height: 24, borderRadius: 8, border: 'none',
                background: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: C.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body — auto-expanded with delay */}
            <div style={{
              padding: '0 16px 14px',
              animation: 'smsNotifExpand 0.55s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both',
              overflow: 'hidden',
            }}>
              {isUnconfirmed ? (
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: darkMode ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div style={{ fontSize: 12, color: darkMode ? '#fbbf24' : '#92400e', fontWeight: 500, lineHeight: 1.45 }}>
                    Aucune confirmation reçue du serveur. Vérifie tes paramètres SMS ou contacte l'admin.
                  </div>
                </div>
              ) : isFailed ? (
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: darkMode ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500, lineHeight: 1.45 }}>
                    {n.error || "L'envoi du SMS a échoué."}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Pending / Preparing dots indicator */}
                  {(isPending || isPreparing) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontWeight: 500 }}>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor, animation: 'navDotPulse 1.2s ease-in-out 0s infinite' }} />
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor, animation: 'navDotPulse 1.2s ease-in-out 0.2s infinite' }} />
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor, animation: 'navDotPulse 1.2s ease-in-out 0.4s infinite' }} />
                      </span>
                      {isPreparing ? 'SMS en préparation…' : 'Envoi en cours…'}
                    </div>
                  )}
                  {/* SMS text preview (shown for pending, sent, queued) */}
                  {n.sms_text && segs.map((seg, i) => (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: 12,
                      background: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                      fontSize: 12.5, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                      position: 'relative',
                    }}>
                      {segs.length > 1 && (
                        <span style={{
                          position: 'absolute', top: -7, left: 10,
                          padding: '1px 7px', borderRadius: 6,
                          background: accentColor, color: '#fff',
                          fontSize: 9, fontWeight: 500, letterSpacing: '0.04em',
                          transition: 'background 0.4s ease',
                        }}>SMS {i + 1}/{segs.length}</span>
                      )}
                      {seg.trim()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}
