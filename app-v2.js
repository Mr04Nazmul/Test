/* Dhaka MRT-6 Explorer v2.
 * Geometry: © OpenStreetMap contributors (ODbL). Rail models: original, conceptual.
 * All train locations and ETAs are timetable ESTIMATES, not real GPS.
 */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const C=window.Cesium,route=window.MRT_TRACK,svc=window.MRT_SCHEDULE;
const info=$("notice");
function announce(message,ms=6500){
 info.textContent=message;
 if(ms)setTimeout(()=>{if(info.textContent===message)info.textContent=""},ms);
}
if(!C||!route||!svc){announce("ম্যাপ বা রুটের তথ্য লোড হয়নি। Refresh করো।",0);return}
const st=route.stations,pts=route.points,stops=route.stationBreaks;
const slate=C.Color.fromCssColorString("#14354d"),green=C.Color.fromCssColorString("#0de9ad");
let viewer,osmLayer=null,satLayer=null,googleTiles=null,googleMode=false,satelliteOn=false;
let selectedStation=10,mode="estimate",selectedTrain="",trainData=[],focused=null;
let playing=true,demoMeters=0,rate=1,ride=false,worldModels=[],buildings=[],showBuildings=true;
let lastFrame=0,lastMapUpdate=0,etaLast=0,stationStructure=null,trainEntities=[],trainMarkers=new Map();
let loadTicket=0,bldgRequest=null,gpsWatchId=null,gpsMeters=null,gpsMark=null;
const nameFor=i=>(st[i]&&st[i].bn)||"";
const carLength=19.8;
function lonlatPoint(p,h){return C.Cartesian3.fromDegrees(p.lon,p.lat,h)}
function clamp(v,a,b){return Math.min(b,Math.max(a,v))}
const cum=[0];
for(let i=1;i<pts.length;i++){
 const a=C.Cartographic.fromDegrees(pts[i-1][1],pts[i-1][0]);
 const b=C.Cartographic.fromDegrees(pts[i][1],pts[i][0]);
 cum.push(cum[i-1]+new C.EllipsoidGeodesic(a,b).surfaceDistance);
}
const trackLength=cum[cum.length-1],stopMeters=stops.map(k=>cum[k]);
demoMeters=stopMeters[10]+110;
function at(meters,travel="south"){
 const d=clamp(meters,0,trackLength-.01);
 let lo=0,hi=cum.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(cum[mid]<=d)lo=mid;else hi=mid}
 const f=(d-cum[lo])/(cum[lo+1]-cum[lo]||1);
 const a=pts[lo],b=pts[lo+1];
 const lat=a[0]+f*(b[0]-a[0]),lon=a[1]+f*(b[1]-a[1]);
 const ang=Math.atan2((b[1]-a[1])*Math.cos(C.Math.toRadians(lat)),b[0]-a[0]);
 return {lat,lon,heading:ang+(travel==="north"?Math.PI:0),distance:d};
}
function metersAtIndex(progress){
 const p=clamp(progress,0,st.length-1),i=Math.min(14,Math.floor(p)),f=p-i;
 return stopMeters[i]+(stopMeters[i+1]-stopMeters[i])*f;
}
function lastKnown(){return focused||at(demoMeters)}
try{
 C.Ion.defaultAccessToken=undefined;
 viewer=new C.Viewer("scene",{baseLayer:false,baseLayerPicker:false,geocoder:false,homeButton:false,
 sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,selectionIndicator:false,
 infoBox:false,shouldAnimate:true});
 viewer.scene.globe.enableLighting=false;
 viewer.scene.globe.depthTestAgainstTerrain=false;
 viewer.scene.screenSpaceCameraController.enableCollisionDetection=false;
 viewer.scene.backgroundColor=C.Color.fromCssColorString("#102736");
 viewer.resolutionScale=Math.min(window.devicePixelRatio>=3?.87:1,1);
 osmLayer=viewer.imageryLayers.addImageryProvider(new C.OpenStreetMapImageryProvider({url:"https://tile.openstreetmap.org/"}));
 const s=st[10];
 viewer.camera.setView({destination:C.Cartesian3.fromDegrees(s.lon,s.lat,470),
 orientation:{heading:C.Math.toRadians(20),pitch:C.Math.toRadians(-48),roll:0}});
}catch(e){announce("3D viewer শুরু হয়নি: "+e.message,0);return}
$("status").textContent="ETA ESTIMATE";
$("notice").textContent="রেলপথ OSM থেকে; ট্রেন অবস্থান সময়সূচিভিত্তিক অনুমান (GPS নয়)।";
const routePositions=C.Cartesian3.fromDegreesArrayHeights(pts.flatMap(p=>[p[1],p[0],18.7]));
viewer.entities.add({name:"MRT Line 6 elevated viaduct · OSM trace",polyline:{
 positions:routePositions,width:12,material:C.Color.fromCssColorString("#6e8291").withAlpha(.95)}});
