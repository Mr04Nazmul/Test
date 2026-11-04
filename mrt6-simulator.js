import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {installHDInfrastructure} from "./mrt6-hd-infrastructure.js";

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
planet.background=new THREE.Color("#9dbfd4");
planet.fog=new THREE.Fog("#9dbfd4",600,mobile?2250:3000);
const renderer=new THREE.WebGLRenderer({antialias:!mobile,powerPreference:"high-performance"});
const deviceRatio=Math.max(1,window.devicePixelRatio||1);
let qualityMode="auto",renderScale=Math.min(deviceRatio,mobile?1.3:1.65);
function applyRenderScale(next){
  renderScale=Math.round(clamp(next,.85,Math.min(deviceRatio,mobile?1.8:2))*100)/100;
  renderer.setPixelRatio(renderScale);
}
applyRenderScale(renderScale);
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.06;
$("viewport").appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.15,3200);
const hemi=new THREE.HemisphereLight("#fff9ee","#566971",1.74);planet.add(hemi);
const sun=new THREE.DirectionalLight("#ffefcf",2.05);sun.position.set(-120,340,-130);planet.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(3400,3400),new THREE.MeshStandardMaterial({color:"#7f9386",roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=-.07;planet.add(ground);
const asphalt=new THREE.MeshStandardMaterial({color:"#373d40",roughness:.98});
asphalt.onBeforeCompile=shader=>{
 shader.vertexShader=shader.vertexShader.replace("#include <common>",
  "#include <common>\nvarying vec3 vAsphaltWorld;");
 shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",
  "#include <begin_vertex>\nvAsphaltWorld=(modelMatrix*vec4(position,1.0)).xyz;");
 shader.fragmentShader=shader.fragmentShader.replace("#include <common>",
  "#include <common>\nvarying vec3 vAsphaltWorld;");
 shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
  "#include <color_fragment>\nfloat grain=fract(sin(dot(floor(vAsphaltWorld.xz*1.4),vec2(12.9898,78.233)))*43758.5453);\ndiffuseColor.rgb*=.91+grain*.17;");
};
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
 for(const q of rows){const [a,b,c,d]=q;out.push(...a,...c,...b,...a,...d,...c);}
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
   for(let k=0;k<4;k++)rails[k].push(strip(a,b,.14,20.14,[-3.34,-1.26,1.26,3.34][k]));
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
const hdRail=installHDInfrastructure({scene:planet,trackAt,length:LENGTH,mobile});
// OSM route shapes are real; infrastructure dimensions are illustrated, not surveyed.
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
  // Side-platform reconstruction. A thin roof replaces the solid roof that
  // blocked the driver's view in the user-submitted screen recording.
  const platformLength=116,roofQuads=[];
  const roofMat=new THREE.MeshStandardMaterial({color:i===16?"#678b7b":"#2e8a77",
    metalness:.31,roughness:.58,side:THREE.DoubleSide});
  const edgeMat=new THREE.MeshStandardMaterial({color:"#d4d8ce",roughness:.75});
  const tactileMat=new THREE.MeshStandardMaterial({color:"#e8bb4d",roughness:.85});
  const glazingMat=new THREE.MeshStandardMaterial({color:"#7fa8ab",metalness:.33,
    transparent:true,opacity:.50,roughness:.26,side:THREE.DoubleSide});
  for(const side of [-1,1]){
    const mid=side*8.3;
    addBox(group,7.2,1.1,platformLength,mid,20.70,0,concrete);
    addBox(group,.38,.12,platformLength,side*4.85,21.33,0,tactileMat);
    addBox(group,.15,1.25,platformLength,side*11.92,22.02,0,glazingMat);
    // Ridge-shaped thin canopy, with open track center and unobstructed catenary.
    for(let z=-platformLength/2;z<platformLength/2;z+=9.5){
      for(let k=0;k<10;k++){
        const x0=mid-4.1+k*.82,x1=x0+.82;
        const y0=29.4+.83*Math.sin(Math.PI*k/10),y1=29.4+.83*Math.sin(Math.PI*(k+1)/10);
        roofQuads.push([[x0,y0,z],[x1,y1,z],[x1,y1,Math.min(z+9.5,platformLength/2)],
         [x0,y0,Math.min(z+9.5,platformLength/2)]]);
      }
    }
    for(let z=-48;z<=48;z+=24){
      addBox(group,.48,7.7,.48,side*11.4,25.05,z,edgeMat);
      addBox(group,7.7,.20,.28,mid,29.15,z,edgeMat);
    }
    const board=stationBoard(s);board.position.set(side*11.7,25.65,0);
    board.rotation.y=side*Math.PI/2;group.add(board);
    // Street access volumes: indicative entrances, no surveyed stair topology.
    addBox(group,4.8,17.8,9,side*17.4,8.9,-38,edgeMat);
    addBox(group,4.5,2.8,9,side*17.4,18.9,-38,roofMat);
  }
  group.add(geometryFromQuads(roofQuads,roofMat));
  // Concourse connects both sides below platform level, keeping rails clear.
  addBox(group,26.5,2.0,16,0,15.1,35,edgeMat);
  if(s.future)group.userData.planned=true;
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
function pantographForCar(){
  const group=new THREE.Group();
  const dark=new THREE.MeshStandardMaterial({color:"#444d54",metalness:.8,roughness:.35});
  const top=new THREE.MeshStandardMaterial({color:"#ad5f42",metalness:.75,roughness:.38});
  function beam(a,b,r,mat){
    const v1=new THREE.Vector3(...a),v2=new THREE.Vector3(...b),d=v2.clone().sub(v1);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),6),mat);
    mesh.position.copy(v1).add(v2).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    group.add(mesh);
  }
  addBox(group,1.5,.15,2.6,0,4.22,0,dark);
  for(const side of [-1,1]){
    beam([side*.60,4.30,-.85],[side*.28,5.10,.64],.060,dark);
    beam([side*.60,4.30,.85],[side*.28,5.10,-.64],.060,dark);
    beam([side*.28,5.10,-.64],[side*.61,5.38,.60],.054,dark);
  }
  beam([-.78,5.42,.65],[.78,5.42,.65],.09,top);
  return group;
}
for(let i=0;i<6;i++){const root=new THREE.Group();const f=fallbackCar();root.add(f);root.userData.fallback=f;
 if(i===2||i===4)root.add(pantographForCar());
 planet.add(root);carGroups.push(root);}
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
const TRAIN_LANE=-2.3; // one of two side-by-side tracks; not straddling their centerline
function paintTrain(d){
 carGroups.forEach((root,i)=>{
  const m=d-i*20,p=trackAt(m),front=trackAt(m+11),rear=trackAt(m-11);
  const t=front.p.clone().sub(rear.p).normalize(),n=new THREE.Vector3(t.z,0,-t.x);
  root.position.copy(p.p).addScaledVector(n,TRAIN_LANE);
  root.position.y=20.23;
  root.rotation.y=Math.atan2(t.x,t.z);
 });
}

