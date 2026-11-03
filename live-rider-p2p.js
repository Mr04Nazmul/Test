/* MRT6 Private Rider GPS via encrypted WebRTC data channel.
 * No backend or public GPS database. A consenting rider must actively
 * open a private invite and press Start Sharing in a browser.
 * This is GPS from a PERSON'S phone, never official train telemetry.
 * PeerJS 1.5.5 (MIT) uses its optional free public signaling service.
 */
(function(){
"use strict";
const listeners=new Set();
let watcher=null,watchConnection=null,sender=null,senderConnection=null,senderGPS=null;
let watchState="idle",senderState="idle",watchLink="",callback=null;
const maxFreshMs=20000;
const status=(state,detail={})=>{
 watchState=state;for(const fn of listeners)try{fn({state,...detail})}catch(e){console.warn(e)}
};
const randomID=()=>{
 if(!window.crypto?.getRandomValues)throw Error("HTTPS secure randomness required");
 const a=new Uint8Array(16);window.crypto.getRandomValues(a);
 return "mrt6-"+Array.from(a).map(v=>v.toString(16).padStart(2,"0")).join("");
};
function validMessage(x,now=Date.now()){
 if(!x||x.kind!=="mrt6-rider-location"||x.onBoard!==true)return false;
 const lat=Number(x.lat),lon=Number(x.lon),accuracy=Number(x.accuracy),time=Number(x.time);
 if(!Number.isFinite(lat)||lat<23.7||lat>23.91)return false;
 if(!Number.isFinite(lon)||lon<90.32||lon>90.46)return false;
 if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>350)return false;
 if(!Number.isFinite(time)||Math.abs(now-time)>maxFreshMs)return false;
 return true;
}
function stopWatch(){
 if(watchConnection){try{watchConnection.close()}catch(e){}watchConnection=null}
 if(watcher){try{watcher.destroy()}catch(e){}watcher=null}
 watchLink="";callback=null;status("idle");
}
function startWatch(onPosition){
 if(!window.Peer)return Promise.reject(Error("PeerJS could not load. Internet is required."));
 stopWatch();
 callback=onPosition;const id=randomID();
 return new Promise((resolve,reject)=>{
  let finished=false;
  const timeout=setTimeout(()=>{if(!finished){finished=true;stopWatch();reject(Error("Peer signaling timed out"))}},17000);
  const p=new window.Peer(id,{debug:0});
  watcher=p;
  p.on("open",()=>{if(finished)return;finished=true;clearTimeout(timeout);
   const link=new URL("share-live.html",window.location.href);
   link.hash="watch="+encodeURIComponent(id); // Fragment is not sent to website/CDN servers.
   watchLink=link.href;status("waiting",{link:watchLink});resolve({link:watchLink,peerId:id});
  });
  p.on("connection",conn=>{
   // One private sender only, a second connection cannot silently subscribe.
   if(watchConnection){conn.close();return}
   watchConnection=conn;status("connecting");
   conn.on("open",()=>{status("connected")});
   conn.on("data",value=>{
    if(value?.kind==="mrt6-rider-stop"){status("sender-stopped");return}
    if(!validMessage(value))return;
    callback?.({lat:value.lat,lon:value.lon,accuracy:value.accuracy,
      speed:Number.isFinite(Number(value.speed))?Number(value.speed):null,
      time:value.time,onBoard:true,source:"consenting rider phone"});
   });
   conn.on("close",()=>{if(watchConnection===conn)watchConnection=null;status("disconnected")});
   conn.on("error",e=>status("error",{message:e.message}));
  });
  p.on("error",e=>{if(!finished){finished=true;clearTimeout(timeout);reject(e)}status("error",{message:e.message})});
  p.on("disconnected",()=>status("disconnected"));
 });
}
function stopShare(){
 if(senderGPS!==null&&navigator.geolocation){navigator.geolocation.clearWatch(senderGPS);senderGPS=null}
 if(senderConnection){try{if(senderConnection.open)senderConnection.send({kind:"mrt6-rider-stop"})}catch(e){}
  try{senderConnection.close()}catch(e){}senderConnection=null}
 if(sender){try{sender.destroy()}catch(e){}sender=null}
 senderState="idle";return senderState;
}
function startShare(peerId,onStatus){
 if(!/^mrt6-[0-9a-f]{32}$/.test(String(peerId)))return Promise.reject(Error("Invalid private watch invite."));
 if(!window.Peer)return Promise.reject(Error("PeerJS could not load."));
 if(!navigator.geolocation)return Promise.reject(Error("GPS unavailable. HTTPS + location permission required."));
 stopShare();senderState="connecting";onStatus?.("Connecting to private viewer…");
 return new Promise((resolve,reject)=>{
  let finished=false;
  const fail=e=>{if(!finished){finished=true;reject(e)}onStatus?.("Connection error: "+e.message)};
  const p=new window.Peer({debug:0});sender=p;
  p.on("open",()=>{
   const conn=p.connect(peerId,{reliable:true});senderConnection=conn;
   conn.on("open",()=>{
    if(!finished){finished=true;resolve(true)}
    senderState="sharing";onStatus?.("Connected. Waiting for GPS permission…");
    senderGPS=navigator.geolocation.watchPosition(
     location=>{
      if(!conn.open)return;
      const {latitude:lat,longitude:lon,accuracy,speed}=location.coords;
      if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
      conn.send({kind:"mrt6-rider-location",lat,lon,accuracy,
        speed:Number.isFinite(speed)?speed:null,time:Date.now(),onBoard:true});
      onStatus?.("Your phone GPS is being shared privately · ±"+Math.round(accuracy)+"m");
     },err=>onStatus?.("GPS permission/error: "+err.message),
     {enableHighAccuracy:true,timeout:18000,maximumAge:2000});
   });
   conn.on("close",()=>{if(senderState!=="idle"){stopShare();onStatus?.("Viewer disconnected; GPS sharing stopped.")}});
   conn.on("error",fail);
  });
  p.on("error",fail);
 });
}
function onStatus(fn){listeners.add(fn);return()=>listeners.delete(fn)}
document.addEventListener("visibilitychange",()=>{
 // In particular, iPhone Safari tab backgrounding must never imply
 // continued, fresh GPS streaming.
 if(document.hidden&&senderState==="sharing")stopShare();
});
window.addEventListener("pagehide",()=>{stopShare();stopWatch()});
window.MRT_RIDER_P2P={startWatch,stopWatch,startShare,stopShare,onStatus,validMessage,
 get watchLink(){return watchLink},get state(){return watchState},get senderState(){return senderState}};
})();
