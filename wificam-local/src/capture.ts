export const presets={ '720p30':[1280,720,30], '720p60':[1280,720,60], '1080p30':[1920,1080,30], '1080p60':[1920,1080,60], '4K30 experimental':[3840,2160,30]} as const;
export type Preset=keyof typeof presets;
import { dimensions, type Orientation } from './format';
export function constraints(preset:Preset,facing:string,device:string,format:Orientation='landscape'):MediaTrackConstraints[]{
  const [w,h,frameRate]=presets[preset];
  const {width,height}=dimensions(w,h,format);
  const fallback=dimensions(1280,720,format);
  const aspectRatio={ideal:width/height};
  const source=device?{deviceId:{exact:device}}:{facingMode:{ideal:facing}};
  return [{...source,width:{ideal:width},height:{ideal:height},aspectRatio,frameRate:{ideal:frameRate,max:frameRate}}, {...source,width:{ideal:fallback.width},height:{ideal:fallback.height},aspectRatio,frameRate:{ideal:30,max:30}},source];
}
export async function capture(get:(c:MediaStreamConstraints)=>Promise<MediaStream>,preset:Preset,facing:string,device:string,mic:boolean,format:Orientation='landscape'):Promise<MediaStream>{
  let last:unknown;
  for(const video of constraints(preset,facing,device,format)){
    try{return await get({video,audio:mic?{echoCancellation:false,noiseSuppression:false,autoGainControl:false}:false});}
    catch(e){last=e;if(!(e instanceof DOMException)||!['OverconstrainedError','NotFoundError'].includes(e.name))throw e;}
  }
  throw last;
}
export function captureError(e:unknown):string{
  if(e instanceof DOMException){
    const messages:Record<string,string>={NotAllowedError:'Permissão recusada. Autorize a câmera/microfone no Safari e confirme a confiança no certificado.',NotFoundError:'Câmera ou microfone não encontrado. Experimente outra câmera ou desligue o microfone.',NotReadableError:'Câmera indisponível. Feche outras aplicações que a estejam a utilizar.',OverconstrainedError:'Este modo não é suportado. Escolha outra câmera ou qualidade.'};
    return messages[e.name]??`${e.name}: ${e.message}`;
  }
  return e instanceof Error?e.message:String(e);
}
