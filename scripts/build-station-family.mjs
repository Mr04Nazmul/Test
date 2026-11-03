#!/usr/bin/env node
/**
 * Original visually approximate MRT-6 station family for the 13 stops which
 * do not already have distinct Agargaon / Farmgate / Dhaka University models.
 * Elevation, cladding and roof geometry are concept studies, NOT surveys.
 * Batch repeated architecture into material groups for mobile Cesium.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const route=JSON.parse(readFileSync('data/mrt6-track.js','utf8').split('window.MRT_TRACK=')[1].trim().replace(/;\s*$/,''));
mkdirSync('assets/stations',{recursive:true});
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(1);
const palette=[
 ['mrt-concrete','#b9bcb8',.91],['aged-concrete','#999d9d',.95],
 ['brick-bangladesh','#9b6757',.87],['brick-trim','#c6a296',.94],
 ['green-roof','#2d7260',.53],['dark-green-edge','#256252',.46],
 ['steel-truss','#61707a',.54],['roof-slat','#6e9284',.58],
 ['glass-blue','#6c92a1',.29],['glass-dark','#3c5b68',.27],
 ['white-panel','#e4e5df',.72],['yellow-tactile','#e6c34e',.83],
 ['stair-grey','#a2a9a7',.87],['rail-steel','#798b91',.51],
 ['dark-grid','#394950',.56],['red-panel','#9e5446',.78]
];
const indexOf=k=>palette.findIndex(a=>a[0]===k);
const basePositions=[],baseNormals=[],baseIndices=[];
for(const [p,n] of [
 [[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[0,0,1]],
 [[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],[0,0,-1]],
 [[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],[-1,0,0]],
 [[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],[1,0,0]],
 [[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],[0,1,0]],
 [[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],[0,-1,0]]
]){
 const k=basePositions.length/3;
 for(const v of p){basePositions.push(...v);baseNormals.push(...n)}
 baseIndices.push(k,k+1,k+2,k,k+2,k+3);
}
function output(id){
 const type=id<=2?'north':id<=7?'mirpur':id===9?'office':id>=14?'city':'south';
 const span=type==='city'?148:type==='north'?152:type==='mirpur'?161:150;
 const hue=id%3,roofRaise=id%4===0?.7:0;
 const chunks=palette.map(()=>({p:[],n:[],i:[]}));let parts=0;
 function cub(m,x,y,z,sx,sy,sz,a=0){
  if(Math.min(sx,sy,sz)<=0)throw Error('invalid piece');
  const b=chunks[indexOf(m)],start=b.p.length/3,c=Math.cos(a),s=Math.sin(a);
  for(let k=0;k<basePositions.length;k+=3){
   const px=basePositions[k]*sx,py=basePositions[k+1]*sy,pz=basePositions[k+2]*sz;
   b.p.push(x+px*c-py*s,y+px*s+py*c,z+pz);
   const nx=baseNormals[k],ny=baseNormals[k+1],nz=baseNormals[k+2];
   b.n.push(nx*c-ny*s,nx*s+ny*c,nz);
  }
  for(const i of baseIndices)b.i.push(start+i);
  parts++;
 }
 // Twin piers and open concourse; train track space is left unobstructed.
 for(let z=-66;z<=66;z+=22){
  for(const x of [-9.4,9.4])cub('mrt-concrete',x,6.45,z,1.52,12.9,1.65);
  cub('aged-concrete',0,12.48,z,24.6,.65,1.7);
 }
 cub('aged-concrete',0,13.5,0,27.5,1.1,span-3);
 cub('mrt-concrete',0,17.0,0,25.2,.78,span-2);
 for(const side of [-1,1]){
  cub('mrt-concrete',side*9.5,18.75,0,8.5,.48,span-8);
  cub('yellow-tactile',side*5.15,19.02,0,.38,.055,span-13);
  for(let z=-span/2+9;z<=span/2-9;z+=5.2){
   cub('glass-blue',side*13.45,21.62,z,.13,4.3,4.76);
   cub('rail-steel',side*13.55,21.7,z+2.43,.18,4.5,.12);
   cub('rail-steel',side*13.55,23.85,z,.17,.11,4.8);
  }
  cub('brick-bangladesh',side*14.0,14.27,-span/2+12,.56,3.0,21);
  cub('brick-bangladesh',side*14.0,14.27,span/2-12,.56,3.0,21);
  for(let z=-span/2+24;z<span/2-22;z+=8.0){
   cub('glass-dark',side*13.96,15.25,z,.11,1.7,5.6);
   cub('white-panel',side*14.08,16.2,z,.12,.15,5.6);
  }
 }
 // Curved green roof with many narrow panels; open edges, steel ribs and end caps.
 for(let x=-13.7;x<=13.7;x+=1.1){
  const y=29.1+roofRaise-3*(x/14.5)**2;
  const slope=-6*x/(14.5*14.5);
  cub('green-roof',x,y,0,1.18,.23,span,Math.atan(slope));
  if(Math.round(x*10)%4===0)cub('roof-slat',x,y+.10,0,.07,.07,span);
 }
 cub('dark-green-edge',0,29.3+roofRaise,0,.64,.38,span+1.5);
 for(const side of [-1,1]){
  cub('dark-green-edge',side*14,26.30,0,.44,.55,span+1.3);
  for(let z=-span/2+7;z<span/2-5;z+=8.6){
   cub('steel-truss',side*12.15,24.25,z,.19,6.5,.20);
   cub('steel-truss',side*6.8,27.55,z,.14,.15,14.0);
   cub('steel-truss',side*8.4,27.15,z,.12,1.5,.16,.3*side);
  }
 }
 for(let z=-span/2+3;z<span/2-2;z+=12.4){
  cub('steel-truss',0,26.2,z,24,.18,.18);
  for(let x of [-7,-3.5,3.5,7])cub('steel-truss',x,27.3,z,.12,2.0,.16,x>0?.22:-.22);
 }
 // Elevators, footbridges and stairs: varying placement per station.
 for(const side of [-1,1]){
  const z=(id%2===0?1:-1)*(type==='city'?32:43)*side;
  cub('mrt-concrete',side*29,13.9,z,29,1.0,4.6);
  cub('white-panel',side*29,14.45,z,29,.17,4.3);
  for(const edge of [-1,1]){
   cub('glass-blue',side*29,15.95,z+edge*2.22,29,2.6,.14);
   cub('rail-steel',side*29,17.23,z+edge*2.28,29,.14,.17);
  }
  cub('green-roof',side*29,17.96,z,30,.26,5.7);
  for(let x=18;x<=41;x+=5) cub('rail-steel',side*x,17.24,z,.14,.28,5.2);
  cub('brick-bangladesh',side*45,7.0,z,5.8,14,6.2);
  cub('glass-blue',side*45,7.8,z+side*3.18,4.5,10.4,.14);
  for(let k=0;k<20;k++){
   const stepZ=z+(k-10)*.42;
   cub('stair-grey',side*(44.0+k*.24),.6+k*.56,stepZ,3.8,.16,.48);
  }
 }
 // Glass end panels and cladding make station less like a blank green tube.
 for(const z of [-span/2,span/2]){
  for(const x of [-10.8,-7.4,-4.0,4,7.4,10.8]){
   cub('glass-dark',x,23.0,z,3.0,3.9,.18);
   cub('white-panel',x,20.92,z,3.08,.12,.23);
  }
  cub('red-panel',0,17.85,z,23.0,.58,.33);
 }
 const materials=palette.map(([name,col,rough])=>({name,doubleSided:true,
  pbrMetallicRoughness:{baseColorFactor:hex(col),metallicFactor:name.includes('steel')?.22:.04,roughnessFactor:rough}}));
 const bufs=[],views=[],accessors=[],primitives=[];let length=0,totalTris=0;
 function append(arr,t,n,bounds=false){
  const typed=t===5126?new Float32Array(arr):new Uint32Array(arr),b=Buffer.from(typed.buffer),v=views.length;
  views.push({buffer:0,byteOffset:length,byteLength:b.length,target:t===5126?34962:34963});
  bufs.push(b);length+=b.length;
  const access={bufferView:v,componentType:t,count:arr.length/n,type:n===3?'VEC3':'SCALAR'};
  if(bounds){
   access.min=Array(n).fill(Infinity);access.max=Array(n).fill(-Infinity);
   for(let k=0;k<arr.length;k++){const axis=k%n;access.min[axis]=Math.min(access.min[axis],arr[k]);access.max[axis]=Math.max(access.max[axis],arr[k]);}
  }
  return accessors.push(access)-1;
 }
 for(let m=0;m<chunks.length;m++){
  const g=chunks[m];if(!g.i.length)continue;
  const p=append(g.p,5126,3,true),n=append(g.n,5126,3),ix=append(g.i,5125,1);
  primitives.push({attributes:{POSITION:p,NORMAL:n},indices:ix,material:m,mode:4});totalTris+=g.i.length/3;
 }
 const binary=Buffer.concat(bufs);
 const gltf={asset:{version:'2.0',generator:'Original approximate MRT-6 station family'},
  scene:0,scenes:[{nodes:[0]}],nodes:[{name:'MRT6 station '+id+' concept geometry',mesh:0}],
  meshes:[{name:route.stations[id].n+' original architectural study',primitives}],materials,
  buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],
  bufferViews:views,accessors,
  extras:{station:id,stationName:route.stations[id].n,modelParts:parts,triangles:totalTris,roofPanels:25,
   accuracy:'Illustrative structures; no measured roof, support or stair location data',license:'Original procedural geometry'}};
 writeFileSync('assets/stations/'+id+'.gltf',JSON.stringify(gltf));
 console.log(id,route.stations[id].n,parts+' architectural parts',totalTris+' triangles');
}
for(let id=0;id<route.stations.length;id++)if(![8,10,13].includes(id))output(id);
