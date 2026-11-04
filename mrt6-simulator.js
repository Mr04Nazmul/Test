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
   (category===1||category===2?19:7.5)+(seed%17)*2.5; // unknown height is an estimate
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
