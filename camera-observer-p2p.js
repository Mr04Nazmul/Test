/* One-to-one consented camera passage messages via browser WebRTC.
 * No video frames or images are sent; no public location database.
 * Every event is human-confirmed and labelled non-official.
 */
(function(){
"use strict";
let loading,viewer=null,sender=null,connection=null,watchId="",listener=null;
let watcherConnections=new Set(),watchers=0,phase="idle";
const listeners=new Set();
const status=(message)=>{for(const fn of listeners)try{fn(message)}catch(_){}};
function peerLibrary(){
 if(window.Peer)return Promise.resolve();
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement("script");
  script.src="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js";
  script.crossOrigin="anonymous";
  script.onload=()=>window.Peer?resolve():reject(Error("PeerJS unavailable"));
  script.onerror=()=>reject(Error("PeerJS signaling library failed to load"));
  document.head.append(script);
 }).catch(e=>{loading=null;throw e});
 return loading;
}
const randomId=()=>{
 const bytes=new Uint8Array(16);
 crypto.getRandomValues(bytes);
 return "mrtcam-"+Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
};
const validId=id=>/^mrtcam-[a-f0-9]{32}$/.test(String(id));
function stopWatch(){
 const old=viewer;viewer=null;watchId="";listener=null;phase="idle";
 for(const conn of watcherConnections)try{conn.close()}catch(e){}
 watcherConnections.clear();watchers=0;
 if(old)try{old.destroy()}catch(e){}
 status("Camera watch stopped. No observations saved.");
}
async function startWatch(callback){
 if(typeof callback!=="function")throw Error("Observation callback required");
 await peerLibrary();
 stopWatch();
 watchId=randomId();listener=callback;phase="connecting";
 return new Promise((resolve,reject)=>{
  let settled=false;const p=new window.Peer(watchId,{debug:0});viewer=p;
  const timeout=setTimeout(()=>{if(!settled){settled=true;stopWatch();reject(Error("Camera watch signaling timeout"))}},16000);
  p.on("open",()=>{
   if(settled)return;settled=true;clearTimeout(timeout);phase="ready";status("Camera watch ready");
   const invite=new URL("camera-watch.html",location.href);
   invite.hash="watch="+watchId;
   resolve({link:invite.toString(),id:watchId});
  });
  p.on("connection",conn=>{
   if(watcherConnections.size>=8){conn.close();return}
   watcherConnections.add(conn);
   let last=0;
   conn.on("open",()=>{watchers=watcherConnections.size;status("Connected station observers: "+watchers)});
   conn.on("data",raw=>{
    if(!raw||raw.kind!=="mrt6-camera-passage"||Date.now()-last<2000)return;
    last=Date.now();listener?.(raw);
   });
   const gone=()=>{watcherConnections.delete(conn);watchers=watcherConnections.size;status("Connected station observers: "+watchers)};
   conn.on("close",gone);
   conn.on("error",gone);
  });
  p.on("error",e=>{status("Camera signaling error: "+String(e.message||e));
   if(!settled){settled=true;clearTimeout(timeout);stopWatch();reject(e)}});
 });
}
function stopSender(){
 const old=sender,conn=connection;sender=null;connection=null;
 if(conn)try{conn.close()}catch(e){}
 if(old)try{old.destroy()}catch(e){}
 status("Station observer disconnected.");
}
async function joinWatch(id){
 if(!validId(id))throw Error("Invalid private camera watch invitation");
 await peerLibrary();stopSender();
 return new Promise((resolve,reject)=>{
  let settled=false;const p=new window.Peer({debug:0});sender=p;
  const timeout=setTimeout(()=>{if(!settled){settled=true;stopSender();reject(Error("Observer connection timeout"))}},16000);
  p.on("open",()=>{
   const conn=p.connect(id,{reliable:true,serialization:"json"});connection=conn;
   conn.on("open",()=>{if(!settled){settled=true;clearTimeout(timeout);resolve(true)}status("Connected to private MRT6 camera watch")});
   conn.on("close",()=>status("Camera viewer disconnected"));
   conn.on("error",e=>{status("Camera data channel error: "+String(e.message||e));
     if(!settled){settled=true;clearTimeout(timeout);reject(e)}});
  });
  p.on("error",e=>{status("Observer signaling error: "+String(e.message||e));
   if(!settled){settled=true;clearTimeout(timeout);stopSender();reject(e)}});
 });
}
function report(payload){
 if(!connection?.open)return false;
 if(!payload||payload.kind!=="mrt6-camera-passage")return false;
 connection.send(payload);return true;
}
window.MRT_CAMERA_P2P={
 startWatch,stopWatch,joinWatch,stopSender,report,onStatus:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},
 get state(){return phase},get observerCount(){return watchers},get joined(){return !!connection?.open}
};
window.addEventListener("pagehide",()=>{stopSender();stopWatch()});
})();
