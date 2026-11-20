import { memo, useDeferredValue, useMemo, useState } from 'react';
import { ArrowUpRight, ChartNoAxesCombined, FileText, FolderOpen, LoaderCircle, Phone, RefreshCw, Search, Share2, TriangleAlert, Users, Video } from 'lucide-react';
import { callsOf, fmtN, groupTeams, salesName, sharedCount, teamOf, totalsOf } from './recordingsData';
import { Avatar, Empty, Failed, Skeleton } from './parts';

// L'onglet « Équipes » : le bilan des enregistrements, la recherche, puis une feuille par équipe avec une carte par sales (4 compteurs cliquables + partagés).
// Chaque compteur ouvre la fiche du sales sur l'onglet correspondant ; le nom ouvre la fiche (Analyses s'il y en a, sinon Notes & transcriptions, comme avant).

// Un chiffre : ombre de chargement tant qu'il est inconnu ET en cours de lecture, « — » s'il reste inconnu après, jamais 0 inventé.
function Value({ value, pending }) {
  if (value == null && pending) return <i className="rc-skel rc-skel-n" role="status" aria-label="Chargement" />;
  return fmtN(value);
}

const Figure = ({ icon, tone, label, value, pending }) => {
  const Glyph = icon;
  return (
    <div className="rc-fig">
      <span className="rc-fig-label"><span className={`rc-chip is-${tone}`} aria-hidden="true"><Glyph size={15} strokeWidth={2} /></span>{label}</span>
      <span className="rc-fig-value"><Value value={value} pending={pending} /></span>
    </div>
  );
};

const COUNTERS = [
  { key: 'calls', icon: Phone, tone: 'green', label: 'Appels' },
  { key: 'videos', icon: Video, tone: 'peach', label: 'Vidéos' },
  { key: 'transcriptions', icon: FileText, tone: 'amber', label: 'Documents' },
  { key: 'analyses', icon: ChartNoAxesCombined, tone: 'blue', label: 'Analyses' },
];

const Person = memo(function Person({ s, avatar, calls, videosLoading, onSelect }) {
  const name = salesName(s);
  const shared = sharedCount(s);
  const values = {
    calls: callsOf(s, calls),
    videos: { value: s.nb_videos ?? null, pending: videosLoading },
    transcriptions: { value: s.nb_transcriptions ?? null, pending: videosLoading },
    analyses: { value: s.nb_scored ?? null, pending: videosLoading },
  };
  return (
    <article className="rc-person">
      <span className="rc-cover" aria-hidden="true" />
      <button type="button" className="rc-open" onClick={() => onSelect(s.email, s.nb_scored ? 'analyses' : 'transcriptions')} title={s.email}>
        <span className="rc-sticker"><Avatar key={avatar || s.email} src={avatar} name={name} /></span>
        <b>{name}</b>
      </button>
      <ArrowUpRight className="rc-arrow" size={15} strokeWidth={2} aria-hidden="true" />
      <div className="rc-counts">
        {COUNTERS.map(({ key, icon, tone, label }) => {
          const Glyph = icon;
          const { value, pending } = values[key];
          return (
            <button type="button" key={key} className={`rc-count${value === 0 ? ' is-zero' : ''}`} onClick={() => onSelect(s.email, key)}>
              <span className={`rc-chip is-${tone}`} aria-hidden="true"><Glyph size={14} strokeWidth={2} /></span>
              <span className="rc-count-t"><b><Value value={value} pending={pending} /></b><span>{label}<i className="rc-sr"> de {name}</i></span></span>
            </button>
          );
        })}
      </div>
      {(shared > 0 || s.error) && (
        <div className="rc-person-foot">
          {shared > 0 && (
            <button type="button" className="rc-shared" onClick={() => onSelect(s.email, 'shared')}>
              <Share2 size={14} aria-hidden="true" />{fmtN(shared)} document{shared > 1 ? 's' : ''} partagé{shared > 1 ? 's' : ''}<ArrowUpRight size={13} aria-hidden="true" />
            </button>
          )}
          {s.error && <span className="rc-tag is-amber"><TriangleAlert size={12} aria-hidden="true" />Accès aux fichiers à rétablir</span>}
        </div>
      )}
    </article>
  );
});

