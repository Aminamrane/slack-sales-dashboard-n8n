// src/pages/MetaAds/tabs.jsx — les dimensions du tableau et leurs colonnes.
//
// Chaque onglet dit d'où viennent ses lignes (vue d'ensemble, leaderboard,
// tableau Meta par niveau) et comment les afficher. Une colonne « leads »
// n'apparaît sur une ventilation que si Meta la renseigne : jamais de zéro
// qui ferait croire qu'on a l'information.

import React from 'react';
import CreativeThumb from './CreativeThumb.jsx';
import { Ring, Pill } from './motion.jsx';
import { RECO_TONE, toneColors, scoreColor } from './CreativePanel.jsx';
import { fmtInt, fmtCompact, fmtEur, fmtEur2, fmtRoas, fmtShare, fmtDay } from './theme.js';

const GENDER = { female: 'Femmes', male: 'Hommes', unknown: 'Non renseigné' };
const FORMAT = { video: 'Vidéo', image: 'Image', carousel: 'Carrousel', other: 'Autre' };
const PLATFORM = { facebook: 'Facebook', instagram: 'Instagram', audience_network: 'Audience Network', messenger: 'Messenger' };
const POSITION = {
  feed: 'Fil', facebook_feed: 'Fil', instagram_feed: 'Fil', instagram_stories: 'Stories', facebook_stories: 'Stories', instagram_reels: 'Reels',
  facebook_reels: 'Reels', facebook_reels_overlay: 'Reels (bandeau)', instagram_explore: 'Explorer', right_hand_column: 'Colonne de droite',
  marketplace: 'Marketplace', search: 'Recherche', instream_video: 'Vidéo in-stream', instagram_profile_feed: 'Profil',
};
const BUCKET = { meta: ['Créa Meta', 'green'], webinaire: ['Webinaire', 'navy'], hors_meta: ['Hors Meta', 'muted'], sans_client: ['Sans client', 'red'] };
const humanize = (v) => String(v || '').replace(/_/g, ' ');
const hasLeads = (rows) => (rows || []).some((r) => r.leads > 0);

const money = (key, label, opts = {}) => ({ key, label, align: 'right', format: fmtEur, ...opts });
const money2 = (key, label, opts = {}) => ({ key, label, align: 'right', format: fmtEur2, ...opts });
const int = (key, label, opts = {}) => ({ key, label, align: 'right', format: fmtInt, ...opts });
const compact = (key, label, opts = {}) => ({ key, label, align: 'right', format: fmtCompact, ...opts });
const share = (key, label, opts = {}) => ({ key, label, align: 'right', format: (v) => fmtShare(v, 1), ...opts });
const roas = { key: 'roas', label: 'ROAS', align: 'right', format: fmtRoas, color: (r, T) => (r.roas == null ? T.textFaint : r.roas >= 1 ? T.green : T.red) };
const ventes = { key: 'ventes', label: 'Ventes', align: 'right', format: fmtInt, strong: true, color: (r, T) => (r.ventes ? T.green : T.textFaint) };