viewer.entities.add({name:"MRT Line 6 rails · OSM trace",polyline:{
 positions:C.Cartesian3.fromDegreesArrayHeights(pts.flatMap(p=>[p[1],p[0],19.75])),
 width:4,material:new C.PolylineGlowMaterialProperty({glowPower:.12,color:green})}});
// Visible 3D concrete viaduct and two pairs of steel rails following the curved OSM track.
try{
 viewer.entities.add({name:"Elevated concrete guideway (3D approximate)",corridor:{
  positions:C.Cartesian3.fromDegreesArray(pts.flatMap(p=>[p[1],p[0]])),
  width:7.2,height:18.4,extrudedHeight:17.95,
  material:C.Color.fromCssColorString("#b4b6b5")}});
 function offsetTrack(shift){
  return C.Cartesian3.fromDegreesArrayHeights(pts.flatMap((p,i)=>{
   const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
   const lat=p[0],cos=Math.cos(C.Math.toRadians(lat));
   const de=(b[1]-a[1])*111320*cos,dn=(b[0]-a[0])*111320,n=Math.max(1e-7,Math.hypot(de,dn));
   return [p[1]+(-dn/n)*shift/(111320*cos),p[0]+(de/n)*shift/111320,19.45];
  }));
 }
 for(const offset of [-2.85,-1.45,1.45,2.85]){
  viewer.entities.add({name:"MRT-6 steel rail (approximate)",polyline:{
   positions:offsetTrack(offset),width:2,
   material:C.Color.fromCssColorString("#44494d")}});
 }
}catch(e){console.warn("Guideway geometry unavailable:",e)}

