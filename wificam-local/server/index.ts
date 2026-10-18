import http from 'node:http';
import https from 'node:https';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { X509Certificate } from 'node:crypto';
import { isIP } from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { Sessions, authenticate } from './sessions.js';
import { parseSignal } from './protocol.js';

if(existsSync('.env'))process.loadEnvFile?.(resolve('.env'));
const env=process.env;
const origin=new URL(env.LAN_ORIGIN??'https://localhost:8443');
if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw Error('LAN_ORIGIN deve ser uma origem HTTPS sem caminho.');
const tokens={publisher:env.PUBLISH_TOKEN??'',viewer:env.VIEW_TOKEN??''};
if(Object.values(tokens).some(t=>!/^[a-f0-9]{64}$/.test(t))||tokens.publisher===tokens.viewer)throw Error('Execute npm run setup: são necessários dois tokens diferentes de 32 bytes.');
const certPath=resolve(env.TLS_CERT??'certs/local.pem'),keyPath=resolve(env.TLS_KEY??'certs/local-key.pem');
if(!existsSync(certPath)||!existsSync(keyPath))throw Error('Certificados ausentes. Consulte README e execute mkcert antes de iniciar.');
const certificate=new X509Certificate(readFileSync(certPath));
const hostname=origin.hostname.replace(/^\[|\]$/g,'');
if(!(isIP(hostname)?certificate.checkIP(hostname):certificate.checkHost(hostname)))throw Error('Certificado não corresponde a LAN_ORIGIN.');
if(Date.now()>Date.parse(certificate.validTo)||Date.now()<Date.parse(certificate.validFrom))throw Error('Certificado fora da validade.');
const sessions=new Sessions();
const localOrigin='http://127.0.0.1:8765';
const dev=process.argv.includes('--dev');
const vite=dev?await (await import('vite')).createServer({server:{middlewareMode:true,hmr:false},appType:'spa'}):null;
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/vnd.microsoft.icon'};
function handle(local:boolean):http.RequestListener{return (req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self)');
  const expected=local?new URL(localOrigin).host:origin.host;
  if(req.headers.host!==expected){res.writeHead(403).end('Host não autorizado');return;}
  const url=new URL(req.url??'/',local?localOrigin:origin);
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(url.pathname==='/api/dashboard'){
    if(!local){res.writeHead(403).end();return;}
    const camera=`${origin.origin}/camera#token=${tokens.publisher}`;
    const viewer=`${localOrigin}/viewer#token=${tokens.viewer}`;
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:sessions.status(),camera,viewer,origin:origin.origin,interfaces:networkInterfaces(),platform:process.platform,ice:'host-only; sem STUN/TURN'}));return;
  }
  if(!local&&(['/', '/index.html'].includes(url.pathname)||url.pathname.startsWith('/api'))){res.writeHead(403).end('Dashboard disponível apenas em 127.0.0.1:8765');return;}
  if(vite){vite.middlewares(req,res);return;}
  const root=resolve('dist');
  let file=resolve(root,'.'+url.pathname);
  if(['/camera','/viewer','/'].includes(url.pathname))file=resolve(root,'index.html');
  if(!file.startsWith(root+sep)){res.writeHead(404).end();return;}
  if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[extname(file)]??'application/octet-stream');createReadStream(file).pipe(res);
};}
const lan=https.createServer({cert:readFileSync(certPath),key:readFileSync(keyPath),minVersion:'TLSv1.2'},handle(false));
const local=http.createServer(handle(true));
const wss=new WebSocketServer({noServer:true,maxPayload:65536,perMessageDeflate:false});
for(const [server,allowed] of [[lan,origin.origin],[local,localOrigin]] as const){
  server.on('upgrade',(req,socket,head)=>{
    const url=new URL(req.url??'/',allowed);
    const role=authenticate(url.searchParams.get('role'),url.searchParams.get('token'),tokens);
    if(req.headers.origin!==allowed||req.headers.host!==new URL(allowed).host||url.pathname!=='/signal'||!role){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    wss.handleUpgrade(req,socket,head,ws=>{
      if(!sessions.join(role,ws)){ws.close(4009,'Papel já ocupado');return;}
      let alive=true,count=0;let windowStart=Date.now();
      ws.on('pong',()=>{alive=true;});
      const timer=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},15000);
      ws.on('message',(raw,binary)=>{
        if(Date.now()-windowStart>1000){count=0;windowStart=Date.now();}
        if(++count>100){ws.close(1008,'Demasiadas mensagens');return;}
        const message=binary?null:parseSignal(raw.toString());
        if(!message){ws.close(1008,'Mensagem inválida');return;}
        if(!sessions.receive(role,message))ws.send(JSON.stringify({type:'rejected'}));
      });
      ws.on('error',()=>ws.terminate());
      ws.on('close',()=>{clearInterval(timer);sessions.leave(role,ws);});
    });
  });
}
for(const s of [lan,local])s.on('error',e=>{console.error(e.message);process.exit(1);});
lan.listen(Number(origin.port||443),env.LAN_BIND??'0.0.0.0',()=>console.log(`iPhone: ${origin.origin}/camera (token no dashboard)`));
local.listen(8765,'127.0.0.1',()=>console.log(`Dashboard: ${localOrigin}\nOBS: ${localOrigin}/viewer (copiar URL completa do dashboard)\nVídeo P2P; ICE host-only. Mantenha ambos os dispositivos na mesma LAN.`));
function shutdown(){for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.close(1001,'Servidor a terminar');lan.close();local.close();void vite?.close();setTimeout(()=>process.exit(),500).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
