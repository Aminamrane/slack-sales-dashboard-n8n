import { useState } from 'react';
import { initials } from './presentation.js';
export function ProfileAvatar({source,person,className=''}){
 const avatar=source.profiles?.[person]?.avatar;const [failed,setFailed]=useState(null);
 return <span className={`vr-avatar ${className}`}>{avatar&&failed!==avatar?<img src={avatar} alt="" onError={()=>setFailed(avatar)}/>:initials(person)}</span>;
}