for(let d=95;d<trackLength;d+=140){
 const p=at(d);
 viewer.entities.add({name:"Illustrative rail support",position:lonlatPoint(p,8.8),
 cylinder:{length:17.6,topRadius:1.15,bottomRadius:1.45,material:C.Color.fromCssColorString("#b2b7b6")}});
}
const list=$("stationList");
st.forEach((s,i)=>{
 const btn=document.createElement("button");btn.className="station";btn.dataset.index=i;btn.type="button";
 const a=document.createElement("span");a.className="marker";
 const text=document.createElement("span");text.className="station-text";
 const strong=document.createElement("strong");strong.textContent=s.n;
 const sub=document.createElement("small");sub.textContent=s.bn;
 text.append(strong,sub);
 const num=document.createElement("span");num.className="num";num.textContent=String(i+1).padStart(2,"0");
 btn.append(a,text,num);
 btn.addEventListener("click",()=>focusStation(i));
 list.append(btn);
 viewer.entities.add({id:"station-"+i,name:s.n,position:lonlatPoint(s,26),
 point:{pixelSize:11,color:green,outlineColor:slate,outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY},
 label:{text:s.n,font:"bold 13px system-ui",fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,
 outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-22),
 distanceDisplayCondition:new C.DistanceDisplayCondition(0,9000),disableDepthTestDistance:Number.POSITIVE_INFINITY}});
});
// glTF 2.0 uses +Z-forward; Cesium converts it to +X. Adjust -90 degrees to
// make the longitudinal axis of all train and station glTF files follow the rail's compass bearing.
function modelOrientation(p){return C.Transforms.headingPitchRollQuaternion(lonlatPoint(p,0),new C.HeadingPitchRoll(p.heading-C.Math.PI_OVER_TWO,0,0))}
function renderStructure(index){
 if(stationStructure)viewer.entities.remove(stationStructure);
 const s=st[index],p=at(stopMeters[index]);
 stationStructure=viewer.entities.add({name:s.n+" conceptual 3D station",position:lonlatPoint(s,0),
 orientation:modelOrientation(p),
 model:{uri:"assets/mrt6-station-concept.gltf",scale:1,minimumPixelSize:0}});
}
function updateStationText(){
 list.querySelectorAll(".station").forEach(el=>el.classList.toggle("active",Number(el.dataset.index)===selectedStation));
 if(!$("etaPanel"))return;
 const box=$("etaPanel");box.replaceChildren();
 const head=document.createElement("div");head.className="eta-head";
 const h=document.createElement("strong");h.textContent=nameFor(selectedStation)+" · আনুমানিক ETA";
 const t=document.createElement("small");t.textContent=svc.dhakaClock().clock.slice(0,5)+" BST";
 head.append(h,t);box.append(head);
 for(const item of svc.arrivals(selectedStation).slice(0,4)){
  const line=document.createElement("div");line.className="eta-row";
  const direction=document.createElement("span");direction.textContent=item.dir==="south"?"↓ মতিঝিল":"↑ উত্তরা উত্তর";
  const eta=document.createElement("b");eta.textContent=item.inMinutes<1?"~ এখন":"~ "+Math.ceil(item.inMinutes)+" মিনিট";
  const clock=document.createElement("small");clock.textContent=item.clock;
  line.append(direction,eta,clock);box.append(line);
 }
 const foot=document.createElement("small");foot.className="estimate-caption";foot.textContent="সময় ও অবস্থান আনুমানিক — সরকারি GPS live feed নয়";
 box.append(foot);
}
function clearViewLock(){viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);ride=false;$("follow").classList.remove("primary")}
function focusStation(i){
 selectedStation=i;clearViewLock();renderStructure(i);updateStationText();
 if(showBuildings&&!googleMode)loadBuildings(i);
 const s=st[i];
 viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(s.lon,s.lat,430),
 orientation:{heading:at(stopMeters[i]).heading,pitch:C.Math.toRadians(-48),roll:0},duration:1.1});
 announce(nameFor(i)+" — স্টেশনের 3D মডেল ও আনুমানিক ট্রেনের সময়",5000);
}
function overview(){
 clearViewLock();viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(90.389,23.793,24000),
 orientation:{heading:0,pitch:C.Math.toRadians(-74),roll:0},duration:1.3});
}
for(let i=0;i<6;i++){
 const variant=i===0?"front":i===5?"rear":"middle";
 trainEntities.push(viewer.entities.add({
 id:"detailed-coach-"+i,name:"MRT-6 "+variant+" coach "+(i+1),
 position:lonlatPoint(at(demoMeters),0),
 model:{uri:"assets/mrt6-"+variant+".gltf",scale:1,minimumPixelSize:0,maximumScale:1}
 }));
}
function refreshTrainMarkerPositions(){
 const active=mode==="estimate"?svc.active():[];
 const previous=new Set(trainMarkers.keys());
 for(const t of active){
  previous.delete(t.id);
  const m=metersAtIndex(t.position),pos=at(m,t.dir),position=lonlatPoint(pos,24);
  let e=trainMarkers.get(t.id);
  if(!e){
   e=viewer.entities.add({name:"Estimated "+t.id,position,point:{
    pixelSize:13,color:t.dir==="south"?C.Color.fromCssColorString("#ffcf76"):green,
    outlineColor:C.Color.BLACK,outlineWidth:2,disableDepthTestDistance:Number.POSITIVE_INFINITY},
    label:{text:"🚆 "+t.id,font:"bold 11px sans-serif",fillColor:C.Color.WHITE,
     outlineColor:C.Color.BLACK,outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,
     pixelOffset:new C.Cartesian2(0,-18),distanceDisplayCondition:new C.DistanceDisplayCondition(0,6000),
     disableDepthTestDistance:Number.POSITIVE_INFINITY}});
   trainMarkers.set(t.id,e);
  }else e.position=position;
 }
 for(const id of previous){viewer.entities.remove(trainMarkers.get(id));trainMarkers.delete(id)}
 trainData=active;
 if(mode==="estimate"){
  if(!active.length){
   mode="demo";updateModeControls();
   announce("এই মুহূর্তে অনুমিত চালু ট্রেন নেই। 3D demo ride চালু হয়েছে।",8500);
  }else if(!active.some(t=>t.id===selectedTrain)){
   selectedTrain=active.reduce((best,t)=>Math.abs(t.position-selectedStation)<Math.abs(best.position-selectedStation)?t:best,active[0]).id;
  }
 }
 updateTrainsUI();
}
function updateTrainsUI(){
 const area=$("trainList");if(!area)return;
 area.replaceChildren();
 const head=document.createElement("div");head.className="eta-head";
 const title=document.createElement("strong");title.textContent="আনুমানিক চলমান ট্রেন";
 const count=document.createElement("small");count.textContent=trainData.length+"টি";
 head.append(title,count);area.append(head);
 if(!trainData.length){const p=document.createElement("small");p.textContent="সময় অনুযায়ী ট্রেন পাওয়া যায়নি";area.append(p);return}
 const close=[...trainData].sort((a,b)=>Math.abs(a.position-selectedStation)-Math.abs(b.position-selectedStation)).slice(0,5);
 close.forEach(t=>{
  const btn=document.createElement("button");btn.type="button";btn.className="train-row"+(t.id===selectedTrain?" active":"");
  const label=document.createElement("strong");label.textContent="🚆 "+t.id+" · "+(t.dir==="south"?"মতিঝিলমুখী":"উত্তরামুখী");
  const sub=document.createElement("small");sub.textContent=st[Math.min(15,Math.max(0,Math.round(t.position)))].bn+" · আনুমানিক";
  btn.append(label,sub);
  btn.addEventListener("click",()=>{selectedTrain=t.id;updateTrainsUI();findTrain()});
  area.append(btn);
 });
}
function activeFocus(){
 if(mode==="estimate"){
  const t=trainData.find(x=>x.id===selectedTrain);
  if(t){const m=metersAtIndex(t.position);return {m,dir:t.dir};}
 }
 if(mode==="onboard"&&gpsMeters!==null)return {m:gpsMeters,dir:"south"};
 return {m:demoMeters,dir:"south"};
}
function renderCoachSet(){
 const focus=activeFocus(),dir=focus.dir;
 focused=at(focus.m,dir);
 for(let i=0;i<trainEntities.length;i++){
  const m=clamp(focus.m+(dir==="south"?-1:1)*i*carLength,0,trackLength-.1),p=at(m,dir);
  const pos=lonlatPoint(p,19.0);
  trainEntities[i].position=pos;trainEntities[i].orientation=modelOrientation(p);
 }
}
function findTrain(){
 clearViewLock();renderCoachSet();
 const p=lastKnown();
 viewer.camera.flyTo({destination:C.Cartesian3.fromDegrees(p.lon,p.lat,160),
  orientation:{heading:p.heading+C.Math.PI,pitch:C.Math.toRadians(-44),roll:0},duration:1.15});
 announce(mode==="estimate"?"সময়সূচিভিত্তিক অনুমান—এটি live GPS tracking নয়":mode==="onboard"?"ফোনের নিজস্ব GPS অনুযায়ী ট্র্যাক অনুসরণ; অন্য ট্রেনের GPS নয়":"সিমুলেটেড ট্রেন—live নয়",6500);
}
function updateModeControls(){
 const demo=mode==="demo",onboard=mode==="onboard";
 $("pause").textContent=demo?"◉ ETA Mode":onboard?"◉ Exit My GPS":"▶ Demo Ride";
 $("speed").textContent="▶ "+rate+"× demo speed";
 $("status").textContent=onboard?"MY PHONE GPS · PRIVATE":demo?"DEMO RIDE":"TIMETABLE ESTIMATE";
}
function updateNow(t){
 const dt=Math.min(.10,Math.max(0,(t-lastFrame)/1000||0));lastFrame=t;
 if(mode==="demo"&&playing){demoMeters+=dt*16*rate;if(demoMeters>trackLength-2)demoMeters=0;}
 if(t-lastMapUpdate>900){
  if(mode==="estimate")refreshTrainMarkerPositions();
  renderCoachSet();lastMapUpdate=t;
  // When riding, update nearby station architecture and offline OSM building geometry.
  // Only change once when the train enters the vicinity of another station.
  if(ride&&focused&&showBuildings&&!googleMode){
   let closest=0,dist=Number.POSITIVE_INFINITY;
   for(let j=0;j<stopMeters.length;j++){
    const d=Math.abs(stopMeters[j]-focused.distance);
    if(d<dist){closest=j;dist=d;}
   }
   if(closest!==selectedStation){
    selectedStation=closest;
    renderStructure(closest);
    updateStationText();
    loadBuildings(closest);
   }
  }
 }
 if(ride&&focused){
  // Look along the train's length from behind, rather than broadside.
  const target=lonlatPoint(focused,22.2);
  viewer.camera.lookAt(target,new C.HeadingPitchRange(focused.heading+C.Math.PI,C.Math.toRadians(-19),130));
 }
 if(t-etaLast>10000){updateStationText();etaLast=t}
 requestAnimationFrame(updateNow);
}
async function loadBuildings(i){
 if(!showBuildings||googleMode)return;
 const token=++loadTicket,s=st[i];
 if(bldgRequest)bldgRequest.abort();
 bldgRequest=new AbortController();
 // True mapped OSM building polygons, converted into one textured glTF mesh
 // per supported station. Glass windows/unknown heights are illustrative.
 const hasCityMesh=new Set([0,1,2,3,4,5,6,7,8,9,10,15]);
 if(hasCityMesh.has(i)){
  try{
   const url="./assets/urban/"+i+".gltf";
   const head=await fetch(url,{method:"HEAD",cache:"force-cache",signal:bldgRequest.signal});
   if(head.ok){
    if(i!==selectedStation||token!==loadTicket||!showBuildings||googleMode)return;
    for(const old of buildings)viewer.entities.remove(old);
    buildings=[];
    buildings.push(viewer.entities.add({
     name:s.n+" — textured 3D buildings from mapped OSM footprints (not photogrammetry)",
     position:lonlatPoint(s,0),
     model:{uri:url,scale:1,minimumPixelSize:0,
      distanceDisplayCondition:new C.DistanceDisplayCondition(0,5500)}
    }));
    announce(s.n+" — বাস্তব OSM footprint-এর 3D building mesh। জানালা/অজানা উচ্চতা আনুমানিক।",9500);
    return;
   }
  }catch(err){if(bldgRequest.signal.aborted)return;console.warn("City mesh unavailable; OSM geometry fallback",err)}
 }
 const query='[out:json][timeout:18];way["building"](around:520,'+s.lat+','+s.lon+');out geom;';
 const base=["https://overpass.kumi.systems/api/interpreter","https://overpass-api.de/api/interpreter"];
 try{
  let rows=[],offline=false;
  // Real OpenStreetMap building polygons are stored in this repository, as same-origin JSON.
  // Unlike public Overpass API, these can be loaded reliably on a phone with no API key/CORS.
  try{
   const result=await fetch("./data/buildings/"+i+".json",{signal:bldgRequest.signal,cache:"force-cache"});
   if(result.ok){
    const cached=await result.json();
    if(Array.isArray(cached.buildings)&&cached.buildings.length){
     rows=cached.buildings;offline=true;
    }
   }
  }catch(err){if(bldgRequest.signal.aborted)return}
  if(!rows.length){
   // Live OSM fallback for stations whose pre-packaged data is not yet available.
   let data=null;
   for(const endpoint of base){
    try{
     const response=await fetch(endpoint+"?data="+encodeURIComponent(query),{signal:bldgRequest.signal});
     if(!response.ok)continue;
     data=await response.json();break;
    }catch(e){if(bldgRequest.signal.aborted)return}
   }
   if(!data)throw Error("No offline footprints; Overpass unavailable");
   rows=(data.elements||[]).map(item=>{
    if(!item.geometry||item.geometry.length<4)return null;
    const p=item.geometry.filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat)).map(p=>[p.lon,p.lat]);
    const h=parseFloat(item.tags?.height),levels=parseFloat(item.tags?.["building:levels"]);
    return {p,h:Number.isFinite(h)?h:Number.isFinite(levels)?levels*3.2:undefined};
   }).filter(Boolean);
  }
  if(!showBuildings||googleMode||i!==selectedStation||token!==loadTicket)return;
  for(const old of buildings)viewer.entities.remove(old);buildings=[];
  // Cap rendered polygons for iPhone GPU performance; use actual footprint shapes.
  for(const item of rows.slice(0,420)){
   if(!item.p||item.p.length<4)continue;
   const vertices=item.p.flat();
   if(vertices.length<8)continue;
   // OSM height/level tag where available; deterministic guess otherwise.
   const seed=(Number(item.id)||item.p.length*17)%17;
   const h=(item.h===undefined||item.h===null)?(8+(seed%6)*3.1):Number(item.h);
   const height=clamp(h,4,110);
   const colorPalette=["#a6abb3","#d4c8b9","#bdbfbd","#c6c6bd","#b0bbb9","#bdb4ae"];
   const color=colorPalette[seed%colorPalette.length];
   buildings.push(viewer.entities.add({name:offline?"OSM building footprint (cached)":"OSM building footprint",polygon:{
    hierarchy:new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(vertices)),
    height:0,extrudedHeight:height,
    material:C.Color.fromCssColorString(color).withAlpha(.98),
    outline:false
   }}));
  }
  announce(buildings.length+"টি বাস্তব OSM footprint থেকে 3D ভবন তৈরি ("+(offline?"লোকাল ক্যাশ":"অনলাইন")+"). Height অনেকে আনুমানিক।",8500);
 }catch(e){if(!bldgRequest.signal.aborted)announce("Building data unavailable for this station. অন্য স্টেশন নির্বাচন করো।",8000)}
}
async function satelliteToggle(){
 if(googleMode){announce("প্রথমে Google 3D mode বন্ধ করো।");return}
 const btn=$("satellite");
 if(satelliteOn){
  satelliteOn=false;if(satLayer)satLayer.show=false;if(osmLayer)osmLayer.show=true;
  btn.textContent="◈ Satellite";btn.classList.remove("primary");return;
 }
 btn.disabled=true;btn.textContent="Loading…";
 try{
  if(!satLayer){
   const provider=await C.ArcGisMapServerImageryProvider.fromUrl("https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    {credit:"Satellite: Esri, Maxar, Earthstar Geographics and imagery contributors"});
   satLayer=viewer.imageryLayers.addImageryProvider(provider);
  }
  satelliteOn=true;satLayer.show=true;if(osmLayer)osmLayer.show=false;
  btn.textContent="◈ Street Map";btn.classList.add("primary");
 }catch(e){btn.textContent="◈ Satellite";announce("Satellite imagery load হয়নি; street map ব্যবহার করা হচ্ছে।",6500)}
 finally{btn.disabled=false}
}
$("overview").addEventListener("click",overview);
$("findTrain").addEventListener("click",findTrain);
$("north").addEventListener("click",()=>focusStation(0));
$("central").addEventListener("click",()=>focusStation(10));
$("south").addEventListener("click",()=>focusStation(15));
$("satellite").addEventListener("click",satelliteToggle);
$("togglePanel").addEventListener("click",()=>{
 document.body.classList.toggle("panel-hidden");
 $("togglePanel").textContent=document.body.classList.contains("panel-hidden")?"▤ Show Panel":"▤ Hide Panel";
});
$("follow").addEventListener("click",()=>{
 ride=!ride;$("follow").classList.toggle("primary",ride);
 if(!ride)clearViewLock();
});
$("pause").addEventListener("click",()=>{
 if(mode==="onboard"){endPhoneGPS();clearViewLock();playing=true;updateModeControls();return;}
 mode=mode==="estimate"?"demo":"estimate";playing=true;refreshTrainMarkerPositions();updateModeControls();
 if(mode==="estimate"&&!trainData.length){mode="demo";updateModeControls();announce("এখন অনুমিত চলমান ট্রেন নেই; Demo ride চলছে।")}
});
$("speed").addEventListener("click",()=>{rate=rate===1?2:rate===2?4:1;updateModeControls()});
$("buildings").addEventListener("click",()=>{
 if(googleMode){announce("Google mode-এ আলাদা OSM ভবন বন্ধ।");return}
 showBuildings=!showBuildings;
 $("buildings").textContent=showBuildings?"▥ Hide Buildings":"▥ 3D Buildings";
 $("buildings").classList.toggle("primary",showBuildings);
 if(showBuildings)loadBuildings(selectedStation);
 else{loadTicket++;if(bldgRequest)bldgRequest.abort();buildings.forEach(e=>viewer.entities.remove(e));buildings=[]}
});
const modal=$("settings");
$("google").addEventListener("click",()=>{
 if(googleMode){
  googleMode=false;viewer.scene.globe.show=true;
  if(osmLayer)osmLayer.show=!satelliteOn;if(satLayer)satLayer.show=satelliteOn;
  if(googleTiles)googleTiles.show=false;
  buildings.forEach(e=>e.show=showBuildings);
  if(stationStructure)stationStructure.show=true;
  $("google").textContent="◈ Google 3D";return;
 }
 modal.classList.add("open");
});
$("close").addEventListener("click",()=>modal.classList.remove("open"));
modal.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});
document.addEventListener("keydown",e=>{if(e.key==="Escape")modal.classList.remove("open")});
$("loadGoogle").addEventListener("click",async()=>{
 const key=$("key").value.trim();if(!key){announce("Map Tiles API key প্রয়োজন।");return}
 const btn=$("loadGoogle");btn.disabled=true;
 try{
  if(!googleTiles){
   googleTiles=await C.Cesium3DTileset.fromUrl("https://tile.googleapis.com/v1/3dtiles/root.json?key="+encodeURIComponent(key),
   {showCreditsOnScreen:true,maximumScreenSpaceError:18});
   viewer.scene.primitives.add(googleTiles);
  }else googleTiles.show=true;
  googleMode=true;viewer.scene.globe.show=false;
  if(osmLayer)osmLayer.show=false;if(satLayer)satLayer.show=false;
  buildings.forEach(e=>e.show=false);if(stationStructure)stationStructure.show=false;
  $("google").textContent="◈ Exit Google 3D";$("key").value="";modal.classList.remove("open");
  announce("Google 3D tiles চালু হয়েছে; ঢাকায় পূর্ণ photorealistic coverage নিশ্চিত নয়।",8000);
 }catch(e){announce("Google 3D load হয়নি। API key, billing অথবা coverage পরীক্ষা করো।",10000)}
 finally{btn.disabled=false}
});

