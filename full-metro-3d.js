(async function(){
"use strict";
// 16 true, geocoded MRT-6 stop locations; OSM attribution in UI.
const C=window.Cesium,route=window.MRT_TRACK,$=id=>document.getElementById(id);
if(!C||!route||route.stations.length!==16){$("message").textContent="Route/3D engine unavailable";return;}
const stations=route.stations,track=route.points;
let v,selected=-1,buildToken=0;
const models=[],fullBoards=[],numberPins=[],supports=[],allStationModels=[];
const getPos=(s,h=0)=>C.Cartesian3.fromDegrees(s.lon,s.lat,h);
const angle=x=>C.Math.toRadians(x);
const note=x=>$("message").textContent=x;
const tint=x=>C.Color.fromCssColorString(x);
try{
 v=new C.Viewer("scene",{baseLayer:false,baseLayerPicker:false,geocoder:false,
 homeButton:false,sceneModePicker:false,navigationHelpButton:false,
 animation:false,timeline:false,fullscreenButton:false,infoBox:false,
 selectionIndicator:false,shouldAnimate:true});
 v.scene.backgroundColor=tint("#a1bfce");
 v.scene.globe.depthTestAgainstTerrain=false;
 v.scene.screenSpaceCameraController.enableCollisionDetection=false;
 v.scene.screenSpaceCameraController.minimumZoomDistance=5;
 v.resolutionScale=innerWidth<700?1.02:1.28;
 v.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
  url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  credit:"© OpenStreetMap contributors (ODbL)"
 }));
 C.ArcGisMapServerImageryProvider.fromUrl(
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
  {credit:"Satellite © Esri and contributors"}
 ).then(x=>v.imageryLayers.addImageryProvider(x)).catch(console.warn);
}catch(e){note("3D viewer error: "+e.message);return;}
v.entities.add({name:"MRT-6 OSM railway centerline, NOT live train GPS",
 polyline:{positions:C.Cartesian3.fromDegreesArrayHeights(track.flatMap(p=>[p[1],p[0],22])),
 width:3,material:tint("#11ba90")}});