const matTraffic=[
 new THREE.MeshStandardMaterial({color:"#a92634"}),
 new THREE.MeshStandardMaterial({color:"#e3bd3b"}),
 new THREE.MeshStandardMaterial({color:"#5c9eaf"}),
 new THREE.MeshStandardMaterial({color:"#e7dfd1"})
];
const traffic=[];
for(let i=0;i<(mobile?24:42);i++){
 const group=new THREE.Group(),bus=i%5===0,rikshaw=i%6===0;
 addBox(group,bus?2.3:rikshaw?1.3:1.8,bus?2.65:rikshaw?1.65:1.3,bus?7.5:rikshaw?2.9:3.9,
  0,bus?1.6:rikshaw?1.05:.9,0,matTraffic[i%4]);
 addBox(group,bus?2.24:1.75,.56,bus?4.5:2.3,0,bus?2.25:1.65,0,glass);
 traffic.push({root:group,s:(i*173)%LENGTH,side:i%2?-9:9,dir:i%2?1:-1,type:bus?"bus":rikshaw?"rickshaw":"car"});
 planet.add(group);
}
// Replace placeholders with the existing three genuine original traffic glTF assets.
Promise.all(["car","bus","rickshaw"].map(n=>bodyLoader.loadAsync("assets/dhaka-"+n+".gltf").catch(()=>null))).then(([car,bus,rickshaw])=>{
 const base={car,bus,rickshaw};
 for(const t of traffic){if(!base[t.type])continue;
  t.root.clear();t.root.add(base[t.type].scene.clone(true));
 }
});
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
const filteredLookAt=new THREE.Vector3();
let cameraReady=false;
function updateCamera(dt){
 const sample=trackAt(sMeters),front=trackAt(sMeters+13),back=trackAt(sMeters-13);
 const t=front.p.clone().sub(back.p).normalize(),n=new THREE.Vector3(t.z,0,-t.x),p=sample.p.clone().addScaledVector(n,TRAIN_LANE);
 const lift=new THREE.Vector3(0,1,0),desired=p.clone();
 if(mode===0)desired.addScaledVector(t,-71).addScaledVector(n,18).addScaledVector(lift,41);
 if(mode===1)desired.addScaledVector(t,9).addScaledVector(lift,24.30);
 if(mode===2)desired.addScaledVector(t,-32).addScaledVector(n,23).addScaledVector(lift,34);
 if(mode===3)desired.addScaledVector(t,-75).addScaledVector(lift,165);
 if(mode===4){
  orbits.target.copy(p).addScaledVector(lift,21);
  orbits.update();return;
 }
 const target=p.clone().addScaledVector(t,mode===1?105:mode===3?30:31)
  .addScaledVector(lift,mode===1?24.2:20);
 if(!cameraReady){camera.position.copy(desired);filteredLookAt.copy(target);cameraReady=true;}
 else{
  const alpha=1-Math.exp(-Math.max(.001,dt)*3.6);
  camera.position.lerp(desired,alpha);filteredLookAt.lerp(target,alpha);
 }
 camera.lookAt(filteredLookAt);
}