function nearestTrackPoint(lat,lon){
 const metersLon=111320*Math.cos(C.Math.toRadians(lat));
 let best={distance:Infinity,along:0};
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1];
  const ax=(a[1]-lon)*metersLon,ay=(a[0]-lat)*111320;
  const bx=(b[1]-lon)*metersLon,by=(b[0]-lat)*111320;
  const dx=bx-ax,dy=by-ay;
  const t=clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy||1),0,1);
  const dist=Math.hypot(ax+t*dx,ay+t*dy);
  if(dist<best.distance)best={distance:dist,along:cum[i]+t*(cum[i+1]-cum[i])};
 }
 return best;
}
function endPhoneGPS(){
 if(gpsWatchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(gpsWatchId);
 gpsWatchId=null;gpsMeters=null;
 if(gpsMark){viewer.entities.remove(gpsMark);gpsMark=null;}
 $("myGPS").textContent="📍 My Train GPS";
 $("myGPS").classList.remove("primary");
 if(mode==="onboard"){mode="estimate";refreshTrainMarkerPositions();updateModeControls();}
}
$("myGPS").addEventListener("click",()=>{
 if(gpsWatchId!==null){endPhoneGPS();clearViewLock();announce("ফোন GPS mode বন্ধ। GPS তথ্য কোথাও আপলোড করা হয়নি।",5000);return;}
 if(!navigator.geolocation){announce("এই ব্রাউজারে GPS পাওয়া যায়নি। HTTPS ও location permission লাগবে।",8000);return;}
 announce("ফোনের GPS অনুমতি দাও। শুধু এই ডিভাইসে location দেখানো হবে, সার্ভারে পাঠানো হবে না।",9500);
 $("myGPS").textContent="📍 GPS locating…";
 gpsWatchId=navigator.geolocation.watchPosition(
  pos=>{
   const {latitude:lat,longitude:lon,accuracy}=pos.coords;
   if(!gpsMark)gpsMark=viewer.entities.add({name:"My phone GPS (private)",position:C.Cartesian3.fromDegrees(lon,lat,32),
    point:{pixelSize:14,color:C.Color.CYAN,outlineColor:C.Color.WHITE,outlineWidth:3,disableDepthTestDistance:Number.POSITIVE_INFINITY}});
   gpsMark.position=C.Cartesian3.fromDegrees(lon,lat,32);
   const match=nearestTrackPoint(lat,lon);
   if(match.distance<200&&accuracy<350){
    gpsMeters=match.along;mode="onboard";playing=true;ride=true;
    $("follow").classList.add("primary");
    $("myGPS").textContent="📍 My GPS ON";$("myGPS").classList.add("primary");
    renderCoachSet();updateModeControls();
   }else{
    if(mode==="onboard"){mode="estimate";refreshTrainMarkerPositions();}
    gpsMeters=null;$("myGPS").textContent="📍 GPS active";
    $("myGPS").classList.remove("primary");updateModeControls();
    announce("তোমার ফোন MRT-6 থেকে "+Math.round(match.distance)+"m দূরে; ট্রেনের অবস্থান হিসেবে ব্যবহার হচ্ছে না।",6000);
   }
  },
  err=>{announce("Location permission / GPS error: "+err.message,9000);endPhoneGPS();},
  {enableHighAccuracy:true,maximumAge:2000,timeout:20000}
 );
});

function cleanupModeLabels(){
 $("buildings").textContent="▥ Hide Buildings";$("buildings").classList.add("primary");
}
renderStructure(10);updateStationText();refreshTrainMarkerPositions();renderCoachSet();updateModeControls();cleanupModeLabels();
if(window.innerWidth<700){
 document.body.classList.add("panel-hidden");
 $("togglePanel").textContent="▤ Show Panel";
 // Start close to the current selected train and keep it in frame.
 const p=lastKnown();
 viewer.camera.setView({destination:C.Cartesian3.fromDegrees(p.lon,p.lat,185),
  orientation:{heading:p.heading,pitch:C.Math.toRadians(-42),roll:0}});
 ride=true;$("follow").classList.add("primary");
}
satelliteToggle();loadBuildings(10);requestAnimationFrame(updateNow);
announce("OSM real route + 3D trains + satellite + ETA estimates। এটি live GPS নয়।",11000);
})();