const Team = memo(function Team({ group, avatars, calls, videosLoading, onSelect }) {
  const titleId = `rc-team-${group.key.replace(/\W+/g, '-')}`;
  const n = group.members.length;
  return (
    <section className={`rc-card${group.tone ? ` rc-tone-${group.tone}` : ''}`} aria-labelledby={titleId}>
      <header className="rc-card-head">
        <h2 id={titleId}>{group.label}</h2>
        <span className="rc-card-meta">{fmtN(n)} sales</span>
      </header>
      <ul className="rc-people">
        {group.members.map((s) => (
          <li key={s.email}><Person s={s} avatar={avatars[String(s.email || '').toLowerCase()]} calls={calls} videosLoading={videosLoading} onSelect={onSelect} /></li>
        ))}
      </ul>
    </section>
  );
});

export default function RecordingsBoard({ data, loading, videosLoading, error, onRefresh, refreshing, onSelectSales, avatars = {}, calls }) {
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('');
  const query = useDeferredValue(search);
  const sales = data?.sales;
  const { teams, groups } = useMemo(() => groupTeams(sales, { query, team }), [sales, query, team]);
  const counts = useMemo(() => {
    const m = {};
    for (const s of sales || []) { const k = teamOf(s); m[k] = (m[k] || 0) + 1; }
    return m;
  }, [sales]);
  const t = totalsOf(data, calls);
  const busy = refreshing || videosLoading;
  // « Les fichiers n'ont pas tous pu être actualisés » (un scan Drive a échoué pour un compte) : pas de bandeau ni d'étiquette, les fichiers déjà connus restent affichés
  // et le serveur retente seul ; un message affiché à chaque visite donnait l'impression d'une erreur permanente. Le bandeau ne reste que pour les vraies pannes
  // (lecture impossible, actualisation interrompue) ; « Accès aux fichiers à rétablir » (compte sans accès) reste sur la carte, comme avant.
  const showError = !!error && !/pas tous pu/.test(error);
  const pendingFiles = loading || videosLoading;

  let body;
  if (!data && loading) body = <Skeleton />;
  else if (!groups.length && !error) {
    body = (
      <Empty><FolderOpen size={22} aria-hidden="true" /><span>{(sales || []).length ? 'Aucun sales ne correspond à cette recherche.' : 'Aucun sales à afficher pour le moment.'}</span></Empty>
    );
  } else {
    body = (
      <div className="rc-teams">
        {groups.map((g) => <Team key={g.key} group={g} avatars={avatars} calls={calls} videosLoading={videosLoading} onSelect={onSelectSales} />)}
      </div>
    );
  }

  return (
    <>
      <section className="rc-summary" aria-label="Bilan des enregistrements">
        <Figure icon={Users} tone="blue" label="Sales actifs" value={t.sales} pending={loading && !data} />
        <Figure icon={Phone} tone="green" label="Appels ce mois-ci" value={t.calls} pending={!!calls?.loading} />
        <Figure icon={ChartNoAxesCombined} tone="amber" label="Analyses" value={t.scored} pending={loading && !data} />
        <Figure icon={Video} tone="peach" label="Vidéos" value={t.videos} pending={pendingFiles} />
        <Figure icon={FileText} tone="terra" label="Notes & transcriptions" value={t.docs} pending={pendingFiles} />
      </section>

      <div className="rc-bar">
        <label className="rc-search">
          <Search size={16} aria-hidden="true" />
          <input aria-label="Rechercher un sales" placeholder="Rechercher un sales…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {teams.length > 1 && (
          <div className="rc-pills" role="group" aria-label="Filtrer par équipe">
            <button type="button" className="rc-pill" aria-pressed={!team} onClick={() => setTeam('')}>Toutes les équipes</button>
            {teams.map((name) => (
              <button type="button" key={name} className="rc-pill" aria-pressed={team === name} onClick={() => setTeam(team === name ? '' : name)}>
                {name}<small>{counts[name] || 0}</small>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="rc-refresh" disabled={busy} onClick={() => onRefresh?.()}>
          {busy ? <LoaderCircle size={16} className="rc-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
          {busy ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {showError && (data
        // Des données sont là (liste légère ou fichiers déjà connus) : simple avertissement, avec la vraie phrase de la page.
        ? (
          <div className="rc-state is-warn" role="alert">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>{/^(Les fichiers|L[’']actualisation)/.test(error) ? error : 'Les enregistrements n’ont pas pu être actualisés.'}{data.light ? '' : ' Les fichiers déjà connus restent affichés.'}</span>
            <button type="button" className="rc-retry" onClick={() => onRefresh?.()}>Réessayer</button>
          </div>
        )
        : <Failed onRetry={() => onRefresh?.()}>Les enregistrements n’ont pas pu être chargés.</Failed>)}
      <div aria-busy={!data && loading}>{body}</div>
    </>
  );
}
