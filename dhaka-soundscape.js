/* Dhaka Metro 3D / original synthesized Bangladesh city soundscape.
 * No music, copyrighted recording, remote stream or microphone access.
 * Muted by default: AudioContext starts only after a user taps Sound ON.
 */
(function(){
 "use strict";
 let audio=null,master=null,rumble=null,crowd=null,timer=null,active=false,station=8,volume=.58;
 const AC=window.AudioContext||window.webkitAudioContext;
 function profile(i){
   // Artistic sound design, NOT a field recording or observed intensity reading.
   if([5,10,11,12,14,15].includes(i))return{traffic:1.0,crowd:.82,birds:.16};
   if([0,1,2,3].includes(i))return{traffic:.55,crowd:.38,birds:.63};
   if([8,9,13].includes(i))return{traffic:.68,crowd:.57,birds:.45};
   return{traffic:.83,crowd:.63,birds:.33};
 }
 function noise(ctx,seconds=2){
   const b=ctx.createBuffer(1,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate),arr=b.getChannelData(0);
   for(let i=0;i<arr.length;i++)arr[i]=Math.random()*2-1;
   return b;
 }
 function loopNoise(ctx,buffer,low,high,gain){
   const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
   src.buffer=buffer;src.loop=true;f.type=high?"bandpass":"lowpass";f.frequency.value=low;
   if(high)f.Q.value=high;
   g.gain.value=gain;src.connect(f);f.connect(g);g.connect(master);src.start();
   return{src,g};
 }
 function tone(freq,dur,vol,type="sine",endFreq=freq,when=0){
   if(!audio||!active)return;
   const t=audio.currentTime+when,osc=audio.createOscillator(),g=audio.createGain();
   osc.type=type;osc.frequency.setValueAtTime(freq,t);
   osc.frequency.exponentialRampToValueAtTime(Math.max(40,endFreq),t+dur);
   g.gain.setValueAtTime(.0001,t);
   g.gain.exponentialRampToValueAtTime(Math.max(.0002,vol),t+.025);
   g.gain.exponentialRampToValueAtTime(.0001,t+dur);
   osc.connect(g);g.connect(master);osc.start(t);osc.stop(t+dur+.025);
   osc.onended=()=>{osc.disconnect();g.disconnect()};
 }
 function bell(){
   tone(990,.72,.048,"sine",925,0);
   tone(1470,.51,.022,"sine",1430,.04);
   tone(990,.58,.039,"sine",930,.33);
 }
 function horn(){
   const f=300+Math.random()*115;
   tone(f,.42,.038,"sawtooth",f*.96);
   tone(f*1.5,.29,.012,"triangle",f*1.49,.07);
 }
 function bird(){
   const f=1300+Math.random()*520;
   tone(f,.16,.014,"sine",f*1.38);
   tone(f*1.24,.16,.012,"sine",f*.92,.19);
 }
 function passingVehicle(){
   tone(72+Math.random()*26,1.5,.017,"triangle",42);
   tone(110+Math.random()*35,.95,.007,"sawtooth",73,.2);
 }
 function soundEvent(){
   if(!active||!audio)return;
   const p=profile(station),r=Math.random();
   if(r<.15*p.traffic)horn();
   else if(r<.29*p.traffic)passingVehicle();
   else if(r<.22+.29*p.traffic)bell();
   else if(r<.26+.29*p.traffic+.33*p.birds)bird();
 }
 function update(){
   if(!audio||!master)return;
   const p=profile(station),t=audio.currentTime;
   master.gain.setTargetAtTime(active?Math.min(.85,volume):0,t,.12);
   if(rumble)rumble.g.gain.setTargetAtTime(.050*p.traffic,t,.5);
   if(crowd)crowd.g.gain.setTargetAtTime(.011*p.crowd,t,.5);
 }
 function setup(){
   if(!AC)throw Error("This browser does not support Web Audio.");
   audio=new AC();master=audio.createGain();
   // Gentle output limiter avoids harsh audio on phone speakers.
   const compressor=audio.createDynamicsCompressor();
   compressor.threshold.value=-20;compressor.knee.value=20;compressor.ratio.value=5;
   master.gain.value=0;master.connect(compressor);compressor.connect(audio.destination);
   const bed=noise(audio);
   rumble=loopNoise(audio,bed,185,0,0);
   crowd=loopNoise(audio,bed,640,.58,0);
 }
 async function start(){
   if(!audio)setup();
   active=true;
   await audio.resume();
   update();
   if(!timer)timer=window.setInterval(soundEvent,1800);
   soundEvent();
   return true;
 }
 function stop(){
   active=false;update();
   if(timer){window.clearInterval(timer);timer=null}
   // Keep the context suspended and reusable after the fade.
   const current=audio;
   window.setTimeout(()=>{if(current&&!active&&current.state==="running")current.suspend().catch(()=>{})},450);
 }
 function setStation(n){station=Math.max(0,Math.min(15,Number(n)||0));update()}
 function setVolume(v){volume=Math.max(0,Math.min(1,Number(v)));update()}
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&active){stop();window.dispatchEvent(new Event("dhaka-sound-muted"))}});
 window.DhakaSoundscape={start,stop,setStation,setVolume,get active(){return active}};
})();
