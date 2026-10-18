import assert from 'node:assert/strict';
import { spawn,spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { setTimeout } from 'node:timers';
import WebSocket from 'ws';
const temp=mkdtempSync(join(tmpdir(),'wificam-smoke-'));
const cert=join(temp,'test.pem'),key=join(temp,'test-key.pem');
const openssl=process.env.OPENSSL??(process.platform==='win32'&&existsSync('C:/Program Files/Git/usr/bin/openssl.exe')?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl');
let child;const sockets=[];
function request(url,ca,host){return new Promise((resolve,reject)=>{const u=new URL(url);const req=(u.protocol==='https:'?https:http).get(u,{ca,headers:host?{Host:host}:{}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.setTimeout(5000,()=>req.destroy(Error('HTTP timeout')));});}
function inbox(ws){const rows=[];ws.on('message',data=>rows.push(JSON.parse(String(data))));return async type=>{const end=Date.now()+5000;while(Date.now()<end){const i=rows.findIndex(r=>r.type===type);if(i>=0)return rows.splice(i,1)[0];await new Promise(r=>setTimeout(r,10));}throw Error(`Não recebeu ${type}`);};}
async function open(url,origin,ca){const ws=new WebSocket(url,{origin,ca});sockets.push(ws);const next=inbox(ws);await once(ws,'open');await next('welcome');return {ws,next};}
async function refused(url,origin){await new Promise((resolve,reject)=>{const ws=new WebSocket(url,{origin});ws.on('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,403);res.resume();ws.terminate();resolve();});ws.on('error',()=>{});ws.on('open',()=>{ws.close();reject(Error('Ligação não autorizada aceite'));});setTimeout(()=>reject(Error('Recusa timeout')),3000).unref();});}
try{
  const generated=spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{encoding:'utf8'});
  if(generated.status!==0)throw Error(`OpenSSL necessário para este teste: ${generated.error?.message??generated.stderr}`);
  const ca=readFileSync(cert),publisher=randomBytes(32).toString('hex'),viewer=randomBytes(32).toString('hex');
  child=spawn(process.execPath,['build/server/index.js'],{env:{...process.env,LAN_ORIGIN:'https://localhost:8443',LAN_BIND:'127.0.0.1',TLS_CERT:cert,TLS_KEY:key,PUBLISH_TOKEN:publisher,VIEW_TOKEN:viewer},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  const deadline=Date.now()+8000;while(!output.includes('Dashboard:')&&Date.now()<deadline&&child.exitCode===null)await new Promise(r=>setTimeout(r,30));
  assert.ok(output.includes('Dashboard:'),output);
  assert.equal((await request('http://127.0.0.1:8765/')).status,200);
  assert.equal((await request('http://127.0.0.1:8765/viewer')).status,200);
  assert.equal((await request('http://127.0.0.1:8765/',undefined,'evil.example')).status,403);
  assert.equal((await request('https://localhost:8443/camera',ca)).status,200);
  assert.equal((await request('https://localhost:8443/',ca)).status,403);
  assert.equal((await request('https://localhost:8443/api/dashboard',ca)).status,403);
  assert.equal((await request('https://localhost:8443/.env',ca)).status,404);
  const d=JSON.parse((await request('http://127.0.0.1:8765/api/dashboard')).body);assert.ok(d.camera.includes(publisher));assert.ok(d.viewer.includes(viewer));
  await refused('ws://127.0.0.1:8765/signal?role=viewer&token=wrong','http://127.0.0.1:8765');
  await refused(`ws://127.0.0.1:8765/signal?role=viewer&token=${viewer}`,'http://evil.example');
  const p=await open(`wss://localhost:8443/signal?role=publisher&token=${publisher}`,'https://localhost:8443',ca);
  p.ws.send(JSON.stringify({type:'ready'}));
  const v=await open(`ws://127.0.0.1:8765/signal?role=viewer&token=${viewer}`,'http://127.0.0.1:8765');
  const negotiation=await p.next('negotiate');const prepared=await v.next('prepare');assert.equal(negotiation.session,prepared.session);
  const session=negotiation.session;
  p.ws.send(JSON.stringify({type:'offer',session,sdp:'test-offer'}));assert.equal((await v.next('offer')).sdp,'test-offer');
  v.ws.send(JSON.stringify({type:'answer',session,sdp:'test-answer'}));assert.equal((await p.next('answer')).sdp,'test-answer');
  p.ws.send(JSON.stringify({type:'ice',session,candidate:{candidate:'candidate:test'}}));assert.equal((await v.next('ice')).candidate.candidate,'candidate:test');
  v.ws.send(JSON.stringify({type:'stop'}));await v.next('rejected');assert.equal(JSON.parse((await request('http://127.0.0.1:8765/api/dashboard')).body).status.capturing,true);
  const duplicate=new WebSocket(`ws://127.0.0.1:8765/signal?role=viewer&token=${viewer}`,{origin:'http://127.0.0.1:8765'});sockets.push(duplicate);const [code]=await once(duplicate,'close');assert.equal(code,4009);
  v.ws.close();await p.next('peer-left');
  const v2=await open(`ws://127.0.0.1:8765/signal?role=viewer&token=${viewer}`,'http://127.0.0.1:8765');assert.notEqual((await p.next('negotiate')).session,session);await v2.next('prepare');
  v2.ws.send('not json');const [invalid]=await once(v2.ws,'close');assert.equal(invalid,1008);
  console.log('PASS: HTTP, TLS com SAN/CA explícita de teste, isolamento dashboard, Host, tokens/origem, WSS↔WS, SDP/ICE, papéis, viewer único, refresh e limpeza. Sem teste de mídia/ICE real.');
}finally{
  for(const ws of sockets)ws.terminate();
  if(child&&child.exitCode===null){child.kill();await once(child,'exit');}
  rmSync(temp,{recursive:true,force:true});
}
