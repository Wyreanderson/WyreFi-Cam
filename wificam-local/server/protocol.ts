export type Role = 'publisher' | 'viewer';
export type Signal = {type:'offer'|'answer'; session:string; sdp:string} | {type:'ice'; session:string; candidate:Record<string,unknown>|null} | {type:'ready'} | {type:'stop'} | {type:'retry'};
export function parseSignal(raw:string): Signal | null {
  try {
    const m:unknown=JSON.parse(raw);
    if (!m || typeof m!=='object' || Array.isArray(m)) return null;
    const o=m as Record<string,unknown>;
    if (['ready','stop','retry'].includes(String(o.type))) return {type:o.type as 'ready'|'stop'|'retry'};
    if(typeof o.session!=='string'||!/^[a-f0-9-]{36}$/.test(o.session)) return null;
    if((o.type==='offer'||o.type==='answer')&&typeof o.sdp==='string'&&o.sdp.length>0&&o.sdp.length<=60000) return {type:o.type,session:o.session,sdp:o.sdp};
    if(o.type==='ice') {
      if(o.candidate===null) return {type:'ice',session:o.session,candidate:null};
      const c=o.candidate;
      if(!c||typeof c!=='object'||Array.isArray(c)) return null;
      const v=c as Record<string,unknown>;
      if(typeof v.candidate!=='string'||v.candidate.length>4096) return null;
      if(v.sdpMid!==undefined&&v.sdpMid!==null&&typeof v.sdpMid!=='string') return null;
      if(v.sdpMLineIndex!==undefined&&v.sdpMLineIndex!==null&&(!Number.isInteger(v.sdpMLineIndex)||Number(v.sdpMLineIndex)<0)) return null;
      if(v.usernameFragment!==undefined&&v.usernameFragment!==null&&typeof v.usernameFragment!=='string') return null;
      return {type:'ice',session:o.session,candidate:{candidate:v.candidate,sdpMid:v.sdpMid,sdpMLineIndex:v.sdpMLineIndex,usernameFragment:v.usernameFragment}};
    }
    return null;
  }catch{return null;}
}
