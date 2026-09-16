import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Bell, TrendingDown, Mail, CheckCheck, X, ArrowUpRight } from 'lucide-react';
import { notificationDate } from '../utils/notificationPresentation.js';
import './GlobalNotifications.css';

function Icon({ notification }) {
  const Glyph = notification.type === 'owner_rating_regression' ? TrendingDown : notification.type === 'sheet_invitation' ? Mail : Bell;
  return <span className="owner-notif-icon"><Glyph size={19} strokeWidth={1.8} aria-hidden="true" /></span>;
}
export function GlobalNotificationPanel({ notifications, tab, setTab, unreadCount, onReadAll, onOpen, onClose, darkMode, position, panelRef }) {
  const [expanded, setExpanded] = useState({});
  const reduceMotion = useReducedMotion();
  return <motion.section ref={panelRef} className={`owner-notif-panel${darkMode ? ' is-dark' : ''}`} style={position} role="dialog" aria-label="Notifications" aria-modal="false" initial={reduceMotion ? false : {opacity:0,y:-8,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:reduceMotion?0:-6}} transition={{duration:reduceMotion?0:.28,ease:[.16,1,.3,1]}}>
    <header className="owner-notif-header"><h2>Notifications</h2><button aria-label="Fermer les notifications" onClick={onClose}><X size={18}/></button></header>
    <div className="owner-notif-toolbar"><div className="owner-notif-tabs">
      {[['unread','Non lues'],['read','Lues']].map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}{key==='unread' && unreadCount>0 && <span>{unreadCount}</span>}</button>)}
    </div>{unreadCount>0 && <button className="owner-notif-read-all" onClick={onReadAll}><CheckCheck size={16}/>Tout lire</button>}</div>
    <div className="owner-notif-list">
      {notifications.filter(n=>tab==='unread'?!n.read:n.read).map(n=>{
        const date=notificationDate(n.created_at); const message=n.message!==n.title?n.message:'';
        return <article key={n.id} className={`owner-notif-item${n.read?'':' is-unread'}`} onClick={e=>{if(!e.target.closest('button'))onOpen(n);}}>
          <Icon notification={n}/><div className="owner-notif-content">
            <button className="owner-notif-title" onClick={()=>onOpen(n)}>{n.title||n.message}</button>
            <time dateTime={date.iso}>{date.label}</time>
            {message && <p className={expanded[n.id]?'':'is-excerpt'}>{message}</p>}
            {message && (message.length>180 || message.split('\n').length>4) && <button className="owner-notif-expand" aria-expanded={!!expanded[n.id]} onClick={()=>setExpanded(e=>({...e,[n.id]:!e[n.id]}))}>{expanded[n.id]?'Réduire':'Lire la suite'}</button>}
          </div>{!n.read && <span className="owner-notif-unread-dot" aria-label="Non lue"/>}
        </article>;
      })}
      {!notifications.some(n=>tab==='unread'?!n.read:n.read) && <div className="owner-notif-empty"><Bell size={24}/><p>{tab==='unread'?'Aucune nouvelle notification':'Aucune notification lue'}</p></div>}
    </div>
  </motion.section>;
}
export function GlobalNotificationPreview({ notification, onOpen, onClose, onPause, darkMode, position }) {
  const reduceMotion=useReducedMotion();
  return <motion.aside className={`owner-notif-preview${darkMode?' is-dark':''}`} style={position} initial={reduceMotion?false:{opacity:0,y:-10,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:reduceMotion?0:-8,scale:reduceMotion?1:.98}} transition={{duration:reduceMotion?0:.32,ease:[.16,1,.3,1]}} onMouseEnter={()=>onPause(true)} onMouseLeave={()=>onPause(false)} onFocus={()=>onPause(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))onPause(false);}}>
    <div className="owner-notif-preview-top"><span role="status">Nouvelle notification</span><button onClick={onClose} aria-label="Fermer l’aperçu"><X size={16}/></button></div>
    <button className="owner-notif-preview-open" onClick={()=>onOpen(notification)}><Icon notification={notification}/><span><strong>{notification.title||'Notification'}</strong><span className="owner-notif-preview-text">{notification.message}</span><span className="owner-notif-preview-link">{notification.type==='owner_rating_regression'?'Voir le client dans le board':'Voir la notification'} <ArrowUpRight size={14}/></span></span></button>
  </motion.aside>;
}
