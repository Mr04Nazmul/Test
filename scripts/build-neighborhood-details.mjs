#!/usr/bin/env node
/**
 * Open-data neighborhood furnishing for the 16 Dhaka MRT-6 stops.
 * Accurate anchor and OSM building exclusion, procedural inferred trees/street objects.
 * NOT satellite photogrammetry, surveyed road lines or observed vegetation.
 * Local glTF axes: +X east, +Y up, +Z south. Cesium glTF Y-up conversion.
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const route=JSON.parse(readFileSync('data/mrt6-track.js','utf8').split('window.MRT_TRACK=')[1].trim().replace(/;\s*$/,''));
const out=join('assets','neighborhood');mkdirSync(out,{recursive:true});
const palette=[
 ['bark','#6b5947',.96],['foliage-deep','#244d2c',.90],
 ['foliage-green','#387143',.96],['foliage-sunlit','#618452',.98],
 ['lamp-steel','#778080',.50],['lamp-glass','#e9d5a1',.42],
 ['pavement','#9d9a91',.98],['paint','#dcd8c8',.92],
 ['market-body','#858579',.94],['market-roof','#a55b4e',.85],
 ['bench-wood','#73634e',.80],['railing','#7d8583',.58],
 ['flowerbeds','#555947',.97]
];
const rgba=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).concat(1);
const materials=palette.map(([name,color,roughness])=>({name,doubleSided:true,
 pbrMetallicRoughness:{baseColorFactor:rgba(color),metallicFactor:name.includes('steel')?.28:0,roughnessFactor:roughness}}));
const groups=palette.map(()=>({p:[],n:[],indices:[]}));
const seedFn=n=>{let x=(n|0)^0x9e3779b9;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}};
const indexByName=name=>palette.findIndex(x=>x[0]===name);
let groupsNow=groups;
function triangle(name,a,b,c){
 const g=groupsNow[indexByName(name)],start=g.p.length/3;
 const e=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],f=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 let normal=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];
 const d=Math.hypot(...normal)||1;normal=normal.map(n=>n/d);
 for(const p of [a,b,c]){g.p.push(...p);g.n.push(...normal)}
 g.indices.push(start,start+1,start+2);
}
function quad(name,a,b,c,d){triangle(name,a,b,c);triangle(name,a,c,d)}
function box(name,x,y,z,sx,sy,sz){
 const X=x+sx/2,x0=x-sx/2,Y=y+sy,Z=z+sz/2,z0=z-sz/2;
 quad(name,[x0,y,z0],[X,y,z0],[X,Y,z0],[x0,Y,z0]);
 quad(name,[X,y,Z],[x0,y,Z],[x0,Y,Z],[X,Y,Z]);
 quad(name,[x0,y,Z],[x0,y,z0],[x0,Y,z0],[x0,Y,Z]);
 quad(name,[X,y,z0],[X,y,Z],[X,Y,Z],[X,Y,z0]);
 quad(name,[x0,Y,z0],[X,Y,z0],[X,Y,Z],[x0,Y,Z]);
}
function tapered(name,x,y,z,bottom,top,h,segments=6){
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
  const p=[x+Math.cos(a)*bottom,y,z+Math.sin(a)*bottom],
   q=[x+Math.cos(b)*bottom,y,z+Math.sin(b)*bottom],
   r=[x+Math.cos(b)*top,y+h,z+Math.sin(b)*top],
   s=[x+Math.cos(a)*top,y+h,z+Math.sin(a)*top];
  quad(name,p,q,r,s);
 }
}
function canopy(name,x,y,z,r,h){
 const ring=7,level=[.02,.55,1.08],spread=[.42,1,.30];
 for(let l=0;l<2;l++)for(let j=0;j<ring;j++){
  const a=j*Math.PI*2/ring,b=(j+1)*Math.PI*2/ring;
  const p=[x+r*spread[l]*Math.cos(a),y+h*level[l]*.66,z+r*spread[l]*Math.sin(a)],
   q=[x+r*spread[l]*Math.cos(b),y+h*level[l]*.66,z+r*spread[l]*Math.sin(b)],
   R=[x+r*spread[l+1]*Math.cos(b),y+h*level[l+1]*.66,z+r*spread[l+1]*Math.sin(b)],
   S=[x+r*spread[l+1]*Math.cos(a),y+h*level[l+1]*.66,z+r*spread[l+1]*Math.sin(a)];
  quad(name,p,q,R,S);
 }
}
function addTree(x,z,rng,university){
 const height=(university?8.5:7.2)+rng()*7.7;
 const trunk=height*.51,r=(.22+rng()*.14);
 tapered('bark',x,.07,z,r,r*.62,trunk);
 const color=['foliage-deep','foliage-green','foliage-sunlit'][Math.floor(rng()*3)];
 canopy(color,x,trunk*.94,z,2.4+rng()*1.6,height-trunk);
 canopy('foliage-green',x+1.25,trunk*.85,z-.55,1.6+rng()*.75,2.6);
 canopy('foliage-deep',x-1.1,trunk*.86,z+.66,1.6+rng()*.75,2.3);
}
function lamp(x,z){
 box('lamp-steel',x,0,z,.16,7.5,.16);
 box('lamp-steel',x+.92,7.30,z,1.9,.12,.12);
 box('lamp-glass',x+1.70,7.17,z,.56,.22,.4);
}
function bench(x,z){
 box('bench-wood',x,.58,z,2.3,.16,.55);
 box('bench-wood',x,1.0,z+.22,2.3,.7,.13);
 for(const dx of [-.9,.9])box('lamp-steel',x+dx,0,z,.10,.65,.16);
}
function stall(x,z,variant){
 box('market-body',x,.05,z,2.2,2.25,1.65);
 box(variant?'market-roof':'foliage-deep',x,2.35,z,2.85,.20,2.25);
 box('lamp-steel',x-1.11,1.1,z+.82,.09,2.2,.12);
}
function inside(p,poly){
 let flag=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1]||1e-8)+a[0])flag=!flag;
 }return flag;
}
function make(i){
 const s=route.stations[i],center=[s.lon,s.lat],lonScale=111320*Math.cos(s.lat*Math.PI/180);
 const city=JSON.parse(readFileSync('data/buildings/'+i+'.json','utf8'));
 const polygons=(city.buildings||[]).filter(x=>Array.isArray(x.p)&&x.p.length>=4).map(x=>x.p.map(([lon,lat])=>[(lon-s.lon)*lonScale,-(lat-s.lat)*111320]));
 const start=Math.max(0,route.stationBreaks[i]-3),end=Math.min(route.points.length-1,route.stationBreaks[i]+3);
 const before=route.points[start],after=route.points[end];
 const vx=(after[1]-before[1])*lonScale,vz=-(after[0]-before[0])*111320;
 const len=Math.hypot(vx,vz)||1,along=[vx/len,vz/len],across=[-along[1],along[0]];
 const local=(alongMeters,lateralMeters)=>[along[0]*alongMeters+across[0]*lateralMeters,along[1]*alongMeters+across[1]*lateralMeters];
 const conflict=(x,z,margin=2)=>{
  if(Math.abs(x*across[0]+z*across[1])<21&&Math.abs(x*along[0]+z*along[1])<190)return true;
  return polygons.some(p=>{
   const xs=p.map(q=>q[0]),zs=p.map(q=>q[1]);
   const minX=Math.min(...xs)-margin,maxX=Math.max(...xs)+margin;
   const minZ=Math.min(...zs)-margin,maxZ=Math.max(...zs)+margin;
   return x>=minX&&x<=maxX&&z>=minZ&&z<=maxZ&&inside([x,z],p);
  });
 };
 const rng=seedFn(93277+i*34573);groupsNow=palette.map(()=>({p:[],n:[],indices:[]}));
 let placed=0, lamps=0, benches=0, stalls=0;
 const target=i===13?140:i===10?55:i===8?95:70;
 let tries=0;
 while(placed<target&&tries++<target*90){
  const segment=(rng()-.5)*470,side=(rng()-.5)*455;
  const p=local(segment,side);
  if(conflict(p[0],p[1],2.8))continue;
  // Large empty campus and mapped open blocks can hold trees; this is inferred, not surveyed.
  addTree(p[0],p[1],rng,i===13);placed++;
 }
 for(const side of [-1,1]){
  for(let d=-165;d<=165;d+=35){
   const p=local(d,side*28);
   if(conflict(...p,1.2))continue;
   lamp(...p);lamps++;
  }
 }
 if(i===13||i===8){
  for(let j=0;j<22;j++){
   const p=local((rng()-.5)*330,(rng()<.5?-1:1)*(27+rng()*18));
   if(conflict(...p,2))continue;
   bench(...p);benches++;
  }
 }
 if(i===10||i===11||i===5){
  for(let j=0;j<18;j++){
   const p=local((rng()-.5)*280,(rng()<.5?-1:1)*(36+rng()*10));
   if(conflict(...p,2.6))continue;
   stall(...p,j%2);stalls++;
  }
 }
 const blobs=[],views=[],accessors=[],primitives=[];let offset=0;
 function push(array,componentType,size,extrema=false){
  const b=componentType===5126?Buffer.from(new Float32Array(array).buffer):Buffer.from(new Uint32Array(array).buffer);
  const aligned=(4-offset%4)%4;
  if(aligned){blobs.push(Buffer.alloc(aligned));offset+=aligned}
  const view=views.push({buffer:0,byteOffset:offset,byteLength:b.length})-1;
  blobs.push(b);offset+=b.length;
  const ac={bufferView:view,componentType,count:array.length/size,type:size===3?'VEC3':'SCALAR'};
  if(extrema){
   ac.min=[Infinity,Infinity,Infinity];ac.max=[-Infinity,-Infinity,-Infinity];
   for(let k=0;k<array.length;k++){ac.min[k%3]=Math.min(ac.min[k%3],array[k]);ac.max[k%3]=Math.max(ac.max[k%3],array[k])}
  }
  return accessors.push(ac)-1;
 }
 let triangles=0;
 for(let m=0;m<groupsNow.length;m++){
  const g=groupsNow[m];if(!g.indices.length)continue;
  const p=push(g.p,5126,3,true),n=push(g.n,5126,3),ix=push(g.indices,5125,1);
  primitives.push({attributes:{POSITION:p,NORMAL:n},indices:ix,material:m});
  triangles+=g.indices.length/3;
 }
 if(!primitives.length)throw new Error('No primitives for station '+i);
 const binary=Buffer.concat(blobs);
 const gltf={
  asset:{version:'2.0',generator:'Dhaka MRT-6 open footprint exclusion + estimated street scenery'},
  scene:0,scenes:[{nodes:[0]}],nodes:[{name:s.n+' neighborhood furniture (approximate)',mesh:0}],
  meshes:[{name:s.n+' trees + fixtures',primitives}],materials,
  buffers:[{byteLength:binary.length,uri:'data:application/octet-stream;base64,'+binary.toString('base64')}],
  bufferViews:views,accessors,
  extras:{station:i,name:s.n,realData:'OpenStreetMap building footprints only',
   localCoordinates:'glTF X east Y up Z south; model origin at mapped station point',
   simulatedVegetation:placed,illustrativeStreetlamps:lamps,illustrativeBenches:benches,illustrativeStalls:stalls,
   triangles,warning:'Tree positions, market stands, lamp positions and dimensions are artist approximations, not verified physical positions',
   attribution:'© OpenStreetMap contributors, ODbL 1.0'}
 };
 writeFileSync(join(out,i+'.gltf'),JSON.stringify(gltf));
 return {station:i,trees:placed,lamps,benches,stalls,triangles};
}
const report=[];
for(let i=0;i<route.stations.length;i++){
 if(!existsSync('data/buildings/'+i+'.json'))continue;
 report.push(make(i));
}
writeFileSync(join(out,'manifest.json'),JSON.stringify({provenance:'OSM building exclusion; all scenery approximate',generatedBy:'scripts/build-neighborhood-details.mjs',models:report},null,2));
console.log('Generated neighborhood scenery for',report.length,'stations:',report);
