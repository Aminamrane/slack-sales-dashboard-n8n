import React,{useEffect,useRef,useState} from 'react';
import {Bold,Italic,List,ListOrdered,Heading2,Undo2,Redo2} from 'lucide-react';
import {notesToHtml,editorToNotes} from '../../utils/salesNotes';
import './salesJourney.css';
export function SalesNotesView({value}){return <div className="sj-note-content" dangerouslySetInnerHTML={{__html:notesToHtml(value)}}/>;}
export default function SalesNotes({value,onChange,dark=false}){
 const ref=useRef(null),last=useRef(null);const [active,setActive]=useState({});
 useEffect(()=>{if(ref.current&&value!==last.current){ref.current.innerHTML=notesToHtml(value);last.current=value;}},[value]);
 const changed=()=>{const next=editorToNotes(ref.current);last.current=next;onChange(next);setActive({bold:document.queryCommandState('bold'),italic:document.queryCommandState('italic')});};
 const command=(cmd,arg)=>{ref.current.focus();document.execCommand('styleWithCSS',false,false);
 if(cmd==='formatBlock')arg=String(document.queryCommandValue('formatBlock')).toLowerCase().includes('h3')?'p':'h3';
 document.execCommand(cmd,false,arg);changed();};
 return <div className={`sj-note-editor ${dark?'sj-dark':''}`}><div className="sj-note-toolbar" role="toolbar" aria-label="Mise en forme du commentaire">{[['bold','Gras',Bold],['italic','Italique',Italic],['insertUnorderedList','Liste à puces',List],['insertOrderedList','Liste numérotée',ListOrdered],['formatBlock','Titre',Heading2],['undo','Annuler la saisie',Undo2],['redo','Rétablir',Redo2]].map(([cmd,label,Icon])=><button type="button" key={cmd} title={label} aria-label={label} aria-pressed={cmd==='bold'||cmd==='italic'?!!active[cmd]:undefined} onMouseDown={e=>e.preventDefault()} onClick={()=>command(cmd,cmd==='formatBlock'?'h3':undefined)}><Icon size={16}/></button>)}</div><div ref={ref} className="sj-note-content sj-note-input" contentEditable suppressContentEditableWarning role="textbox" aria-label="Commentaire" aria-multiline="true" onInput={changed} onKeyUp={()=>setActive({bold:document.queryCommandState('bold'),italic:document.queryCommandState('italic')})} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));changed();}} onDrop={e=>e.preventDefault()} data-placeholder="Les points clés de votre échange…"/></div>;
}
