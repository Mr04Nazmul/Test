#!/usr/bin/env node
/**
 * Detailed original procedural reconstruction of Farmgate MRT-6 station.
 * Reference features: curved green roof, brick-red concourse, glass screens,
 * elevated platform, concrete pillars and footbridge.
 * NOT measured photogrammetry. No third-party model assets or copied textures.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='assets';mkdirSync(dir,{recursive:true});
const palette=[
 ['concrete','#b6b9b5',.9],['weathered-concrete','#8e9798',.92],
 ['brick-cladding','#8c493c',.92],['brick-mortar','#b08b78',.88],
 ['roof-green','#235e51',.44],['roof-ridge','#537b6c',.45],
 ['steel','#57636c',.45],['reflective-glass','#56859c',.18],
 ['dark-glass','#203946',.16],['white-panel','#e9e7dd',.82],
 ['yellow-warning','#e2b940',.66],['dark-lettering','#162731',.9],
 ['black-asphalt','#3f4449',1],['safety-red','#ad3835',.7],
 ['roof-shadow','#2f5049',.75],['light-metal','#9aa9ad',.46]
];
const hexRGBA=h=>[1,3,5].map(n=>parseInt(h.slice(n,n+2),16)/255).concat(1);
const mats=palette.map(([name,hex,r])=>({name,pbrMetallicRoughness:{baseColorFactor:hexRGBA(hex),metallicFactor:name.includes('steel')?.34:0.04,roughnessFactor:r},doubleSided:true}));
const vertices=[],normals=[],uvs=[],ids=[];
const faces=[
 {p:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],n:[0,0,1]},
 {p:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],n:[0,0,-1]},
 {p:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],n:[-1,0,0]},
 {p:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],n:[1,0,0]},
 {p:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],n:[0,1,0]},
 {p:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],n:[0,-1,0]}
];
for(const f of faces){
 const start=vertices.length/3;
 for(let i=0;i<4;i++){vertices.push(...f.p[i]);normals.push(...f.n);uvs.push(...[[0,0],[1,0],[1,1],[0,1]][i]);}
 ids.push(start,start+1,start+2,start,start+2,start+3);
}
const buffers=[],views=[],accessors=[],binarySize={value:0};
function push(values,kind,component,num,limits=false){
 const arr=kind==='float'?new Float32Array(values):new Uint16Array(values);
 const buf=Buffer.from(arr.buffer);
 const off=binarySize.value;binarySize.value+=buf.length;buffers.push(buf);
 const view=views.push({buffer:0,byteOffset:off,byteLength:buf.length,target:kind==='float'?34962:34963})-1;
 const a={bufferView:view,componentType:component,count:values.length/num,type:num===3?'VEC3':num===2?'VEC2':'SCALAR'};
 if(limits){a.min=Array.from({length:num},(_,j)=>Math.min(...values.filter((_,k)=>k%num===j)));a.max=Array.from({length:num},(_,j)=>Math.max(...values.filter((_,k)=>k%num===j)));}
 return accessors.push(a)-1;
}
const p=push(vertices,'float',5126,3,true),n=push(normals,'float',5126,3),u=push(uvs,'float',5126,2),idx=push(ids,'index',5123,1);
const meshes=mats.map((m,i)=>({name:m.name,primitives:[{attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:u},indices:idx,material:i}]}));
const nodes=[];
const mat=name=>palette.findIndex(m=>m[0]===name);
function part(label,material,x,y,z,sx,sy,sz,theta=0){
 if(Math.min(sx,sy,sz)<=0)throw Error('Negative part '+label);
 const q=[0,0,Math.sin(theta/2),Math.cos(theta/2)];
 nodes.push({name:label,mesh:mat(material),translation:[x,y,z],rotation:q,scale:[sx,sy,sz]});
}
function roof(){
 // Segmented curved roof (arched green metal sheeting) instead of a flat block.
 for(let s=-12;s<=12;s++){
  const x=s*1.11, y=29.65-2.65*(x/14.5)**2;
  const slope=-5.3*x/(14.5*14.5);
  part('curved-green-canopy-'+s,'roof-green',x,y,0,1.18,.25,152,Math.atan(slope));
 }
 part('long-roof-ridge','roof-ridge',0,29.7,0,.65,.39,153);
 for(const x of [-13.7,13.7])part('green-roof-edge-'+x,'roof-ridge',x,27.25,0,.45,.55,154);
 for(let z=-72;z<=72;z+=9){
  for(const x of [-12.3,12.3]){
   part('canopy-post-'+x+'-'+z,'steel',x,24,z,.22,6.9,.24);
   part('green-post-trim-'+x+'-'+z,'light-metal',x,26.9,z,.34,.2,.48);
  }
  part('arched-underside-horizontal-'+z,'steel',0,27,z,24,.12,.18);
  for(const x of [-8,-4,4,8])
   part('diagonal-roof-brace-'+x+'-'+z,'steel',x,27.65-(Math.abs(x)*.1),z,.13,1.7,.15,x>0?.1:-.1);
 }
}
function sign(side,z){
 const x=side*15.25;
 part('farmgate-bilingual-station-nameplate-'+side,'white-panel',x,14.3,z,.20,3.0,21);
 part('nameplate-trim-'+side,'roof-green',x+side*.12,15.78,z,.09,.1,21.2);
 // English signboard is modeled with 5x7 bitmapped relief glyphs.
 const alphabet={F:['11111','10000','11110','10000','10000','10000','10000'],A:['01110','10001','10001','11111','10001','10001','10001'],R:['11110','10001','10001','11110','10100','10010','10001'],M:['10001','11011','10101','10101','10001','10001','10001'],G:['01111','10000','10000','10111','10001','10001','01111'],T:['11111','00100','00100','00100','00100','00100','00100'],E:['11111','10000','10000','11110','10000','10000','11111']};
 const name='FARMGATE',width=.195,gap=.1,unit=.12,letterSpace=6*unit;
 const start=z-(name.length*letterSpace)/2;
 for(let ch=0;ch<name.length;ch++){
  const rows=alphabet[name[ch]];
  for(let r=0;r<7;r++)for(let c=0;c<5;c++)if(rows[r][c]==='1')
   part('sign-letter-'+side+'-'+ch+'-'+r+'-'+c,'dark-lettering',x+side*.145,14.8-r*.25,start+ch*letterSpace+c*unit,.043,.20,unit*.86);
 }
}
function entrance(side,z){
 const x=side*16;
 // Raised pedestrian passage across the road, braced underneath.
 part('footbridge-concrete-'+side,'concrete',side*30,13.7,z,31,1.05,5.2);
 part('footbridge-path-'+side,'white-panel',side*30,14.3,z,31,.14,4.8);
 for(const zSide of [-1,1]){
  part('bridge-side-glass-'+side+'-'+zSide,'reflective-glass',side*30,16.1,z+zSide*2.55,31,2.9,.16);
  part('bridge-side-handrail-'+side+'-'+zSide,'steel',side*30,17.5,z+zSide*2.55,31,.2,.20);
 }
 for(let x1=17;x1<=45;x1+=5){
  part('bridge-rib-'+side+'-'+x1,'steel',side*x1,17.65,z,.13,.3,5.7);
 }
 part('bridge-green-roof-'+side,'roof-green',side*30,18.14,z,31,.33,6.1);
 part('ground-elevator-tower-'+side,'brick-cladding',side*46,7.0,z,6.5,14.0,7.4);
 part('elevator-glass-'+side,'reflective-glass',side*46,8.2,z+(side>0?3.75:-3.75),4.8,10,.16);
 for(let level=0;level<20;level++){
  const zSt=z+(level-10)*.45;
  part('side-stairs-'+side+'-'+level,'concrete',side*(47+level*.23),.6+level*.52,zSt,4,.13,.47);
 }
}
function ground(){
 // Illustrative local lane under/near the viaduct; not surveyed roadway geometry.
 for(const side of [-1,1]){
  part('asphalt-sample-road-'+side,'black-asphalt',side*28,.015,0,20,.06,164);
  part('continuous-sidewalk-'+side,'concrete',side*40,.1,0,3.4,.2,164);
  for(let z=-76;z<79;z+=8){
   part('white-lane-dashes-'+side+'-'+z,'white-panel',side*29,.063,z,.15,.024,2.7);
   part('median-black-white-curbs-'+side+'-'+z,Math.round(z/8)%2===0?'white-panel':'weathered-concrete',side*17.65,.3,z,1.25,.45,7.4);
  }
 }
 // Suspended concourse slab, with ground columns / sunlit side enclosure.
 part('station-mezzanine-floor','weathered-concrete',0,11.65,0,31,1.0,146);
 part('station-lower-concrete-slab','concrete',0,17.75,0,27,1.0,146);
 for(let z=-66;z<=66;z+=22){
  for(const x of [-9.7,9.7]){
   part('main-pier-'+x+'-'+z,'concrete',x,6.3,z,1.5,12.6,1.6);
   part('pier-crossbeam-'+x+'-'+z,'weathered-concrete',x,12.35,z,9,.65,1.4);
  }
  for(const side of [-1,1]){
   part('brick-support-wall-'+side+'-'+z,'brick-cladding',side*14.4,13.6,z,.45,3.5,18.5);
   part('wall-plaster-band-'+side+'-'+z,'brick-mortar',side*14.6,15.35,z,.55,.14,19);
   for(let windowZ=z-7;windowZ<=z+7;windowZ+=4.7)
    part('concourse-glass-pane-'+side+'-'+windowZ,'dark-glass',side*14.7,16.9,windowZ,.22,2.5,3.4);
  }
 }
 for(const side of [-1,1]){
  // Platform edge and tactile safety strip sit outside the two live tracks.
  part('platform-'+side,'concrete',side*9.5,18.75,0,9,.47,145);
  part('yellow-tactile-'+side,'yellow-warning',side*5.2,19.02,0,.32,.037,143);
  for(let z=-68;z<=68;z+=8.5){
   part('glass-side-wall-'+side+'-'+z,'reflective-glass',side*14.5,22,z,.16,4.3,7.4);
   part('glass-vertical-frame-'+side+'-'+z,'steel',side*14.6,22,z+3.65,.19,4.45,.17);
  }
 }
}
ground();roof();sign(-1,2);sign(1,-2);entrance(-1,-39);entrance(1,39);
// Bake hundreds of separate cubic components into one batched glTF mesh.
// Material batching dramatically reduces draw calls on mobile WebGL/Cesium.
// This preserves all source architectural parts and visual colors.
const originalPartCount=nodes.length;
const groups=mats.map(()=>({positions:[],normals:[],indices:[]}));
for(const piece of nodes){
 const g=groups[piece.mesh],scale=piece.scale,offset=piece.translation,
  angle=2*Math.atan2(piece.rotation[2],piece.rotation[3]),cs=Math.cos(angle),sn=Math.sin(angle);
 const start=g.positions.length/3;
 for(let v=0;v<vertices.length;v+=3){
  const lx=vertices[v]*scale[0],ly=vertices[v+1]*scale[1],lz=vertices[v+2]*scale[2];
  g.positions.push(offset[0]+lx*cs-ly*sn,offset[1]+lx*sn+ly*cs,offset[2]+lz);
  const nx=normals[v],ny=normals[v+1],nz=normals[v+2];
  g.normals.push(nx*cs-ny*sn,nx*sn+ny*cs,nz);
 }
 for(const id of ids)g.indices.push(start+id);
}
const data=[],viewsOut=[],accessorsOut=[],primitives=[];
let byteOffset=0;
function append(dataArray,componentType,components,isPosition=false){
 const typed=componentType===5126?new Float32Array(dataArray):new Uint32Array(dataArray);
 const bytes=Buffer.from(typed.buffer),view=viewsOut.length;
 viewsOut.push({buffer:0,byteOffset,byteLength:bytes.length,
  target:componentType===5126?34962:34963});
 data.push(bytes);byteOffset+=bytes.length;
 const accessor={bufferView:view,componentType,count:dataArray.length/components,
  type:components===3?'VEC3':'SCALAR'};
 if(isPosition){
  accessor.min=[Infinity,Infinity,Infinity];accessor.max=[-Infinity,-Infinity,-Infinity];
  for(let k=0;k<dataArray.length;k++){
   const axis=k%3,val=dataArray[k];
   accessor.min[axis]=Math.min(accessor.min[axis],val);
   accessor.max[axis]=Math.max(accessor.max[axis],val);
  }
 }
 return accessorsOut.push(accessor)-1;
}
let totalTris=0;
for(let matIndex=0;matIndex<groups.length;matIndex++){
 const g=groups[matIndex];if(!g.indices.length)continue;
 const p=append(g.positions,5126,3,true),n=append(g.normals,5126,3),
  id=append(g.indices,5125,1);
 primitives.push({attributes:{POSITION:p,NORMAL:n},indices:id,material:matIndex,mode:4});
 totalTris+=g.indices.length/3;
}
const binary=Buffer.concat(data);
const gltf={
 asset:{version:'2.0',generator:'original Farmgate procedural landmark; mobile GPU batched',copyright:'Original conceptual model'},
 scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Farmgate original detailed station landmark',mesh:0}],
 meshes:[{name:'Farmgate architectural elements grouped by material',primitives}],materials:mats,
 buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],
 bufferViews:viewsOut,accessors:accessorsOut,
 extras:{station:'Farmgate MRT Line 6',accuracy:'Illustrative reconstruction, not measured',modelParts:originalPartCount,drawBatches:primitives.length,triangles:totalTris}
};
writeFileSync(dir+'/farmgate-landmark.gltf',JSON.stringify(gltf));
console.log('Farmgate glTF:',originalPartCount,'architectural parts in',primitives.length,'material batches and',totalTris,'triangles');
