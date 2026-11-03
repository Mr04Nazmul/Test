#!/usr/bin/env node
/**
 * Generate renderable, textured glTF buildings for Dhaka MRT-6 stations.
 * Geometry follows locally cached OpenStreetMap building footprints (ODbL 1.0).
 * Unknown heights, window patterns, parapets and rooftop details are illustrative;
 * NOT a photogrammetric survey or a Google Earth model.
 * Runs on Node.js 20+ without dependencies.
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {join} from 'node:path';

const root=process.cwd();
const destination=join(root,'assets','urban');
mkdirSync(destination,{recursive:true});
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));

function crc32(bytes){
 let crc=0xffffffff;
 for(const b of bytes){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^(0xedb88320&-(crc&1))}
 return (crc^0xffffffff)>>>0;
}
function pngChunk(type,data){
 const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const t=Buffer.from(type),crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
 return Buffer.concat([len,t,data,crc]);
}
function makeFacadeTexture(){
 const w=64,h=64,pixels=Buffer.alloc((w*4+1)*h);
 for(let y=0;y<h;y++){
  const row=y*(w*4+1);pixels[row]=0;
  for(let x=0;x<w;x++){
   let r=204,g=200,b=192;
   // plaster, concrete slab line, two reflective glass windows per 4 m x 3.2 m tile
   if(y<6||y>58){r=170;g=169;b=164}
   else if((x>=6&&x<=28)||(x>=36&&x<=58)){
    if(y>=15&&y<=51){
     const frame=x<=28?(x<9||x>25||y<18||y>48):(x<39||x>55||y<18||y>48);
     if(frame){r=92;g=104;b=111}
     else {
      const shine=(x+y)%23<4;
      r=shine?160:98;g=shine?188:143;b=shine?196:159;
      if(y>40){r+=5;g+=5;b+=4}
     }
    }
   }else if(y>10&&y<55&&x%17===0){r=182;g=179;b=172}
   const off=row+1+x*4;pixels[off]=r;pixels[off+1]=g;pixels[off+2]=b;pixels[off+3]=255;
  }
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),
   pngChunk('IDAT',deflateSync(pixels,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);
}
const facadePNG='data:image/png;base64,'+makeFacadeTexture().toString('base64');
const colors=['#e0d4c5','#c3c5c1','#e1c3b4','#c0c9c6','#ddd1bb','#b4b6b3','#e4ddcf','#c1a99c'];
function rgba(hex){const s=hex.slice(1);return [parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255,1]}
function material(name,hex,texture=false){
 const pbr={baseColorFactor:rgba(hex),metallicFactor:0.02,roughnessFactor:texture?0.78:0.89};
 if(texture)pbr.baseColorTexture={index:0,texCoord:0};
 return {name,pbrMetallicRoughness:pbr,doubleSided:true};
}
const routeJS=readFileSync(join(root,'data','mrt6-track.js'),'utf8');
const routeBody=routeJS.split('window.MRT_TRACK=')[1];
if(!routeBody)throw Error('MRT route data missing');
const trackNodes=JSON.parse(routeBody.trim().replace(/;\s*$/,'')).points;
function distanceToSegment(p,a,b){
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function nearRailCorridor(poly,routeXY,stationIndex){
 if(poly.length<3)return false;
 const c=poly.reduce((s,p)=>[s[0]+p[0]/poly.length,s[1]+p[1]/poly.length],[0,0]);
 const buffer=stationIndex===8?30:18;
 // Coarse reject: do not apply visual clearance to buildings far from rail.
 const candidates=routeXY.filter(p=>Math.abs(p[0]-c[0])<150&&Math.abs(p[1]-c[1])<150);
 if(!candidates.length)return false;
 const minDist=p=>{
  let best=Infinity;
  for(let k=1;k<routeXY.length;k++){
   const a=routeXY[k-1],b=routeXY[k];
   if(Math.abs(a[0]-p[0])>160&&Math.abs(b[0]-p[0])>160)continue;
   if(Math.abs(a[1]-p[1])>160&&Math.abs(b[1]-p[1])>160)continue;
   best=Math.min(best,distanceToSegment(p,a,b));
  }
  return best;
 };
 if(minDist(c)<buffer)return true;
 return poly.some(p=>minDist(p)<Math.max(10,buffer*.48));
}
const materials=[
 ...colors.map((c,i)=>material('windowed-plaster-'+i,c,true)),
 material('roof-concrete','#a7a59b'),material('parapets','#c9c5b8'),
 material('roof-utilities','#7d8988'),
 material('ground-floor-shop-glass','#6f91a4'),
 material('corrugated-shop-awning-green','#387968'),
 material('corrugated-shop-awning-red','#a34b44'),
 material('balcony-concrete','#b4aea4'),
 material('balcony-metal-railing','#59666d'),
 material('rooftop-black-water-tank','#33383b'),
 material('rooftop-airconditioning','#879292'),
 material('small-roof-greenery','#506f54')
];
const detailMaterials={shop:11,awningGreen:12,awningRed:13,balcony:14,rail:15,tank:16,aircon:17,green:18};

function newGroup(){return {positions:[],normals:[],uv:[],indices:[]}}
function appendTri(g,a,b,c,normal,uv=[[0,0],[1,0],[0,1]]){
 const k=g.positions.length/3;
 for(let i=0;i<3;i++){g.positions.push(...[a,b,c][i]);g.normals.push(...normal);g.uv.push(...uv[i])}
 g.indices.push(k,k+1,k+2);
}
function appendQuad(g,a,b,c,d,normal,u=1,v=1){
 const k=g.positions.length/3;
 for(const vertex of [a,b,c,d])g.positions.push(...vertex);
 for(let i=0;i<4;i++)g.normals.push(...normal);
 g.uv.push(0,0,u,0,u,v,0,v);
 g.indices.push(k,k+1,k+2,k,k+2,k+3);
}
function area2(v){let a=0;for(let i=0;i<v.length;i++){const p=v[i],q=v[(i+1)%v.length];a+=p[0]*q[1]-q[0]*p[1]}return a}
function pointInside(p,a,b,c,orientation){
 const cross=(x,y,z)=>(y[0]-x[0])*(z[1]-x[1])-(y[1]-x[1])*(z[0]-x[0]);
 return orientation*cross(a,b,p)>=-1e-7&&orientation*cross(b,c,p)>=-1e-7&&orientation*cross(c,a,p)>=-1e-7;
}
function earclip(poly){
 const a=area2(poly),sign=a>=0?1:-1,remaining=poly.map((_,i)=>i),tri=[];
 if(Math.abs(a)<.001)return tri;
 let guard=0;
 while(remaining.length>3&&guard++<400){
  let found=false;
  for(let j=0;j<remaining.length;j++){
   const i0=remaining[(j-1+remaining.length)%remaining.length],i1=remaining[j],i2=remaining[(j+1)%remaining.length],
     p=poly[i0],q=poly[i1],r=poly[i2],
     cross=(q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]);
   if(sign*cross<=.0001)continue;
   let contains=false;
   for(const k of remaining){if(k!==i0&&k!==i1&&k!==i2&&pointInside(poly[k],p,q,r,sign)){contains=true;break}}
   if(contains)continue;
   tri.push([i0,i1,i2]);remaining.splice(j,1);found=true;break;
  }
  if(!found)break;
 }
 if(remaining.length===3)tri.push([...remaining]);
 return tri;
}
function box(g,x,y,z,sx,sy,sz){
 const lo=[x-sx/2,y,z-sz/2],hi=[x+sx/2,y+sy,z+sz/2];
 for(const [a,b,c,d,n] of [
  [[lo[0],lo[1],lo[2]],[hi[0],lo[1],lo[2]],[hi[0],hi[1],lo[2]],[lo[0],hi[1],lo[2]],[0,0,-1]],
  [[hi[0],lo[1],hi[2]],[lo[0],lo[1],hi[2]],[lo[0],hi[1],hi[2]],[hi[0],hi[1],hi[2]],[0,0,1]],
  [[lo[0],lo[1],hi[2]],[lo[0],lo[1],lo[2]],[lo[0],hi[1],lo[2]],[lo[0],hi[1],hi[2]],[-1,0,0]],
  [[hi[0],lo[1],lo[2]],[hi[0],lo[1],hi[2]],[hi[0],hi[1],hi[2]],[hi[0],hi[1],lo[2]],[1,0,0]],
  [[lo[0],hi[1],lo[2]],[hi[0],hi[1],lo[2]],[hi[0],hi[1],hi[2]],[lo[0],hi[1],hi[2]],[0,1,0]]]){
  appendQuad(g,a,b,c,d,n);
 }
}
// Some archival OSM snapshot JSON files omit center; use surveyed route
// station anchor coordinates already bundled in data/mrt6-track.js.
const stationCenters=[
 [90.3676821,23.8690849],[90.3651273,23.8597088],[90.3630841,23.8459106],
 [90.3642123,23.8261574],[90.3653075,23.819103],[90.3682791,23.8083683],
 [90.3720193,23.7992485],[90.375542,23.7909718],[90.3801611,23.7784483],
 [90.3831212,23.7663912],[90.3870783,23.7590775],[90.3928149,23.7513044],
 [90.3961548,23.7400564],[90.3968427,23.7316979],[90.4075587,23.7300419],
 [90.4190709,23.7280844]
];
function makeModel(data,index){
 // Always anchor the local mesh to the same station coordinate as Cesium.
 // Some archival caches have a different center, which caused visible shifts.
 const center=stationCenters[index];
 if(!center||center.length!==2)throw Error('Missing map anchor for station '+index);
 const cx=center[0],cy=center[1],lonScale=111320*Math.cos(cy*Math.PI/180),latScale=111320;
 const groups=materials.map(newGroup);
 // Cesium uses local ENU (east/north/up). In a Y-up glTF, X=east, Z=south.
 // The previous [-north,east] transform rotated mapped blocks off the imagery.
 const routeXY=trackNodes.map(([lat,lon])=>[(lon-cx)*lonScale,-(lat-cy)*latScale]);
 let count=0,known=0,triangles=0,clearedNearTrack=0;
 for(const item of (data.buildings||[]).slice(0,450)){
  if(!Array.isArray(item.p)||item.p.length<4)continue;
  const coords=item.p.map(([lon,lat])=>[(lon-cx)*lonScale,-(lat-cy)*latScale]);
  if(coords.length>3&&Math.hypot(coords[0][0]-coords.at(-1)[0],coords[0][1]-coords.at(-1)[1])<.15)coords.pop();
  if(coords.length<3||coords.length>150)continue;
  // Safety clearance around metro track and camera: OSM footprints are still
  // preserved verbatim in data/buildings/*.json. Only conflicting 3D walls
  // are not rendered, avoiding camera spawning INSIDE dark fake buildings.
  if(data.buildings.length>15&&nearRailCorridor(coords,routeXY,index)){clearedNearTrack++;continue}
  const a=area2(coords);
  if(Math.abs(a)<3)continue;
  const seed=Math.abs(Number(item.id)||item.p.length*98761);
  const chosenHeight=Number(item.h);
  const genuine=item.h!==undefined&&item.h!==null&&Number.isFinite(chosenHeight)&&chosenHeight>1;
  let height=genuine?chosenHeight:8+(seed%9)*3.15;
  height=clamp(height,4.4,110);
  if(genuine)known++;
  const orientation=a>=0?1:-1,g=groups[seed%colors.length],roof=groups[8],parapet=groups[9];
  for(let j=0;j<coords.length;j++){
   const p=coords[j],q=coords[(j+1)%coords.length],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);
   if(length<.22)continue;
   const nx=orientation*dz/length,nz=-orientation*dx/length;
   appendQuad(g,[p[0],.35,p[1]],[q[0],.35,q[1]],[q[0],height,q[1]],[p[0],height,p[1]],[nx,0,nz],length/4,height/3.2);
   // Original illustrative Dhaka street frontage geometry.
   // Footprint and location are OSM; shop presence/design is NOT verified.
   if(seed%4===0&&j===seed%coords.length&&height>8&&length>6&&length<35){
    const e=.11,awning=1.35;
    appendQuad(groups[detailMaterials.shop],
     [p[0]+nx*e,.55,p[1]+nz*e],[q[0]+nx*e,.55,q[1]+nz*e],
     [q[0]+nx*e,2.94,q[1]+nz*e],[p[0]+nx*e,2.94,p[1]+nz*e],[nx,0,nz],1,1);
    appendQuad(groups[seed%2?detailMaterials.awningGreen:detailMaterials.awningRed],
     [p[0]+nx*.17,3.18,p[1]+nz*.17],[q[0]+nx*.17,3.18,q[1]+nz*.17],
     [q[0]+nx*awning,3.02,q[1]+nz*awning],[p[0]+nx*awning,3.02,p[1]+nz*awning],
     [0,1,0],1,1);
   }
   // A small number of illustrative balconies on eligible facades. A budget
   // of three floors per face keeps all 16 station-area meshes phone-friendly.
   if(seed%8===0&&j===((seed>>>2)%coords.length)&&height>14&&length>6&&length<23){
    const floors=Math.min(3,Math.floor((height-4)/3.2));
    for(let floor=1;floor<=floors;floor++){
     const y=floor*3.2+.24;
     appendQuad(groups[detailMaterials.balcony],
      [p[0]+nx*.06,y,p[1]+nz*.06],[q[0]+nx*.06,y,q[1]+nz*.06],
      [q[0]+nx*.95,y,q[1]+nz*.95],[p[0]+nx*.95,y,p[1]+nz*.95],[0,1,0],1,1);
     appendQuad(groups[detailMaterials.rail],
      [p[0]+nx*.96,y,p[1]+nz*.96],[q[0]+nx*.96,y,q[1]+nz*.96],
      [q[0]+nx*.96,y+.8,q[1]+nz*.96],[p[0]+nx*.96,y+.8,p[1]+nz*.96],
      [nx,0,nz],1,1);
    }
   }
   // Thin concrete roof-edge parapets add a more legible city silhouette.
   if(seed%3===0)appendQuad(parapet,
     [p[0]+nx*.15,height,p[1]+nz*.15],[q[0]+nx*.15,height,q[1]+nz*.15],
     [q[0]+nx*.15,height+.55,q[1]+nz*.15],[p[0]+nx*.15,height+.55,p[1]+nz*.15],
     [nx,0,nz],1,1);
  }
  for(const [a,b,c] of earclip(coords))
   appendTri(roof,[coords[a][0],height,coords[a][1]],[coords[b][0],height,coords[b][1]],
     [coords[c][0],height,coords[c][1]],[0,1,0]);
  if(coords.length<18){
   const mid=coords.reduce((acc,p)=>[acc[0]+p[0]/coords.length,acc[1]+p[1]/coords.length],[0,0]);
   if(seed%9===0)box(groups[10],mid[0],height+.06,mid[1],2.6,1.1,2.2);
   // Dhaka rooftops commonly have water storage, AC units and roof fixtures;
   // their exact locations here are procedural, not sourced building records.
   if(seed%7===0&&height>6)box(groups[detailMaterials.tank],mid[0]+1.8,height+.10,mid[1],1.65,1.55,1.65);
   if(seed%11===0&&height>10){
    box(groups[detailMaterials.aircon],mid[0]-1.3,height+.10,mid[1]+.6,1.9,.78,1.4);
    box(groups[detailMaterials.green],mid[0]+1.4,height+.08,mid[1]-1.3,1.1,.42,1.2);
   }
  }
  count++;
 }
 const blobs=[],bufferViews=[],accessors=[],primitives=[];
 let byteCursor=0;
 function pushArray(arr,type){
  const buff=type==='float'?Buffer.from(new Float32Array(arr).buffer):Buffer.from(new Uint32Array(arr).buffer);
  while(byteCursor%4){blobs.push(Buffer.alloc(1));byteCursor++}
  const view=bufferViews.length;
  bufferViews.push({buffer:0,byteOffset:byteCursor,byteLength:buff.length});
  blobs.push(buff);byteCursor+=buff.length;return view;
 }
 function accessor(arr,components,type,withMinMax=false){
  const view=pushArray(arr,type),count=arr.length/components;
  const ac={bufferView:view,componentType:type==='float'?5126:5125,count,type:components===3?'VEC3':components===2?'VEC2':'SCALAR'};
  if(withMinMax){
   // Exact bounding volume across EVERY vertex is required for Cesium culling.
   // The previous 1,200-value truncation silently hid most neighborhood buildings.
   ac.min=Array(components).fill(Infinity);ac.max=Array(components).fill(-Infinity);
   for(let k=0;k<arr.length;k++){
    const axis=k%components;
    if(arr[k]<ac.min[axis])ac.min[axis]=arr[k];
    if(arr[k]>ac.max[axis])ac.max[axis]=arr[k];
   }
   // recompute bounds over entire array, not a sample
   for(let k=0;k<arr.length;k++){const n=k%components;ac.min[n]=Math.min(ac.min[n],arr[k]);ac.max[n]=Math.max(ac.max[n],arr[k])}
  }
  accessors.push(ac);return accessors.length-1;
 }
 for(let i=0;i<groups.length;i++){
  const g=groups[i];if(!g.indices.length)continue;
  const p=accessor(g.positions,3,'float',true),n=accessor(g.normals,3,'float'),uv=accessor(g.uv,2,'float');
  const idx=accessor(g.indices,1,'index');
  primitives.push({attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:uv},indices:idx,material:i,mode:4});
  triangles+=g.indices.length/3;
 }
 if(!primitives.length)throw Error('Empty model '+index);
 const binary=Buffer.concat(blobs);
 const model={
  asset:{version:'2.0',generator:'Dhaka MRT-6 OSM footprint 3D mesh builder; heights/windows may be estimates'},
  scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Station '+index+' surrounding real OSM building footprints'}],
  meshes:[{primitives}],materials,
  textures:[{sampler:0,source:0}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],
  images:[{uri:facadePNG,mimeType:'image/png'}],
  buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],
  bufferViews,accessors,
  extras:{station:index,buildingFootprints:count,knownHeights:known,inferredHeights:count-known,
   addedIllustrativeDetails:'shopfront glass and sunshades, balcony slabs, rooftop tanks and AC fixtures',
   anchor:{longitude:cx,latitude:cy},coordinateSystem:'local glTF X=east, Y=up, Z=south',provenance:data.source,license:'ODbL 1.0 © OpenStreetMap contributors',
   clearedNearTrack,
   caveat:'Real mapped footprints, visually excluded shapes near train corridor to reduce occlusion; approximate heights/windows are not real building imagery.'}
 };
 return {model,count,known,triangles};
}
const report=[];
for(let index=0;index<16;index++){
 const path=join(root,'data','buildings',index+'.json');
 if(!existsSync(path))continue;
 const data=JSON.parse(readFileSync(path,'utf8'));
 const {model,count,known,triangles}=makeModel(data,index);
 const name=index+'.gltf';writeFileSync(join(destination,name),JSON.stringify(model));
 report.push({index,name,buildings:count,knownHeights:known,approximateHeights:count-known,triangles,anchor:model.extras.anchor,source:model.extras.provenance,clearedNearTrack:model.extras.clearedNearTrack});
}
writeFileSync(join(destination,'manifest.json'),JSON.stringify({generatedBy:'scripts/build-urban-models.mjs',source:'OpenStreetMap ODbL + procedural surfaces',models:report},null,2));
console.log('Generated',report.length,'MRT-6 surrounding-area glTF 3D models:',report.map(x=>x.index+':'+x.buildings).join(', '));
