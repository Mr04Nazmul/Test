#!/usr/bin/env node
/**
 * MRT-6 realistic-looking architectural roof and facade detail pass.
 *
 * Building footprints: cached OSM polygons, © OpenStreetMap contributors ODbL.
 * Roof equipment, ACs, shop fascia and balcony geometry: original illustrative
 * procedural reconstruction ONLY, not building-specific surveyed observations.
 *
 * Coordinate conversion exactly matches scripts/build-urban-models.mjs so props
 * align with the already published geo-anchored buildings.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd(),output=join(root,'assets','rooftops');
mkdirSync(output,{recursive:true});
const route=JSON.parse(readFileSync(join(root,'data','mrt6-track.js'),'utf8').split('window.MRT_TRACK=')[1].trim().replace(/;\s*$/,''));
const materialColors=[
 ['black-plastic','#272d31'],['blue-plastic','#366d96'],['stair-core','#b2a89b'],
 ['ac-metal','#a7b5b6'],['ac-vent','#495c61'],['solar-dark','#244660'],
 ['steel-railing','#707c80'],['brick-rooftop','#a6745f'],
 ['green-awning','#31795b'],['red-awning','#b34c4a'],
 ['yellow-awning','#cead57'],['facade-banner','#ded0b5']
];
const materials=materialColors.map(([name,h])=>({name,doubleSided:true,pbrMetallicRoughness:{
 baseColorFactor:[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(1),
 metallicFactor:name.includes('metal')?.24:0.02,roughnessFactor:name==='solar-dark'?.43:.87
}}));
const groups=materials.map(()=>({p:[],n:[],ind:[]}));
const mat=n=>materialColors.findIndex(p=>p[0]===n);
let gNow=groups,counts;
function box(name,x,y,z,sx,sy,sz,rot=0){
 if(sx<.01||sy<.01||sz<.01)return;
 const g=gNow[mat(name)],c=Math.cos(rot),s=Math.sin(rot);
 const half=[sx/2,sy/2,sz/2],min=[-half[0],-half[1],-half[2]],max=half;
 const faces=[
  [[min[0],min[1],max[2]],[max[0],min[1],max[2]],[max[0],max[1],max[2]],[min[0],max[1],max[2]]],
  [[max[0],min[1],min[2]],[min[0],min[1],min[2]],[min[0],max[1],min[2]],[max[0],max[1],min[2]]],
  [[min[0],min[1],min[2]],[min[0],min[1],max[2]],[min[0],max[1],max[2]],[min[0],max[1],min[2]]],
  [[max[0],min[1],max[2]],[max[0],min[1],min[2]],[max[0],max[1],min[2]],[max[0],max[1],max[2]]],
  [[min[0],max[1],max[2]],[max[0],max[1],max[2]],[max[0],max[1],min[2]],[min[0],max[1],min[2]]],
  [[min[0],min[1],min[2]],[max[0],min[1],min[2]],[max[0],min[1],max[2]],[min[0],min[1],max[2]]]
 ];
 for(const face of faces){
  const start=g.p.length/3;
  const [a,b,d]=face;
  const ux=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],vx=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
  const cross=[ux[1]*vx[2]-ux[2]*vx[1],ux[2]*vx[0]-ux[0]*vx[2],ux[0]*vx[1]-ux[1]*vx[0]];
  const l=Math.hypot(...cross)||1,nn=cross.map(v=>v/l);
  for(const p of face){
   g.p.push(x+c*p[0]+s*p[2],y+p[1],z-s*p[0]+c*p[2]);
   g.n.push(c*nn[0]+s*nn[2],nn[1],-s*nn[0]+c*nn[2]);
  }
  g.ind.push(start,start+1,start+2,start,start+2,start+3);
 }
}
function tank(name,x,z,height){
 const sides=10,r=.67;
 const g=gNow[mat(name)];
 for(let k=0;k<sides;k++){
  const a=k*2*Math.PI/sides,b=(k+1)*2*Math.PI/sides;
  const nx=Math.cos(a),nz=Math.sin(a),mx=Math.cos(b),mz=Math.sin(b),base=g.p.length/3;
  for(const [px,py,pz,normalX,normalZ] of [
   [nx*r,height+.08,nz*r,nx,nz],[mx*r,height+.08,mz*r,mx,mz],
   [mx*r,height+1.56,mz*r,mx,mz],[nx*r,height+1.56,nz*r,nx,nz]
  ]){g.p.push(x+px,py,z+pz);g.n.push(normalX,0,normalZ)}
  g.ind.push(base,base+1,base+2,base,base+2,base+3);
 }
 box('steel-railing',x,height+.25,z,1.6,.1,1.6);
 box(name,x,height+1.65,z,1.34,.14,1.34);counts.tank++;
}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function area(p){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1]}return s*.5}
function pointDistToSegment(p,a,b){const vx=b[0]-a[0],vz=b[1]-a[1],len=vx*vx+vz*vz||1,t=clamp(((p[0]-a[0])*vx+(p[1]-a[1])*vz)/len,0,1);return Math.hypot(p[0]-(a[0]+t*vx),p[1]-(a[1]+t*vz))}
function nearTrack(p,track){
 for(let i=1;i<track.length;i++){const a=track[i-1],b=track[i];
  if(Math.min(Math.abs(a[0]-p[0]),Math.abs(b[0]-p[0]))>140&&Math.min(Math.abs(a[1]-p[1]),Math.abs(b[1]-p[1]))>140)continue;
  if(pointDistToSegment(p,a,b)<26)return true;
 }
 return false;
}
function decorateBuilding(item,station,center,track){
 if(!Array.isArray(item.p)||item.p.length<4)return;
 const [lon,lat]=center,lonScale=111320*Math.cos(lat*Math.PI/180),latScale=111320;
 const p=item.p.map(([lng,lt])=>[-(lt-lat)*latScale,(lng-lon)*lonScale]);
 if(p.length>3&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.15)p.pop();
 if(p.length<3||Math.abs(area(p))<10||p.length>145)return;
 const centroid=p.reduce((s,q)=>[s[0]+q[0]/p.length,s[1]+q[1]/p.length],[0,0]);
 if(nearTrack(centroid,track))return;
 const xs=p.map(v=>v[0]),zs=p.map(v=>v[1]);
 const width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...zs)-Math.min(...zs);
 if(width<4.5||depth<4.5||width>150||depth>150)return;
 const seed=Math.abs(Number(item.id)||item.p.length*98761);
 const h=Number(item.h),known=item.h!==null&&item.h!==undefined&&Number.isFinite(h)&&h>1;
 const height=clamp(known?h:8+(seed%9)*3.15,4.4,110);
 const x=centroid[0],z=centroid[1];
 if(seed%3===0){
  tank(seed%2?'blue-plastic':'black-plastic',x,z,height);counts.buildings++;
 }
 if(seed%5===0&&width>7&&depth>7){
  const xx=x+Math.min(1.2,width/6),zz=z+Math.min(1,depth/7);
  box('ac-metal',xx,height+.41,zz,1.55,.73,1.2);
  box('ac-vent',xx+.02,height+.56,zz+.62,1.30,.40,.06);counts.ac++;
 }
 if(seed%7===0&&width>8&&depth>8){
  box('stair-core',x,height+1.08,z,2.5,2.16,2.75);
  box('brick-rooftop',x,height+2.25,z,2.65,.19,2.9);counts.stair++;
 }
 if(seed%11===0&&width>8&&depth>8){
  box('steel-railing',x-1.2,height+.27,z+.8,3.4,.12,2.3);
  box('solar-dark',x-1.2,height+.43,z+.8,3.1,.11,2.02,.18);counts.solar++;
 }
 if(seed%4!==0||height<9)return;
 let longest=null;const ccw=area(p)>0;
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len>5&&(!longest||longest.len<len))longest={a,b,dx,dz,len};
 }
 if(!longest)return;
 const e=longest,normal=[(ccw?1:-1)*e.dz/e.len,(ccw?-1:1)*e.dx/e.len];
 const mx=(e.a[0]+e.b[0])/2,mz=(e.a[1]+e.b[1])/2,yaw=Math.atan2(e.dx,e.dz);
 if(!nearTrack([mx+normal[0]*2,mz+normal[1]*2])){
  const len=Math.min(8,e.len*.70);
  // Shop sign and awning use blank color blocks, no fictional real business labels.
  box('facade-banner',mx+normal[0]*.25,3.35,mz+normal[1]*.25,len,.59,.15,yaw);
  box(['green-awning','red-awning','yellow-awning'][seed%3],
   mx+normal[0]*.91,3.7,mz+normal[1]*.91,len+.26,.13,1.45,yaw);
  counts.shops++;
 }
}
function make(i){
 const city=JSON.parse(readFileSync(join(root,'data','buildings',i+'.json'),'utf8')),station=route.stations[i];
 const center=city.center||[station.lon,station.lat];
 const lonScale=111320*Math.cos(center[1]*Math.PI/180);
 const track=route.points.map(([lat,lon])=>[-(lat-center[1])*111320,(lon-center[0])*lonScale]);
 gNow=materialColors.map(()=>({p:[],n:[],ind:[]}));
 counts={buildings:0,tank:0,stair:0,ac:0,solar:0,shops:0};
 for(const item of (city.buildings||[]).slice(0,450))decorateBuilding(item,i,center,track);
 // Keep an intentionally invisible valid glTF placeholder if OSM data is too
 // sparse for any rooftop details; never invent a mapped building location.
 const noMappedDetails=!gNow.some(g=>g.ind.length);
 if(noMappedDetails)box('stair-core',0,-1000,0,.05,.05,.05);
 const buffers=[],views=[],accessors=[],primitives=[];let off=0,triangles=0;
 function add(v,type,size,bounds=false){
  const b=type===5126?Buffer.from(new Float32Array(v).buffer):Buffer.from(new Uint32Array(v).buffer);
  const view=views.push({buffer:0,byteOffset:off,byteLength:b.length})-1;buffers.push(b);off+=b.length;
  const acc={bufferView:view,componentType:type,count:v.length/size,type:size===3?'VEC3':'SCALAR'};
  if(bounds){acc.min=[Infinity,Infinity,Infinity];acc.max=[-Infinity,-Infinity,-Infinity];
   for(let n=0;n<v.length;n++){acc.min[n%3]=Math.min(acc.min[n%3],v[n]);acc.max[n%3]=Math.max(acc.max[n%3],v[n])}}
  return accessors.push(acc)-1;
 }
 for(let i=0;i<gNow.length;i++){const g=gNow[i];if(!g.ind.length)continue;
  const p=add(g.p,5126,3,true),n=add(g.n,5126,3),id=add(g.ind,5125,1);
  primitives.push({attributes:{POSITION:p,NORMAL:n},indices:id,material:i});triangles+=g.ind.length/3;
 }
 if(!primitives.length)return null;
 const binary=Buffer.concat(buffers);
 const gltf={asset:{version:'2.0',generator:'original MRT-6 OSM anchored rooftop details'},
 scene:0,scenes:[{nodes:[0]}],nodes:[{name:'OSM-anchored illustrative rooftops, façades and shop awnings',mesh:0}],
 meshes:[{primitives}],materials,
 buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],
 bufferViews:views,accessors,extras:{station:i,footprintsSource:city.buildings.length,
 detailCounts:{...counts},noMappedDetails,triangles,
 attribution:'© OpenStreetMap contributors ODbL 1.0',
 warning:'Building footprints from OSM; architectural fixtures and signage are estimates, not surveyed observations'}};
 writeFileSync(join(output,i+'.gltf'),JSON.stringify(gltf));
 return {station:i,...counts,triangles};
}
const models=[];
for(let i=0;i<route.stations.length;i++){
 if(!existsSync(join(root,'data','buildings',i+'.json')))continue;
 const m=make(i);if(m)models.push(m);
}
writeFileSync(join(output,'manifest.json'),JSON.stringify({generator:'scripts/build-urban-rooftops.mjs',
 provenance:'OSM building footprints, procedural illustrative rooftop fixtures',
 models},null,2));
console.log('OSM-anchored roof assets:',models.length,'stations;',models.map(m=>m.station+':'+m.triangles).join(', '));
