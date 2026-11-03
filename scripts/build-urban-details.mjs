#!/usr/bin/env node
/**
 * Generates original illustrated street-scale 3D details for all MRT-6 station
 * neighborhoods, anchored to cached OpenStreetMap building footprints.
 *
 * OSM provides footprint locations only. Awning colors, shopfront locations,
 * trees, poles, rooftop tanks and street furniture are creative approximations.
 * Does not reproduce Google Earth data or claim survey-quality coverage.
 * Node 20+, no dependencies.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd(),output=join(root,'assets','urban-details');
mkdirSync(output,{recursive:true});
const routeSrc=readFileSync(join(root,'data','mrt6-track.js'),'utf8').split('window.MRT_TRACK=')[1];
if(!routeSrc)throw Error('Station route missing');
const route=JSON.parse(routeSrc.trim().replace(/;\s*$/,''));
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const swatches=[
 ['brick-plaster','#c6a48d'],['painted-plaster','#cbd5c8'],['blue-shop-sign','#275b75'],
 ['green-shop-sign','#18735c'],['red-shop-sign','#a74b42'],['awning-light','#e7d6a6'],
 ['awning-blue','#367b98'],['awning-green','#439170'],['tin-roof','#697d7a'],
 ['black-tank','#242b31'],['steel','#616b72'],['ac-box','#c2c6c4'],
 ['leaf-green','#438361'],['leaf-deep','#275b43'],['wood-trunk','#6b5542'],
 ['lamp-warm','#f3d5a5'],['concrete','#aaa99f'],['street-rail','#738281']
];
const materials=swatches.map(([name,hex])=>({name,pbrMetallicRoughness:{
 baseColorFactor:[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)/255).concat(1),
 metallicFactor:['black-tank','steel','street-rail','tin-roof'].includes(name)?0.25:0.015,
 roughnessFactor:['steel','street-rail','tin-roof'].includes(name)?.55:.88},
 doubleSided:true}));
const groups=materials.map(()=>({p:[],n:[],indices:[]}));
let components=0;
function tri(m,a,b,c){
 const g=groups[m],i=g.p.length/3;
 g.p.push(...a,...b,...c);
 const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 let x=u[1]*v[2]-u[2]*v[1],y=u[2]*v[0]-u[0]*v[2],z=u[0]*v[1]-u[1]*v[0];
 const len=Math.hypot(x,y,z)||1;x/=len;y/=len;z/=len;
 for(let j=0;j<3;j++)g.n.push(x,y,z);
 g.indices.push(i,i+1,i+2);
}
function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d)}
function box(m,x,y,z,sx,sy,sz,angle=0){
 components++;
 const cs=Math.cos(angle),sn=Math.sin(angle);
 const corners=[];
 for(const [u,v,w] of [
 [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
 [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]
 ]){
  const xx=u*sx/2,zz=w*sz/2;
  corners.push([x+xx*cs+zz*sn,y+v*sy/2,z-xx*sn+zz*cs]);
 }
 for(const [a,b,c,d] of [[4,5,6,7],[1,0,3,2],[0,4,7,3],[5,1,2,6],[7,6,2,3],[0,1,5,4]])
  quad(m,corners[a],corners[b],corners[c],corners[d]);
}
function cylinder(mat,x,y,z,radius,height,sides=9){
 components++;
 for(let j=0;j<sides;j++){
  const a=j*2*Math.PI/sides,b=(j+1)*2*Math.PI/sides,
   p=[x+Math.cos(a)*radius,y-height/2,z+Math.sin(a)*radius],
   q=[x+Math.cos(b)*radius,y-height/2,z+Math.sin(b)*radius],
   topA=[p[0],y+height/2,p[2]],topB=[q[0],y+height/2,q[2]];
  quad(mat,p,q,topB,topA);
  tri(mat,[x,y+height/2,z],topA,topB);
 }
}
function cone(mat,x,bottom,z,radius,height,sides=9){
 components++;
 const peak=[x,bottom+height,z];
 for(let j=0;j<sides;j++){
  const a=j*2*Math.PI/sides,b=(j+1)*2*Math.PI/sides;
  tri(mat,[x+radius*Math.cos(a),bottom,z+radius*Math.sin(a)],
   [x+radius*Math.cos(b),bottom,z+radius*Math.sin(b)],peak);
 }
}
function footprint(poly,lon,lat){
 const ex=111320*Math.cos(lat*Math.PI/180),ny=111320;
 const pp=poly.map(([lo,la])=>[-(la-lat)*ny,(lo-lon)*ex]);
 if(pp.length>3&&Math.hypot(pp[0][0]-pp.at(-1)[0],pp[0][1]-pp.at(-1)[1])<.13)pp.pop();
 return pp;
}
function area(pts){let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1]}return a/2}
function closestRail(x,z,rail){
 let min=Infinity;
 for(let i=1;i<rail.length;i++){
  const a=rail[i-1],b=rail[i],dx=b[0]-a[0],dz=b[1]-a[1];
  if(Math.abs(x-a[0])>250&&Math.abs(x-b[0])>250)continue;
  if(Math.abs(z-a[1])>250&&Math.abs(z-b[1])>250)continue;
  const f=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
  min=Math.min(min,Math.hypot(x-a[0]-f*dx,z-a[1]-f*dz));
 }
 return min;
}
function writeGLTF(index,center,source,metadata){
 const views=[],accessors=[],bins=[],primitives=[];let offset=0,tris=0;
 function accessor(array,kind,n,bounds=false){
  const bytes=Buffer.from((kind===5126?new Float32Array(array):new Uint32Array(array)).buffer);
  const view=views.push({buffer:0,byteOffset:offset,byteLength:bytes.length})-1;
  bins.push(bytes);offset+=bytes.length;
  const a={bufferView:view,componentType:kind,count:array.length/n,type:n===3?'VEC3':'SCALAR'};
  if(bounds){
   a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];
   for(let k=0;k<array.length;k++){
    const axis=k%3,val=array[k];
    a.min[axis]=Math.min(val,a.min[axis]);a.max[axis]=Math.max(val,a.max[axis]);
   }
  }
  return accessors.push(a)-1;
 }
 for(let i=0;i<groups.length;i++){
  const g=groups[i];if(!g.indices.length)continue;
  const p=accessor(g.p,5126,3,true),n=accessor(g.n,5126,3),idx=accessor(g.indices,5125,1);
  primitives.push({attributes:{POSITION:p,NORMAL:n},indices:idx,material:i,mode:4});
  tris+=g.indices.length/3;
 }
 if(!primitives.length)return null;
 const bin=Buffer.concat(bins),model={
  asset:{version:'2.0',generator:'Dhaka neighborhood original-detail builder'},
  scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Station neighborhood architectural details',mesh:0}],
  meshes:[{name:'Batched shopfronts, rooftops and illustrative street detail',primitives}],
  materials,buffers:[{uri:'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}],
  bufferViews:views,accessors,
  extras:{station:index,source,buildingFootprints:metadata.buildings,
   shops:metadata.shops,trees:metadata.trees,rooftopTanks:metadata.tanks,streetlamps:metadata.lamps,
   shapes:components,triangles:tris,anchor:{lon:center[0],lat:center[1]},
   accuracy:'Building locations adapted from OSM; architectural/street features invented for visualization, not factual city records',
   license:'© OpenStreetMap contributors, ODbL 1.0'}
 };
 writeFileSync(join(output,index+'.gltf'),JSON.stringify(model));
 return {station:index,...metadata,shapes:components,triangles:tris,byteLength:bin.length};
}
const report=[];
for(let i=0;i<route.stations.length;i++){
 const file=join(root,'data','buildings',i+'.json');
 if(!existsSync(file))continue;
 const data=JSON.parse(readFileSync(file,'utf8'));
 const c=data.center||[route.stations[i].lon,route.stations[i].lat];
 groups.forEach(g=>{g.p.length=0;g.n.length=0;g.indices.length=0});components=0;
 const rail=route.points.map(([lat,lon])=>[-(lat-c[1])*111320,(lon-c[0])*111320*Math.cos(c[1]*Math.PI/180)]);
 const records=(data.buildings||[]).map(item=>{
  if(!Array.isArray(item.p)||item.p.length<4)return null;
  const pts=footprint(item.p,c[0],c[1]);
  if(pts.length<3||pts.length>120||Math.abs(area(pts))<5)return null;
  const mx=pts.reduce((a,p)=>a+p[0]/pts.length,0),mz=pts.reduce((a,p)=>a+p[1]/pts.length,0);
  return {item,pts,mx,mz,dist:Math.hypot(mx,mz)};
 }).filter(Boolean).sort((a,b)=>a.dist-b.dist).slice(0,175);
 const counters={buildings:0,shops:0,trees:0,tanks:0,lamps:0};
 for(const {item,pts,mx,mz} of records){
  if(closestRail(mx,mz,rail)<30)continue;
  const seed=Math.abs(Number(item.id)||Math.round(mx*41+mz*73))>>>0;
  const h0=Number(item.h),height=Number.isFinite(h0)&&h0>1?clamp(h0,4.4,110):8+(seed%9)*3.15;
  const aa=area(pts),orient=aa>0?1:-1;
  let candidate=null;
  for(let j=0;j<pts.length;j++){
   const a=pts[j],b=pts[(j+1)%pts.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   if(len<3.3||len>140)continue;
   if(!candidate||len>candidate.len)candidate={a,b,dx,dz,len};
  }
  if(!candidate)continue;
  const {a,b,dx,dz,len}=candidate,tx=dx/len,tz=dz/len,
   ox=orient*tz,oz=-orient*tx,angle=-Math.atan2(dz,dx),
   sx=(a[0]+b[0])/2,sz=(a[1]+b[1])/2;
  // Illustrative storefront façades, canopy and coloured shop fascias,
  // anchored to an actual OSM building edge.
  const frontage=Math.min(len-1,clamp(len*.66,4,10));
  if(height>7&&seed%5!==0){
   box(2+seed%3,sx+ox*.24,3.35,sz+oz*.24,frontage,.78,.20,angle);
   box(5+seed%3,sx+ox*.95,2.72,sz+oz*.95,frontage+1,.13,1.6,angle);
   for(const f of [-.4,0,.4]){
    if(Math.abs(f)>.3&&len<7)continue;
    const px=sx+tx*frontage*f+ox*.19,pz=sz+tz*frontage*f+oz*.19;
    box(7,px,1.38,pz,frontage*.20,2.15,.07,angle);
    box(10,px+ox*.03,2.4,pz+oz*.03,frontage*.21,.095,.1,angle);
   }
   counters.shops++;
  }
  if(seed%3===0){
   // Black rooftop water storage drums common in many Dhaka neighborhoods;
   // exact tank count and placement are not surveyed.
   const n=1+seed%3;
   for(let k=0;k<n;k++){
    const px=mx+(k-1)*1.35,pz=mz+((seed>>3)%5-2)*.35;
    cylinder(9,px,height+.65,pz,.52,1.25,10);
    cylinder(10,px,height+1.29,pz,.55,.09,10);
   }
   counters.tanks+=n;
  }
  if(seed%4===0){
   const bx=mx+1.4,bz=mz-.2;
   box(11,bx,height+.32,bz,1.35,.63,1.1);
   box(10,bx,height+.67,bz,1.16,.07,.9);
  }
  if(seed%7===0&&height>11){
   box(8,mx-1,height+.45,mz+1,3.7,.19,2.8);
   box(10,mx-1,height+.16,mz+1,3.7,.31,.14);
  }
  // These decorative props sit near building edges, but do NOT represent
  // verified sidewalks, exact roads or mapped street tree positions.
  if(seed%5===0&&closestRail(sx+ox*4,sz+oz*4,rail)>40){
   const px=sx+ox*4.2,pz=sz+oz*4.2;
   cylinder(14,px,1.48,pz,.13,2.95,7);
   cone(13,px,2.6,pz,1.7,3.2,9);
   cone(12,px,3.5,pz,1.25,2.9,9);
   counters.trees++;
  }
  if(seed%11===0&&closestRail(sx+ox*5,sz+oz*5,rail)>38){
   const px=sx+ox*5.5,pz=sz+oz*5.5;
   cylinder(10,px,3.6,pz,.09,7.2,8);
   box(10,px+ox*.8,7.2,pz+oz*.8,1.5,.13,.13,angle);
   box(15,px+ox*1.45,7.16,pz+oz*1.45,.55,.12,.49,angle);
   counters.lamps++;
  }
  counters.buildings++;
 }
 const result=writeGLTF(i,c,data.source||'OSM footprints',counters);
 if(result)report.push(result);
}
writeFileSync(join(output,'manifest.json'),JSON.stringify({
 generatedBy:'scripts/build-urban-details.mjs',
 source:'Cached OpenStreetMap footprints ODbL and original illustrative 3D details',
 limitations:'Shops, trees, awnings, water tanks and lamps are artist-created approximations; OSM coverage is limited',
 models:report
},null,2));
console.log('Neighborhood detail models built:',report.length,
 report.map(x=>x.station+':'+x.buildings+' buildings, '+x.shops+' facades').join('; '));
