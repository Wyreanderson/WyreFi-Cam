import './style.css';
import QRCode from 'qrcode';
import { capture, captureError, presets, type Preset } from './capture';
import { Link } from './peer';
import { orientation, dimensions, formatAdvice, formattedUrl } from './format';
const app=document.querySelector<HTMLDivElement>('#app')!;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const page=location.pathname;
function badge(s:string){$('status').textContent=s;$('status').dataset.live=String(s==='Ao vivo');}
function header(sub:string){return `<header><div class="brand"><img class="logo" src="/icons/icon-192.png" alt="" width="48" height="48"><div><h1>WyreFi <em>Cam</em></h1><p>${sub}</p></div></div><span class="pill" id="status">Desligado</span></header>`;}
function token(){const t=new URLSearchParams(location.hash.slice(1)).get('token')??sessionStorage.getItem(`token:${page}`)??'';if(t){sessionStorage.setItem(`token:${page}`,t);history.replaceState(null,'',page+location.search+(page==='/camera'?'#token='+encodeURIComponent(t):''));}return t;}
if(page==='/camera')camera();else if(page==='/viewer')viewer();else void dashboard();
function camera(){
  app.innerHTML=`<main>${header('A tua câmera. Na tua rede.')}<section class="monitor" id="monitor"><video id="video" autoplay playsinline muted></video><span class="overlay">PRÉ-VISUALIZAÇÃO LOCAL</span></section><p id="error" role="alert"></p><div class="actions"><button id="start">Iniciar transmissão</button><button class="secondary" id="stop" disabled>Parar</button></div><section class="panel settings"><label>Formato de envio<select id="orientation"><option value="landscape">Horizontal · 16:9</option><option value="portrait">Vertical · 9:16</option></select></label><label>Qualidade<select id="preset">${Object.keys(presets).map(p=>`<option ${p==='1080p30'?'selected':''}>${p}</option>`).join('')}</select></label><label>Câmera<select id="facing"><option value="environment">Traseira</option><option value="user">Frontal</option></select></label><label>Dispositivo<select id="device"><option value="">Automático</option></select></label><label>Bitrate pretendido (Mbps)<input id="bitrate" type="number" min="1" max="50" value="8"></label><label class="check"><input id="mic" type="checkbox"> Microfone</label><label class="check"><input id="mirror" type="checkbox"> Espelhar pré-visualização</label><div id="advanced"></div></section><section class="panel"><h2>Resolução e qualidade</h2><p id="format-info" role="status"></p><p id="stats">Sem captura ativa.</p><small>RTT mede a ida e volta da rede, não a latência total do vídeo.</small></section><p class="note">Mantenha o Safari em primeiro plano e o iPhone desbloqueado. Os modos dependem da câmera, do Safari e da rede Wi-Fi.</p></main>`;
  const video=$<HTMLVideoElement>('video'),start=$<HTMLButtonElement>('start'),stop=$<HTMLButtonElement>('stop');
  const formatSelect=$<HTMLSelectElement>('orientation');
  formatSelect.value=orientation(new URLSearchParams(location.search).get('orientation')??localStorage.getItem('camera-orientation'));
  const updateFormat=()=>{
    const format=orientation(formatSelect.value);
    localStorage.setItem('camera-orientation',format);
    $('monitor').style.aspectRatio=format==='portrait'?'9 / 16':'16 / 9';
    const [w,h]=presets[$<HTMLSelectElement>('preset').value as Preset];
    const size=dimensions(w,h,format);
    $('format-info').textContent='Pedido: '+size.width+' × '+size.height+'. Posicione o iPhone '+(format==='portrait'?'na vertical':'na horizontal')+' antes de iniciar.';
  };
  formatSelect.onchange=updateFormat;$('preset').onchange=updateFormat;updateFormat();
  const auth=token();if(!auth){$('error').textContent='Abra a URL completa ou o QR code no dashboard local.';start.disabled=true;return;}
  const link=new Link('publisher',auth,badge,()=>{},()=>Math.min(50,Math.max(1,Number($<HTMLInputElement>('bitrate').value)||8)));link.connect();
  let stream:MediaStream|undefined,busy=false;
  const locked=['preset','facing','device','mic','orientation'];
  function lock(v:boolean){locked.forEach(id=>($<HTMLInputElement>(id).disabled=v));}
  function halt(){const old=stream;stream=undefined;link.stop();old?.getTracks().forEach(t=>t.stop());video.srcObject=null;start.disabled=false;stop.disabled=true;lock(false);$('advanced').replaceChildren();$('stats').textContent='Sem captura ativa.';updateFormat();}
  start.onclick=async()=>{
    if(busy)return;busy=true;start.disabled=true;$('error').textContent='';
    try{
      if(!window.isSecureContext||!navigator.mediaDevices)throw Error('A câmera exige HTTPS e um certificado de confiança no iPhone.');
      stream=await capture(c=>navigator.mediaDevices.getUserMedia(c),$<HTMLSelectElement>('preset').value as Preset,$<HTMLSelectElement>('facing').value,$<HTMLSelectElement>('device').value,$<HTMLInputElement>('mic').checked,orientation(formatSelect.value));
      video.srcObject=stream;await video.play();await link.start(stream);stop.disabled=false;lock(true);
      for(const t of stream.getTracks())t.onended=()=>{halt();$('error').textContent='A captura foi interrompida. Volte ao Safari e inicie novamente.';};
      void listDevices();advanced(stream.getVideoTracks()[0]);
    }catch(e){halt();$('error').textContent=captureError(e);}finally{busy=false;}
  };
  stop.onclick=halt;
  $('mirror').onchange=()=>video.style.transform=$<HTMLInputElement>('mirror').checked?'scaleX(-1)':'';
  $('bitrate').onchange=()=>void link.applyBitrate();
  $('facing').onchange=()=>{$<HTMLSelectElement>('device').value='';};
  async function listDevices(){try{
    const selected=$<HTMLSelectElement>('device').value;const devices=await navigator.mediaDevices.enumerateDevices();const el=$<HTMLSelectElement>('device');el.replaceChildren(new Option('Automático',''));
    devices.filter(d=>d.kind==='videoinput').forEach((d,i)=>el.add(new Option(d.label||`Câmera ${i+1}`,d.deviceId)));el.value=selected;
  }catch{/* Permission-dependent enumeration. */}}
  function advanced(track:MediaStreamTrack){
    const box=$('advanced');box.replaceChildren();
    const caps=track.getCapabilities?.() as (MediaTrackCapabilities & {zoom?:{min:number;max:number;step:number};torch?:boolean;focusMode?:string[]})|undefined;
    const apply=async(key:string,value:unknown)=>{try{await track.applyConstraints({advanced:[{[key]:value} as MediaTrackConstraintSet]});}catch{$('error').textContent=`O controlo ${key} não foi aplicado. A transmissão continua.`;}};
    if(caps?.zoom){const label=document.createElement('label');label.textContent='Zoom';const input=document.createElement('input');input.type='range';input.min=String(caps.zoom.min);input.max=String(caps.zoom.max);input.step=String(caps.zoom.step||.1);input.value=String((track.getSettings() as MediaTrackSettings&{zoom?:number}).zoom??caps.zoom.min);input.onchange=()=>void apply('zoom',Number(input.value));label.append(input);box.append(label);}
    if(caps?.torch){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.onchange=()=>void apply('torch',input.checked);label.append(input,' Lanterna');box.append(label);}
    if(caps?.focusMode?.length){const label=document.createElement('label');label.textContent='Foco';const select=document.createElement('select');caps.focusMode.forEach(f=>select.add(new Option(f,f)));select.onchange=()=>void apply('focusMode',select.value);label.append(select);box.append(label);}
  }
  const interval=setInterval(()=>{const settings=stream?.getVideoTracks()[0]?.getSettings();if(settings){$('format-info').textContent=formatAdvice(video.videoWidth||settings.width||0,video.videoHeight||settings.height||0,orientation(formatSelect.value));void stats(link,$('stats'),`${settings.width}×${settings.height} · solicitado ${presets[$<HTMLSelectElement>('preset').value as Preset][2]} FPS · captura ${settings.frameRate?.toFixed(1)??'n/d'} FPS`);}},2000);
  window.addEventListener('pagehide',()=>{clearInterval(interval);link.close();stream?.getTracks().forEach(t=>t.stop());});
}
const previous=new WeakMap<RTCPeerConnection,{bytes:number;time:number;frames:number}>();
async function stats(link:Link,el:HTMLElement,prefix=''){
  const pc=link.pc;if(!pc){el.textContent=prefix+' · Sem peer';return;}
  try{const report=await pc.getStats();let bytes=0,frames=0,lost:number|undefined,rtt:number|undefined,fps:number|undefined,encoded='',limited='';
    report.forEach(s=>{if((s.type==='outbound-rtp'||s.type==='inbound-rtp')&&(s.kind==='video'||s.mediaType==='video')){bytes=s.bytesSent??s.bytesReceived??0;frames=s.framesEncoded??s.framesDecoded??0;fps=s.framesPerSecond;lost=s.packetsLost??lost;if(s.frameWidth&&s.frameHeight)encoded=s.frameWidth+'×'+s.frameHeight;const reasons:Record<string,string>={bandwidth:'rede',cpu:'processamento',other:'outro motivo'};if(s.qualityLimitationReason&&s.qualityLimitationReason!=='none')limited='Qualidade limitada: '+(reasons[s.qualityLimitationReason]??s.qualityLimitationReason);}if(s.type==='remote-inbound-rtp'&&s.kind==='video')lost=s.packetsLost;if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated)rtt=s.currentRoundTripTime;});
    const now=performance.now(),old=previous.get(pc);previous.set(pc,{bytes,time:now,frames});const dt=old?(now-old.time)/1000:0;
    el.textContent=[prefix,encoded?'Enviado: '+encoded:'Enviado: resolução n/d',limited,`vídeo ${fps?.toFixed(1)??(old&&dt>0?((frames-old.frames)/dt).toFixed(1):'n/d')} FPS`,`${old&&dt>0?Math.max(0,(bytes-old.bytes)*8/dt/1e6).toFixed(2):'n/d'} Mbps`,`perda ${lost??'n/d'} pacotes`,`RTT ${rtt===undefined?'n/d':Math.round(rtt*1000)+' ms'}`].filter(Boolean).join(' · ');
  }catch{el.textContent=prefix+' · Estatísticas indisponíveis';}
}
function viewer(){
  document.body.classList.add('viewer');app.innerHTML='<video id="video" autoplay playsinline muted></video><p id="status" class="viewer-status">À espera de transmissão</p><button id="play" hidden>Reproduzir vídeo / áudio</button>';
  const video=$<HTMLVideoElement>('video');const params=new URLSearchParams(location.search);
  video.style.objectFit=params.get('fit')==='cover'?'cover':'contain';video.muted=params.get('audio')!=='1';
  const t=token();if(!t){badge('Copie a URL completa do viewer a partir do dashboard.');return;}
  const play=async()=>{try{await video.play();$('play').hidden=true;}catch{$('play').hidden=false;badge('Toque para permitir reprodução');}};
  $('play').onclick=()=>void play();
  const link=new Link('viewer',t,s=>{badge(s);if(s.includes('espera'))video.srcObject=null;},s=>{video.srcObject=s;void play();},()=>8);link.connect();window.addEventListener('pagehide',()=>link.close());
}
async function dashboard(){
  app.innerHTML=`<main>${header('Estúdio privado · sem cloud')}<section class="hero"><span class="eyebrow">DO IPHONE PARA O OBS</span><h2>A tua imagem,<br>sem cabos.</h2><p>Vídeo direto na rede local. Um iPhone, um recetor.</p></section><div class="grid"><section class="panel"><h2>01 · Ligar o iPhone</h2><label>Formato da transmissão<select id="output-orientation"><option value="landscape">Horizontal · 16:9</option><option value="portrait">Vertical · 9:16</option></select></label><canvas id="qr"></canvas><p>Leia com a câmera do iPhone, depois abra no Safari.</p><a id="camera">Preparar URL…</a></section><section class="panel"><h2>02 · Abrir no OBS</h2><p>Adicione uma Fonte de navegador e cole esta URL.</p><code id="viewer"></code><button id="copy" class="secondary">Copiar URL do OBS</button><p class="note" id="obs-size"></p><p class="note">Defina estas dimensões nas propriedades da Fonte de navegador. Depois: Transformar → Repor transformação → Ajustar ao ecrã. Evite esticar a imagem.</p><label class="check"><input id="audio" type="checkbox"> Reproduzir áudio</label><label>Ajuste<select id="fit"><option value="contain">Conter (imagem inteira)</option><option value="cover">Preencher (recortar)</option></select></label></section></div><section class="panel"><h2>Diagnóstico local</h2><p id="health"></p><pre id="network"></pre><small>Sem STUN/TURN. Isolamento Wi-Fi, firewall ou WSL2 NAT podem impedir ICE/UDP. Execute npm run diagnose.</small></section><p id="error" role="alert"></p></main>`;
  const output=$<HTMLSelectElement>('output-orientation');
  output.value=orientation(localStorage.getItem('output-orientation'));
  let base='',cameraBase='',qrGeneration=0;
  const updateQr=async()=>{
    if(!cameraBase)return;
    const generation=++qrGeneration;
    const cameraUrl=formattedUrl(cameraBase,orientation(output.value));
    const a=$<HTMLAnchorElement>('camera');a.href=cameraUrl;a.textContent=cameraUrl;
    const canvas=document.createElement('canvas');
    try{await QRCode.toCanvas(canvas,cameraUrl,{width:220,margin:2,color:{dark:'#071019',light:'#ffffff'}});if(generation===qrGeneration){const target=$<HTMLCanvasElement>('qr');target.width=canvas.width;target.height=canvas.height;target.getContext('2d')?.drawImage(canvas,0,0);}}catch{$('error').textContent='Não foi possível gerar o QR. Abra a URL indicada.';}
  };
  const update=()=>{
    const format=orientation(output.value);localStorage.setItem('output-orientation',format);
    const size=dimensions(1920,1080,format);
    $('obs-size').textContent='Fonte OBS: largura '+size.width+' · altura '+size.height+'. Escolha o mesmo formato na câmera; para alterar uma captura ativa, pare e inicie novamente.';
    if(!base)return;
    const url=new URL(formattedUrl(base,format));url.searchParams.set('audio',$<HTMLInputElement>('audio').checked?'1':'0');url.searchParams.set('fit',$<HTMLSelectElement>('fit').value);$('viewer').textContent=url.href;
  };
  output.onchange=()=>{update();void updateQr();};update();
  $('audio').onchange=update;$('fit').onchange=update;
  $('copy').onclick=()=>{void navigator.clipboard.writeText($('viewer').textContent??'').then(()=>{$('copy').textContent='Copiado';}).catch(()=>{$('error').textContent='Selecione e copie a URL manualmente.';});};
  const refresh=async()=>{try{const res=await fetch('/api/dashboard');if(!res.ok)throw Error('Dashboard disponível apenas em http://127.0.0.1:8765');const d=await res.json();badge('Servidor online');$('health').textContent=`Câmera: ${d.status.publisher?'ligada':'desligada'} · Captura: ${d.status.capturing?'ativa':'parada'} · Viewer: ${d.status.viewer?'ligado':'desligado'}`;$('network').textContent=`${d.platform} · ${d.ice}\nHTTPS: ${d.origin}\n${Object.entries(d.interfaces).map(([name,rows])=>`${name}: ${(rows as {address:string;family:string}[]).filter(r=>r.family==='IPv4').map(r=>r.address).join(', ')}`).join('\n')}`;
    if(base!==d.viewer||cameraBase!==d.camera){base=d.viewer;cameraBase=d.camera;update();await updateQr();}
  }catch(e){badge('Erro');$('error').textContent=captureError(e);}};
  await refresh();const interval=setInterval(()=>void refresh(),3000);window.addEventListener('pagehide',()=>clearInterval(interval));
}
