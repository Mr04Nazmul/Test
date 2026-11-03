#!/usr/bin/env node
/**
 * Original low-poly urban transport assets, scaled to approximate real vehicles.
 * Generates self-contained glTF 2.0 models without extra dependencies.
 * These are visual traffic simulations, not vehicles located via GPS.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('assets',{recursive:true});
const palette=[
 ['bus-offwhite','#dfded5',.72],['bus-red','#ab3530',.55],['bus-blue','#29598b',.55],
 ['bus-dark','#26363c',.64],['bus-tinted-glass','#2f5566',.16],
 ['chrome','#a5adb0',.2],['rubber','#212428',.98],['light','#e9e3bf',.14],
 ['road-green','#247b5d',.52],['rickshaw-seat','#80432c',.91],
 ['rickshaw-canopy','#2f8b8c',.7],['rickshaw-pattern','#efba48',.77],
 ['rickshaw-frame','#454f55',.42],['rickshaw-fabric','#b34d63',.78],
 ['car-silver','#aeb6ba',.45],['car-black','#31383d',.73],
 ['tail-light','#bc3036',.45],['orange','#e99e4b',.47],
 ['skin','#a36d50',.95],['clothing','#40647c',.9],['white','#f4f0e1',.8]
];
const mi=n=>palette.findIndex(p=>p[0]===n);
const colors=palette.map(([name,h,r])=>({name,pbrMetallicRoughness:{
 baseColorFactor:[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(1),
 metallicFactor:name==='chrome'?.6:name.includes('glass')?.15:0,
 roughnessFactor:r},doubleSided:true}));
const pos=[],normals=[],indices=[];
for(const [quad,n] of [
 [[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[0,0,1]],
 [[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],[0,0,-1]],
 [[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],[-1,0,0]],
 [[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],[1,0,0]],
 [[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],[0,1,0]],
 [[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],[0,-1,0]]
]){
 const start=pos.length/3;
 quad.forEach(v=>{pos.push(...v);normals.push(...n)});
 indices.push(start,start+1,start+2,start,start+2,start+3);
}
const wheelPositions=[],wheelNormals=[],wheelIndices=[];
const sides=16;
for(let k=0;k<sides;k++){
 const a=2*Math.PI*k/sides,b=2*Math.PI*(k+1)/sides;
 const ca=Math.cos(a)*.5,sa=Math.sin(a)*.5,cb=Math.cos(b)*.5,sb=Math.sin(b)*.5;
 // Axis X; radius in YZ plane
 const faces=[
  [[-.5,ca,sa],[.5,ca,sa],[.5,cb,sb],[-.5,cb,sb]],
  [[.5,0,0],[.5,ca,sa],[.5,cb,sb]],
  [[-.5,0,0],[-.5,cb,sb],[-.5,ca,sa]]
 ];
 for(const q of faces){
  const start=wheelPositions.length/3;
  for(const v of q){wheelPositions.push(...v);wheelNormals.push(q.length===4?0:(q===faces[1]?1:-1),q.length===4?(v[1]*2):0,q.length===4?(v[2]*2):0)}
  if(q.length===4)wheelIndices.push(start,start+1,start+2,start,start+2,start+3);
  else wheelIndices.push(start,start+1,start+2);
 }
}
function model(file,build){
 const parts=[];
 const b=(name,mat,x,y,z,sx,sy,sz,rot=0)=>parts.push({name,mat,translation:[x,y,z],scale:[sx,sy,sz],rotation:[0,0,Math.sin(rot/2),Math.cos(rot/2)],geometry:'box'});
 const wheel=(name,mat,x,y,z,sx,diam)=>parts.push({name,mat,translation:[x,y,z],scale:[sx,diam,diam],rotation:[0,0,0,1],geometry:'wheel'});
 build(b,wheel);
 const chunks=[],bufferViews=[],accessors=[];let off=0;
 function buffer(a,type){
  const typed=type===5126?new Float32Array(a):new Uint16Array(a),buf=Buffer.from(typed.buffer);
  const view=bufferViews.push({buffer:0,byteOffset:off,byteLength:buf.length})-1;
  chunks.push(buf);off+=buf.length;return view;
 }
 function acc(v,type,n,bounds=false){
  const a={bufferView:buffer(v,type),componentType:type,count:v.length/n,type:n===3?'VEC3':'SCALAR'};
  if(bounds){a.min=[-.5,-.5,-.5];a.max=[.5,.5,.5]}
  return accessors.push(a)-1;
 }
 const bp=acc(pos,5126,3,true),bn=acc(normals,5126,3),bi=acc(indices,5123,1);
 const wp=acc(wheelPositions,5126,3,true),wn=acc(wheelNormals,5126,3),wi=acc(wheelIndices,5123,1);
 const meshes=[],lookup=new Map();
 function mesh(kind,material){
  const key=kind+'/'+material;
  if(lookup.has(key))return lookup.get(key);
  const index=meshes.push({name:key,primitives:[{attributes:{POSITION:kind==='box'?bp:wp,NORMAL:kind==='box'?bn:wn},indices:kind==='box'?bi:wi,material:mi(material),mode:4}]})-1;
  lookup.set(key,index);return index;
 }
 const nodes=parts.map(p=>({name:p.name,mesh:mesh(p.geometry,p.mat),translation:p.translation,rotation:p.rotation,scale:p.scale}));
 const binary=Buffer.concat(chunks);
 const gltf={asset:{version:'2.0',generator:'original Dhaka traffic 3D asset generator'},
  scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:colors,
  buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],bufferViews,accessors,
  extras:{visualisation:'traffic simulation only, no real-time or GPS identity',name:file,partCount:nodes.length}};
 writeFileSync('assets/'+file+'.gltf',JSON.stringify(gltf));
 console.log(file+': '+nodes.length+' parts');
}
model('dhaka-bus',(b,w)=>{
 b('body','bus-offwhite',0,1.58,0,2.46,2.25,10.2);
 b('lower-red-panel','bus-red',0,.92,0,2.48,.91,10.25);
 b('upper-blue-stripe','bus-blue',0,2.72,0,2.50,.16,10.25);
 b('window-wide-front','bus-tinted-glass',0,2.15,5.13,2.14,1.22,.1);
 b('rear-window','bus-tinted-glass',0,2.18,-5.13,2.0,1.04,.10);
 b('roof-air-unit','chrome',0,2.91,-1.2,1.6,.21,2.5);
 for(const side of [-1,1]){
  for(let z=-3.8;z<=3.8;z+=1.7){
   b('side-window-'+side+'-'+z,'bus-tinted-glass',side*1.252,2.22,z,.065,1.0,1.44);
   b('vertical-divider-'+side+'-'+z,'chrome',side*1.295,2.22,z+.71,.072,1.04,.06);
  }
  b('side-paint-sweep-'+side,'bus-blue',side*1.26,1.08,0,.035,.27,10.15);
  for(const z of [-3.25,3.25]){
   w('rear-tyre-'+side+'-'+z,'rubber',side*1.21,.51,z,.29,1.06);
   w('chrome-hub-'+side+'-'+z,'chrome',side*1.395,.51,z,.04,.49);
  }
  b('side-mirror-'+side,'bus-dark',side*1.34,2.48,4.76,.16,.34,.36);
 }
 b('front-destination-board','bus-dark',0,2.8,5.24,1.36,.34,.055);
 b('front-bumper','chrome',0,.55,5.22,2.38,.21,.17);
 for(const x of [-.91,.91]){
  b('front-headlamp-'+x,'light',x,1.08,5.24,.3,.18,.07);
  b('rear-light-'+x,'tail-light',x,1.0,-5.24,.25,.36,.07);
 }
});
model('dhaka-rickshaw',(b,w)=>{
 b('rear-axle','rickshaw-frame',0,.62,-.65,1.8,.10,.1);
 b('passenger-platform','rickshaw-frame',0,1.17,-.65,1.36,.13,1.45);
 b('passenger-cushion','rickshaw-seat',0,1.34,-.94,1.22,.27,.68);
 b('backrest','rickshaw-seat',0,1.93,-1.45,1.30,1.06,.17);
 b('leg-space','rickshaw-frame',0,.79,.22,1.12,.08,1.22);
 b('canopy-front','rickshaw-canopy',0,2.64,-.02,1.85,.18,.46);
 b('canopy-rear','rickshaw-canopy',0,2.52,-1.46,1.88,.17,.48);
 b('canopy-summit','rickshaw-canopy',0,2.78,-.76,1.9,.24,1.55);
 b('canopy-trim','rickshaw-pattern',0,2.56,.33,1.85,.14,.24);
 for(const side of [-1,1]){
  w('spoked-rear-wheel-'+side,'rubber',side*.91,.65,-.83,.12,1.27);
  w('rear-hub-'+side,'chrome',side*.99,.65,-.83,.06,.28);
  b('canopy-side-post-'+side,'rickshaw-frame',side*.89,1.98,-1.37,.075,1.27,.1);
  b('side-decoration-'+side,'rickshaw-pattern',side*.73,1.28,-1.48,.08,.11,1.03);
  b('side-handhold-'+side,'chrome',side*.64,1.55,.07,.08,.11,1.16);
 }
 b('front-fork','rickshaw-frame',0,.87,1.56,.12,1.22,.11);
 w('front-wheel','rubber',0,.45,1.65,.15,.9);
 b('handlebar','chrome',0,1.63,1.49,1.15,.08,.11);
 b('driver-torso','clothing',0,1.62,.98,.54,.72,.36);
 b('driver-head','skin',0,2.2,1.04,.34,.37,.34);
});
model('dhaka-car',(b,w)=>{
 b('bottom-car-body','car-silver',0,.85,0,1.82,.88,4.25);
 b('upper-cabin','car-silver',0,1.45,-.14,1.52,.70,2.35);
 b('windscreen','bus-tinted-glass',0,1.55,1.1,1.34,.62,.12);
 b('rear-windscreen','bus-tinted-glass',0,1.55,-1.36,1.28,.6,.1);
 b('grill','car-black',0,.78,2.17,1.3,.26,.07);
 b('front-plate','white',0,.55,2.21,.55,.12,.07);
 for(const side of [-1,1]){
  for(const z of [-1.35,1.3]){
   w('tyre-'+side+'-'+z,'rubber',side*.90,.48,z,.20,.85);
   w('rim-'+side+'-'+z,'chrome',side*1.035,.48,z,.045,.43);
  }
  for(const z of [-.65,.53])b('door-window-'+side+'-'+z,'bus-tinted-glass',side*.79,1.54,z,.065,.43,.89);
  b('door-handle-'+side,'chrome',side*.932,1.06,.5,.04,.07,.35);
  b('headlamp-'+side,'light',side*.68,.91,2.16,.31,.16,.1);
  b('tail-lamp-'+side,'tail-light',side*.69,.91,-2.17,.3,.16,.1);
 }
});

model('dhaka-motorcycle',(b,w)=>{
  // Lightweight original two-wheeled motorcycle plus rider, moving only in simulation.
  for(const z of [-.93,.93]){
    w('motorcycle-tire-'+z,'rubber',0,.45,z,.20,.91);
    w('motorcycle-hub-'+z,'chrome',.13,.45,z,.045,.46);
  }
  b('bike-main-frame','car-black',0,.93,0,.42,.31,1.95);
  b('fuel-tank','bus-red',0,1.08,.28,.64,.42,.78);
  b('seat','rubber',0,1.15,-.56,.52,.17,.92);
  b('rear-lamp','tail-light',0,.88,-1.12,.34,.16,.13);
  b('headlight','light',0,1.09,1.07,.33,.27,.18);
  b('front-fork','chrome',0,.84,.89,.13,.88,.13);
  b('rear-shock','chrome',0,.84,-.84,.12,.66,.13);
  b('handle-bar','chrome',0,1.45,.75,1,.08,.12);
  b('driver-torso','clothing',0,1.68,-.22,.65,.76,.42);
  b('driver-head','skin',0,2.23,.01,.35,.42,.34);
  b('driver-helmet','bus-dark',0,2.48,.01,.43,.20,.44);
  for(const side of [-1,1]){
    b('handle-grip-'+side,'rubber',side*.48,1.44,.75,.2,.12,.12);
    b('rider-arm-'+side,'skin',side*.41,1.50,.31,.17,.48,.18);
    b('rider-leg-'+side,'car-black',side*.25,1.03,-.40,.20,.67,.24);
  }
});
