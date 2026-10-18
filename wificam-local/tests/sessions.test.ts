import { describe,it,expect } from 'vitest';
import { Sessions,authenticate,type Client } from '../server/sessions';
import { parseSignal } from '../server/protocol';
const tokens={publisher:'a'.repeat(64),viewer:'b'.repeat(64)};
function client(){const messages:Record<string,unknown>[]=[];const c:Client={send:s=>messages.push(JSON.parse(s)),close:()=>{}};return {c,messages};}
describe('autenticação e validação',()=>{
  it('separa os papéis e recusa tokens anónimos ou trocados',()=>{expect(authenticate('publisher',tokens.publisher,tokens)).toBe('publisher');expect(authenticate('viewer',tokens.viewer,tokens)).toBe('viewer');for(const [r,t]of [['publisher',tokens.viewer],['viewer',''],['admin',tokens.publisher],['publisher',null]])expect(authenticate(r,t,tokens)).toBeNull();});
  it('recusa mensagens inválidas e limita SDP/ICE',()=>{for(const raw of ['bad','null','[]','{}',JSON.stringify({type:'offer',session:'x',sdp:'a'}),JSON.stringify({type:'ice',session:'a'.repeat(36),candidate:{candidate:5}}),JSON.stringify({type:'offer',session:'a'.repeat(36),sdp:'x'.repeat(60001)})])expect(parseSignal(raw)).toBeNull();expect(parseSignal('{"type":"ready"}')).toEqual({type:'ready'});});
});
describe('sessões e encaminhamento',()=>{
  it.each(['publisher-first','viewer-first'])('recupera %s e encaminha offer, answer e trickle ICE',order=>{
    const s=new Sessions(),p=client(),v=client();
    if(order==='publisher-first'){s.join('publisher',p.c);s.receive('publisher',{type:'ready'});s.join('viewer',v.c);}else{s.join('viewer',v.c);s.join('publisher',p.c);s.receive('publisher',{type:'ready'});}
    const session=s.session!;expect(session).toBeTruthy();expect(p.messages.at(-1)?.type).toBe('negotiate');expect(v.messages.at(-1)?.type).toBe('prepare');
    expect(s.receive('publisher',{type:'offer',session,sdp:'offer'})).toBe(true);expect(v.messages.at(-1)?.sdp).toBe('offer');
    expect(s.receive('viewer',{type:'answer',session,sdp:'answer'})).toBe(true);expect(p.messages.at(-1)?.sdp).toBe('answer');
    const ice={type:'ice' as const,session,candidate:{candidate:'candidate:host'}};expect(s.receive('publisher',ice)).toBe(true);expect(v.messages.at(-1)).toEqual(ice);
    expect(s.receive('viewer',{type:'ready'})).toBe(false);expect(s.receive('viewer',{type:'stop'})).toBe(false);expect(s.receive('viewer',{type:'offer',session,sdp:'bad'})).toBe(false);expect(s.receive('publisher',{type:'answer',session,sdp:'bad'})).toBe(false);
  });
  it('limita viewers, limpa desconexão e cria nova sessão após refresh',()=>{
    const s=new Sessions(),p=client(),v=client();s.join('publisher',p.c);s.join('viewer',v.c);s.receive('publisher',{type:'ready'});const old=s.session!;
    expect(s.join('viewer',client().c)).toBe(false);s.leave('viewer',v.c);expect(s.session).toBeNull();expect(p.messages.at(-1)?.type).toBe('peer-left');
    const next=client();s.join('viewer',next.c);expect(s.session).not.toBe(old);expect(s.receive('publisher',{type:'offer',session:old,sdp:'stale'})).toBe(false);
    s.leave('viewer',v.c);expect(s.clients.viewer).toBe(next.c);s.receive('publisher',{type:'stop'});expect(s.ready).toBe(false);expect(next.messages.at(-1)?.type).toBe('stopped');
    s.leave('publisher',p.c);expect(s.status().publisher).toBe(false);
  });
  it('reinicia negociação com retry',()=>{const s=new Sessions();s.join('publisher',client().c);s.join('viewer',client().c);s.receive('publisher',{type:'ready'});const old=s.session;s.receive('viewer',{type:'retry'});expect(s.session).not.toBe(old);});
});
