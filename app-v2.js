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
let viewer,osmLayer=null,satLayer=null,roadsLayer=null,labelsLayer=null,googleTiles=null,googleMode=false,satelliteOn=false;
let selectedStation=8,mode="estimate",selectedTrain="",trainData=[],focused=null;
let playing=true,demoMeters=0,rate=1,ride=false,worldModels=[],buildings=[],showBuildings=true;
let cameraStyle="chase",orbitYaw=0,orbitPitch=-0.74,followDistance=220,gpsDisplayMeters=null;
let lastFrame=0,lastMapUpdate=0,lastMarkerAnimation=0,etaLast=0,lastAudioSceneUpdate=0,stationStructure=null,trainEntities=[],trainMarkers=new Map();
const stationMarkers=[];
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
demoMeters=stopMeters[8]+105;
// Derive the tangent over 36 metres to avoid heading jitter at OSM vertices.
function trackPoint(meters){
 const d=clamp(meters,0,trackLength-.01);
 let lo=0,hi=cum.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(cum[mid]<=d)lo=mid;else hi=mid}
 const f=(d-cum[lo])/(cum[lo+1]-cum[lo]||1);
 const a=pts[lo],b=pts[lo+1];
 return {lat:a[0]+f*(b[0]-a[0]),lon:a[1]+f*(b[1]-a[1]),distance:d};
}
function at(meters,travel="south"){
 const p=trackPoint(meters),prev=trackPoint(p.distance-18),next=trackPoint(p.distance+18);
 const h=Math.atan2((next.lon-prev.lon)*Math.cos(C.Math.toRadians(p.lat)),next.lat-prev.lat);
 return {...p,heading:h+(travel==="north"?Math.PI:0)};
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
 viewer.scene.backgroundColor=C.Color.fromCssColorString("#88b5cd");
 if(viewer.scene.skyBox)viewer.scene.skyBox.show=false; // Ground-level viewer should not expose starfield
 // High-resolution map without running the iPhone GPU at excessive native DPR.
 viewer.resolutionScale=window.innerWidth<700?1.16:1.35;
 viewer.scene.globe.maximumScreenSpaceError=1.6;
 if(viewer.scene.postProcessStages.fxaa)viewer.scene.postProcessStages.fxaa.enabled=true;
 if(viewer.scene.fog)viewer.scene.fog.enabled=true;
 viewer.scene.screenSpaceCameraController.minimumZoomDistance=3;
 viewer.scene.screenSpaceCameraController.maximumZoomDistance=600000;
 osmLayer=viewer.imageryLayers.addImageryProvider(new C.OpenStreetMapImageryProvider({url:"https://tile.openstreetmap.org/"}));
 const s=st[8];
 viewer.camera.setView({destination:C.Cartesian3.fromDegrees(s.lon,s.lat,275),
 orientation:{heading:C.Math.toRadians(20),pitch:C.Math.toRadians(-48),roll:0}});
}catch(e){announce("3D viewer শুরু হয়নি: "+e.message,0);return}
const originalCameraFov=viewer.camera.frustum.fov;
$("status").textContent="ETA ESTIMATE";
$("notice").textContent="রেলপথ OSM থেকে; ট্রেন অবস্থান সময়সূচিভিত্তিক অনুমান (GPS নয়)।";
// MRT-6 elevated main line: 1,435 mm standard gauge, 1,500 V DC overhead
// electrification, welded rails on ballastless concrete plinths (DMTCL/DTCA).
// Visual reconstruction uses approximate measurements, not operator CAD.
const viaductColors={
 concrete:C.Color.fromCssColorString("#aeb2ae"),
 parapet:C.Color.fromCssColorString("#c3c5bd"),
 bed:C.Color.fromCssColorString("#969d9a"),
 plinth:C.Color.fromCssColorString("#c6c7bf"),
 rail:C.Color.fromCssColorString("#454d50"),
 metal:C.Color.fromCssColorString("#858f8d"),
 wire:C.Color.fromCssColorString("#707574")
};
const trackCenter=2.25;
function shiftedRailCoordinates(shift){
 return pts.map((p,i)=>{
  const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)],lat=p[0];
  const east=(next[1]-prev[1])*111320*Math.cos(C.Math.toRadians(lat));
  const north=(next[0]-prev[0])*111320;
  const length=Math.max(.001,Math.hypot(east,north)),cos=Math.cos(C.Math.toRadians(lat));
  return [p[1]-(north/length)*shift/(111320*cos),
          p[0]+(east/length)*shift/111320];
 });
}
const centerLine=shiftedRailCoordinates(0);
function shiftedPositions(shift,height){
 const arr=shiftedRailCoordinates(shift);
 return C.Cartesian3.fromDegreesArrayHeights(arr.flatMap(p=>[p[0],p[1],height]));
}
function shiftedSurface(shift){
 return C.Cartesian3.fromDegreesArray(shiftedRailCoordinates(shift).flat());
}
try{
 // Real viaduct deck is a shallow box section, not a giant white road slab.
 viewer.entities.add({name:"MRT-6 main concrete box girder",corridor:{
  positions:shiftedSurface(0),width:9.5,height:18.05,extrudedHeight:17.25,
  material:viaductColors.concrete,outline:false}});
 for(const side of [-4.58,4.58]){
  viewer.entities.add({name:"Viaduct safety parapet",polyline:{
   positions:shiftedPositions(side,19.35),width:2,material:viaductColors.parapet}});
 }
 // Narrow rails on two distinct plinths, not a flat four-rail slab.
 for(const center of [-trackCenter,trackCenter]){
  viewer.entities.add({name:"Ballastless concrete plinth",corridor:{
   positions:shiftedSurface(center),width:1.96,height:18.57,extrudedHeight:18.34,
   material:viaductColors.plinth}});
  for(const rail of [center-.7175,center+.7175]){
   viewer.entities.add({name:"Continuous welded steel MRT-6 rail",polyline:{
    positions:shiftedPositions(rail,18.79),width:2,
    material:viaductColors.rail}});
  }
 }
 for(const off of [-3.8,0,3.8]){
  viewer.entities.add({name:"Cable trench and service channel",polyline:{
   positions:shiftedPositions(off,18.39),width:2,material:viaductColors.bed}});
 }
 // Lightweight overhead catenary silhouette, as used by the 1500V DC system.
 for(const off of [-trackCenter,trackCenter]){
  viewer.entities.add({name:"Overhead electric contact wire (conceptual)",polyline:{
   positions:shiftedPositions(off,24.5),width:1,material:viaductColors.wire}});
 }
}catch(err){console.warn("Detailed ballastless railway viaduct could not render",err)}
const railwayFurniture=[];
function clearRailFurniture(){
 for(const ent of railwayFurniture)viewer.entities.remove(ent);
 railwayFurniture.length=0;
}
function nearbyRailFurniture(stationIndex){
 clearRailFurniture();
 const middle=stopMeters[stationIndex];
 const c=C.Color.fromCssColorString("#b7bbb8");
 // Scene detail is localized to the selected station, protecting mobile FPS.
 for(let distance=Math.max(35,middle-340);distance<Math.min(trackLength-30,middle+340);distance+=35){
  const p=at(distance),base=lonlatPoint(p,9.0);
  railwayFurniture.push(viewer.entities.add({
   name:"Concrete viaduct support pier",
   position:base,
   cylinder:{length:18,topRadius:1.12,bottomRadius:1.44,material:c,
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,1700)}
  }));
  const left=shiftedCoordinateAt(distance,-4.95),right=shiftedCoordinateAt(distance,4.95);
  railwayFurniture.push(viewer.entities.add({
   name:"Overhead wire support gantry",
   polyline:{positions:C.Cartesian3.fromDegreesArrayHeights([
    left.lon,left.lat,18.9,left.lon,left.lat,25.5,right.lon,right.lat,25.5,
    right.lon,right.lat,18.9
   ]),width:2,material:viaductColors.metal,
   distanceDisplayCondition:new C.DistanceDisplayCondition(0,1600)}
  }));
 }
 for(let distance=Math.max(0,middle-135);distance<Math.min(trackLength,middle+135);distance+=6.4){
  for(const center of [-trackCenter,trackCenter]){
   const p1=shiftedCoordinateAt(distance,center-.87),p2=shiftedCoordinateAt(distance,center+.87);
   railwayFurniture.push(viewer.entities.add({
    name:"Steel rail fixation plate / ballastless cross-tie",
    polyline:{positions:C.Cartesian3.fromDegreesArrayHeights([
     p1.lon,p1.lat,18.70,p2.lon,p2.lat,18.70]),
     width:2,material:viaductColors.metal,
     distanceDisplayCondition:new C.DistanceDisplayCondition(0,480)}
   }));
  }
 }
}
function shiftedCoordinateAt(distance,offset){
 const here=at(distance),before=at(distance-4),after=at(distance+4);
 const east=(after.lon-before.lon)*111320*Math.cos(C.Math.toRadians(here.lat));
 const north=(after.lat-before.lat)*111320;
 const len=Math.max(.001,Math.hypot(east,north));
 return {lat:here.lat+(east/len)*offset/111320,
  lon:here.lon-(north/len)*offset/(111320*Math.cos(C.Math.toRadians(here.lat)))};
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
 stationMarkers.push(viewer.entities.add({id:"station-"+i,name:s.n,position:lonlatPoint(s,26),
 point:{pixelSize:8,color:green,outlineColor:slate,outlineWidth:2,disableDepthTestDistance:0},
 label:{text:s.n,font:"bold 13px system-ui",fillColor:C.Color.WHITE,outlineColor:C.Color.BLACK,
 outlineWidth:3,style:C.LabelStyle.FILL_AND_OUTLINE,pixelOffset:new C.Cartesian2(0,-22),
 distanceDisplayCondition:new C.DistanceDisplayCondition(0,1200),disableDepthTestDistance:0}}));
});
// glTF 2.0 uses +Z-forward; Cesium converts it to +X. Adjust -90 degrees to
// make the longitudinal axis of all train and station glTF files follow the rail's compass bearing.
function modelOrientation(p){return C.Transforms.headingPitchRollQuaternion(lonlatPoint(p,0),new C.HeadingPitchRoll(p.heading-C.Math.PI_OVER_TWO,0,0))}
// Photo-inspired original Farmgate street details. Separate glTF asset per category;
// locations/appearance are approximate, not measured or GPS-observed.
let farmgateDetails=[];
function removeFarmgateDetails(){
 for(const e of farmgateDetails)viewer.entities.remove(e);
 farmgateDetails=[];
}
function addFarmgateDetails(index){
 removeFarmgateDetails();
 if(index!==10||googleMode)return;
 const s=st[index],p=at(stopMeters[index]),pos=lonlatPoint(s,0),direction=modelOrientation(p);
 const kinds=["street-market","pedestrians","greenery","utility-network","streetlights"];
 for(const kind of kinds){
  farmgateDetails.push(viewer.entities.add({
   name:"Farmgate — "+kind+" (original approximate 3D model)",
   position:pos,orientation:direction,
   model:{uri:"assets/farmgate-"+kind+".gltf",scale:1,minimumPixelSize:0,maximumScale:1,
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,kind==="buildings"?2500:1800)}
  }));
 }

}
// 16 separate original low-poly 3D street-environment meshes, dynamically
// loaded for the chosen station. They complement real OSM building footprints.
let neighborhoodProps=null;
function renderNeighborhoodProps(index){
 if(neighborhoodProps){viewer.entities.remove(neighborhoodProps);neighborhoodProps=null;}
 if(googleMode)return;
 const selected=st[index],tangent=at(stopMeters[index]);
 neighborhoodProps=viewer.entities.add({
  name:selected.n+" — illustrative local street furniture and trees in actual 3D",
  position:lonlatPoint(selected,0),orientation:modelOrientation(tangent),
  model:{uri:"assets/nearby/"+index+".gltf",scale:1,minimumPixelSize:0,maximumScale:1,
   distanceDisplayCondition:new C.DistanceDisplayCondition(0,3000)}
 });
}
function renderStructure(index){
 if(window.DhakaSoundscape)window.DhakaSoundscape.setStation(index);
 if(stationStructure)viewer.entities.remove(stationStructure);
 const s=st[index],p=at(stopMeters[index]);
 // Farmgate (index 10) gets its own original landmark geometry: curved
 // green roof, brick concourse, bridges, facade glass and street furniture.
 // Illustrative reconstruction, NOT photogrammetry or a measured survey.
 const farmgate=index===10,agargaon=index===8,university=index===13;
 const title=university?" — Dhaka University original detailed 3D":agargaon?" — Agargaon photo-referenced 3D":farmgate?" — Farmgate detailed reconstruction":" conceptual 3D station";
 stationStructure=viewer.entities.add({name:s.n+title,
  position:lonlatPoint(s,0),orientation:modelOrientation(p),
  model:{uri:university?"assets/dhaka-university-landmark.gltf":agargaon?"assets/agargaon-station.gltf":farmgate?"assets/farmgate-landmark.gltf":"assets/stations/"+index+".gltf",
   scale:1,minimumPixelSize:0,maximumScale:1}});
 setupStreetTraffic(index);
 addFarmgateDetails(index);
 renderNeighborhoodProps(index);
 renderPhotoStationDetail(index,p,s);
}
// 16 separate original glTF overlays modeled from the 2023 Daily Star aerial
// gallery: reference-guided roof colors, photo-visible local landmarks, different
// station-area profiles. Photos themselves are NOT copied or rehosted.
let photoStationDetail=null;
function renderPhotoStationDetail(index,trackPos,station){
 if(photoStationDetail){viewer.entities.remove(photoStationDetail);photoStationDetail=null;}
 photoStationDetail=viewer.entities.add({
  name:station.n+" — photo-reference exterior architecture and city silhouettes (approximate)",
  position:lonlatPoint(station,0),
  orientation:modelOrientation(trackPos),
  model:{uri:"assets/photo-stations/"+index+".gltf",scale:1,
   minimumPixelSize:0,maximumScale:1,
   distanceDisplayCondition:new C.DistanceDisplayCondition(0,4200)}
 });
}
// Illustrated traffic near the detailed Farmgate landmark.
// Separately modeled buses, rickshaws and cars; animation is a visual demo,
// NEVER based on GPS, live city traffic or a road survey.
let streetTraffic=[],streetTransform=null;
function clearStreetTraffic(){
 for(const t of streetTraffic)viewer.entities.remove(t.entity);
 streetTraffic=[];streetTransform=null;
}
function makeTrafficWorld(x,z){
 if(!streetTransform)return null;
 return C.Matrix4.multiplyByPoint(streetTransform,new C.Cartesian3(x,0,z),new C.Cartesian3());
}
function setupStreetTraffic(index){
 clearStreetTraffic();
 if(index!==10)return;
 const s=st[index],p=at(stopMeters[index]),origin=lonlatPoint(s,0);
 streetTransform=C.Matrix4.fromTranslationQuaternionRotationScale(
  origin,modelOrientation(p),new C.Cartesian3(1,1,1),new C.Matrix4());
 const specs=[
  ["bus",-29,-65,1,5.6],["bus",28,55,-1,5.1],
  ["car",-24,-42,1,7.5],["car",-32,34,-1,6.6],
  ["car",23,-7,-1,8.1],["car",32,70,-1,7.1],
  ["rickshaw",-19,-60,1,2.9],["rickshaw",-36,28,-1,2.5],
  ["rickshaw",19,40,-1,3.0],["rickshaw",35,-21,1,2.8],
  ["motorcycle",-23,-9,1,9.4],["motorcycle",30,-47,-1,10.3]
 ];
 for(const [kind,x,z,dir,speed] of specs){
  const heading={...p,heading:p.heading+(dir<0?Math.PI:0)};
  const entity=viewer.entities.add({
   name:"Dhaka "+kind+" — simulated street traffic",
   position:makeTrafficWorld(x,z),orientation:modelOrientation(heading),
   model:{uri:"assets/dhaka-"+kind+".gltf",scale:1,minimumPixelSize:0,maximumScale:1,
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,2200)}
  });
  streetTraffic.push({kind,x,z,dir,speed,entity});
 }
}
function animateStreetTraffic(dt){
 if(!streetTransform||!streetTraffic.length)return;
 for(const item of streetTraffic){
  item.z+=item.dir*item.speed*dt;
  if(item.z>78)item.z=-78;
  if(item.z< -78)item.z=78;
  item.entity.position=makeTrafficWorld(item.x,item.z);
  item.entity.show=!googleMode;
 }
}

