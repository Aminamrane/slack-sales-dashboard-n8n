// Markdown subset, escaped before any markup is introduced. No raw HTML or URLs.
export const escapeNote = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inline(value){return escapeNote(value).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');}
export function notesToHtml(value) {
  const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n');let html='',list='';
  for(const line of lines){const bullet=line.match(/^\s*[-•] (.*)$/),number=line.match(/^\s*\d+\. (.*)$/),kind=bullet?'ul':number?'ol':'';
    if(list!==kind){if(list)html+=`</${list}>`;if(kind)html+=`<${kind}>`;list=kind;}
    if(kind)html+=`<li>${inline((bullet||number)[1])}</li>`;
    else if(line.startsWith('## '))html+=`<h3>${inline(line.slice(3))}</h3>`;
    else html+=`<div>${inline(line)||'<br>'}</div>`;
  }return html+(list?`</${list}>`:'');
}
export function editorToNotes(root){
  function walk(node){
    if(node.nodeType===3)return node.textContent.replace(/\u00a0/g,' ');
    if(node.nodeType!==1)return '';
    const tag=node.tagName;
    if(['SCRIPT','STYLE','IFRAME','OBJECT'].includes(tag))return '';
    if(tag==='BR')return '\n';
    if(tag==='UL'||tag==='OL')return '\n'+[...node.children].map((li,i)=>(tag==='OL'?`${i+1}. `:'- ')+[...li.childNodes].map(walk).join('').trim()).join('\n')+'\n';
    const text=[...node.childNodes].map(walk).join('');
    if(tag==='STRONG'||tag==='B')return text?'**'+text+'**':'';
    if(tag==='EM'||tag==='I')return text?'*'+text+'*':'';
    if(/^H[1-6]$/.test(tag))return '\n## '+text.trim()+'\n';
    if(tag==='DIV'||tag==='P')return text.endsWith('\n')?text:text+'\n';
    return text;
  }
  return [...root.childNodes].map(walk).join('').replace(/\n{3,}/g,'\n\n').replace(/^\n|\n$/g,'');
}