function heading(i){
 const k=Math.max(1,Math.min(track.length-2,route.stationBreaks[i]));
 const before=track[k-1],after=track[k+1],lat=stations[i].lat;
 const east=(after[1]-before[1])*Math.cos(angle(lat)),north=after[0]-before[0];
 return Math.atan2(east,north);
}
function orientation(i){
 return C.Transforms.headingPitchRollQuaternion(getPos(stations[i]),
  new C.HeadingPitchRoll(heading(i)-C.Math.PI_OVER_TWO,0,0));
}
function signTexture(s,i){
 const cv=document.createElement("canvas");cv.width=920;cv.height=260;
 const c=cv.getContext("2d");
 c.fillStyle="#e4f0e7";c.fillRect(0,0,920,260);
 c.fillStyle="#127459";c.fillRect(0,0,920,24);c.fillRect(0,221,920,39);
 c.fillStyle="#154637";c.font="bold 27px system-ui";
 c.fillText("MRT LINE-06",28,63);
 c.textAlign="right";c.fillText(String(i+1).padStart(2,"0")+" / 16",890,63);
 c.fillStyle="#173e33";c.textAlign="center";
 c.font='bold 62px "Hind Siliguri","Noto Sans Bengali",sans-serif';
 const bnWidth=c.measureText(s.bn).width,scale=Math.min(1,850/Math.max(1,bnWidth));
 c.save();c.translate(460,0);c.scale(scale,1);c.fillText(s.bn,0,145);c.restore();
 c.font="bold 38px system-ui";c.fillStyle="#253b40";
 c.fillText(s.n,460,204);
 c.font="bold 23px system-ui";c.fillStyle="#f4fff9";
 c.fillText("ঢাকা মেট্রোরেল · DHAKA METRO",460,247);
 return cv;
}
function pinTexture(i){
 const cv=document.createElement("canvas");cv.width=cv.height=110;
 const c=cv.getContext("2d");c.beginPath();c.arc(55,55,48,0,2*Math.PI);
 c.fillStyle="#16876a";c.fill();c.lineWidth=7;c.strokeStyle="#fafff6";c.stroke();
 c.fillStyle="white";c.font="bold 52px system-ui";
 c.textAlign="center";c.textBaseline="middle";c.fillText(String(i+1),55,57);
 return cv;
}
function makeStations(){
 stations.forEach((s,i)=>{
  const props={stationIndex:i,english:s.n,bangla:s.bn};
  fullBoards.push(v.entities.add({name:s.bn+" / "+s.n,
   position:getPos(s,40),properties:props,
   billboard:{image:signTexture(s,i),width:270,height:76,
    verticalOrigin:C.VerticalOrigin.BOTTOM,pixelOffset:new C.Cartesian2(0,-15),
    disableDepthTestDistance:Number.POSITIVE_INFINITY,
    scaleByDistance:new C.NearFarScalar(150,1.1,7000,.65)}
  }));
  numberPins.push(v.entities.add({name:s.n,position:getPos(s,38),properties:props,
   billboard:{image:pinTexture(i),width:34,height:34,
    disableDepthTestDistance:Number.POSITIVE_INFINITY}
  }));
  // Always instantiate a distinct station-specific 3D architecture model
  // at each OSM station coordinate, but render only at street-level zoom.
  // Non-surveyed architecture is illustrative, not operator CAD.
  const stationFile=i===8?"assets/agargaon-station.gltf":
   i===10?"assets/farmgate-landmark.gltf":
   i===13?"assets/dhaka-university-landmark.gltf":
   "assets/stations/"+i+".gltf";
  allStationModels.push(v.entities.add({
   name:s.bn+" / "+s.n+" · original station 3D",
   position:getPos(s,0),
   orientation:orientation(i),
   model:{uri:stationFile,scale:1,
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,3300)}
  }));
  supports.push(v.entities.add({name:"Estimated physical sign support, "+s.n,
   position:getPos(s,34),
   box:{dimensions:new C.Cartesian3(.4,.5,10),material:tint("#61716c"),
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,1500)}
  }));
 });
}
function updateLabels(){
 const height=v.camera.positionCartographic.height;
 const close=height<6000;
 for(let i=0;i<16;i++){
  fullBoards[i].show=close||selected===i;
  numberPins[i].show=!close&&selected!==i;
  supports[i].show=height<1500;
  allStationModels[i].show=(height<3500&&i!==selected);
 }
}
function dropModels(){
 buildToken++;while(models.length)v.entities.remove(models.pop());
}
function showModel(i,path,oriented=false){
 models.push(v.entities.add({name:stations[i].n+" — "+path,
  position:getPos(stations[i],0),
  ...(oriented?{orientation:orientation(i)}:{}),
  model:{uri:path,scale:1,minimumPixelSize:0,maximumScale:1,
   distanceDisplayCondition:new C.DistanceDisplayCondition(0,4200)}
 }));
}
async function loadNeighborhood(i){
 dropModels();const job=buildToken;
 const site=i===8?"assets/agargaon-station.gltf":
  i===10?"assets/farmgate-landmark.gltf":
  i===13?"assets/dhaka-university-landmark.gltf":"assets/stations/"+i+".gltf";
 const tasks=[
  {index:i,path:site,oriented:true},
  {index:i,path:"assets/urban/"+i+".gltf",oriented:false}
 ];
 if(![8,10,13].includes(i))tasks.push({index:i,path:"assets/photo-stations/"+i+".gltf",oriented:true});
 for(const j of [i-1,i+1])if(j>=0&&j<16)tasks.push({index:j,path:"assets/urban/"+j+".gltf",oriented:false});
 for(const task of tasks){
  let okay=false;
  try{const r=await fetch(task.path,{method:"HEAD",cache:"force-cache"});okay=r.ok}catch(e){}
  if(job!==buildToken)return;
  if(okay)showModel(task.index,task.path,task.oriented);
 }
 if(job===buildToken)note(stations[i].bn+" / "+stations[i].n+" · 3D station, nearby OSM buildings and satellite imagery");
}
function overview(){
 selected=-1;dropModels();
 $("pickStation").value="";$("allLine").classList.add("active");
 v.camera.flyTo({destination:C.Cartesian3.fromDegrees(90.389,23.799,27500),
  orientation:{heading:0,pitch:angle(-87),roll:0},duration:1.25});
 $("status").innerHTML="<strong>Full MRT-6:</strong> উত্তরা উত্তর থেকে মতিঝিল · ১৬টি স্টেশন। Zoom করে bilingual nameboards দেখুন।";
 note("পূর্ণ OSM rail alignment দেখানো হচ্ছে, real-time train GPS নয়");
 updateLabels();
}
function focus(i){
 if(!Number.isInteger(i)||i<0||i>=16)return;
 selected=i;$("pickStation").value=String(i);
 $("allLine").classList.remove("active");
 const s=stations[i];
 v.camera.flyToBoundingSphere(new C.BoundingSphere(getPos(s,20),52),{
  offset:new C.HeadingPitchRange(heading(i)+angle(140),angle(-38),560),duration:1.3});
 $("status").innerHTML="<strong>"+s.bn+" / "+s.n+"</strong> · প্রকৃত OSM অবস্থান, অনুমানভিত্তিক 3D facade/height.";
 $("panel").classList.remove("open");
 updateLabels();loadNeighborhood(i);
}
function ui(){
 const select=$("pickStation"),list=$("stationList");
 stations.forEach((s,i)=>{
  const opt=document.createElement("option");opt.value=String(i);
  opt.textContent=String(i+1).padStart(2,"0")+" · "+s.bn+" / "+s.n;
  select.appendChild(opt);
  const b=document.createElement("button");b.type="button";b.className="station-choice";
  b.dataset.q=(s.bn+" "+s.n).toLowerCase();
  const num=document.createElement("span");num.className="number";num.textContent=String(i+1).padStart(2,"0");
  const main=document.createElement("span"),bn=document.createElement("strong"),en=document.createElement("small");
  bn.textContent=s.bn;en.textContent=s.n;main.append(bn,en);b.append(num,main);
  b.onclick=()=>focus(i);list.appendChild(b);
 });
 select.onchange=()=>select.value===""?overview():focus(Number(select.value));
 $("stationSearch").oninput=e=>{
  const q=e.target.value.toLowerCase().trim();
  for(const b of list.children)b.hidden=q.length>0&&!b.dataset.q.includes(q);
 };
 $("allLine").onclick=overview;
 $("next").onclick=()=>focus((selected+1+16)%16);
 $("stationPanel").onclick=()=>$("panel").classList.toggle("open");
 $("closePanel").onclick=()=>$("panel").classList.remove("open");
 $("zoomIn").onclick=()=>v.camera.zoomIn(Math.max(10,v.camera.positionCartographic.height*.3));
 $("zoomOut").onclick=()=>v.camera.zoomOut(Math.max(10,v.camera.positionCartographic.height*.4));
 v.camera.moveEnd.addEventListener(updateLabels);
 const picks=new C.ScreenSpaceEventHandler(v.scene.canvas);
 picks.setInputAction(e=>{
  const hit=v.scene.pick(e.position);
  const p=hit?.id?.properties?.stationIndex;
  if(p){const i=p.getValue(v.clock.currentTime);if(Number.isInteger(i))focus(i);}
 },C.ScreenSpaceEventType.LEFT_CLICK);
}
await Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,2400))]);
makeStations();ui();
const q=new URLSearchParams(location.search),target=Number(q.get("station"));
if(q.has("station")&&Number.isInteger(target)&&target>=0&&target<16)focus(target);
else overview();
window.MRTFullLine3D={viewer:v,stations,focus,overview};
})();