function updateStationText(){
 stationMarkers.forEach((e,i)=>{e.show=!ride||i===selectedStation});
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
function clearViewLock(){viewer.camera.lookAtTransform(C.Matrix4.IDENTITY);if(typeof originalCameraFov==="number")viewer.camera.frustum.fov=originalCameraFov;ride=false;$("follow").classList.remove("primary")}
function stationCinematicCamera(index,animate=true){
 // Genuine 3D street-side elevated approach, not a camera stuck on the rails.
 const p=at(stopMeters[index]),d=clamp(stopMeters[index]-122,0,trackLength-2);
 const flank=index===8||index===13?-138:-118;
 const origin=shiftedCoordinateAt(d,flank),height=index===10?96:105;
 const east=(p.lon-origin.lon)*111320*Math.cos(C.Math.toRadians(p.lat));
 const north=(p.lat-origin.lat)*111320;
 const horizontal=Math.max(1,Math.hypot(east,north));
 const destination=C.Cartesian3.fromDegrees(origin.lon,origin.lat,height);
 // Three-quarter urban-streetscape view, not near-vertical looking only at a roof.
 const orientation={heading:Math.atan2(east,north),
  pitch:clamp(-Math.atan2(height-23,horizontal)-.075,-.64,-.32),roll:0};
 if(animate)viewer.camera.flyTo({destination,orientation,duration:1.22});
 else viewer.camera.setView({destination,orientation});
}
function focusStation(i){
 selectedStation=i;clearViewLock();
 if(mode==="demo")demoMeters=clamp(stopMeters[i]+145,0,trackLength-3);
 renderStructure(i);updateStationText();
 nearbyRailFurniture(i);
 if(showBuildings&&!googleMode)loadBuildings(i);
 stationCinematicCamera(i,true);
 announce(nameFor(i)+" — সিনেমাটিক স্টেশনের দৃশ্য, বাস্তব রুটে আনুমানিক 3D পরিবেশ",5500);
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
     pixelOffset:new C.Cartesian2(0,-18),distanceDisplayCondition:new C.DistanceDisplayCondition(0,900),
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
function activeFocus(dt=0.016){
 if(mode==="estimate"){
  const sampled=svc.positionFor&&svc.positionFor(selectedTrain);
  if(sampled)return {m:metersAtIndex(sampled.position),dir:sampled.dir};
  const t=trainData.find(x=>x.id===selectedTrain);
  if(t)return {m:metersAtIndex(t.position),dir:t.dir};
 }
 if(mode==="onboard"&&gpsMeters!==null){
  if(gpsDisplayMeters===null||Math.abs(gpsDisplayMeters-gpsMeters)>400)gpsDisplayMeters=gpsMeters;
  gpsDisplayMeters+=(gpsMeters-gpsDisplayMeters)*(1-Math.exp(-5*dt));
  return {m:gpsDisplayMeters,dir:"south"};
 }
 return {m:demoMeters,dir:"south"};
}
function renderCoachSet(dt=0.016){
 const focus=activeFocus(dt),dir=focus.dir;
 focused={...at(focus.m,dir),dir};
 for(let i=0;i<trainEntities.length;i++){
  const m=clamp(focus.m+(dir==="south"?-1:1)*i*carLength,0,trackLength-.1),p=at(m,dir);
  const pos=lonlatPoint(p,19.0);
  trainEntities[i].position=pos;trainEntities[i].orientation=modelOrientation(p);
 }
}
function findTrain(){
 renderCoachSet();
 ride=true;cameraStyle="chase";orbitYaw=0;orbitPitch=-0.76;followDistance=235;
 $("follow").classList.add("primary");
 updateCameraLabel();
 updateFollowCamera();
 announce(mode==="estimate"?"Train-follow চালু। অবস্থান সময়সূচিভিত্তিক অনুমান (GPS নয়)।":mode==="onboard"?"ফোনের GPS অনুসরণ হচ্ছে, অন্য ট্রেনের GPS নয়।":"Demo train অনুসরণ হচ্ছে (live নয়)।",6500);
}
function updateModeControls(){
 const demo=mode==="demo",onboard=mode==="onboard";
 $("pause").textContent=demo?"◉ ETA Mode":onboard?"◉ Exit My GPS":"▶ Demo Ride";
 $("speed").textContent="▶ "+rate+"× demo speed";
 $("status").textContent=onboard?"PHONE GPS · NOT TRAIN GPS":demo?"DEMO RIDE · NOT LIVE":"TIMETABLE ESTIMATE · NOT GPS";
}
// Follow view remains user-controlled through orbit/zoom offset; no forced reset.
function updateFollowCamera(){
 if(!focused)return;
 // Avoid dark near-field blocks when the first-person camera enters mapped
 // building geometry near the station. Detailed station stays visible.
 const nearStation=Math.abs(focused.distance-stopMeters[selectedStation])<175;
 for(const b of buildings)b.show=showBuildings&&!googleMode;
 for(const e of farmgateDetails){const hideFront=ride&&cameraStyle==="front"&&nearStation&&e.name.includes(" — buildings ");e.show=!googleMode&&!(hideFront||(!showBuildings&&(e.name.includes(" — buildings ")||e.name.includes(" — shopfronts "))));}
 if(!ride)return;
 if(typeof originalCameraFov==="number")viewer.camera.frustum.fov=originalCameraFov;
 // All modes use an OUTSIDE camera: the train, adjacent roads and buildings
 // are visible rather than placing the user INSIDE the roof or viaduct model.
 const front=cameraStyle==="front",top=cameraStyle==="top";
 const heading=focused.heading+(front?0:Math.PI)+orbitYaw;
 const pitch=top?-1.26:front?clamp(orbitPitch-.09,-1.40,-.57):clamp(orbitPitch,-1.40,-.55);
 const range=top?Math.max(210,followDistance):Math.max(130,followDistance);
 viewer.camera.lookAt(lonlatPoint(focused,21.6),
  new C.HeadingPitchRange(heading,pitch,range));
}
function animateTrainMarkers(){
 if(mode!=="estimate")return;
 for(const [id,entity] of trainMarkers){
  const sample=svc.positionFor&&svc.positionFor(id);
  if(sample){
   const pos=at(metersAtIndex(sample.position),sample.dir);
   entity.position=lonlatPoint(pos,24);
  }
 }
}
// Sound zones follow the actual 3D camera, not an invented train GPS feed.
function updateSoundCamera(t){
 const engine=window.DhakaSoundscape;
 if(!engine?.active||t-lastAudioSceneUpdate<430)return;
 lastAudioSceneUpdate=t;
 const camera=viewer.camera.positionCartographic;
 if(!camera)return;
 const s=st[selectedStation],lat=C.Math.toDegrees(camera.latitude),lon=C.Math.toDegrees(camera.longitude);
 const east=(lon-s.lon)*111320*Math.cos(C.Math.toRadians(s.lat));
 const north=(lat-s.lat)*111320;
 const distance=Math.hypot(east,north);
 engine.updateScene({
  station:selectedStation,following:ride,height:Math.max(0,camera.height),
  distance,moving:mode==="estimate"||mode==="onboard"||playing
 });
}
function updateNow(t){
 // Train + 3D camera rendered per animation frame. Schedule lookup is fractional-time.
 const dt=lastFrame?Math.min(.06,Math.max(0,(t-lastFrame)/1000)):0.016;
 lastFrame=t;
 if(mode==="demo"&&playing){demoMeters+=dt*16*rate;if(demoMeters>trackLength-2)demoMeters=0;}
 renderCoachSet(dt);
 animateStreetTraffic(dt);
 if(t-lastMarkerAnimation>120){animateTrainMarkers();lastMarkerAnimation=t;}
 if(t-lastMapUpdate>1300){
  if(mode==="estimate")refreshTrainMarkerPositions();
  lastMapUpdate=t;
  if(ride&&focused&&showBuildings&&!googleMode){
   let closest=0,dist=Number.POSITIVE_INFINITY;
   for(let j=0;j<stopMeters.length;j++){
    const d=Math.abs(stopMeters[j]-focused.distance);
    if(d<dist){closest=j;dist=d;}
   }
   if(closest!==selectedStation){
    selectedStation=closest;renderStructure(closest);updateStationText();
    nearbyRailFurniture(closest);loadBuildings(closest);
   }
  }
 }
 updateFollowCamera();
 updateSoundCamera(t);
 if(t-lastMapUpdate<45){
  stationMarkers.forEach((e,i)=>{e.show=!ride||i===selectedStation});
  for(const [id,e] of trainMarkers)e.show=!ride;
 }
 if(t-etaLast>10000){updateStationText();etaLast=t}
 requestAnimationFrame(updateNow);
}
// Stream several georeferenced, OSM-footprint 3D station neighborhoods together.
// Each station tile is anchored to its own real route coordinate. These are
// mapped building footprints + illustrative walls, not complete photographic scans.
// Only nearby tiles are mounted to avoid running out of GPU memory on phones.
let extendedCityCoverage=false;
function adjacentUrbanTileIndices(focus){
 const maxGap=extendedCityCoverage?3:(window.innerWidth<700?1:2);
 const order=[];
 for(let delta=1;delta<=maxGap;delta++){
  if(focus-delta>=0)order.push(focus-delta);
  if(focus+delta<st.length)order.push(focus+delta);
 }
 return order;
}
function appendAdjacentUrbanTiles(focus){
 for(const j of adjacentUrbanTileIndices(focus)){
  const station=st[j];
  buildings.push(viewer.entities.add({
   name:station.n+" — nearby georeferenced OSM 3D neighborhood (illustrative heights)",
   position:lonlatPoint(station,0),
   model:{uri:"./assets/urban/"+j+".gltf",scale:1,minimumPixelSize:0,maximumScale:1,
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,2400)}
  }));
 }
}

// Rooftop equipment and local shop overhangs follow cached mapped building
// footprints. Individual details are illustrative, not surveyed storefronts.
function appendBuildingRoofDetails(index){
 const station=st[index];
 buildings.push(viewer.entities.add({
  name:station.n+" — mapped-building 3D rooftops, AC units, awnings (illustrative)",
  position:lonlatPoint(station,0),
  model:{uri:"./assets/rooftops/"+index+".gltf",scale:1,minimumPixelSize:0,maximumScale:1,
   distanceDisplayCondition:new C.DistanceDisplayCondition(0,1850)}
 }));
}
function appendNeighborhoodFurnishings(index){
 // Procedural scene props around this selected station. They use OSM
 // building footprints for placement exclusion, but are NOT a real tree survey.
 const p=st[index];
 buildings.push(viewer.entities.add({
  name:p.n+" — 3D trees, street lamps and neighborhood furnishings (approximate)",
  position:lonlatPoint(p,0),
  model:{uri:"./assets/neighborhood/"+index+".gltf",scale:1,minimumPixelSize:0,maximumScale:1,
   distanceDisplayCondition:new C.DistanceDisplayCondition(0,2900)}
 }));
}

async function loadBuildings(i){
 if(!showBuildings||googleMode)return;
 const token=++loadTicket,s=st[i];
 if(bldgRequest)bldgRequest.abort();
 bldgRequest=new AbortController();
 // True mapped OSM building polygons, converted into one textured glTF mesh
 // per supported station. Glass windows/unknown heights are illustrative.
 const hasCityMesh=new Set(Array.from({length:16},(_,n)=>n));
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
    appendAdjacentUrbanTiles(i);
    // Close-up 3D shops, roofs and urban greenery. Built from cached OSM
    // footprint anchors; decorations are illustrative and are NOT surveyed.
    for(const zone of [...new Set([i,...adjacentUrbanTileIndices(i)])]){
     const place=st[zone],uri="./assets/urban-details/"+zone+".gltf";
     fetch(uri,{method:"HEAD",cache:"force-cache",signal:bldgRequest.signal})
      .then(response=>{
       if(!response.ok||token!==loadTicket||!showBuildings||googleMode)return;
       buildings.push(viewer.entities.add({
        name:place.n+" — original close-up 3D urban details (approximate)",
        position:lonlatPoint(place,0),
        model:{uri,scale:1,minimumPixelSize:0,maximumScale:1,
         distanceDisplayCondition:new C.DistanceDisplayCondition(0,1550)}
       }));
      })
      .catch(err=>{
       if(!bldgRequest.signal.aborted)console.warn("Detail tile not available",err);
      });
    }
    appendNeighborhoodFurnishings(i);
    appendBuildingRoofDetails(i);
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
  appendAdjacentUrbanTiles(i);
  appendNeighborhoodFurnishings(i);
  announce(buildings.length+"টি বাস্তব OSM footprint থেকে 3D ভবন তৈরি ("+(offline?"লোকাল ক্যাশ":"অনলাইন")+"). Height অনেকে আনুমানিক।",8500);
 }catch(e){if(!bldgRequest.signal.aborted)announce("Building data unavailable for this station. অন্য স্টেশন নির্বাচন করো।",8000)}
}
// Esri satellite is real imagery, while these independent reference overlays add
// actual road/street and locality labeling (not invented ground textures).
async function satelliteToggle(){
 if(googleMode){announce("প্রথমে Google 3D mode বন্ধ করো।");return}
 const btn=$("satellite");
 if(satelliteOn){
  satelliteOn=false;
  if(satLayer)satLayer.show=false;
  if(roadsLayer)roadsLayer.show=false;
  if(labelsLayer)labelsLayer.show=false;
  if(osmLayer)osmLayer.show=true;
  btn.textContent="◈ Satellite";btn.classList.remove("primary");return;
 }
 btn.disabled=true;btn.textContent="Loading…";
 try{
  if(!satLayer){
   const provider=await C.ArcGisMapServerImageryProvider.fromUrl(
    "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
    {credit:"Aerial imagery © Esri, Maxar, Earthstar Geographics and contributors"});
   satLayer=viewer.imageryLayers.addImageryProvider(provider);
   satLayer.brightness=1.075;satLayer.contrast=1.075;satLayer.saturation=1.08;
  }
  satelliteOn=true;satLayer.show=true;
  if(osmLayer)osmLayer.show=false;
  btn.textContent="◈ Street Map";btn.classList.add("primary");
  // Reference overlay services are optional; satellite mode works if one fails.
  if(!roadsLayer){
   try{
    const provider=await C.ArcGisMapServerImageryProvider.fromUrl(
     "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer",
     {credit:"Transportation labels © Esri, HERE, Garmin, contributors"});
    roadsLayer=viewer.imageryLayers.addImageryProvider(provider);
   }catch(e){console.warn("Road overlay not available",e)}
  }
  if(!labelsLayer){
   try{
    const provider=await C.ArcGisMapServerImageryProvider.fromUrl(
     "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer",
     {credit:"Place names © Esri and contributors"});
    labelsLayer=viewer.imageryLayers.addImageryProvider(provider);
   }catch(e){console.warn("Place-name overlay not available",e)}
  }
  if(roadsLayer)roadsLayer.show=true;
  if(labelsLayer)labelsLayer.show=true;
 }catch(e){btn.textContent="◈ Satellite";announce("Satellite imagery load হয়নি; street map ব্যবহার করা হচ্ছে।",6500)}
 finally{btn.disabled=false}
}
// User-selectable illustrative day/night illumination, separate from GPS or live weather.
let daylightMode="day";
function setDaylightMode(next){
 daylightMode=next;
 const night=daylightMode==="night";
 // Fixed illustrative Dhaka local times; does not assert current sky conditions.
 viewer.clock.shouldAnimate=false;
 viewer.clock.currentTime=C.JulianDate.fromDate(
  new Date(night?"2026-06-01T15:00:00Z":"2026-06-01T06:00:00Z"));
 viewer.scene.globe.enableLighting=night;
 viewer.scene.globe.dynamicAtmosphereLighting=false;
 viewer.scene.globe.dynamicAtmosphereLightingFromSun=false;
 viewer.scene.backgroundColor=C.Color.fromCssColorString(night?"#192a40":"#88b5cd");
 if(viewer.scene.skyBox)viewer.scene.skyBox.show=false;
 if(viewer.scene.skyAtmosphere)viewer.scene.skyAtmosphere.show=!night;
 if(viewer.scene.sun)viewer.scene.sun.show=!night;
 if(viewer.scene.moon)viewer.scene.moon.show=night;
 if(viewer.scene.fog)viewer.scene.fog.enabled=!night;
 $("dayNight").textContent=night?"☾ Night view":"☀ Daylight";
 $("dayNight").classList.toggle("primary",night);
 announce(night?"3D Night View: lighting simulation (not live weather).":"3D Day View: illustrative lighting.",4500);
}
$("dayNight").addEventListener("click",()=>setDaylightMode(daylightMode==="day"?"night":"day"));

