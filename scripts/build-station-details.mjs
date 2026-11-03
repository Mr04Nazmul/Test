#!/usr/bin/env node
/**
 * Original, lightweight, real-colour-inspired MRT-6 3D platform, concourse
 * and below-station furniture for every station. NOT an architectural survey.
 * No Google imagery, textures, or third-party model assets are extracted.
 */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const stations=JSON.parse(readFileSync('data/mrt6-track.js','utf8').split('window.MRT_TRACK=')[1].trim().replace(/;\s*$/,'')).stations;
mkdirSync('assets/station-detail',{recursive:true});
const palette=[
 ['concrete','#b6b9b7'],['floor-tile','#c7c7bd'],['white-ceiling','#d5d9d7'],
 ['yellow-tactile','#e5c23e'],['green-steel','#317562'],['red-brick','#ad7362'],
 ['glass-blue','#729eaf'],['dark-glass','#344b5b'],['steel','#8c9597'],
 ['ticket-gate','#516f76'],['screen-black','#202d36'],['screen-cyan','#5ac7dc'],
 ['bench-blue','#426a81'],['warm-light','#efe1ba'],['escalator-black','#343b43'],
 ['yellow-sign','#e4ca66'],['floor-grey','#8b9695'],['red-detail','#bf6456']
];
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(1);
const materials=palette.map(([name,col])=>({name,pbrMetallicRoughness:{baseColorFactor:rgb(col),roughnessFactor:name==='glass-blue'||name==='dark-glass'?.32:.78,metallicFactor:name==='steel'?.5:.06},doubleSided:true}));
const boxFaces=[
 [[0,1,2,3],[0,0,-1]],[[5,4,7,6],[0,0,1]],
 [[4,0,3,7],[-1,0,0]],[[1,5,6,2],[1,0,0]],
 [[3,2,6,7],[0,1,0]],[[4,5,1,0],[0,-1,0]]
];
function station(id){
 const groups=palette.map(()=>({p:[],n:[],i:[]}));let parts=0;
 const box=(mat,x,y,z,w,h,d)=>{
  const g=groups[palette.findIndex(v=>v[0]===mat)],sx=w/2,sy=h/2,sz=d/2;
  const p=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]];
  for(const [face,norm] of boxFaces){
   const first=g.p.length/3;
   for(const q of face){const a=p[q];g.p.push(x+a[0],y+a[1],z+a[2]);g.n.push(...norm)}
   g.i.push(first,first+1,first+2,first,first+2,first+3);
  }
  parts++;
 };
 const modern=id>=12||id<=2,market=[3,4,5,10,11,15].includes(id),campus=id===13;
 const seats=market?8:campus?5:6;
 // Ticket concourse: a raised tile floor with rows of turnstiles, all in 3D.
 // These are inset into the station rather than obstructing the train guideway.
 box('floor-tile',0,14.16,0,24.0,.12,117);
 for(const z of [-29,29]){
  for(let x=-8.7;x<=8.7;x+=2.9){
   box('ticket-gate',x,14.78,z,.62,1.18,1.58);
   box('green-steel',x,15.43,z,.42,.10,.82);
   box('screen-cyan',x,15.49,z,.24,.035,.40);
   box('steel',x+.42,14.96,z+.48,.62,.055,.16);
   box('steel',x-.42,14.96,z-.48,.62,.055,.16);
  }
  box('dark-glass',-12.2,16.25,z,3.2,2.45,4.4);
  box('screen-cyan',-10.53,16.47,z,.05,.63,2.1);
  box('red-brick',12.1,15.6,z,3.1,2.6,4.7);
  box('white-ceiling',12.2,16.97,z,3.4,.12,5.1);
 }
 // Ticket counters, information screens, pillars and ceiling lightbars.
 for(const z of [-44,44]){
  box('ticket-gate',7.7,14.91,z,5.8,1.43,1.7);
  box('glass-blue',7.7,16.55,z,5.7,1.7,.10);
  for(const x of [-9.5,-3.2,3.1,9.4]){
   box('warm-light',x,17.95,z,2.9,.11,1.3);
   box('white-ceiling',x,18.08,z,3.05,.085,1.45);
  }
  box('screen-black',0,17.05,z,8.2,1.1,.14);
  box('screen-cyan',0,17.08,z+0.081,5.3,.17,.035);
 }
 // Platform-edge tactile strips and half-height safety screens.
 for(const side of [-1,1]){
  box('yellow-tactile',side*5.75,19.18,0,.44,.09,125);
  for(let z=-60;z<=60;z+=6){
   box('steel',side*5.90,19.72,z,.095,1.12,.095);
   box('glass-blue',side*5.91,19.80,z+2.9,.055,1.14,5.72);
  }
  for(let j=0;j<seats;j++){
   const z=-51+j*(102/Math.max(1,seats-1));
   box('bench-blue',side*10.4,19.73,z,1.6,.22,2.4);
   box('steel',side*10.4,19.40,z,1.25,.48,.14);
   box('steel',side*10.4,19.40,z+1.0,1.25,.48,.14);
   box('bench-blue',side*11.08,20.15,z,.15,.76,2.4);
  }
  for(const z of [-42,0,42]){
   box('screen-black',side*12.83,23.7,z,.24,1.1,4.3);
   box('screen-cyan',side*12.67,23.80,z,.06,.14,3.45);
   box('yellow-sign',side*12.79,22.87,z,.14,.14,3.6);
  }
  for(let z=-55;z<=55;z+=11){
   box('warm-light',side*10.3,27.15,z,2.1,.10,5.4);
  }
 }
 // Road-level entrances: stairs, glass rail, roof canopies, traffic-facing shade.
 // Outside under-viaduct geometry is illustrative; exact locations vary.
 for(const side of [-1,1]){
  for(const z of [-38,38]){
   const x=side*43.6;
   box('floor-grey',x,.12,z,7.3,.24,10.3);
   for(let step=0;step<14;step++){
    box('concrete',x-side*2.1+side*(step*.30),.32+step*.22,z,3.5,.15,.45);
   }
   for(const edge of [-1,1]){
    box('steel',x,3.15,z+edge*4.2,.12,5.9,.16);
    box('glass-blue',x,2.45,z+edge*3.75,7.0,3.4,.09);
   }
   box('green-steel',x,6.42,z,11.2,.27,11.2);
   box('white-ceiling',x,6.18,z,10.9,.11,10.9);
   box('screen-black',x,5.6,z+5.3,6.1,.65,.12);
   box('warm-light',x,5.64,z+5.38,5.6,.08,.035);
  }
 }
 // Colored local information walls vary by broad neighborhood type.
 const facing=modern?'glass-blue':market?'red-brick':'concrete';
 for(const z of [-58,58]){
  box(facing,0,15.9,z,6.9,2.6,.34);
  box('green-steel',0,17.15,z,7.4,.14,.46);
  box('screen-black',0,16.04,z+.26,4.5,.72,.05);
 }
 const bufs=[],views=[],accessors=[],primitives=[];let total=0,triangles=0;
 const push=(arr,isFloat,n,bounds=false)=>{
  const a=isFloat?new Float32Array(arr):new Uint32Array(arr),b=Buffer.from(a.buffer),index=views.length;
  views.push({buffer:0,byteOffset:total,byteLength:b.length,target:isFloat?34962:34963});total+=b.length;bufs.push(b);
  const ac={bufferView:index,componentType:isFloat?5126:5125,count:arr.length/n,type:n===3?'VEC3':'SCALAR'};
  if(bounds){ac.min=[Infinity,Infinity,Infinity];ac.max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<arr.length;k++){const q=k%3;ac.min[q]=Math.min(ac.min[q],arr[k]);ac.max[q]=Math.max(ac.max[q],arr[k]);}}
  accessors.push(ac);return accessors.length-1;
 };
 for(let mi=0;mi<groups.length;mi++){
  const g=groups[mi];if(!g.i.length)continue;
  const p=push(g.p,true,3,true),n=push(g.n,true,3),idx=push(g.i,false,1);
  primitives.push({attributes:{POSITION:p,NORMAL:n},indices:idx,material:mi,mode:4});triangles+=g.i.length/3;
 }
 const binary=Buffer.concat(bufs);
 const gltf={asset:{version:'2.0',generator:'MRT-6 original layered station environment'},
 scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Station interior and street-level illustrative furniture',mesh:0}],
 meshes:[{primitives}],materials,buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],
 bufferViews:views,accessors,
 extras:{station:id,stationName:stations[id].n,parts,triangles,levelCount:3,
  modelledLevels:['street entrance','concourse gates','elevated platform'],
  scope:'original photo-colour-inspired approximate reconstruction, not measured plans or real-time data'}};
 writeFileSync('assets/station-detail/'+id+'.gltf',JSON.stringify(gltf));
 console.log(id,stations[id].n,parts+' shapes',triangles+' triangles');
}
for(let i=0;i<stations.length;i++)station(i);
