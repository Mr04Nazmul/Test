#!/usr/bin/env node
/* Build six clearly audible original (NOT field-recorded) loops for 3D scene.
   PCM WAV files are self-hosted for reliable Safari playback with a direct tap.
   No copyrighted source files, remote APIs, libraries or microphone needed. */
import {mkdirSync,writeFileSync,statSync} from 'node:fs';
const OUT='assets/audio',SR=22050,SECONDS=8,COUNT=SR*SECONDS;
mkdirSync(OUT,{recursive:true});
const scenes=['street','hall','platform','track','train','roof'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pi=Math.PI;
function make(name,index){
 let seed=(7919+index*10007)>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 let brown=0,smoothed=0;
 const f=new Float32Array(COUNT);
 for(let i=0;i<COUNT;i++){
  const t=i/SR,noise=random()*2-1;
  brown=brown*.986+noise*.037;
  smoothed=smoothed*.63+noise*.37;
  const beat=(t,at,dur)=>Math.max(0,1-Math.abs(t-at)/(dur||.3));
  const env=(time,at,len)=>{const d=time-at;return d>0&&d<len?Math.pow(Math.sin(pi*d/len),1.35):0};
  const ring=(hz,time,at,len)=>Math.sin(2*pi*hz*(time-at))*env(time,at,len);
  const bass=(hz)=>Math.sin(2*pi*hz*t);
  let v=0;
  if(name==='street'){
   v=.32*brown+.15*smoothed+.16*bass(42+3*Math.sin(2*pi*.13*t));
   v+=.05*bass(88)*(.5+.5*Math.sin(t*2));
   for(const when of [.65,3.15,5.85])v+=.34*ring(340,t,when,.45)+.12*ring(508,t,when,.35);
   for(const when of [1.45,4.52])v+=.18*ring(1140,t,when,.43)+.10*ring(1650,t,when+.16,.4);
   v+=.11*smoothed*(Math.sin(2*pi*.8*t)**2);
  }else if(name==='hall'){
   v=.22*brown+.13*smoothed+.055*bass(84);
   for(const when of [.75,1.5,2.9,4.2,6.1,7.2])v+=.15*noise*env(t,when,.16);
   for(const when of [1.9,5.7])v+=.19*ring(960,t,when,.16)+.15*ring(1120,t,when+.16,.17);
   v+=.06*Math.sin(t*2.3)*smoothed;
  }else if(name==='platform'){
   v=.17*brown+.14*smoothed+.09*bass(63);
   for(const when of [1.1,4.9])v+=.30*ring(750,t,when,.27)+.22*ring(980,t,when+.30,.25);
   for(const when of [2.4,6.2])v+=.14*noise*env(t,when,1.0);
   v+=.07*bass(148+6*Math.sin(t*.5));
  }else if(name==='track'){
   const speed=1.6+.6*Math.sin(2*pi*t/SECONDS);
   v=.24*brown+.22*smoothed+.2*bass(105+8*Math.sin(t*.39));
   v+=.095*Math.sin(2*pi*(245*t+10*t*t/SECONDS));
   v+=.20*noise*(Math.abs(Math.sin(2*pi*speed*t))**22);
   v+=.13*Math.sin(2*pi*720*t)*(.5+.5*Math.sin(2*pi*.5*t));
  }else if(name==='train'){
   v=.18*brown+.18*smoothed+.19*bass(122+6*Math.sin(t*.43));
   v+=.10*Math.sin(2*pi*(360*t+4*t*t/SECONDS));
   for(const when of [3.0,3.26,3.52])v+=.29*ring(850,t,when,.18);
   for(const when of [5.1])v+=.16*noise*env(t,when,1.3);
  }else if(name==='roof'){
   v=.25*brown+.095*smoothed+.065*bass(51);
   for(const when of [1.1,2.9,5.6,6.4])v+=.19*ring(1550,t,when,.23)+.13*ring(1980,t,when+.19,.15);
   for(const when of [3.4,7.0])v+=.07*ring(350,t,when,.5);
  }
  // A gentle crossfade at the repeat boundary stops audible looping clicks.
  const feather=Math.min(1,t/.11,(SECONDS-t)/.11);
  f[i]=v*Math.max(0,feather);
 }
 let peak=0,sum=0;for(const x of f){peak=Math.max(peak,Math.abs(x));sum+=x*x}
 const gain=Math.min(4,.76/(peak||1));
 const b=Buffer.alloc(44+COUNT*2);
 b.write('RIFF',0);b.writeUInt32LE(36+COUNT*2,4);b.write('WAVE',8);b.write('fmt ',12);
 b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(SR,24);
 b.writeUInt32LE(SR*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(COUNT*2,40);
 for(let i=0;i<COUNT;i++)b.writeInt16LE(Math.round(clamp(f[i]*gain,-1,1)*32760),44+i*2);
 const output=OUT+'/'+name+'.wav';writeFileSync(output,b);
 console.log(name,statSync(output).size+' bytes', 'peak '+(peak*gain).toFixed(3),'RMS '+Math.sqrt(sum/COUNT)*gain);
}
for(let i=0;i<scenes.length;i++)make(scenes[i],i);
