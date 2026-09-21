import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Search, Video, FileText, Captions, ChartNoAxesCombined, Users, ArrowUpRight, RefreshCw, FolderOpen, Share2, LoaderCircle } from 'lucide-react';
import './SalesRecordings.css';

const number = value => value == null ? '—' : new Intl.NumberFormat('fr-FR').format(value);
function Avatar({name='',url}) {
  return url ? <img className="recordings-avatar" src={url} alt=""/> : <span className="recordings-avatar">{name.split(' ').filter(Boolean).slice(0,2).map(s=>s[0]).join('')}</span>;
}
export default function SalesRecordingsGrid({data,loading,videosLoading,error,onRefresh,refreshing,onSelectSales,avatars={},darkMode}) {
  const [search,setSearch]=useState('');
  const [team,setTeam]=useState('');
  const reduce=useReducedMotion();
  const sales=data?.sales||[];
  const teams=useMemo(()=>[...new Set(sales.map(s=>s.team||'Sans équipe'))],[sales]);
  const filtered=sales.filter(s=>(!team||(s.team||'Sans équipe')===team)&&`${s.name||s.full_name||''} ${s.email}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  // Notes et transcriptions comptées séparément : une note Gemini résume le
  // rendez-vous, seule la transcription en contient le verbatim (et permet donc
  // l'analyse). Le backend distingue les deux, la page ne les mélange plus.
  const totals=[{Icon:Users,value:sales.length,label:'Sales actifs'},{Icon:ChartNoAxesCombined,value:sales.reduce((n,s)=>n+(s.nb_scored||0),0),label:'Analyses'},{Icon:Video,value:data?.totals?.videos,label:'Vidéos'},{Icon:Captions,value:data?.totals?.transcriptions,label:'Transcriptions'},{Icon:FileText,value:data?.totals?.notes,label:'Notes Gemini'}];
  return <section className={`sales-recordings-ui${darkMode?' is-dark':''}`} aria-label="Enregistrements des équipes">
    <div className="recordings-summary">{totals.map(({Icon,value,label})=><div className="recordings-stat" key={label}><span className="recordings-icon"><Icon size={22} strokeWidth={1.7}/></span><div><strong>{value == null && (loading || videosLoading) ? <LoaderCircle size={23} className="is-spinning" aria-label="Chargement" /> : loading&&!data?'—':number(value)}</strong><span>{label}</span></div></div>)}</div>
    <div className="recordings-toolbar"><label className="recordings-search"><Search size={18}/><input aria-label="Rechercher un sales" placeholder="Rechercher un sales…" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filtrer par équipe" value={team} onChange={e=>setTeam(e.target.value)}><option value="">Toutes les équipes</option>{teams.map(t=><option key={t}>{t}</option>)}</select><button className="recordings-refresh" disabled={refreshing||videosLoading} onClick={()=>onRefresh?.()}><RefreshCw size={17} className={refreshing||videosLoading?'is-spinning':''}/>{refreshing||videosLoading?'Actualisation…':'Actualiser'}</button></div>
    {error&&<div role="alert" className="recordings-empty">Les enregistrements n’ont pas pu être chargés. <button onClick={()=>onRefresh?.()}>Réessayer</button></div>}
    {!loading&&!error&&!filtered.length&&<div className="recordings-empty"><FolderOpen size={28}/><p>Aucun sales ne correspond à cette recherche.</p></div>}
    {teams.filter(t=>filtered.some(s=>(s.team||'Sans équipe')===t)).map(t=><section className="recordings-team" key={t}><h3>{t}<span>{filtered.filter(s=>(s.team||'Sans équipe')===t).length}</span></h3><div className="recordings-grid">{filtered.filter(s=>(s.team||'Sans équipe')===t).map((s,i)=>{
      const name=s.name||s.full_name||s.email;
      const shared=s.nb_shared??s.recordings?.filter(r=>r.shared).length??0;
      return <motion.article className="recordings-person" key={s.email} initial={reduce?false:{opacity:0,y:7}} animate={{opacity:1,y:0}} transition={{duration:reduce?0:.28,delay:reduce?0:Math.min(i*.025,.12),ease:[.16,1,.3,1]}}>
        <button className="recordings-person-heading" onClick={()=>onSelectSales(s.email,s.nb_scored?'analyses':'transcriptions')}><Avatar name={name} url={avatars[s.email.toLowerCase()]}/><strong>{name}</strong><ArrowUpRight size={17}/></button>
        <div className="recordings-actions is-four">{[{key:'videos',Icon:Video,n:s.nb_videos,label:'Vidéos'},{key:'transcriptions',Icon:Captions,n:s.nb_transcriptions,label:'Transcriptions'},{key:'notes',Icon:FileText,n:s.nb_notes,label:'Notes'},{key:'analyses',Icon:ChartNoAxesCombined,n:s.nb_scored,label:'Analyses'}].map(({key,Icon,n,label})=><button key={key} onClick={()=>onSelectSales(s.email,key)} aria-label={`${label} de ${name} : ${number(n)}`}><Icon size={19} strokeWidth={1.7}/><strong>{n == null && videosLoading ? <LoaderCircle size={20} className="is-spinning" aria-label="Chargement" /> : number(n)}</strong><span>{label}</span></button>)}</div>
        {shared>0&&<button className="recordings-shared" onClick={()=>onSelectSales(s.email,'shared')}><Share2 size={15}/>{number(shared)} document{shared>1?'s':''} partagé{shared>1?'s':''}<ArrowUpRight size={14}/></button>}
        {s.error&&<div className="recordings-access-note">Accès aux fichiers à rétablir</div>}
      </motion.article>;
    })}</div></section>)}
  </section>;
}
