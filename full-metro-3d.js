(async function(){
"use strict";
// 16 OSM-geocoded MRT-6 stations, plus planned/approximate Kamalapur terminal.
const C=window.Cesium,route=window.MRT_3D_ROUTE||window.MRT_TRACK,$=id=>document.getElementById(id);
if(!C||!route||route.stations.length<16){$("message").textContent="Route/3D engine unavailable";return;}
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
v.entities.add({name:"MRT-6 mapped rail centerline plus planned Kamalapur approximate extension, NOT train GPS",
 polyline:{positions:C.Cartesian3.fromDegreesArrayHeights(track.flatMap(p=>[p[1],p[0],22])),
 width:3,material:tint("#11ba90")}});
// Full route is one continuous ACTUAL 3D viaduct body, not a thin flat line.
const surveyedCount=window.MRT_TRACK?.points?.length||track.length;
const knownTrack=track.slice(0,surveyedCount);
const proposedTrack=track.slice(Math.max(0,surveyedCount-1));
function elevatedTrackBody(segment,color,label){
 if(segment.length<2)return;
 v.entities.add({name:label,polylineVolume:{
  positions:segment.map(p=>C.Cartesian3.fromDegrees(p[1],p[0],20)),
  shape:[new C.Cartesian2(-4.9,-.8),new C.Cartesian2(4.9,-.8),
         new C.Cartesian2(4.9,.8),new C.Cartesian2(-4.9,.8)],
  material:tint(color),cornerType:C.CornerType.ROUNDED
 }});
}
elevatedTrackBody(knownTrack,"#b8c1bf","MRT-6 elevated concrete guideway, measured line position, illustrative support geometry");
elevatedTrackBody(proposedTrack,"#a1b9a9","Future Kamalapur extension: unsurveyed illustrative line");

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
 c.textAlign="right";c.fillText(String(i+1).padStart(2,"0")+" / "+stations.length,890,63);
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
   i===16?"assets/mrt6-station-concept.gltf":
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
 for(let i=0;i<stations.length;i++){
  fullBoards[i].show=close||selected===i;
  numberPins[i].show=!close&&selected!==i;
  supports[i].show=height<1500;
  allStationModels[i].show=(height<3500&&i!==selected);
 }
}
// Approximate concrete viaduct and columns around the active station only.
function putGuideway(i){
 const s=stations[i];
 const vertices=track.filter(p=>Math.hypot((p[0]-s.lat)*111320,
       (p[1]-s.lon)*111320*Math.cos(s.lat*Math.PI/180))<710);
 if(vertices.length<2)return;
 const coords=vertices.map(p=>C.Cartesian3.fromDegrees(p[1],p[0],19.5));
// Guideway mesh spans the full corridor; here we add only nearby support piers.
 let gap=0;
 for(let k=1;k<vertices.length;k++){
  const a=vertices[k-1],b=vertices[k];
  const distance=Math.hypot((a[0]-b[0])*111320,(a[1]-b[1])*111320*Math.cos(s.lat*Math.PI/180));
  gap+=distance;
  if(gap<45)continue;
  gap=0;
  models.push(v.entities.add({name:"MRT-6 concrete support, illustrative",
   position:C.Cartesian3.fromDegrees(b[1],b[0],9.4),
   box:{dimensions:new C.Cartesian3(1.75,1.75,18.8),material:tint("#a9aeac"),
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,1800)} }));
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
 dropModels();putGuideway(i);const job=buildToken;
 const site=i===8?"assets/agargaon-station.gltf":
  i===10?"assets/farmgate-landmark.gltf":
  i===13?"assets/dhaka-university-landmark.gltf":
  i===16?"assets/mrt6-station-concept.gltf":"assets/stations/"+i+".gltf";
 const tasks=[{index:i,path:site,oriented:true}];
 if(i<16)tasks.push(
  {index:i,path:"assets/urban/"+i+".gltf",oriented:false},
  {index:i,path:"assets/urban-details/"+i+".gltf",oriented:false},
  {index:i,path:"assets/rooftops/"+i+".gltf",oriented:false},
  {index:i,path:"assets/neighborhood/"+i+".gltf",oriented:false}
 );
 if(i<16&&![8,10,13].includes(i))tasks.push({index:i,path:"assets/photo-stations/"+i+".gltf",oriented:true});
 for(const j of [i-1,i+1])if(j>=0&&j<16&&i<16)tasks.push({index:j,path:"assets/urban/"+j+".gltf",oriented:false});
 for(const task of tasks){
  let okay=false;
  try{const r=await fetch(task.path,{method:"HEAD",cache:"force-cache"});okay=r.ok}catch(e){}
  if(job!==buildToken)return;
  if(okay)showModel(task.index,task.path,task.oriented);
 }
 if(job===buildToken)note(stations[i].bn+" / "+stations[i].n+" · 3D station, surrounding mapped geometry and satellite imagery");
}
function overview(){
 selected=-1;dropModels();window.MRT_CORRIDOR_3D?.hide();
 $("pickStation").value="";$("allLine").classList.add("active");
 v.camera.flyTo({destination:C.Cartesian3.fromDegrees(90.389,23.799,27500),
  orientation:{heading:0,pitch:angle(-87),roll:0},duration:1.25});
 $("status").innerHTML="<strong>Full MRT-6:</strong> উত্তরা উত্তর থেকে কমলাপুর · ১৭টি স্টেশন (কমলাপুর পরিকল্পিত)। Zoom করে bilingual nameboards দেখুন।";
 note("OSM based route through Motijheel; Kamalapur extension is approximate, NOT live train GPS");
 updateLabels();
}
function focus(i){
 if(!Number.isInteger(i)||i<0||i>=stations.length)return;
 selected=i;$("pickStation").value=String(i);
 const studioLink=$("studioStationLink");
 if(studioLink){
  studioLink.href="real-3d-studio.html?station="+i;
  studioLink.textContent="🏙 "+stations[i].bn+" · Real 3D";
 }
 $("allLine").classList.remove("active");
 const s=stations[i];
 v.camera.flyToBoundingSphere(new C.BoundingSphere(getPos(s,20),52),{
  offset:new C.HeadingPitchRange(heading(i)+angle(140),angle(-38),560),duration:1.3});
 $("status").innerHTML="<strong>"+s.bn+" / "+s.n+"</strong> · "+(s.future?"পরিকল্পিত স্টেশন; আনুমানিক track geometry, ":"OSM station location, ")+"অনুমানভিত্তিক 3D facade/height.";
 $("panel").classList.remove("open");
 updateLabels();loadNeighborhood(i);window.MRT_CORRIDOR_3D?.load(i);
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
 $("next").onclick=()=>focus((selected+1+16)%stations.length);
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
await window.MRT_CORRIDOR_3D?.init(v,route);
makeStations();ui();
const q=new URLSearchParams(location.search),target=Number(q.get("station"));
if(q.has("station")&&Number.isInteger(target)&&target>=0&&target<16)focus(target);
else overview();
window.MRTFullLine3D={viewer:v,stations,focus,overview};
window.dispatchEvent(new Event('mrt3dready'));
})();