import { randomUUID, timingSafeEqual } from 'node:crypto';
import { type Role, type Signal } from './protocol.js';
export interface Client { send(data:string):void; close(code:number,reason:string):void }
export function authenticate(role:string|null,token:string|null,tokens:Record<Role,string>):Role|null {
  if(role!=='publisher'&&role!=='viewer') return null;
  const a=Buffer.from(token??''), b=Buffer.from(tokens[role]);
  return a.length===b.length&&timingSafeEqual(a,b)?role:null;
}
export class Sessions {
  clients:Partial<Record<Role,Client>>={};
  ready=false;
  session:string|null=null;
  status(){return {publisher:!!this.clients.publisher,viewer:!!this.clients.viewer,capturing:this.ready,session:!!this.session};}
  send(role:Role,data:unknown){this.clients[role]?.send(JSON.stringify(data));}
  join(role:Role,client:Client){
    if(this.clients[role]) return false;
    this.clients[role]=client;
    this.send(role,{type:'welcome',role}); this.negotiate(); return true;
  }
  negotiate(){
    this.session=null;
    if(this.ready&&this.clients.publisher&&this.clients.viewer){
      this.session=randomUUID();
      this.send('viewer',{type:'prepare',session:this.session});
      this.send('publisher',{type:'negotiate',session:this.session});
    }
  }
  receive(role:Role,m:Signal){
    if(m.type==='ready') {if(role!=='publisher')return false;this.ready=true;this.negotiate();return true;}
    if(m.type==='stop'){if(role!=='publisher')return false;this.ready=false;this.session=null;this.send('viewer',{type:'stopped'});return true;}
    if(m.type==='retry'){this.negotiate();return true;}
    if(m.session!==this.session)return false;
    if((m.type==='offer'&&role!=='publisher')||(m.type==='answer'&&role!=='viewer'))return false;
    this.send(role==='publisher'?'viewer':'publisher',m);return true;
  }
  leave(role:Role,client:Client){
    if(this.clients[role]!==client)return;
    delete this.clients[role];this.session=null;
    if(role==='publisher')this.ready=false;
    this.send(role==='publisher'?'viewer':'publisher',{type:'peer-left'});
  }
}
