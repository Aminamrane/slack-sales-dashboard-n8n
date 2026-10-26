import { useState } from 'react';
import { initials } from './presentation.js';
// Photo préchargée et décodée (avatars.js) : decoding="sync" la peint dans l'image même où elle apparaît.
export function ProfileAvatar({source,person,className=''}){
 const avatar=source.profiles?.[person]?.avatar;const [failed,setFailed]=useState(null);
 return <span className={`vr-avatar ${className}`}>{avatar&&failed!==avatar?<img src={avatar} alt="" decoding="sync" onError={()=>setFailed(avatar)}/>:initials(person)}</span>;
}
