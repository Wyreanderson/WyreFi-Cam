export type Role='publisher'|'viewer';
type Message={type:string;session?:string;sdp?:string;candidate?:RTCIceCandidateInit|null};
export class Link {
  ws?:WebSocket; pc?:RTCPeerConnection; stream?:MediaStream;
  session=''; private candidates:RTCIceCandidateInit[]=[];private timer?:ReturnType<typeof setTimeout>;private retryTimer?:ReturnType<typeof setTimeout>;private watchTimer?:ReturnType<typeof setTimeout>;private retry=0;private closed=false;private queue:Promise<void>=Promise.resolve();
  constructor(public role:Role,private token:string,private state:(s:string)=>void,private remote:(s:MediaStream)=>void,private bitrate:()=>number){}
  connect(){
    if(this.closed)return;
    this.state('A conectar');
    const url=new URL('/signal',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('role',this.role);url.searchParams.set('token',this.token);
    const ws=this.ws=new WebSocket(url);
    ws.onopen=()=>{this.retry=0;this.state('Ligado · à espera');if(this.stream)this.send({type:'ready'});};
    ws.onmessage=e=>{this.queue=this.queue.then(async()=>{if(this.ws===ws)await this.message(JSON.parse(String(e.data)) as Message);}).catch(e=>{this.state(`Erro de negociação: ${String(e)}`);this.requestRetry();});};
    ws.onclose=e=>{
      if(this.ws!==ws)return;
      this.clearPeer();
      if(e.code===4009||e.code===1008){this.state(e.code===4009?'Erro: já existe outro dispositivo com este papel. Feche-o e recarregue.':'Erro: signaling recusado. Recarregue a página.');return;}
      if(!this.closed){this.state('Reconectando');this.timer=setTimeout(()=>this.connect(),Math.min(1000*2**this.retry++,10000));}
    };
    ws.onerror=()=>this.state('Erro de ligação. Confirme URL, token, certificado e rede.');
  }
  send(m:object){if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(m));}
  async start(stream:MediaStream){this.stream=stream;this.send({type:'ready'});}
  stop(){this.stream=undefined;this.send({type:'stop'});this.clearPeer();this.state('Desligado');}
  requestRetry(){if(this.retryTimer||this.closed)return;this.retryTimer=setTimeout(()=>{this.retryTimer=undefined;this.send({type:'retry'});},2500);}
  clearPeer(){clearTimeout(this.watchTimer);clearTimeout(this.retryTimer);this.retryTimer=undefined;if(this.pc){this.pc.onconnectionstatechange=null;this.pc.onicecandidate=null;this.pc.ontrack=null;this.pc.close();this.pc=undefined;}this.candidates=[];this.session='';}
  private create(session:string){
    this.clearPeer();this.session=session;
    const pc=this.pc=new RTCPeerConnection({iceServers:[],bundlePolicy:'max-bundle'});
    pc.onicecandidate=e=>this.send({type:'ice',session,candidate:e.candidate?.toJSON()??null});
    pc.ontrack=e=>this.remote(e.streams[0]??new MediaStream([e.track]));
    pc.onconnectionstatechange=()=>{
      if(pc!==this.pc)return;
      const s=pc.connectionState;
      this.state(s==='connected'?'Ao vivo':s==='failed'?'Erro ICE: confirme LAN, isolamento Wi-Fi, UDP e WSL.':s==='disconnected'?'Reconectando':'A conectar');
      if(s==='failed'||s==='disconnected')this.requestRetry();
      if(s==='connected'){clearTimeout(this.retryTimer);this.retryTimer=undefined;}
    };
    return pc;
  }
  private preferH264(pc:RTCPeerConnection){
    for(const t of pc.getTransceivers()){
      if(t.receiver.track.kind!=='video'||!t.setCodecPreferences)continue;
      const codecs=RTCRtpReceiver.getCapabilities?.('video')?.codecs;
      if(codecs)try{t.setCodecPreferences([...codecs].sort((a,b)=>Number(b.mimeType.toLowerCase()==='video/h264')-Number(a.mimeType.toLowerCase()==='video/h264')));}catch{/* Negotiation retains browser defaults. */}
    }
  }
  async applyBitrate(){
    for(const sender of this.pc?.getSenders()??[]){if(sender.track?.kind!=='video')continue;
      try{
        const p=sender.getParameters();if(!p.encodings?.length)continue;
        p.encodings.forEach(e=>e.maxBitrate=this.bitrate()*1e6);
        p.degradationPreference='maintain-resolution';
        try{await sender.setParameters(p);}catch{delete p.degradationPreference;await sender.setParameters(p);}
      }catch{/* Optional on Safari. */}
    }
  }
  private async message(m:Message){
    if(m.type==='peer-left'||m.type==='stopped'){this.clearPeer();this.state('Ligado · à espera de transmissão');return;}
    if(m.type==='prepare'&&this.role==='viewer'&&m.session){this.create(m.session);this.state('A conectar');return;}
    if(m.type==='negotiate'&&this.role==='publisher'&&m.session&&this.stream){
      const pc=this.create(m.session);this.state('A conectar');
      this.stream.getTracks().forEach(t=>pc.addTrack(t,this.stream!));this.preferH264(pc);
      await pc.setLocalDescription(await pc.createOffer());
      if(pc!==this.pc)return;
      this.send({type:'offer',session:this.session,sdp:pc.localDescription?.sdp});await this.applyBitrate();this.watchConnection(pc);return;
    }
    const pc=this.pc;if(!pc||m.session!==this.session)return;
    if(m.type==='offer'&&this.role==='viewer'){
      await pc.setRemoteDescription({type:'offer',sdp:m.sdp});await this.flush(pc);this.preferH264(pc);
      await pc.setLocalDescription(await pc.createAnswer());
      this.send({type:'answer',session:this.session,sdp:pc.localDescription?.sdp});this.watchConnection(pc);
    }else if(m.type==='answer'&&this.role==='publisher'){
      await pc.setRemoteDescription({type:'answer',sdp:m.sdp});await this.flush(pc);await this.applyBitrate();
    }else if(m.type==='ice'&&m.candidate){
      if(pc.remoteDescription)await pc.addIceCandidate(m.candidate);else this.candidates.push(m.candidate);
    }
  }
  private watchConnection(pc:RTCPeerConnection){
    clearTimeout(this.watchTimer);this.watchTimer=setTimeout(()=>{if(pc===this.pc&&pc.connectionState!=='connected'){this.state('Reconectando · ICE sem resposta; verifique UDP/LAN/WSL');this.requestRetry();}},12000);
  }
  private async flush(pc:RTCPeerConnection){for(const c of this.candidates)await pc.addIceCandidate(c);this.candidates=[];}
  close(){this.closed=true;clearTimeout(this.timer);this.clearPeer();this.ws?.close();this.stream?.getTracks().forEach(t=>t.stop());}
}
