// Fiche d'un sales : un volet à la fois (Analyses, Appels, Vidéos, Notes & transcriptions, Partagés, Bilan de la semaine).
// Les dossiers (scorecard, bilan de coaching, appels Allo) et la visionneuse gardent leur propre mise en page : seul le cadre autour change.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, ChartNoAxesCombined, FileText, LoaderCircle, Phone, Share2, Video } from 'lucide-react';
import apiClient from '../../services/apiClient';
import ScorecardView from '../ScorecardView.jsx';
import RecordingViewerModal from '../RecordingViewerModal.jsx';
import WeeklyBilanView from '../WeeklyBilanView.jsx';
import SalesCallsPanel from '../SalesCallsPanel.jsx';
import ErrorBoundary from '../ErrorBoundary.jsx';
import { fmtDate, fmtN, prospectName, scoreBand, sortScorecards, splitFiles } from './recordingsData';
import { Avatar, Empty, Failed, Skeleton } from './parts';

const FONT_ID = 'owner-scorecard-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap';

const Load = ({ label }) => <div className="rc-load" role="status"><LoaderCircle size={20} className="rc-spin" aria-hidden="true" />{label}</div>;

export default function RecordingsDetail({ sales, onBack, C, darkMode, initialTab = 'analyses', loadingFiles = false }) {
  const [tab, setTab] = useState(initialTab);
  const [scList, setScList] = useState(null);
  const [scLoading, setScLoading] = useState(false);
  const [scError, setScError] = useState(false);
  const [selId, setSelId] = useState(null);
  const [scData, setScData] = useState(null);
  const [scDataLoading, setScDataLoading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [bilanLoading, setBilanLoading] = useState(false);

  useEffect(() => { setTab(initialTab); setViewing(null); }, [sales.email, initialTab]);

  // Polices des dossiers (bilan, scorecard) : chargées une fois pour la page.
  useEffect(() => {
    if (document.getElementById(FONT_ID)) return;
    const l = document.createElement('link');
    l.id = FONT_ID; l.rel = 'stylesheet'; l.href = FONT_HREF;
    document.head.appendChild(l);
  }, []);

  // Le bilan de la semaine ne se lit qu'à l'ouverture de son volet (avant : à chaque ouverture de fiche, même sans le regarder).
  useEffect(() => { setBilan(null); setBilanLoading(false); }, [sales.email, sales.period]);
  useEffect(() => {
    if (tab !== 'bilan' || bilan) return undefined;
    let alive = true;
    setBilanLoading(true);
    apiClient.getRecordingAnalysis(sales.email, 'sales_weekly', sales.period)
      .then((r) => { if (alive) setBilan(r?.payload || null); })
      .catch(() => {})
      .finally(() => { if (alive) setBilanLoading(false); });
    return () => { alive = false; };
  }, [tab, bilan, sales.email, sales.period]);

  useEffect(() => {
    let alive = true;
    setScLoading(true); setScError(false); setScList(null); setSelId(null);
    apiClient.getScorecards(sales.email)
      .then((r) => {
        if (!alive) return;
        const list = sortScorecards(r?.scorecards);
        setScList(list);
        if (list[0]) setSelId(list[0].id);
      })
      .catch(() => { if (alive) setScError(true); })
      .finally(() => { if (alive) setScLoading(false); });
    return () => { alive = false; };
  }, [sales.email]);

  useEffect(() => {
    if (!selId) { setScData(null); return undefined; }
    let alive = true;
    setScDataLoading(true); setScData(null);
    apiClient.getScorecard(selId)
      .then((r) => { if (alive) setScData(r?.payload || null); })
      .catch(() => {})
      .finally(() => { if (alive) setScDataLoading(false); });
    return () => { alive = false; };
  }, [selId]);

  const { videos, notes, shared } = useMemo(() => splitFiles(sales.recordings), [sales]);

  const TABS = [
    { key: 'analyses', label: 'Analyses', icon: ChartNoAxesCombined, tone: 'blue', n: scList?.length ?? sales.nb_scored ?? 0 },
    { key: 'calls', label: 'Appels', icon: Phone, tone: 'green', n: sales.nb_calls ?? undefined },
    { key: 'videos', label: 'Vidéos', icon: Video, tone: 'peach', n: videos.length },
    { key: 'transcriptions', label: 'Notes & transcriptions', icon: FileText, tone: 'amber', n: notes.length },
    ...(shared.length ? [{ key: 'shared', label: 'Partagés avec ce sales', icon: Share2, tone: 'terra', n: shared.length }] : []),
    { key: 'bilan', label: 'Bilan de la semaine', icon: BookOpen, tone: 'blue' },
  ];

  const filesBody = () => {
    const files = tab === 'videos' ? videos : tab === 'shared' ? shared : notes;
    if ((sales.files_loading ?? loadingFiles) && !files.length) return <Load label="Chargement des fichiers…" />;
    if (!files.length) return <Empty>{tab === 'videos' ? 'Aucune vidéo disponible pour le moment.' : 'Aucun document disponible pour le moment.'}</Empty>;
    return (
      <div className="rc-files">
        {files.map((r) => {
          const isVideo = r.kind === 'video';
          const Glyph = isVideo ? Video : FileText;
          return (
            <button type="button" key={r.id} className="rc-file" onClick={() => setViewing({ rec: r, mode: isVideo ? 'video' : 'transcription' })}>
              <span className={`rc-chip is-${isVideo ? 'peach' : 'amber'}`} aria-hidden="true"><Glyph size={15} strokeWidth={2} /></span>
              <span className="rc-file-t">
                <b>{r.name}</b>
                <span className="rc-file-m">
                  {fmtDate(r.created)}{r.rdv ? ` · ${r.rdv}` : ''}
                  {r.shared && <span className="rc-tag is-terra">Document partagé</span>}
                </span>
              </span>
              <span className="rc-file-go"><span>{isVideo ? 'Voir la vidéo' : 'Ouvrir'}</span><ArrowUpRight size={16} aria-hidden="true" /></span>
            </button>
          );
        })}
      </div>
    );
  };

  let panel;
  let bare = false;
  if (tab === 'calls') {
    bare = true;
    panel = <ErrorBoundary key={`calls-${sales.email}`}><SalesCallsPanel email={sales.email} name={sales.name} linked={sales.allo_linked !== false} /></ErrorBoundary>;
  } else if (tab === 'bilan') {
    bare = !bilanLoading;
    panel = bilanLoading
      ? <Load label="Chargement du bilan…" />
      : <ErrorBoundary key={`bilan-${sales.email}`}><WeeklyBilanView bilan={bilan} salesName={sales.name} avatarUrl={sales.avatar_url} team={sales.team} /></ErrorBoundary>;
  } else if (tab === 'analyses') {
    if (scLoading) panel = <Skeleton kind="block" />;
    else if (scError) panel = <Failed>Les analyses n’ont pas pu être chargées. Revenez à la liste pour réessayer.</Failed>;
    else if (!scList || scList.length === 0) panel = <Empty>Aucune analyse disponible pour le moment.</Empty>;
    else {
      panel = (
        <div className="rc-split">
          <div className="rc-rdvs" role="group" aria-label="Rendez-vous analysés">
            {scList.map((sc) => (
              <button type="button" key={sc.id} className="rc-rdv" aria-pressed={String(sc.id) === String(selId)} onClick={() => setSelId(sc.id)}>
                <span className={`rc-tag ${sc.rdv_type === 'R2' ? 'is-peach' : 'is-blue'}`}>{sc.rdv_type === 'R2' ? 'R2' : 'R1'}</span>
                <span className="rc-rdv-t"><b>{prospectName(sc)}</b><span>{fmtDate(sc.rdv_date)}</span></span>
                <span className={`rc-score is-${scoreBand(sc.score)}`}>{fmtN(sc.score)}</span>
              </button>
            ))}
          </div>
          <div className="rc-paper">
            {scDataLoading ? <Load label="Chargement de la scorecard…" />
              : scData ? <ErrorBoundary key={selId}><ScorecardView sc={scData} /></ErrorBoundary>
                : <div className="rc-paper-empty">Sélectionnez un RDV à gauche.</div>}
          </div>
        </div>
      );
    }
  } else {
    panel = filesBody();
  }

  const analyses = sales.nb_scored;
  return (
    <>
      <button type="button" className="rc-back" onClick={onBack} title="Retour"><ArrowLeft size={16} aria-hidden="true" />Retour</button>
      <div className="rc-who">
        <Avatar src={sales.avatar_url} name={sales.name} large />
        <div>
          <h1><span>{sales.name}</span></h1>
          {(sales.team || analyses) ? (
            <div className="rc-who-meta">
              {sales.team && <span className="rc-tag is-blue">{sales.team}</span>}
              {analyses ? <span className="rc-tag">{fmtN(analyses)} analyse{analyses > 1 ? 's' : ''}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="rc-tabs" role="group" aria-label="Volets de la fiche">
        {TABS.map((t) => (
          <button type="button" key={t.key} className={`rc-tab is-${t.tone}`} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>
            <t.icon size={15} strokeWidth={2} aria-hidden="true" />{t.label}{t.n != null && <span className="rc-tab-n">{fmtN(t.n)}</span>}
          </button>
        ))}
      </div>
      <div key={tab} className={`rc-panel${bare ? ' is-bare' : ''}`}>{panel}</div>
      {viewing && <RecordingViewerModal rec={viewing.rec} mode={viewing.mode} onClose={() => setViewing(null)} C={C} darkMode={darkMode} />}
    </>
  );
}