function NameCell({ name, sub, creative, status, T }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, maxWidth: 360 }}>
      {creative !== undefined && <CreativeThumb creative={creative} name={name} size={32} radius={T.radiusSm} T={T} />}
      {status !== undefined && <span style={{ width: 7, height: 7, borderRadius: 99, background: status === 'active' ? T.green : T.textFaint, flexShrink: 0 }} title={status === 'active' ? 'Active' : 'Inactive'} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={name}>{name || '—'}</div>
        {sub && <div style={{ fontSize: 11.5, color: T.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </div>
  );
}

// Décision Jev (TypeSafe) : action décidée par le modèle à partir des faits calculés côté serveur.
function JevCell({ jev, T }) {
  if (!jev) return <span style={{ color: T.textFaint }} title="Pas encore analysée par Jev">—</span>;
  const tone = toneColors(T, jev.tone || RECO_TONE[jev.action] || 'muted');
  const title = [(jev.facts || []).join('\n'), jev.confidence != null ? `Confiance ${Math.round(jev.confidence * 100)} %` : ''].filter(Boolean).join('\n');
  return <Pill T={T} color={tone.color} bg={tone.bg} title={title}>{jev.action_label}</Pill>;
}

export const TABS = [
  {
    key: 'creatives', label: 'Créas', source: 'leaderboard', rows: (d) => d?.rows || [], clickable: true, rowKey: (r) => r.name,
    defaultSort: { key: 'score', dir: 'desc' },
    columns: [
      { key: 'name', label: 'Créa', sortValue: (r) => r.name, render: (r, T) => <NameCell name={r.name} sub={r.campaign_name} creative={r.creative} status={r.status || 'active'} T={T} /> },
      { key: 'score', label: 'Score', align: 'right', width: 70, render: (r, T) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Ring value={(r.score || 0) / 100} size={26} stroke={3} color={scoreColor(r.score, T)} T={T} /><span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.score == null ? '—' : Math.round(r.score)}</span></span> },
      money('spend', 'Dépense'),
      { key: 'leads', label: 'Leads', align: 'right', format: fmtInt, sortValue: (r) => Math.max(r.crm_leads || 0, r.leads_meta || 0), render: (r) => fmtInt(Math.max(r.crm_leads || 0, r.leads_meta || 0)) },
      money2('cpl', 'Coût / lead'),
      int('r1_fait', 'R1 tenus'),
      int('r2_fait', 'R2 tenus'),
      ventes,
      money('cac', 'Coût / vente'),
      roas,
      { key: 'jev', label: 'Décision Jev', sortable: false, render: (r, T) => <JevCell jev={r.jev} T={T} /> },
    ],
  },
  {
    key: 'campaigns', label: 'Campagnes', source: 'table_campaign', rows: (d) => d?.rows || [], rowKey: (r) => r.name,
    columns: [
      { key: 'name', label: 'Campagne', sortValue: (r) => r.name, render: (r, T) => <NameCell name={r.name} T={T} /> },
      money('spend', 'Dépense'), compact('impressions', 'Impressions'), int('clicks', 'Clics'), int('leads', 'Leads'), money2('cpl', 'Coût / lead'),
      int('match', 'Retrouvés CRM'), ventes, money('ca', 'CA'), roas,
    ],
  },
  {
    key: 'adsets', label: 'Ensembles', source: 'table_adset', rows: (d) => d?.rows || [], rowKey: (r) => r.name + (r.campaign_name || ''),
    columns: [
      { key: 'name', label: 'Ensemble de publicités', sortValue: (r) => r.name, render: (r, T) => <NameCell name={r.name} sub={r.campaign_name} T={T} /> },
      money('spend', 'Dépense'), compact('impressions', 'Impressions'), int('leads', 'Leads'), money2('cpl', 'Coût / lead'), int('match', 'Retrouvés CRM'), ventes, roas,
    ],
  },
  {
    key: 'ads', label: 'Publicités', source: 'table_ad', rows: (d) => d?.rows || [], clickable: true, rowKey: (r) => r.name,
    columns: [
      { key: 'name', label: 'Publicité', sortValue: (r) => r.name, render: (r, T) => <NameCell name={r.name} sub={r.campaign_name} creative={r.creative} status={r.status || 'active'} T={T} /> },
      money('spend', 'Dépense'), compact('impressions', 'Impressions'), int('clicks', 'Clics'), money2('cpm', 'CPM'), int('leads', 'Leads'), money2('cpl', 'Coût / lead'), ventes, roas,
    ],
  },
  {
    key: 'regions', label: 'Régions', source: 'overview', rows: (d) => d?.geo?.rows || [], rowKey: (r) => r.name,
    columns: (rows) => [
      { key: 'name', label: 'Région', sortValue: (r) => r.name, render: (r, T) => <NameCell name={r.name} T={T} /> },
      compact('reach', 'Personnes touchées'), compact('impressions', 'Impressions'), share('share', 'Part des impressions'), money('spend', 'Dépense'),
      ...(hasLeads(rows) ? [int('leads', 'Leads')] : []),
    ],
  },
  {
    key: 'audience', label: 'Âge et genre', source: 'overview', rows: (d) => (d?.audience?.age_gender || []).filter((r) => r.impressions > 0), rowKey: (r) => `${r.age}-${r.gender}`,
    columns: (rows) => {
      const total = rows.reduce((s, r) => s + (r.impressions || 0), 0) || 1;
      return [
        { key: 'age', label: 'Âge', sortValue: (r) => r.age, render: (r) => (/^unknown$/i.test(r.age) ? 'Non renseigné' : r.age) },
        { key: 'gender', label: 'Genre', sortValue: (r) => r.gender, render: (r) => GENDER[r.gender] || humanize(r.gender) },
        compact('reach', 'Personnes touchées'), compact('impressions', 'Impressions'),
        { key: 'share', label: 'Part des impressions', align: 'right', sortValue: (r) => r.impressions / total, render: (r) => fmtShare(r.impressions / total, 1) },
        money('spend', 'Dépense'), ...(hasLeads(rows) ? [int('leads', 'Leads')] : []),
      ];
    },
  },
  {
    key: 'placements', label: 'Placements', source: 'overview', rows: (d) => d?.placements || [], rowKey: (r) => `${r.platform}-${r.position}`,
    columns: (rows) => [
      { key: 'platform', label: 'Plateforme', sortValue: (r) => r.platform, render: (r) => PLATFORM[r.platform] || humanize(r.platform) },
      { key: 'position', label: 'Placement', sortValue: (r) => r.position, render: (r) => POSITION[r.position] || humanize(r.position) },
      compact('impressions', 'Impressions'), share('share', 'Part des impressions'), money('spend', 'Dépense'), ...(hasLeads(rows) ? [int('leads', 'Leads')] : []),
    ],
  },
  {
    key: 'formats', label: 'Formats', source: 'overview', rows: (d) => (d?.formats || []).filter((f) => f.ads > 0), rowKey: (r) => r.format,
    columns: [
      { key: 'format', label: 'Format', sortValue: (r) => r.format, render: (r) => FORMAT[r.format] || humanize(r.format) },
      int('ads', 'Publicités en compte'), int('active', 'Actives'), money('spend', 'Dépense'), share('share_spend', 'Part de la dépense'), int('leads', 'Leads'),
    ],
  },
  {
    key: 'portfolios', label: 'Portefeuilles', source: 'overview', rows: (d) => d?.portfolios || [], rowKey: (r) => r.key,
    columns: [
      { key: 'label', label: 'Portefeuille', sortValue: (r) => r.label, render: (r, T) => <NameCell name={r.label} sub={`${fmtInt(r.accounts)} compte${r.accounts > 1 ? 's' : ''}`} T={T} /> },
      money('spend', 'Dépense'), compact('impressions', 'Impressions'), compact('reach', 'Personnes touchées'), int('leads', 'Leads'), money2('cpl', 'Coût / lead'),
    ],
  },
  {
    key: 'days', label: 'Jours', source: 'overview', rows: (d) => d?.days || [], rowKey: (r) => r.date, defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'date', label: 'Jour', sortValue: (r) => r.date, render: (r) => fmtDay(r.date) },
      money('spend', 'Dépense'), compact('impressions', 'Impressions'), compact('reach', 'Personnes touchées'), int('clicks', 'Clics'), int('leads', 'Leads'),
      { key: 'cpl', label: 'Coût / lead', align: 'right', sortValue: (r) => (r.leads ? r.spend / r.leads : null), render: (r) => (r.leads ? fmtEur2(r.spend / r.leads) : '—') },
      { key: 'sales', label: 'Ventes', align: 'right', format: fmtInt, strong: true, color: (r, T) => (r.sales ? T.green : T.textFaint) },
    ],
  },
  {
    key: 'sales', label: 'Ventes', source: 'overview', rows: (d) => d?.sales?.detail || [], rowKey: (r) => r.id, defaultSort: { key: 'date', dir: 'desc' },
    columns: [
      { key: 'date', label: 'Date', sortValue: (r) => r.date, render: (r) => fmtDay(r.date) },
      { key: 'client', label: 'Client', sortValue: (r) => r.client, render: (r, T) => <NameCell name={r.client} sub={r.numero_client} T={T} /> },
      { key: 'seller', label: 'Vendeur', sortValue: (r) => r.seller },
      money('amount', 'Montant', { strong: true }),
      { key: 'origin', label: 'Origine du lead', sortValue: (r) => r.origin, render: (r, T) => r.origin || <span style={{ color: T.textFaint }}>—</span> },
      { key: 'attributed_to', label: 'Créa rattachée', sortValue: (r) => r.attributed_to, render: (r, T) => r.attributed_to ? <span>{r.attributed_to}{r.on_row === false && <span style={{ marginLeft: 6, fontSize: 11, color: T.textFaint }}>hors fenêtre</span>}</span> : <span style={{ color: T.textFaint }}>—</span> },
      { key: 'bucket', label: 'Famille', sortValue: (r) => r.bucket, render: (r, T) => { const [l, tone] = BUCKET[r.bucket] || BUCKET.hors_meta; const c = toneColors(T, tone); return <Pill T={T} color={c.color} bg={c.bg}>{l}</Pill>; } },
    ],
  },
];