let previousMode=0;
function setCamera(){
 mode=(mode+1)%5;cameraReady=false;
 if(mode===4){orbits.enabled=true;orbits.target.copy(trackAt(sMeters).p).add(new THREE.Vector3(0,22,0));}
 else orbits.enabled=false;
 $("camera").textContent=["📷 Chase","🚉 Driver Cab","🚆 Roof","🛰️ Drone","🖐 Orbit"][mode];
}
function setNight(){
 night=!night;$("sun").textContent=night?"🌙 Night":"☀ Day";
 planet.background.set(night?"#142c43":"#9dbfd4");planet.fog.color.copy(planet.background);
 hemi.intensity=night?.69:1.74;sun.intensity=night?.38:2.05;
 if(worldM.userData.shader?.uniforms?.uNight)worldM.userData.shader.uniforms.uNight.value=night?1:0;
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
 cameraReady=false;paintTrain(sMeters);updateCamera(1);updateHUD();
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
// Small procedural facade windows, derived from geometry, NOT real surveyed windows.
// Shader keeps one mesh per OSM tile and avoids thousands of WebGL draw calls.
worldM.onBeforeCompile=shader=>{
 shader.uniforms.uNight={value:0};worldM.userData.shader=shader;
 shader.vertexShader=shader.vertexShader.replace("#include <common>",
  "#include <common>\nvarying vec3 vCityWorld;");
 shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",
  "#include <begin_vertex>\nvCityWorld = (modelMatrix * vec4(position,1.0)).xyz;");
 shader.fragmentShader=shader.fragmentShader.replace("#include <common>",
  "#include <common>\nvarying vec3 vCityWorld;\nuniform float uNight;");
 shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
  "#include <color_fragment>\\nvec3 wallN = normalize(cross(dFdx(vCityWorld), dFdy(vCityWorld)));\\nfloat facade = 1.0-step(.43,abs(wallN.y));\\nfloat across = abs(wallN.x)>abs(wallN.z) ? vCityWorld.z : vCityWorld.x;\\nfloat floorPattern = fract(vCityWorld.y/3.2);\\nfloat panePattern = fract(across/3.2);\\nfloat pane = step(.12,panePattern)*(1.0-step(.84,panePattern))*step(.28,floorPattern)*(1.0-step(.83,floorPattern));\\nfloat individual = fract(sin(floor(across/3.2)*17.13+floor(vCityWorld.y/3.2)*61.7)*43758.55);\\nfloat isLit = step(.82,individual);\\nvec3 glass = mix(vec3(.075,.16,.205),vec3(.93,.72,.38),isLit*uNight);\\ndiffuseColor.rgb *= mix(1.0,.79+.19*abs(wallN.z),facade);\\ndiffuseColor.rgb = mix(diffuseColor.rgb,glass,facade*pane*.92);\\nfloat sill=step(.88,floorPattern)*(1.0-step(.94,floorPattern))*facade;\\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.51,.55,.54),sill*.80);\\nfloat storefront=facade*(1.0-smoothstep(3.4,4.8,vCityWorld.y));\\nfloat shutter=step(.06,fract(across/3.6))*(1.0-step(.93,fract(across/3.6)));\\nvec3 storeTint=mix(vec3(.17,.24,.27),vec3(.28,.32,.34),fract(sin(across*.15)*53.4));\\ndiffuseColor.rgb=mix(diffuseColor.rgb,storeTint,storefront*shutter*.7);");
};
const facades=["#bdb7ac","#d6b9a3","#c6cbcd","#8cabbc","#c6a390","#bdc9bc","#d1c2ad","#d3b6a4","#9eaaaa","#ded0bb"];
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
  const seed=Math.abs(Math.round(Math.sin(pts[0].x*.11+pts[0].z*.19)*100003));
  const category=Number(rec[2]||0);
  const h=Number(rec[1])>2?Math.min(Number(rec[1]),190):
   (category===1||category===2?19:7.5)+(seed%17)*2.5; // untagged height is an estimate
  const material=new THREE.Color(facades[(seed+category)%facades.length]);
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
// iPhone-friendly adaptive HD: prioritise fluid gameplay, and let the user force resolution.
const qualityButton=$("quality"),maxAuto=Math.min(deviceRatio,mobile?1.65:1.9);
qualityButton.onclick=()=>{
 qualityMode=qualityMode==="auto"?"hd":qualityMode==="hd"?"smooth":"auto";
 qualityButton.textContent=qualityMode==="hd"?"✨ HD":qualityMode==="smooth"?"⚡ Smooth":"✨ Auto HD";
 applyRenderScale(qualityMode==="hd"?Math.min(deviceRatio,mobile?1.8:2.0):
  qualityMode==="smooth"?(mobile?1.0:1.2):Math.min(renderScale,maxAuto));
};
let frameTicks=0,frameTime=performance.now();
const trainAudio=new Audio("assets/audio/train.wav");
trainAudio.loop=true;trainAudio.preload="auto";trainAudio.volume=0;
function updateAdaptive(now){
 frameTicks++;
 if(now-frameTime<2200)return;
 const fps=frameTicks*1000/Math.max(1,now-frameTime);
 frameTicks=0;frameTime=now;
 if(qualityMode==="auto" && running){
  if(fps<36)applyRenderScale(Math.max(.88,renderScale-.12));
  else if(fps>53&&renderScale<maxAuto)applyRenderScale(Math.min(maxAuto,renderScale+.07));
 }
}
function render(){
 const now=performance.now(),dt=Math.min((now-lastUpdate)/1000,.075);lastUpdate=now;
 updateAdaptive(now);
 if(running){
  updatePhysics(dt*rate);paintTrain(sMeters);
  trainAudio.volume=clamp(.035+speed*.004,0,.12);
  trainAudio.playbackRate=clamp(.7+speed*.025,.7,1.35);
  const f=trackAt(sMeters);ground.position.x=f.p.x;ground.position.z=f.p.z;
  for(const ch of trackChunks)ch.group.visible=Math.abs(ch.center-sMeters)<(mobile?1350:1900);
  hdRail.update(sMeters,mobile?1500:1900);
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
paintTrain(sMeters);updateCamera(1);updateHUD();hdRail.update(sMeters,1500);render();
$("start").onclick=()=>{
 $("loading").hidden=true;running=true;lastUpdate=performance.now();jump.value="0";
 trainAudio.play().catch(()=>{});
 uiMessage("Simulator শুরু! Power বাড়াও, স্টেশনের আগে Brake দিয়ে থামাও, তারপর Doors খুলে পয়েন্ট নাও।");
};
window.addEventListener("resize",()=>{
 camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
});
window.MRT6Simulator={get state(){return {positionMeters:sMeters,speedKmh:speed*3.6,nextStation:nextIndex,score,doors,rate}},reset};
