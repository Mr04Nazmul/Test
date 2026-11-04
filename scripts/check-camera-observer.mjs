#!/usr/bin/env node
/* QA for private permitted camera observer; no video, operator or GPS data. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {webcrypto} from "node:crypto";
import {runInNewContext,Script} from "node:vm";
const read=path=>readFileSync(path,"utf8");
const schema=read("data/camera-observation-core.js"),p2p=read("camera-observer-p2p.js");
const observer=read("camera-watch.js"),observerHtml=read("camera-watch.html");
const html=read("index.html"),app=read("app-v2.js");
for(const code of [schema,p2p,observer,app])new Script(code);
const context={window:{},console,Date,Math,Number,Uint8Array};
runInNewContext(read("data/mrt6-track.js"),context);
runInNewContext(schema,context);
const stations=context.window.MRT_TRACK.stations;
const core=context.window.MRT_CAMERA_OBSERVATIONS.create(stations);
assert.equal(stations.length,16,"Expect all MRT6 stations");
const now=Date.now();
const valid={kind:"mrt6-camera-passage",eventId:"pass-abcdef987654321",
 source:"browser-camera",method:"human-confirmed",stationIndex:7,
 time:now,confidence:null};
assert.equal(core.validate(valid,now).ok,true);
const accepted=core.ingest(valid,now);
assert(accepted.ok,"Live station sighting accepted");
assert.equal(accepted.data.isGps,false);
assert.equal(accepted.data.isOfficialTrainTelemetry,false);
assert.equal(accepted.data.sourceType,"consenting-camera-witness");
assert.equal(accepted.data.stationName,stations[7].bn);
assert.equal(core.ingest(valid,now).ok,false,"No replayed sightings");
assert.equal(core.latest(now+91000),null,"90s TTL expires");
assert.equal(core.validate({...valid,eventId:"pass-2bbbbbb",time:now-100000},now).ok,false);
assert.equal(core.validate({...valid,eventId:"pass-3bbbbbb",stationIndex:99},now).ok,false);
assert.equal(core.validate({...valid,eventId:"pass-4bbbbbb",method:"AI-only"},now).ok,false);
assert.equal(core.validate({...valid,eventId:"pass-5bbbbbb",source:"operator"},now).ok,false);
assert.equal(core.validate({...valid,eventId:"pass-6bbbbbb",confidence:.2},now).ok,false);
assert.equal(core.validate({...valid,eventId:"pass-7bbbbbb",time:now+6000},now).ok,false);
assert(html.includes('id="cameraWitnessPanel"'),"Camera watch container missing");
for(const id of ["cameraWatchStart","cameraWatchStop",
 "cameraWatchLink","cameraWatchCopy","cameraWatchShare","cameraWatchStatus",
 "cameraWitnessList"]){
 assert(html.includes('id="'+id+'"'),"Camera watch UI missing "+id);
 assert(app.includes('$("'+id+'")'),"Camera watch handler missing "+id);
}
assert(html.includes('camera-observation-core.js')&&html.includes('camera-observer-p2p.js'));
assert(html.includes('camera-watch-v')||html.includes('app-v2.js'));
assert(app.includes('function receiveCameraReport('),"Missing 3D passage renderer");
assert(app.includes("cameraReports.set(event.eventId,event)"),"New reports not stored");
assert(app.includes("viewer.entities.add({"),"Cesium station marker required");
assert(app.includes("camera-passage-"),"Station markers must be clearly labelled");
assert(app.includes("setInterval(expireCameraReports,5000)"),"Stale markers must disappear");
assert(observerHtml.includes('id="consent"'),"Camera owner must opt in");
assert(observerHtml.includes("camera-watch.js"),"Camera observer JS missing");
assert(observer.includes("navigator.mediaDevices.getUserMedia"),"Local camera must ask permission");
assert(observer.includes("window.cocoSsd.load"),"Optional TensorFlow model missing");
assert(observer.includes('x.class==="train"'),"AI must look specifically for train class");
assert(observer.includes("human-confirmed-ai-candidate"),"AI suggestions require human confirmation");
assert(observer.includes("document.hidden&&media")&&observer.includes("stopCamera()"));
assert(!p2p.includes("getUserMedia")&&!p2p.includes("geolocation"),
 "Private P2P must never request photos or GPS");
assert(!p2p.includes("fetch("),"No station camera surveillance endpoints allowed");
assert(!observer.includes("MediaRecorder"),"Camera sessions should not record footage");
// Simulate two independent devices and a direct data-channel handshake.
class Emitter{
 constructor(){this.handlers=new Map()}
 on(name,fn){const list=this.handlers.get(name)||[];list.push(fn);this.handlers.set(name,list);return this}
 emit(name,...args){for(const fn of this.handlers.get(name)||[])fn(...args)}
}
const peers=new Map();let counter=0;
class Conn extends Emitter{
 constructor(){super();this.open=false}
 send(message){if(this.open&&this.other)this.other.emit("data",message)}
 close(){if(!this.open)return;this.open=false;this.emit("close");if(this.other?.open){this.other.open=false;this.other.emit("close")}}
}
class Peer extends Emitter{
 constructor(id){super();this.id=id||"test-sender-"+(++counter);peers.set(this.id,this);
  queueMicrotask(()=>this.emit("open",this.id))}
 connect(id){
  const target=peers.get(id);if(!target)throw Error("Viewer not found");
  const client=new Conn(),server=new Conn();client.other=server;server.other=client;
  target.emit("connection",server);
  queueMicrotask(()=>{client.open=true;server.open=true;server.emit("open");client.emit("open")});
  return client;
 }
 destroy(){peers.delete(this.id)}
}
const mock={window:{Peer,addEventListener(){}},document:{},console,Math,Date,Uint8Array,
 URL,setTimeout,clearTimeout,crypto:webcrypto,
 location:{href:"https://example.org/Test/index.html"}};
runInNewContext(p2p,mock);
const system=mock.window.MRT_CAMERA_P2P,got=[];
assert(system,"Private camera transport not loaded");
const viewer=await system.startWatch(x=>got.push(x));
assert(viewer.link.includes("camera-watch.html#watch=mrtcam-"),"Invitation must stay in URL fragment");
await system.joinWatch(viewer.id);
assert(system.joined===true,"Camera observer connected");
assert(system.report(valid),"Camera passage event sent via P2P");
assert.equal(got.length,1);
assert.equal(got[0].stationIndex,7);
system.stopSender();system.stopWatch();
assert.equal(system.joined,false);
console.log("PASS camera observer: explicit permission, station mapping, AI human review, 90s expiry and private two-device P2P.");
