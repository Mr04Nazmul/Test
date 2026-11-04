import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";

// A PLAYABLE approximation, not an operational railway control model.
// Track and building footprints: © OpenStreetMap contributors (ODbL 1.0).
// Kamalapur extension, untagged heights, facades, traffic and rail structures are illustrative.
const R=window.MRT_3D_ROUTE||window.MRT_TRACK;
const $=id=>document.getElementById(id);
const mobile=matchMedia("(max-width: 760px)").matches;
const X0=90.3801,Y0=23.8000,SX=111320*Math.cos(Y0*Math.PI/180),SZ=111320;
const position=(lon,lat)=>new THREE.Vector3((lon-X0)*SX,0,(Y0-lat)*SZ);
const route=R.points.map(p=>position(p[1],p[0]));
const segments=[0];
for(let i=1;i<route.length;i++)segments[i]=segments[i-1]+route[i].distanceTo(route[i-1]);
const LENGTH=segments.at(-1);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function trackAt(m){
  m=clamp(m,-120,LENGTH+120);
  if(m<=0){const t=route[1].clone().sub(route[0]).normalize();return {p:route[0].clone().addScaledVector(t,m),t};}
  if(m>=LENGTH){const t=route.at(-1).clone().sub(route.at(-2)).normalize();return {p:route.at(-1).clone().addScaledVector(t,m-LENGTH),t};}
  let lo=1,hi=segments.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(segments[mid]<m)lo=mid+1;else hi=mid;}
  const i=lo,from=segments[i-1],factor=(m-from)/(segments[i]-from||1);
  return {p:route[i-1].clone().lerp(route[i],factor),t:route[i].clone().sub(route[i-1]).normalize()};
}
function closestOnTrack(p){
 let best=Infinity,m=0;
 for(let i=1;i<route.length;i++){
  const a=route[i-1],b=route[i],d=b.clone().sub(a),len=d.lengthSq();
  const f=clamp(p.clone().sub(a).dot(d)/Math.max(len,1e-10),0,1),q=a.clone().addScaledVector(d,f),dist=q.distanceToSquared(p);
  if(dist<best){best=dist;m=segments[i-1]+f*Math.sqrt(len);}
 }
 return m;
}
const stationD=R.stations.map(s=>closestOnTrack(position(s.lon,s.lat)));
const planet=new THREE.Scene();
planet.background=new THREE.Color("#a8cddd");
planet.fog=new THREE.Fog("#a8cddd",650,mobile?1900:2600);
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.15:1.75));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.18;
$("viewport").appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.15,3200);
const hemi=new THREE.HemisphereLight("#f9f8e9","#637778",2.1);planet.add(hemi);
const sun=new THREE.DirectionalLight("#fff7de",2.35);sun.position.set(-120,340,-130);planet.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(3400,3400),new THREE.MeshStandardMaterial({color:"#7f9386",roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.07;planet.add(ground);
const asphalt=new THREE.MeshStandardMaterial({color:"#3b4047",roughness:.97});
const concrete=new THREE.MeshStandardMaterial({color:"#b0bab9",roughness:.86});
const steel=new THREE.MeshStandardMaterial({color:"#6c7476",metalness:.45,roughness:.55});
const yellow=new THREE.MeshBasicMaterial({color:"#e9e2af"});
const white=new THREE.MeshBasicMaterial({color:"#e2e5e1"});
const grass=new THREE.MeshStandardMaterial({color:"#557d64"});
const canopy=new THREE.MeshStandardMaterial({color:"#26906e",metalness:.18,roughness:.6,side:THREE.DoubleSide});
const piers=[];
const trackChunks=[],trackMarkers=[];
function geometryFromQuads(rows,mat){
 const out=[];
 for(const q of rows){const [a,b,c,d]=q;out.push(...a,...b,...c,...a,...c,...d);}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(out,3));g.computeVertexNormals();
 return new THREE.Mesh(g,mat);
}
function strip(a,b,width,y,offset=0){
 const t=b.clone().sub(a).normalize(),n=new THREE.Vector3(t.z,0,-t.x),w=width/2;
 return [[a.x+n.x*(offset-w),y,a.z+n.z*(offset-w)],
 [a.x+n.x*(offset+w),y,a.z+n.z*(offset+w)],
 [b.x+n.x*(offset+w),y,b.z+n.z*(offset+w)],
 [b.x+n.x*(offset-w),y,b.z+n.z*(offset-w)]];
}
function buildInfrastructure(){
 const box=new THREE.BoxGeometry(2.2,18.5,2.2);
 const count=Math.ceil(LENGTH/45)+2;
 const mesh=new THREE.InstancedMesh(box,concrete,count);
 const dummy=new THREE.Object3D();let n=0;
 for(let m=0;m<=LENGTH;m+=45){
  const f=trackAt(m);dummy.position.copy(f.p);dummy.position.y=9.25;dummy.rotation.set(0,Math.atan2(f.t.x,f.t.z),0);dummy.updateMatrix();
  mesh.setMatrixAt(n++,dummy.matrix);
 }
 mesh.count=n;mesh.instanceMatrix.needsUpdate=true;planet.add(mesh);
 const chunkLen=450;
 for(let offset=0;offset<LENGTH;offset+=chunkLen){
  const road=[],deck=[],lane=[],walk=[],rails=[[],[],[],[]],sleepers=[],supports=[];
  for(let m=offset;m<Math.min(offset+chunkLen,LENGTH);m+=12){
   const a=trackAt(m).p,b=trackAt(Math.min(m+12,offset+chunkLen,LENGTH)).p;
   if(a.distanceTo(b)<.2)continue;
   road.push(strip(a,b,26,.08));
   walk.push(strip(a,b,4,.28,-17),strip(a,b,4,.28,17));
   deck.push(strip(a,b,11.5,20.0));
   for(let k=0;k<4;k++)rails[k].push(strip(a,b,.14,20.14,[-3.05,-1.62,1.62,3.05][k]));
   if(Math.floor(m/12)%2===0){lane.push(strip(a,b,.16,.20,-8),strip(a,b,.16,.20,8));}
   sleepers.push(strip(a,b,.3,20.10,-2.33),strip(a,b,.3,20.10,2.33));
  }
  const group=new THREE.Group();
  group.add(geometryFromQuads(road,asphalt),geometryFromQuads(walk,concrete),geometryFromQuads(deck,concrete),
    geometryFromQuads(lane,white),geometryFromQuads(sleepers,steel));
  for(const r of rails)group.add(geometryFromQuads(r,steel));
  planet.add(group);trackChunks.push({center:offset+chunkLen/2,group});
 }
 // Unsurveyed traffic/vegetation is deliberately illustrative.
 const trunkGeom=new THREE.CylinderGeometry(.22,.26,3.8,5),crownGeom=new THREE.IcosahedronGeometry(2.35,0);
 const trunks=new THREE.InstancedMesh(trunkGeom,new THREE.MeshStandardMaterial({color:"#675643"}),420);
 const crowns=new THREE.InstancedMesh(crownGeom,new THREE.MeshStandardMaterial({color:"#4d8d61"}),420);
 const dummy2=new THREE.Object3D();let idx=0;
 for(let m=75;m<LENGTH&&idx<420;m+=95){
  const f=trackAt(m),n=new THREE.Vector3(f.t.z,0,-f.t.x);
  for(const side of [-1,1]){
   const d=(m%4<2?62:96)*side;
   dummy2.position.copy(f.p).addScaledVector(n,d);dummy2.position.y=1.9;dummy2.updateMatrix();trunks.setMatrixAt(idx,dummy2.matrix);
   dummy2.position.y=5.25;dummy2.scale.set(1.0+(m%3)/7,1,1.1);dummy2.updateMatrix();crowns.setMatrixAt(idx,dummy2.matrix);
   dummy2.scale.set(1,1,1);idx++;
  }
 }
 trunks.count=crowns.count=idx;trunks.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate;
 planet.add(trunks,crowns);
}
buildInfrastructure();
function stationBoard(s){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=280;
 const c=canvas.getContext("2d");c.fillStyle="#e5f0e6";c.fillRect(0,0,1024,280);
 c.fillStyle="#168662";c.fillRect(0,0,1024,24);c.fillRect(0,243,1024,37);
 c.textAlign="center";c.fillStyle="#0c543e";c.font='bold 78px "Hind Siliguri",sans-serif';c.fillText(s.bn,512,137,960);
 c.fillStyle="#244841";c.font="bold 45px sans-serif";c.fillText(s.n,512,213,950);
 c.fillStyle="white";c.font="bold 23px sans-serif";c.fillText("DHAKA METRO · MRT-6",512,270);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(21,5.8),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));
 return sign;
}
const stations=[];
function addBox(parent,w,h,d,x,y,z,material){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function buildStations(){
 R.stations.forEach((s,i)=>{
  const o=trackAt(stationD[i]),group=new THREE.Group();
  group.position.copy(o.p);group.rotation.y=Math.atan2(o.t.x,o.t.z);
  const platformLength=115;
  // Physical dimensions are a stylised construction.
  addBox(group,24,1.4,platformLength,0,21.4,0,concrete);
  addBox(group,4,.35,platformLength,-9.2,22.22,0,yellow);
  addBox(group,4,.35,platformLength,9.2,22.22,0,yellow);
  const roofShape=new THREE.Shape();
  roofShape.moveTo(-13,0);roofShape.lineTo(-13,1.8);
  for(let k=0;k<=20;k++){const x=-13+26*k/20;roofShape.lineTo(x,3.9+1.35*Math.sin(Math.PI*k/20));}
  roofShape.lineTo(13,0);roofShape.closePath();
  const roof=new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape,{depth:platformLength,bevelEnabled:false}),canopy);
  roof.position.set(0,27,-platformLength/2);group.add(roof);
  for(const side of [-1,1]){
    for(let z=-48;z<=48;z+=24)addBox(group,.65,5.6,.65,side*11,25.2,z,concrete);
    const board=stationBoard(s);board.position.set(side*12,26,4);board.rotation.y=side*Math.PI/2;group.add(board);
  }
  // Station access steps represent the elevated entrance, not a surveyed CAD footprint.
  addBox(group,5,22,10,18,11,0,concrete);
  addBox(group,5,22,10,-18,11,0,concrete);
  if(i===16)group.userData.planned=true;
  group.visible=false;stations.push({s,m:stationD[i],mesh:group});planet.add(group);
 });
}
buildStations();
const carGroups=[],bodyLoader=new GLTFLoader();
const fallbackSteel=new THREE.MeshStandardMaterial({color:"#e5e7e4",metalness:.72,roughness:.32});
const glass=new THREE.MeshStandardMaterial({color:"#294c5f",metalness:.36,roughness:.25});
const green=new THREE.MeshStandardMaterial({color:"#1e9474",metalness:.2,roughness:.65});
const red=new THREE.MeshStandardMaterial({color:"#c6453e"});
function fallbackCar(){
 const car=new THREE.Group();
 addBox(car,3,3.2,19.2,0,2.2,0,fallbackSteel);
 addBox(car,3.05,.27,18.8,0,3.45,0,green);addBox(car,3.07,.18,18.8,0,1.2,0,red);
 for(const side of [-1,1])for(let z=-7.6;z<=7.6;z+=3.05)addBox(car,.08,1.05,2.15,side*1.54,2.52,z,glass);
 addBox(car,2.5,1.15,.05,0,2.65,9.63,glass);
 return car;
}
for(let i=0;i<6;i++){const root=new THREE.Group();const f=fallbackCar();root.add(f);root.userData.fallback=f;planet.add(root);carGroups.push(root);}
const imported=Promise.all(["front","middle","rear"].map(x=>bodyLoader.loadAsync("assets/mrt6-"+x+".gltf").catch(()=>null)));
imported.then(([front,middle,rear])=>{
 for(let i=0;i<6;i++){
  const result=i===0?front:i===5?rear:middle;
  if(!result)continue;
  const group=carGroups[i],model=result.scene.clone(true),f=group.userData.fallback;
  // Repo glTF parts use metric dimensions with train long axis along Z.
  group.remove(f);group.add(model);
 }
});
function paintTrain(d){
 carGroups.forEach((root,i)=>{
  const p=trackAt(d-i*20),yaw=Math.atan2(p.t.x,p.t.z);
  root.position.copy(p.p);root.position.y=20.23;root.rotation.y=yaw;
 });
}
const matTraffic=[
 new THREE.MeshStandardMaterial({color:"#a92634"}),
 new THREE.MeshStandardMaterial({color:"#e3bd3b"}),
 new THREE.MeshStandardMaterial({color:"#5c9eaf"}),
 new THREE.MeshStandardMaterial({color:"#e7dfd1"})
];
const traffic=[];
for(let i=0;i<(mobile?12:20);i++){
 const group=new THREE.Group(),bus=i%5===0,rikshaw=i%6===0;
 addBox(group,bus?2.3:rikshaw?1.3:1.8,bus?2.65:rikshaw?1.65:1.3,bus?7.5:rikshaw?2.9:3.9,
  0,bus?1.6:rikshaw?1.05:.9,0,matTraffic[i%4]);
 addBox(group,bus?2.24:1.75,.56,bus?4.5:2.3,0,bus?2.25:1.65,0,glass);
 traffic.push({root:group,s:(i*287)%LENGTH,side:i%2?-9:9,dir:i%2?1:-1});
 planet.add(group);
}
let sMeters=105,speed=0,power=0,brake=0,score=0,nextIndex=1,doors=false,mode=0,night=false,rate=1;
let running=false,lastUpdate=performance.now(),lastTiles="",served=new Set(),lastHUD=0;
const uiMessage=t=>{$("message").textContent=t;};
function updateHUD(){
 $("speed").textContent=Math.round(speed*3.6);$("powerValue").textContent=power+"/4";
 $("brakeValue").textContent=brake+"/5";$("score").textContent=score;
 $("progress").style.width=clamp(sMeters/LENGTH*100,0,100)+"%";
 const target=R.stations[Math.min(nextIndex,R.stations.length-1)],km=stationD[Math.min(nextIndex,stationD.length-1)]-sMeters;
 $("nextStation").textContent="Next: "+target.bn+" / "+target.n+(target.future?" (planned)":"");
 $("distance").textContent=(km>=0?"Distance: ":"Overshot: ")+(Math.abs(km)>999?(Math.abs(km)/1000).toFixed(2)+" km":Math.round(Math.abs(km))+" m");
 $("trip").textContent="Route: "+(sMeters/1000).toFixed(2)+" / "+(LENGTH/1000).toFixed(2)+" km"+(doors?" • Doors OPEN":"");
}
function updatePhysics(dt){
 if(doors){speed=0;return;}
 let acceleration=power*.27-brake*.45-(.055+.00014*speed*speed);
 if(speed>=80/3.6&&acceleration>0)acceleration=0;
 speed=clamp(speed+acceleration*dt,0,80/3.6);
 sMeters=clamp(sMeters+speed*dt,-30,LENGTH);
 if(sMeters>=LENGTH)speed=0;
 const d=stationD[nextIndex]-sMeters;
 if(speed>.1&&d>0&&d<speed*speed/(2*1.35)+65&&d<260)uiMessage("⚠ "+R.stations[nextIndex].bn+" সামনে। এখন Brake বাড়াও।");
 if(d< -75&&nextIndex<R.stations.length-1){nextIndex++;score=Math.max(0,score-40);uiMessage("স্টেশন মিস হয়েছে! −40 points. পরের স্টেশন লক্ষ্য করো।");}
}
function changeDoor(){
 if(doors){doors=false;uiMessage("দরজা বন্ধ। Brake ছাড়িয়ে Power বাড়াও।");return;}
 if(speed>.45){uiMessage("দরজা খুলতে ট্রেন সম্পূর্ণ থামাও।");return;}
 doors=true;power=0;brake=5;
 const d=Math.abs(stationD[nextIndex]-sMeters);
 if(d<45&&!served.has(nextIndex)){
  served.add(nextIndex);score+=200;uiMessage("✅ "+R.stations[nextIndex].bn+"-তে থামানো সফল! +200 points");
  if(nextIndex<R.stations.length-1)nextIndex++;
 }else uiMessage("দরজা খোলা হয়েছে। স্টেশনে থামলে পয়েন্ট পাওয়া যাবে।");
}
const clock=new THREE.Clock();
const orbits=new OrbitControls(camera,renderer.domElement);
orbits.enabled=false;orbits.enableDamping=true;orbits.maxPolarAngle=Math.PI*.49;orbits.minDistance=12;orbits.maxDistance=200;
function updateCamera(dt){
 const f=trackAt(sMeters),t=f.t,p=f.p;
 const lift=new THREE.Vector3(0,1,0),desired=new THREE.Vector3();
 if(mode===0)desired.copy(p).addScaledVector(t,-65).addScaledVector(lift,46);
 if(mode===1)desired.copy(p).addScaledVector(t,7).addScaledVector(lift,24.0);
 if(mode===2)desired.copy(p).addScaledVector(t,-16).addScaledVector(lift,35);
 if(mode===3)desired.copy(p).addScaledVector(lift,170);
 if(mode===4){
  orbits.target.copy(p).addScaledVector(lift,21);
  orbits.update();return;
 }
 camera.position.lerp(desired,clamp(dt*3.1,0,1));
 const target=p.clone().addScaledVector(t,mode===1?90:mode===3?10:25).addScaledVector(lift,mode===1?23:20);
 camera.lookAt(target);
}
let previousMode=0;
function setCamera(){
 mode=(mode+1)%5;
 if(mode===4){orbits.enabled=true;orbits.target.copy(trackAt(sMeters).p).add(new THREE.Vector3(0,22,0));}
 else orbits.enabled=false;
 $("camera").textContent=["📷 Chase","🚉 Driver Cab","🚆 Roof","🛰️ Drone","🖐 Orbit"][mode];
}
function setNight(){
 night=!night;$("sun").textContent=night?"🌙 Night":"☀ Day";
 planet.background.set(night?"#10263c":"#a8cddd");planet.fog.color.copy(planet.background);
 hemi.intensity=night?.75:2.1;sun.intensity=night?.55:2.35;
}
let audioCtx=null;
function horn(){
 try{
  const ctx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();audioCtx=ctx;
  if(ctx.state==="suspended")ctx.resume();
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type="sawtooth";osc.frequency.value=330;
  gain.gain.setValueAtTime(.0001,ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.05);
  gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+1.1);
  osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+1.12);
 }catch(e){uiMessage("Audio অনুমতি মেলেনি।");}
}
function reset(index=0){
 const i=clamp(index,0,16);
 sMeters=stationD[i]+(i===0?105:-60);nextIndex=Math.min(i+1,16);
 speed=0;power=0;brake=0;doors=false;score=0;served.clear();
 lastTiles="";clearTimeout(window.__simToast);
 uiMessage("নতুন যাত্রা: "+R.stations[i].bn+"। Power + চাপ দিয়ে ট্রেন চালাও।");
 paintTrain(sMeters);updateCamera(1);updateHUD();
}
$("throttleUp").onclick=()=>{if(doors){uiMessage("আগে Doors বন্ধ করো।");return;}power=clamp(power+1,0,4);if(power>0)brake=0;updateHUD();};
$("throttleDown").onclick=()=>{power=clamp(power-1,0,4);updateHUD();};
$("brakeUp").onclick=()=>{brake=clamp(brake+1,0,5);power=0;updateHUD();};
$("brakeDown").onclick=()=>{brake=clamp(brake-1,0,5);updateHUD();};
$("emergency").onclick=()=>{brake=5;power=0;uiMessage("Emergency brake applied!");updateHUD();};
$("doors").onclick=()=>{changeDoor();updateHUD();};
$("camera").onclick=setCamera;
$("sun").onclick=setNight;
$("horn").onclick=horn;
$("time").onclick=()=>{rate=rate===1?3:rate===3?6:1;$("time").textContent="⏱ "+rate+"×";};
$("reset").onclick=()=>reset(0);
const jump=$("stationJump");
R.stations.forEach((s,i)=>{const op=document.createElement("option");op.value=i;op.textContent=(i+1)+". "+s.bn+" / "+s.n+(s.future?" (planned)":"");jump.appendChild(op);});
jump.value="0";jump.onchange=()=>reset(Number(jump.value));
document.addEventListener("keydown",e=>{
 if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
 if(["ArrowUp","ArrowDown","Space"].includes(e.code))e.preventDefault();
 if(e.repeat)return;
 if(e.code==="KeyW"||e.code==="ArrowUp")$("throttleUp").click();
 if(e.code==="KeyS"||e.code==="ArrowDown")$("brakeUp").click();
 if(e.code==="Space")$("emergency").click();
 if(e.code==="KeyD")$("doors").click();
 if(e.code==="KeyC")$("camera").click();
 if(e.code==="KeyH")$("horn").click();
});
let cityManifest=null,tilesLoaded=new Map(),tileLoading=new Set(),lastTileCoords="";
function tileAt(lon,lat,z){
 const n=2**z;
 return [Math.floor((lon+180)/360*n),Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n)];
}
const worldM=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,metalness:.03,roughness:.87});
const facades=["#d7cabb","#c8ac96","#d4d5c9","#a7beca","#d8b1a1","#d0d9d2","#c8b8af"];
function buildTile(data){
 const vertices=[],cols=[];
 const max=mobile?340:720;
 let count=0;
 function triangle(a,b,c,color){
  vertices.push(...a,...b,...c);
  for(let i=0;i<3;i++)cols.push(color.r,color.g,color.b);
 }
 for(const rec of data){
  if(count++>=max)break;
  const ring=rec[0];if(!Array.isArray(ring)||ring.length<3||ring.length>90)continue;
  const pts=ring.map(p=>position(p[0],p[1])).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.z));
  if(pts.length<3)continue;
  if(pts[0].distanceTo(pts.at(-1))<.1)pts.pop();
  if(pts.length<3)continue;
  const h=Number(rec[1])>2?Math.min(Number(rec[1]),190):10+(Math.abs(Math.round(pts[0].x*15+pts[0].z*9))%8)*3.1;
  const seed=Math.abs(Math.round(pts[0].x*3+pts[0].z*7));
  const material=THREE.Color.prototype.set.call(new THREE.Color(),facades[(seed+Number(rec[2]||0))%facades.length]);
  const face=material.clone().multiplyScalar(.91),roof=material.clone().multiplyScalar(.82);
  try{
   const triangulated=THREE.ShapeUtils.triangulateShape(pts.map(p=>new THREE.Vector2(p.x,p.z)),[]);
   for(const [a,b,c] of triangulated)triangle([pts[a].x,h,pts[a].z],[pts[b].x,h,pts[b].z],[pts[c].x,h,pts[c].z],roof);
  }catch(e){}
  for(let i=0;i<pts.length;i++){
   const a=pts[i],b=pts[(i+1)%pts.length];
   triangle([a.x,0,a.z],[b.x,0,b.z],[b.x,h,b.z],face);
   triangle([a.x,0,a.z],[b.x,h,b.z],[a.x,h,a.z],material);
  }
 }
 if(!vertices.length)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));
 geometry.computeVertexNormals();
 return new THREE.Mesh(geometry,worldM);
}
async function loadTile(x,y,z){
 const k=z+"/"+x+"/"+y;if(tileLoading.has(k)||tilesLoaded.has(k))return;
 tileLoading.add(k);
 try{
  const response=await fetch("data/3d-city/t/"+k+".json");
  if(!response.ok)return;
  const data=await response.json();if(!Array.isArray(data))return;
  const mesh=buildTile(data);
  if(mesh){tilesLoaded.set(k,mesh);planet.add(mesh);}
 }catch(e){console.warn("OSM 3D tile unavailable",k,e);}
 finally{tileLoading.delete(k);}
}
function updateTiles(){
 if(!cityManifest?.ready)return;
 const f=trackAt(sMeters).p;
 const lat=Y0-f.z/SZ,lon=X0+f.x/SX,z=cityManifest.zoom;
 const [tx,ty]=tileAt(lon,lat,z),key=tx+":"+ty;
 if(key===lastTileCoords)return;lastTileCoords=key;
 const candidates=[];
 for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)candidates.push({x:tx+a,y:ty+b,dist:a*a+b*b});
 candidates.sort((a,b)=>a.dist-b.dist);
 const needed=new Set(candidates.slice(0,mobile?4:6).map(t=>z+"/"+t.x+"/"+t.y));
 for(const [key,mesh] of tilesLoaded.entries()){
  if(needed.has(key))continue;planet.remove(mesh);mesh.geometry.dispose();tilesLoaded.delete(key);
 }
 for(const {x,y} of candidates.slice(0,mobile?4:6))loadTile(x,y,z);
}
async function initTiles(){
 try{
  cityManifest=await (await fetch("data/3d-city/manifest.json")).json();
  if(!cityManifest.ready)throw Error("No completed 3D tiles");
  updateTiles();
 }catch(e){uiMessage("OSM corridor offline tiles নেই। স্টেশন, ট্র্যাক এবং ট্রেন 3D তবুও চলবে।");}
}
initTiles();
let lastCenter=null;
function render(){
 const now=performance.now(),dt=Math.min((now-lastUpdate)/1000,.075);lastUpdate=now;
 if(running){
  updatePhysics(dt*rate);paintTrain(sMeters);
  const f=trackAt(sMeters);ground.position.x=f.p.x;ground.position.z=f.p.z;
  for(const ch of trackChunks)ch.group.visible=Math.abs(ch.center-sMeters)<1700;
  for(const st of stations)st.mesh.visible=Math.abs(st.m-sMeters)<1350;
  for(const t of traffic){
   t.s=(t.s+dt*rate*8*t.dir+LENGTH)%LENGTH;
   const p=trackAt(t.s),n=new THREE.Vector3(p.t.z,0,-p.t.x);
   t.root.position.copy(p.p).addScaledVector(n,t.side);
   t.root.position.y=.3;t.root.rotation.y=Math.atan2(p.t.x*t.dir,p.t.z*t.dir);
   t.root.visible=Math.abs(t.s-sMeters)<1400;
  }
  updateCamera(dt);
  if(now-lastHUD>260){updateHUD();updateTiles();lastHUD=now;}
 }
 renderer.render(planet,camera);
 requestAnimationFrame(render);
}
paintTrain(sMeters);updateCamera(1);updateHUD();render();
$("start").onclick=()=>{
 $("loading").hidden=true;running=true;lastUpdate=performance.now();jump.value="0";
 uiMessage("Simulator শুরু! Power বাড়াও, স্টেশনের আগে Brake দিয়ে থামাও, তারপর Doors খুলে পয়েন্ট নাও।");
};
window.addEventListener("resize",()=>{
 camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
window.MRT6Simulator={get state(){return {positionMeters:sMeters,speedKmh:speed*3.6,nextStation:nextIndex,score,doors,rate}},reset};