const cameraModes=[
 {id:"chase",label:"▣ Rear Chase"},
 {id:"front",label:"◧ Front Cinematic"},
 {id:"top",label:"▣ Drone Top"},
 {id:"orbit",label:"◉ Orbit 360°"}
];
function updateCameraLabel(){
 const item=cameraModes.find(c=>c.id===cameraStyle)||cameraModes[0];
 if($("camMode"))$("camMode").textContent=item.label;
}
function useCameraMode(id){
 cameraStyle=id;ride=true;orbitYaw=0;
 orbitPitch=id==="top"?-1.24:id==="orbit"?-.81:-.78;
 followDistance=id==="top"?270:id==="front"?220:240;
 $("follow").classList.add("primary");updateCameraLabel();
 updateFollowCamera();
}
function cameraZoom(multiplier){
 if(!ride){
  const distance=clamp(viewer.camera.positionCartographic.height*.22,12,7500);
  if(multiplier<1)viewer.camera.zoomIn(distance);
  else viewer.camera.zoomOut(distance);
  return;
 }
 followDistance=clamp(followDistance*multiplier,70,1500);
 updateFollowCamera();
}
const sceneCanvas=viewer.canvas;
const activePointers=new Map();
function pointerLength(){
 const a=[...activePointers.values()];
 return a.length<2?null:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
}
sceneCanvas.addEventListener("pointerdown",e=>{
 if(!ride)return;
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 try{sceneCanvas.setPointerCapture(e.pointerId)}catch(err){}
 e.preventDefault();e.stopImmediatePropagation();
},true);
sceneCanvas.addEventListener("pointermove",e=>{
 if(!ride||!activePointers.has(e.pointerId))return;
 const prev=activePointers.get(e.pointerId),d0=pointerLength();
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const d1=pointerLength();
 if(activePointers.size===1){
  orbitYaw-=(e.clientX-prev.x)*.009;
  orbitPitch=clamp(orbitPitch+(e.clientY-prev.y)*.005,-1.45,-.52);
 }else if(d0&&d1&&d1>10)followDistance=clamp(followDistance*d0/d1,70,1500);
 e.preventDefault();e.stopImmediatePropagation();
},true);
function endOrbitPointer(e){
 if(!activePointers.has(e.pointerId))return;
 activePointers.delete(e.pointerId);
 try{sceneCanvas.releasePointerCapture(e.pointerId)}catch(err){}
 e.preventDefault();e.stopImmediatePropagation();
}
sceneCanvas.addEventListener("pointerup",endOrbitPointer,true);
sceneCanvas.addEventListener("pointercancel",endOrbitPointer,true);
sceneCanvas.addEventListener("wheel",e=>{
 if(!ride)return;
 e.preventDefault();e.stopImmediatePropagation();
 cameraZoom(e.deltaY>0?1.14:.87);
},{capture:true,passive:false});
$("camMode").addEventListener("click",()=>{
 const n=cameraModes.findIndex(x=>x.id===cameraStyle);
 useCameraMode(cameraModes[(n+1)%cameraModes.length].id);
});
$("orbitLeft").addEventListener("click",()=>{if(!ride)useCameraMode("orbit");orbitYaw-=C.Math.toRadians(25)});
$("orbitRight").addEventListener("click",()=>{if(!ride)useCameraMode("orbit");orbitYaw+=C.Math.toRadians(25)});
$("zoomIn").addEventListener("click",()=>cameraZoom(.78));
$("zoomOut").addEventListener("click",()=>cameraZoom(1.28));
let qualityLevel=1;
const qModes=[
 {name:"Balanced",scale:1.02,error:2.5},
 {name:"HD",scale:1.22,error:1.65},
 {name:"Ultra",scale:1.48,error:1.14}
];
function setQuality(level,notify=false){
 qualityLevel=level;
 const q=qModes[level],mobile=window.innerWidth<700;
 viewer.resolutionScale=q.scale*(mobile?0.96:1.13);
 viewer.scene.globe.maximumScreenSpaceError=q.error;
 if(viewer.scene.postProcessStages.fxaa)viewer.scene.postProcessStages.fxaa.enabled=level>=1;
 $("quality").textContent=q.name;
 if(notify)announce(q.name+" 3D quality নির্বাচিত। ফোন গরম/slow হলে Balanced ব্যবহার করো।",5200);
}
$("quality").addEventListener("click",()=>setQuality((qualityLevel+1)%qModes.length,true));
$("overview").addEventListener("click",overview);
$("findTrain").addEventListener("click",findTrain);
$("north").addEventListener("click",()=>focusStation(0));
$("central").addEventListener("click",()=>focusStation(10));
$("south").addEventListener("click",()=>focusStation(15));
$("agargaon").addEventListener("click",()=>focusStation(8));
$("university").addEventListener("click",()=>focusStation(13));
$("moreControls").addEventListener("click",()=>{
 document.body.classList.toggle("mobile-controls-expanded");
 $("moreControls").textContent=document.body.classList.contains("mobile-controls-expanded")?"✕ Less tools":"☷ More tools";
});
$("satellite").addEventListener("click",satelliteToggle);
$("togglePanel").addEventListener("click",()=>{
 document.body.classList.toggle("panel-hidden");
 $("togglePanel").textContent=document.body.classList.contains("panel-hidden")?"▤ Show Panel":"▤ Hide Panel";
});
$("follow").addEventListener("click",()=>{
 if(ride)clearViewLock();
 else useCameraMode(cameraStyle);
});
$("pause").addEventListener("click",()=>{
 if(mode==="onboard"){endPhoneGPS();clearViewLock();playing=true;updateModeControls();return;}
 mode=mode==="estimate"?"demo":"estimate";playing=true;refreshTrainMarkerPositions();updateModeControls();
 if(mode==="estimate"&&!trainData.length){mode="demo";updateModeControls();announce("এখন অনুমিত চলমান ট্রেন নেই; Demo ride চলছে।")}
});
$("speed").addEventListener("click",()=>{rate=rate===1?2:rate===2?4:1;updateModeControls()});
$("cityCoverage").addEventListener("click",()=>{
 extendedCityCoverage=!extendedCityCoverage;
 $("cityCoverage").textContent=extendedCityCoverage?"🏙 Local 3D":"🏙 Wider 3D";
 $("cityCoverage").classList.toggle("primary",extendedCityCoverage);
 if(showBuildings&&!googleMode)loadBuildings(selectedStation);
 announce(extendedCityCoverage
  ?"বিস্তৃত 3D: এই স্টেশনের আগে ও পরে সর্বোচ্চ ৩টি করে OSM বিল্ডিং এলাকা দেখানো হবে।"
  :"পারফরম্যান্স মোড: কাছের 3D এলাকাগুলো দেখানো হবে।",5600);
});

