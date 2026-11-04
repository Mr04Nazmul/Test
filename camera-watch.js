/* Permission-gated human confirmation of permitted station camera sightings.
 * Inference stays in this browser. Never transmit frames/video, people, or GPS.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const core=window.MRT_CAMERA_OBSERVATIONS?.create(window.MRT_TRACK?.stations||[]);
const session=window.MRT_CAMERA_P2P;
const stations=window.MRT_TRACK?.stations||[];
const params=new URLSearchParams(location.hash.replace(/^#/,""));
const invite=params.get("watch")||"";
const validInvite=/^mrtcam-[a-f0-9]{32}$/.test(invite);
let media=null,model=null,aiRunning=false,aiTimer=null,aiHits=0;
let candidateTime=0,candidateScore=null,sensorEvidence=null,lastSent=0;
const status=text=>{$("status").textContent=text};
const aiStatus=text=>{$("aiStatus").textContent=text};
for(let i=0;i<stations.length;i++){
 const s=stations[i],option=document.createElement("option");
 option.value=String(i);option.textContent=(i+1)+". "+(s.bn||s.n);
 $("station").append(option);
}
$("connect").disabled=!validInvite;
status(validInvite?"Private invitation detected. Confirm permission to connect.":"Private viewer link প্রয়োজন। Dhaka Metro 3D → Camera Watch থেকে লিংক তৈরি করো।");
function refresh(){
 const connected=session?.joined===true;
 const browser=$("sourceMode").value==="browser-camera";
 $("connect").disabled=!validInvite||!$("consent").checked;
 $("startCamera").disabled=!connected||!$("consent").checked||!browser||!!media;
 $("stopCamera").disabled=!media;
 $("startAI").disabled=!media||aiRunning;
 $("confirmTrain").disabled=!connected||!$("consent").checked||
  (browser?!media:!sensorEvidence);
 $("cameraBox").hidden=!browser;
 $("sensorBox").hidden=browser;
}
$("consent").addEventListener("change",refresh);
$("sourceMode").addEventListener("change",()=>{stopCamera();sensorEvidence=null;refresh()});
$("station").addEventListener("change",()=>{sensorEvidence=null;refresh()});
session?.onStatus(status);
$("connect").addEventListener("click",async()=>{
 if(!$("consent").checked||!validInvite)return;
 $("connect").disabled=true;
 status("Joining private camera observation session…");
 try{await session.joinWatch(invite);status("✅ Viewer connected. Confirm a real passage only.");}
 catch(e){status("Connection failed: "+String(e.message||e));}
 refresh();
});
async function startCamera(){
 if(!$("consent").checked||!session?.joined)throw Error("Consent and private viewer connection required");
 if(!navigator.mediaDevices?.getUserMedia)throw Error("Camera requires HTTPS and browser permission");
 media=await navigator.mediaDevices.getUserMedia({
  audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:640},height:{ideal:360},frameRate:{ideal:15}}});
 $("preview").srcObject=media;
 await $("preview").play();
 aiStatus("📷 Your own camera runs locally. No video uploaded. Press Confirm when train really passes.");
 refresh();
}
function stopCamera(){
 aiRunning=false;if(aiTimer!==null){clearTimeout(aiTimer);aiTimer=null}
 if(media){for(const t of media.getTracks())t.stop();media=null}
 $("preview").pause();$("preview").srcObject=null;
 aiHits=0;candidateTime=0;candidateScore=null;
 aiStatus("Camera stopped. AI and camera observations disabled.");
 refresh();
}
$("startCamera").addEventListener("click",async()=>{
 $("startCamera").disabled=true;
 try{await startCamera()}catch(e){stopCamera();status("Camera error: "+String(e.message||e))}
 refresh();
});
$("stopCamera").addEventListener("click",stopCamera);
function loadScript(src){
 return new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src=src;script.crossOrigin="anonymous";
  script.onload=resolve;script.onerror=()=>reject(Error("AI model CDN unavailable"));
  document.head.append(script);
 });
}
async function loadModel(){
 if(model)return model;
 if(!window.tf)await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
 if(!window.cocoSsd)await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
 if(!window.cocoSsd?.load)throw Error("TensorFlow COCO-SSD load failed");
 model=await window.cocoSsd.load({base:"lite_mobilenet_v2"});
 return model;
}
async function predict(){
 if(!aiRunning||!media||document.hidden)return;
 try{
  const results=await model.detect($("preview"),12,.52);
  const train=results.filter(x=>x.class==="train"&&x.score>=.58).sort((a,b)=>b.score-a.score)[0];
  aiHits=train?Math.min(3,aiHits+1):0;
  if(train&&aiHits>=2){
   candidateTime=Date.now();candidateScore=train.score;
   aiStatus("🤖 Possible TRAIN detected · "+Math.round(train.score*100)+"% confidence. Verify visually, then Confirm. AI is not proof.");
  }else if(Date.now()-candidateTime>10000){
   candidateTime=0;candidateScore=null;
   aiStatus("🤖 Scanning own camera · "+(train?"train candidate, awaiting second frame":"no reliable train candidate"));
  }
 }catch(e){aiStatus("AI detection failed; manual confirmation still works: "+String(e.message||e).slice(0,130));aiRunning=false;return}
 if(aiRunning)aiTimer=setTimeout(predict,1700);
}
$("startAI").addEventListener("click",async()=>{
 if(!media||!session?.joined)return;
 $("startAI").disabled=true;aiStatus("Loading AI model onto this device; video is not uploaded…");
 try{await loadModel();if(!media)return;aiRunning=true;predict();}
 catch(e){aiStatus("AI unavailable ("+String(e.message||e)+"). Manual confirmation works.");}
 refresh();
});
$("checkSensor").addEventListener("click",()=>{
 sensorEvidence=null;
 try{
  if($("sourceMode").value==="browser-camera")throw Error("Choose a local sensor source");
  const d=JSON.parse($("sensorJson").value);
  if(d.train_detected!==true&&d.label!=="train")throw Error("Sensor result does not report a train");
  const time=Date.parse(d.observed_at);
  if(!Number.isFinite(time)||Date.now()-time>30000||time>Date.now()+2000)
   throw Error("Sensor result must be real and newer than 30 seconds");
  const confidence=Number(d.confidence);
  if(!Number.isFinite(confidence)||confidence<.5||confidence>1)
   throw Error("Confidence must be between 0.5 and 1");
  sensorEvidence={time,confidence};
  status("Sensor result checked · "+Math.round(confidence*100)+"%. Visually verify and click Confirm.");
 }catch(e){status("Sensor evidence rejected: "+String(e.message||e))}
 refresh();
});
$("confirmTrain").addEventListener("click",()=>{
 if(!session?.joined||!$("consent").checked)return;
 const source=$("sourceMode").value,now=Date.now(),browser=source==="browser-camera";
 if(now-lastSent<15000){status("১৫ সেকেন্ড পর আরেকটি observation পাঠাও।");return}
 if(browser&&!media){status("Start Camera and verify a real passing train first.");return}
 if(!browser&&(!sensorEvidence||now-sensorEvidence.time>30000)){status("Fresh sensor result যাচাই করো।");return}
 const viaAI=browser&&candidateTime&&now-candidateTime<10000;
 const method=browser?(viaAI?"human-confirmed-ai-candidate":"human-confirmed"):
  "human-confirmed-sensor";
 const confidence=browser?(viaAI?candidateScore:null):sensorEvidence.confidence;
 const bytes=new Uint8Array(12);crypto.getRandomValues(bytes);
 const eventId="pass-"+Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 const raw={kind:"mrt6-camera-passage",eventId,source,method,
  stationIndex:Number($("station").value),time:now,confidence};
 const checked=core.validate(raw,now);
 if(!checked.ok){status("Observation validation failed: "+checked.reason);return}
 if(session.report(raw)){
  lastSent=now;sensorEvidence=null;candidateTime=0;candidateScore=null;
  status("✅ User-confirmed passage sent to private viewer · "+checked.data.stationName+
   " · NOT official GPS or train identity.");
 }else status("Viewer connection disconnected. Nothing sent.");
 refresh();
});
$("disconnect").addEventListener("click",()=>{
 stopCamera();session?.stopSender();sensorEvidence=null;refresh();status("Disconnected and camera stopped");
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&media)stopCamera()});
window.addEventListener("pagehide",stopCamera);
refresh();
})();
