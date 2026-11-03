#!/usr/bin/env node
/**
 * Builds geo-anchored glTF models for actual OpenStreetMap objects between
 * Dhaka MRT Line 6 stations; Google Maps imagery/meshes are NOT extracted.
 *
 * A corridor may have no cached data; preserve it as missing, not a fake city.
 * Buildings: mapped footprints, height known only if OSM supplied a tag.
 * Roads: mapped centerlines with estimated visual widths. Trees: tagged nodes.
 *
 * License: © OpenStreetMap contributors, ODbL 1.0.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const folder='data/corridor',target='assets/corridor';
mkdirSync(target,{recursive:true});
const manifest=JSON.parse(readFileSync(folder+'/manifest.json','utf8'));
const tiles=manifest.tiles.filter(t=>t.exists&&existsSync(folder+'/'+t.id+'.json'));
const colors=[
 ['concrete','#b3b1aa',1],['brick','#aa8678',1],['pale','#d1cbbb',1],
 ['roof','#878e8e',1],['glass','#6f8e9c',1],['asphalt','#43484a',.88],
 ['lane','#ded9cd',1],['tree-trunk','#6e5540',1],['tree-leaf','#3c744d',1],
 ['metal','#899398',1]
];
const mat=colors.map(([name,hex,alpha])=>({name,doubleSided:true,alphaMode:alpha<1?'BLEND':'OPAQUE',
 pbrMetallicRoughness:{baseColorFactor:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat(alpha),metallicFactor:name==='metal'?.2:0,roughnessFactor:name==='glass'?.35:.87}}));
const groups=mat.map(()=>({positions:[],normals:[],indices:[]}));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function polyArea(p){let n=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];n+=a[0]*b[1]-b[0]*a[1]}return n/2}
function pointInTri(p,a,b,c,sg){return sg*cross(a,b,p)>=-1e-8&&sg*cross(b,c,p)>=-1e-8&&sg*cross(c,a,p)>=-1e-8}
function triangulate(poly){
 const sg=polyArea(poly)>=0?1:-1,ids=poly.map((_,i)=>i),out=[];
 if(Math.abs(polyArea(poly))<.2)return out;
 for(let guard=0;ids.length>3&&guard<600;guard++){
  let found=false;
  for(let j=0;j<ids.length;j++){
   const a=ids[(j+ids.length-1)%ids.length],b=ids[j],c=ids[(j+1)%ids.length];
   if(sg*cross(poly[a],poly[b],poly[c])<.0001)continue;
   if(ids.some(n=>n!==a&&n!==b&&n!==c&&pointInTri(poly[n],poly[a],poly[b],poly[c],sg)))continue;
   out.push([a,b,c]);ids.splice(j,1);found=true;break;
  }
  if(!found)break;
 }
 if(ids.length===3)out.push(ids.slice());
 return out;
}
let working=groups;
function tri(m,a,b,c){
 const g=working[m],dx=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],dy=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 const n=[dx[1]*dy[2]-dx[2]*dy[1],dx[2]*dy[0]-dx[0]*dy[2],dx[0]*dy[1]-dx[1]*dy[0]];
 const l=Math.hypot(...n)||1,index=g.positions.length/3;
 for(const p of [a,b,c]){g.positions.push(...p);g.normals.push(...n.map(v=>v/l))}
 g.indices.push(index,index+1,index+2);
}
function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d)}
function local(coord,tile){
 const lat=tile.center.lat,lon=tile.center.lon;
 return [-(coord[1]-lat)*111320,(coord[0]-lon)*111320*Math.cos(lat*Math.PI/180)];
}
function distance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function closestTile(p,id){
 for(const other of tiles){
  if(other.id===id)continue;
  const ref=[other.center.lon,other.center.lat];
  const my=[manifest.tiles.find(t=>t.id===id).center.lon,manifest.tiles.find(t=>t.id===id).center.lat];
  const scale=111320*Math.cos(p[1]*Math.PI/180);
  const d1=Math.hypot((p[0]-my[0])*scale,(p[1]-my[1])*111320);
  const d2=Math.hypot((p[0]-ref[0])*scale,(p[1]-ref[1])*111320);
  if(d2<d1)return false;
 }
 return true;
}
function box(m,x,y,z,w,h,d){
 const a=x-w/2,b=x+w/2,c=z-d/2,e=z+d/2,bottom=y,top=y+h;
 quad(m,[a,bottom,c],[b,bottom,c],[b,top,c],[a,top,c]);
 quad(m,[b,bottom,e],[a,bottom,e],[a,top,e],[b,top,e]);
 quad(m,[a,bottom,e],[a,bottom,c],[a,top,c],[a,top,e]);
 quad(m,[b,bottom,c],[b,bottom,e],[b,top,e],[b,top,c]);
 quad(m,[a,top,c],[b,top,c],[b,top,e],[a,top,e]);
}
function make(tile){
 const data=JSON.parse(readFileSync(folder+'/'+tile.id+'.json','utf8'));
 working=colors.map(()=>({positions:[],normals:[],indices:[]}));
 let buildings=0,roads=0,trees=0,taggedHeights=0,triangles=0;
 for(const building of (data.buildings||[]).slice(0,950)){
  if(!Array.isArray(building.p)||building.p.length<4||building.p.length>160)continue;
  const original=building.p;
  const center=original.reduce((a,p)=>[a[0]+p[0]/original.length,a[1]+p[1]/original.length],[0,0]);
  if(!closestTile(center,tile.id))continue;
  const polygon=original.map(p=>local(p,tile));
  if(polygon.length>3&&distance(polygon[0],polygon.at(-1))<.2)polygon.pop();
  if(polygon.length<3||Math.abs(polyArea(polygon))<4)continue;
  const known=Number.isFinite(Number(building.h))&&Number(building.h)>2;
  const seed=Number(building.id)||polygon.length*17;
  const height=clamp(known?Number(building.h):7.8+(seed%11)*2.8,4,95);
  if(known)taggedHeights++;
  const colorIndex=(Math.abs(seed)%3),orientation=polyArea(polygon)>=0?1:-1;
  for(let k=0;k<polygon.length;k++){
   const a=polygon[k],b=polygon[(k+1)%polygon.length];
   const start=[a[0],0.28,a[1]],end=[b[0],0.28,b[1]],tall=[b[0],height,b[1]],tall2=[a[0],height,a[1]];
   if(distance(a,b)<.2)continue;
   if(orientation>0)quad(colorIndex,start,end,tall,tall2);
   else quad(colorIndex,end,start,tall2,tall);
   // Storefront/lower glass on some blocks; illustrative surface.
   if(seed%4===0&&distance(a,b)>7){
    const c1=[a[0]*.7+b[0]*.3,.5,a[1]*.7+b[1]*.3],
      c2=[a[0]*.3+b[0]*.7,.5,a[1]*.3+b[1]*.7];
    quad(4,c1,c2,[c2[0],2.55,c2[2]],[c1[0],2.55,c1[2]]);
   }
  }
  for(const [a,b,c] of triangulate(polygon))tri(3,[polygon[a][0],height,polygon[a][1]],[polygon[b][0],height,polygon[b][1]],[polygon[c][0],height,polygon[c][1]]);
  buildings++;
 }
 for(const road of (data.roads||[]).slice(0,260)){
  if(!road.p||road.p.length<2)continue;
  const w=({primary:12,secondary:9,tertiary:7,residential:5.5,service:3.4})[road.type]||4.8;
  const coords=road.p.map(p=>local(p,tile));
  for(let k=1;k<coords.length;k++){
   const a=coords[k-1],b=coords[k],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);
   if(l<.3||l>300)continue;
   const nx=-dz/l*w/2,nz=dx/l*w/2;
   quad(5,[a[0]+nx,.16,a[1]+nz],[a[0]-nx,.16,a[1]-nz],[b[0]-nx,.16,b[1]-nz],[b[0]+nx,.16,b[1]+nz]);
   if(w>6){
    for(let q=0;q<l;q+=13){
     const t=q/l,tt=Math.min(l,q+2.8)/l;
     const p=[a[0]+dx*t,a[1]+dz*t],r=[a[0]+dx*tt,a[1]+dz*tt];
     const px=-dz/l*.09,pz=dx/l*.09;
     quad(6,[p[0]+px,.18,p[1]+pz],[p[0]-px,.18,p[1]-pz],[r[0]-px,.18,r[1]-pz],[r[0]+px,.18,r[1]+pz]);
    }
   }
  }
  roads++;
 }
 for(const p of (data.trees||[]).slice(0,450)){
  const coord=Array.isArray(p)?p:p.p;
  if(!Array.isArray(coord)||coord.length!==2)continue;
  const [x,z]=local(coord,tile);
  box(7,x,0,z,.24,3.6,.24);
  box(8,x,3.1,z,2.45,3.1,2.1);
  trees++;
 }
 if(buildings+roads+trees===0)return null;
 const binaries=[],views=[],accessors=[],primitives=[];let offset=0;
 function push(values,isIndex,count,withBounds){
  const a=isIndex?new Uint32Array(values):new Float32Array(values),bytes=Buffer.from(a.buffer);
  const view=views.push({buffer:0,byteOffset:offset,byteLength:bytes.length})-1;
  binaries.push(bytes);offset+=bytes.length;
  const acc={bufferView:view,componentType:isIndex?5125:5126,count:values.length/count,type:count===3?'VEC3':'SCALAR'};
  if(withBounds){acc.min=[Infinity,Infinity,Infinity];acc.max=[-Infinity,-Infinity,-Infinity];
   for(let i=0;i<values.length;i++){let axis=i%3;acc.min[axis]=Math.min(acc.min[axis],values[i]);acc.max[axis]=Math.max(acc.max[axis],values[i]);}}
  return accessors.push(acc)-1;
 }
 for(let i=0;i<working.length;i++){
  const g=working[i];if(!g.indices.length)continue;
  const p=push(g.positions,false,3,true),n=push(g.normals,false,3,false),id=push(g.indices,true,1,false);
  primitives.push({attributes:{POSITION:p,NORMAL:n},indices:id,material:i,mode:4});triangles+=g.indices.length/3;
 }
 const binary=Buffer.concat(binaries);
 const output={asset:{version:'2.0',generator:'Dhaka MRT-6 public OSM rail-corridor model'},
 scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Real OSM vectors; approximate geometry and textures'}],
 meshes:[{primitives}],materials:mat,
 buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],
 bufferViews:views,accessors,
 extras:{id:tile.id,center:tile.center,betweenStations:tile.betweenStations,
  buildings,taggedHeights,roads,trees,triangles,
  attribution:'© OpenStreetMap contributors, ODbL 1.0',
  accuracy:'Mapped building and road geometry; heights/road widths may be estimated. Not Google imagery or surveyed 3D.'}};
 writeFileSync(target+'/'+tile.id+'.gltf',JSON.stringify(output));
 return {id:tile.id,center:tile.center,betweenStations:tile.betweenStations,
  buildings,roads,trees,taggedHeights,triangles,file:'assets/corridor/'+tile.id+'.gltf'};
}
const models=[];
for(const tile of tiles){
 try{const output=make(tile);if(output)models.push(output)}
 catch(error){console.error('Could not build OSM corridor tile '+tile.id,error.message)}
}
writeFileSync(target+'/manifest.json',JSON.stringify({
 source:'© OpenStreetMap contributors ODbL 1.0',modelCount:models.length,
 neededTiles:manifest.tileCount,generatedBy:'scripts/build-corridor-models.mjs',models
},null,2));
console.log('Generated',models.length,'real-OSM corridor segments,',models.reduce((n,m)=>n+m.buildings,0),'buildings,',models.reduce((n,m)=>n+m.roads,0),'mapped road features');