// WebAudio starts only on a direct tap; no background recording or autoplay.
function reflectSoundState(){
 const btn=$("sound"),enabled=!!window.DhakaSoundscape?.active;
 btn.textContent=enabled?"🔊 Sound On":"🔇 City Sound";
 btn.setAttribute("aria-pressed",String(enabled));
 btn.classList.toggle("primary",enabled);
}
$("sound").addEventListener("click",async()=>{
 const engine=window.DhakaSoundscape;
 if(!engine){announce("Audio engine unavailable. Refresh করে আবার চেষ্টা করো।",5000);return}
 if(engine.active){engine.stop();reflectSoundState();return}
 try{
  engine.setStation(selectedStation);
  await engine.start();
  reflectSoundState();
  announce("Dhaka 3D sound zones চালু। রাস্তা, স্টেশন, প্ল্যাটফর্ম ও ট্রেনের সাউন্ড ক্যামেরা অনুযায়ী বদলাবে।",6000);
 }catch(err){engine.stop();reflectSoundState();announce("Sound চালু হয়নি: "+err.message,6000)}
});
window.addEventListener("dhaka-sound-muted",reflectSoundState);
reflectSoundState();
// Optional compact sound mixer, with no autoplay or microphone permissions.
const audioPanel=$("soundPanel"),zoneControl=$("soundZone"),audioStatus=$("soundState");
function toggleAudioPanel(open){
 audioPanel.hidden=!open;
 $("soundOptions").setAttribute("aria-expanded",String(open));
}
$("soundOptions").addEventListener("click",()=>toggleAudioPanel(audioPanel.hidden));
$("soundClose").addEventListener("click",()=>toggleAudioPanel(false));
zoneControl.addEventListener("change",()=>{
 window.DhakaSoundscape?.setZone(zoneControl.value);
});
$("soundVolume").addEventListener("input",()=>{
 const level=Number($("soundVolume").value);
 $("soundVolumeValue").textContent=level+"%";
 window.DhakaSoundscape?.setVolume(level/100);
});
$("recordedRail").addEventListener("change",()=>{
 const engine=window.DhakaSoundscape;
 if(!engine){$("recordedRail").checked=false;return}
 // Real recording is an OPTIONAL external CC BY clip; it isn't Dhaka metro audio.
 if($("recordedRail").checked&&!engine.active){
  $("recordedRail").checked=false;
  announce("প্রথমে City Sound চালু করো।",5000);return;
 }
 if($("recordedRail").checked&&zoneControl.value==="auto")zoneControl.value="platform";
 if($("recordedRail").checked)engine.setZone(zoneControl.value);
 engine.useRecordedTrain($("recordedRail").checked);
});
$("demoPA").addEventListener("click",()=>{
 const result=window.DhakaSoundscape?.paDemo();
 announce(!result?.ok?"প্রথমে Sound চালু করো।":result.voice
  ?"এটি অফিসিয়াল মেট্রোরেলের ঘোষণা নয়—শুধু বাংলা ডেমো।"
  :"Announcement chime বাজছে। এই ফোনে Bengali TTS voice নেই; অফিসিয়াল announcement ব্যবহার করা হয়নি।",5500);
});
function renderSoundMixer(detail){
 if(!detail)return;
 $("soundVolume").value=Math.round(detail.volume*100);
 $("soundVolumeValue").textContent=Math.round(detail.volume*100)+"%";
 $("recordedRail").checked=detail.recordedEnabled;
 zoneControl.value=detail.requestedZone;
 const zoneLabels={street:"রাস্তা",hall:"স্টেশনের ভেতর",platform:"প্ল্যাটফর্ম",track:"ট্রেনের পাশে",train:"ট্রেনের ভেতর",roof:"স্টেশনের উপরে"};
 audioStatus.textContent=detail.active?"Sound ON · "+(zoneLabels[detail.zone]||detail.zone)
  +(detail.recordingError?" · রেকর্ডিং লোড হয়নি":""):"Sound OFF · City Sound ট্যাপ করো";
 reflectSoundState();
}
window.DhakaSoundscape?.onChange(renderSoundMixer);
renderSoundMixer({active:false,zone:"street",requestedZone:"auto",volume:.55,recordedEnabled:false});
$("buildings").addEventListener("click",()=>{
 if(googleMode){announce("Google mode-এ আলাদা OSM ভবন বন্ধ।");return}
 showBuildings=!showBuildings;
 $("buildings").textContent=showBuildings?"▥ Hide Buildings":"▥ 3D Buildings";
 $("buildings").classList.toggle("primary",showBuildings);
 for(const e of farmgateDetails)e.show=showBuildings||!(e.name.includes(" — buildings ")||e.name.includes(" — shopfronts "));
 if(showBuildings)loadBuildings(selectedStation);
 else{loadTicket++;if(bldgRequest)bldgRequest.abort();buildings.forEach(e=>viewer.entities.remove(e));buildings=[]}
});
const modal=$("settings");
$("google").addEventListener("click",()=>{
 if(googleMode){
  googleMode=false;viewer.scene.globe.show=true;
  if(osmLayer)osmLayer.show=!satelliteOn;if(satLayer)satLayer.show=satelliteOn;
  if(roadsLayer)roadsLayer.show=satelliteOn;if(labelsLayer)labelsLayer.show=satelliteOn;
  if(googleTiles)googleTiles.show=false;
  buildings.forEach(e=>e.show=showBuildings);
  if(stationStructure)stationStructure.show=true;if(photoStationDetail)photoStationDetail.show=true;
  if(neighborhoodProps)neighborhoodProps.show=true;
  for(const e of farmgateDetails)e.show=true;
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
   if(roadsLayer)roadsLayer.show=false;if(labelsLayer)labelsLayer.show=false;
  buildings.forEach(e=>e.show=false);if(stationStructure)stationStructure.show=false;if(photoStationDetail)photoStationDetail.show=false;
  if(neighborhoodProps)neighborhoodProps.show=false;
  farmgateDetails.forEach(e=>e.show=false);
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
 gpsWatchId=null;gpsMeters=null;gpsDisplayMeters=null;
 if(gpsMark){viewer.entities.remove(gpsMark);gpsMark=null;}
 $("myGPS").textContent="📍 My Phone GPS";
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
renderStructure(8);nearbyRailFurniture(8);updateStationText();refreshTrainMarkerPositions();renderCoachSet();updateModeControls();cleanupModeLabels();updateCameraLabel();setQuality(1);
if(window.innerWidth<700){
 document.body.classList.add("panel-hidden");
 $("togglePanel").textContent="▤ Show Panel";
 // Open with the new Agargaon architecture visible. Follow mode stays one tap away.
 stationCinematicCamera(8,false);
 ride=false;$("follow").classList.remove("primary");
}
satelliteToggle();loadBuildings(8);requestAnimationFrame(updateNow);
announce("OSM real route + 3D trains + satellite + ETA estimates। এটি live GPS নয়।",11000);
})();
