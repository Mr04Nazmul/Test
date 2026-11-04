#!/usr/bin/env node
// Simulate fully consented rider->viewer WebRTC lifecycle with a fake PeerJS
// transport and GPS. This does NOT pretend to be a real Bangladesh train.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync('live-rider-p2p.js','utf8');
const html=readFileSync('index.html','utf8');
const app=readFileSync('app-v2.js','utf8');
const peers=new Map(),timers={watch:false,cleared:false};
class Emitter{
 constructor(){this.events=new Map()}
 on(name,callback){let a=this.events.get(name)||[];a.push(callback);this.events.set(name,a);return this}
 emit(name,...args){for(const cb of this.events.get(name)||[])cb(...args)}
}
class Conn extends Emitter{
 constructor(){super();this.open=false;this.other=null}
 send(value){assert(this.open);const other=this.other;queueMicrotask(()=>{if(other.open)other.emit('data',value)})}
 close(){if(!this.open)return;this.open=false;this.emit('close');if(this.other.open){this.other.open=false;this.other.emit('close')}}
}
let senderCount=0;
class Peer extends Emitter{
 constructor(idOrOpts){super();this.id=typeof idOrOpts==='string'?idOrOpts:'sender-'+(++senderCount);
  peers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id))}
 connect(id){
  const remote=peers.get(id),sender=new Conn(),receiver=new Conn();
  sender.other=receiver;receiver.other=sender;
  queueMicrotask(()=>{
   if(!remote){this.emit('error',Error('No receiver'));return}
   remote.emit('connection',receiver);
   sender.open=true;receiver.open=true;
   receiver.emit('open');sender.emit('open');
  });
  return sender;
 }
 destroy(){peers.delete(this.id);this.emit('disconnected')}
}
const geo={
 watchPosition(onPosition){
  timers.watch=true;
  queueMicrotask(()=>onPosition({
   coords:{latitude:23.76,longitude:90.386,accuracy:14,speed:9.8}
  }));
  return 13;
 },
 clearWatch(id){assert.equal(id,13);timers.cleared=true}
};
const fakeCrypto={getRandomValues(a){for(let i=0;i<a.length;i++)a[i]=(i*31+11)%256;return a}};
const window={
 Peer,crypto:fakeCrypto,location:{href:'https://mr04nazmul.github.io/Test/'},
 addEventListener(){}
};
const document={addEventListener(){},createElement(){throw Error('PeerJS library must not load at app start')}};
runInNewContext(src,{window,document,navigator:{geolocation:geo},URL,Uint8Array,
 Math,Date,Number,console,setTimeout,clearTimeout,queueMicrotask});
const p=window.MRT_RIDER_P2P;
assert(p&&p.senderState==='idle'&&p.state==='idle','Location off by default');
let sample=null,latestState='';
const watch=await p.startWatch(x=>{sample=x});
assert(watch.link.startsWith('https://mr04nazmul.github.io/Test/share-live.html#watch=mrt6-'));
assert(!new URL(watch.link).search,'No secret token in HTTP query');
assert.equal(p.state,'waiting','Watch page should wait for explicit rider participation');
assert.equal(timers.watch,false,'No permission prompt before onboard rider opts in');
await p.startShare(watch.peerId,s=>{latestState=s});
await new Promise(resolve=>setTimeout(resolve,12));
assert(timers.watch,'Rider GPS requested after opting in');
assert(sample,'Private GPS must reach the authorized viewer');
assert.equal(p.validMessage({...sample,kind:'mrt6-rider-location'},Date.now()),true);
assert.equal(sample.lat,23.76);assert.equal(sample.lon,90.386);
assert.equal(sample.source,'consenting rider phone');
assert.equal(p.senderState,'sharing');
p.stopShare();
assert.equal(p.senderState,'idle');assert(timers.cleared,'GPS watch must be explicitly released');
p.stopWatch();
assert.equal(p.state,'idle');
for(const id of ['realGpsQuickStatus','actualGpsLed','actualGpsHeadline','actualGpsDetails','actualGpsAge']){
 assert(html.includes('id="'+id+'"'),'GPS truth UI missing '+id);
 assert(app.includes('$("'+id+'")'),'Missing GPS truth UI binding '+id);
}
assert(app.includes('function updateActualGpsStatus('),'Source status not updated');
assert(app.includes('REAL TRAIN GPS · No connected feed'),'GPS unavailable must be explicit');
assert(app.includes('PHONE GPS · 1 consenting rider'),'Rider GPS must not imply official telemetry');
assert(html.includes('com.traintracker.bd'),'Metro community app must be linked as external, not scraped');
assert(html.includes('mrt.touhidapps.com'),'MRT Mate source must be linked as external');
assert(!html.includes('data-api-key="'),'No secret provider key in HTML');
console.log('PASS WebRTC fake handshake, fresh actual phone sample, explicit opt-in, stop/shutdown, transparent GPS source UI.');
