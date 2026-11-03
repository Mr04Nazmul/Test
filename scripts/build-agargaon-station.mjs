#!/usr/bin/env node
/**
 * Photo-referenced, schematic Agargaon MRT-6 station for Cesium.
 * Referenced features: long arched green corrugated roof, red-brick bands,
 * concrete frames, glass platform windows, covered street entrances, stairs,
 * roadway under the viaduct. Geometry is authored procedurally and is
 * NOT a laser-scanned / surveyed replica or Google Earth export.
 * Node 20+, no npm dependencies. Creates assets/agargaon-station.gltf.
 */
import {writeFileSync,mkdirSync} from "node:fs";
import {join} from "node:path";

const assets=join(process.cwd(),"assets");mkdirSync(assets,{recursive:true});
const palette={
 concrete:"#b3b2ac",concreteLight:"#d6d3ca",concreteDark:"#797c7c",
 brick:"#a65648",brickLight:"#c67e67",brickMortar:"#d8aca0",
 metal:"#778886",silver:"#bac2be",black:"#2d383b",
 roof:"#178363",roofLight:"#289e7b",roofDark:"#16694f",
 glass:"#6c9198",glassDark:"#385f65",windowLight:"#92b9bb",
 platform:"#c8c9c2",tactile:"#dbc74c",white:"#e4e6df",
 asphalt:"#383d42",asphaltLight:"#4c5155",marking:"#e7e4d3",
 plant:"#397a45",plantLight:"#5c9861",trunk:"#705a43",
 carWhite:"#c7d0cf",carGreen:"#218b6d",carRed:"#b64c48",
 bus:"#2d7469",busStrip:"#d8d2c7",rickshaw:"#228760",
 wheel:"#26292b",lamp:"#efdfb4",sign:"#087a60"
};
const materials=Object.entries(palette).map(([name,color])=>{
 const n=parseInt(color.slice(1),16);
 const base=[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255,1];
 const glass=name.startsWith("glass")||name==="windowLight";
 if(glass)base[3]=.72;
 return {name,alphaMode:glass?"BLEND":"OPAQUE",doubleSided:true,
  pbrMetallicRoughness:{baseColorFactor:base,metallicFactor:glass?.14:0.04,roughnessFactor:glass?.25:0.83}};
});
const matIds=Object.fromEntries(Object.keys(palette).map((n,i)=>[n,i]));
// One unit cube reused for all structural parts and street furniture.
const face=[
 {n:[0,0,1],v:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
 {n:[0,0,-1],v:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
 {n:[1,0,0],v:[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]},
 {n:[-1,0,0],v:[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]},
 {n:[0,1,0],v:[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]},
 {n:[0,-1,0],v:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]}
];
const pos=[],nor=[],ind=[];
for(const f of face){
 const start=pos.length/3;
 for(const v of f.v){pos.push(...v);nor.push(...f.n);}
 ind.push(start,start+1,start+2,start,start+2,start+3);
}
const bytes=[Buffer.from(new Float32Array(pos).buffer),Buffer.from(new Float32Array(nor).buffer),Buffer.from(new Uint16Array(ind).buffer)];
const bufferViews=[];let offset=0;
for(let i=0;i<bytes.length;i++){
 bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes[i].length});
 offset+=bytes[i].length;
}
const accessors=[
 {bufferView:0,componentType:5126,count:24,type:"VEC3",min:[-.5,-.5,-.5],max:[.5,.5,.5]},
 {bufferView:1,componentType:5126,count:24,type:"VEC3"},
 {bufferView:2,componentType:5123,count:36,type:"SCALAR",min:[0],max:[23]}
];
const meshes=materials.map((mat,i)=>({name:mat.name+" component",primitives:[{
 attributes:{POSITION:0,NORMAL:1},indices:2,material:i
}]}));
const nodes=[];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const deg=v=>v*Math.PI/180;
function box(name,material,x,y,z,w,h,d,rotation){
 const node={name,mesh:matIds[material],translation:[x,y,z],scale:[w,h,d]};
 if(rotation)node.rotation=rotation;
 nodes.push(node);
 return nodes.length-1;
}
function quatYTo(dx,dy,dz){
 const len=Math.hypot(dx,dy,dz)||1;
 const x=dx/len,y=dy/len,z=dz/len;
 if(y<-.999999)return [1,0,0,0];
 const q=[z,0,-x,1+y],L=Math.hypot(...q);
 return q.map(v=>v/L);
}
function link(name,mat,a,b,width=.12,depth=.12){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
 if(length<.01)return;
 box(name,mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,width,length,depth,quatYTo(dx,dy,dz));
}
function rotationZ(angle){return [0,0,Math.sin(angle/2),Math.cos(angle/2)]}
function greenery(x,z,h=3){
 box("small planted tree / trunk","trunk",x,h*.29,z,.24,h*.58,.24);
 box("rounded tree canopy base","plant",x,h*.78,z,2.1,h*.65,2.1,rotationZ(deg(14)));
 box("tree canopy lighter patch","plantLight",x-.4,h*.96,z+.36,1.5,h*.39,1.5);
}
function car(x,z,color="carWhite",heading=1){
 const a=heading;
 box("street vehicle body",color,x,.95,z,1.9,1.05,3.9);
 box("street vehicle top","glassDark",x,1.7,z-.20*a,1.68,.66,2.15);
 for(const xx of [-.82,.82])for(const zz of [-1.25,1.25]){
  box("wheel axle side","wheel",x+xx,.53,z+zz*a,.25,.52,.59);
 }
 box("windscreen glint","windowLight",x,1.81,z+1.05*a,1.4,.13,.09);
}
function bus(x,z,a=1){
 box("green city bus chassis","bus",x,1.45,z,2.45,2.1,9.5);
 box("cream transit roof","busStrip",x,2.75,z,2.45,.55,9.4);
 for(let t=-3.5;t<=3.6;t+=1.15){
  for(const side of [-1,1])box("bus glazing","glassDark",x+side*1.24,2.04,z+t*a,.035,.8,.86);
 }
 for(const zz of [-3.1,3])for(const side of [-1,1])
  box("bus wheel","wheel",x+side*1.1,.53,z+zz, .39,.86,.87);
 box("bus destination band","roofLight",x,1.75,z+4.77*a,1.9,.55,.05);
}
function rickshaw(x,z){
 box("green autorickshaw body","rickshaw",x,.95,z,1.35,1.05,2.25);
 box("auto dark windshield","glassDark",x,1.59,z+.48,1.24,.82,.9);
 box("auto roof","rickshaw",x,2.0,z-.12,1.38,.14,2.0);
 for(const side of [-1,1])box("autorickshaw rear wheel","wheel",x+side*.62,.42,z-.45,.20,.48,.54);
 box("autorickshaw front wheel","wheel",x,.37,z+.78,.44,.45,.35);
}
// Ground roads run along the station; placement is intentionally illustrative.
for(const side of [-1,1]){
 box("asphalt carriageway","asphalt",side*18.6,.025,0,34,.05,282);
 box("road side sidewalk","concreteLight",side*35.8,.14,0,3.4,.28,282);
 box("curb edge","white",side*33.5,.15,0,.28,.3,282);
 box("sidewalk tactile paving","tactile",side*36.1,.30,0,.38,.02,270);
 for(let z=-132;z<=132;z+=12){
  box("broken lane stripe","marking",side*16,.058,z,.12,.016,5.0);
  box("second lane stripe","marking",side*26,.058,z,.12,.016,5.0);
 }
 for(let z=-120;z<=120;z+=23){
  if(Math.abs(z)>73)greenery(side*39,z,3.4);
 }
}
box("concrete central median island","concreteLight",0,.17,0,2,.32,282);
for(let z=-128;z<=126;z+=9){
 box("planted central median strip","plant",0,.41,z,1.28,.16,5.0);
}
// Broad carriageway and undercroft structure.
box("station undercroft deck","concrete",0,11.8,0,33,1.5,163);
box("east red brick fascia","brick",15.0,13.8,0,1.1,5.0,153);
box("west red brick fascia","brick",-15.0,13.8,0,1.1,5.0,153);
for(let side of [-1,1]){
 for(let z=-65;z<=65;z+=13){
  box("exposed concrete frame pier","concreteLight",side*14.6,13.75,z,1.7,9.0,1.5);
  if(Math.abs(z)<50){
   box("red brick wall infill","brick",side*15.3,13.85,z+6.4,.48,3.2,10.4);
   box("brick band trim","brickLight",side*15.6,15.5,z+6.3,.17,.18,10.4);
  }
 }
 // Structural columns beneath the station, leaving vehicle passages.
 for(let z=-58;z<=58;z+=29){
  box("elevated concrete support pillar","concreteLight",side*11.7,5.1,z,1.62,10.2,2.0);
  box("support pillar cap","concrete",side*11.7,10.8,z,2.7,1.25,3.0);
 }
}
// Track clearance, elevated platform ends, yellow safety strips.
for(const side of [-1,1]){
 box("raised side platform","platform",side*10.1,18.75,0,8.15,.72,151);
 box("tactile yellow platform line","tactile",side*5.76,19.126,0,.42,.02,145);
 box("platform edge dark safety gap","concreteDark",side*5.38,18.90,0,.16,.12,148);
 box("platform metal barrier","silver",side*5.70,20.18,0,.095,1.3,146);
 for(let z=-68;z<=68;z+=5.5){
  box("platform screen door silver stile","metal",side*5.70,20.3,z,.16,1.52,.15);
 }
 // Long side glazing & vertical mullions.
 for(let z=-73;z<=73;z+=8.3){
  box("platform exterior blue-tinted glass","glass",side*15.7,22.35,z,.12,5.95,7.4);
  box("glazed window dividing post","silver",side*15.8,22.2,z+3.8,.24,6.1,.3);
  box("horizontal sill","concreteLight",side*15.8,19.3,z,.30,.36,7.8);
  box("horizontal upper beam","concreteLight",side*15.8,25.55,z,.30,.42,7.9);
 }
 // Streetfront brick pillars.
 for(let z=-72;z<=72;z+=14)
  box("red brick outer facade post","brickLight",side*16.03,16.55,z,.72,5.15,.85);
}
// Green sweeping convex station canopy roof.
const curve=x=>27.45+3.65*(1-Math.pow(clamp(x/17,-1,1),2));
for(let i=-13;i<=13;i++){
 const x=i*1.20;
 const ya=curve(x-.6),yb=curve(x+.6),angle=Math.atan2(yb-ya,1.2);
 box("corrugated green arched roof strip",i%3===0?"roofLight":"roof",x,(ya+yb)/2,0,1.27,.22,167,rotationZ(angle));
 box("metal longitudinal roof seam","roofDark",x,(ya+yb)/2+.12,0,.055,.07,167,rotationZ(angle));
}
for(let z=-81;z<=81;z+=10.0){
 link("roof steel truss bottom tie","metal",[-15.5,26.70,z],[15.5,26.70,z],.22,.26);
 for(let x=-15;x<=15;x+=3){
  link("roof diagonal triangular support","silver",[x,26.7,z],[x+1.5,curve(x+1.5)-.5,z],.14,.14);
 }
 for(let side of [-1,1]){
  link("roof eave upper brace","metal",[side*15.4,25.55,z],[side*15.4,curve(15.4),z],.28,.25);
 }
}
for(const side of [-1,1]){
 box("green roof edge fascia","roofDark",side*16.45,27.80,0,.54,.65,169);
 box("metallic eave drainage channel","silver",side*16.65,27.39,0,.18,.14,169);
}
// Two covered entrances on the west and east sides, green stair canopies.
for(const side of [-1,1]){
 const x=side*25.8;
 for(const end of [-1,1]){
  const z0=end*47;
  box("entrance pavement","concreteLight",x,.16,z0,8.0,.32,17.0);
  // Entrance stair with 24 visible steps from street to 11m elevated concourse.
  for(let step=0;step<24;step++){
   const zz=z0+(step-12)*.53*end;
   const yy=.50+step*.45;
   box("individual entrance staircase step","platform",x,yy,zz,4.15,.16,.60);
  }
  link("stair left hand rail","silver",[x-2.25,.8,z0-6.9*end],[x-2.25,12.15,z0+6.9*end],.08,.08);
  link("stair right hand rail","silver",[x+2.25,.8,z0-6.9*end],[x+2.25,12.15,z0+6.9*end],.08,.08);
  for(let i=0;i<8;i++){
   const z=z0+(i-4)*1.55*end,yy=1.2+i*1.30;
   for(const dx of [-2.25,2.25])link("stair safety rail vertical","silver",[x+dx,yy-.9,z],[x+dx,yy+.20,z],.055,.055);
  }
  // Green curved entrance cap, a landmark in actual Agargaon photos.
  for(let i=-3;i<=3;i++){
   const xx=x+i*.78;
   const yroof=12.7+1.12*(1-Math.pow(i/4,2));
   box("entrance canopy green curved rib",i%2===0?"roofLight":"roof",xx,yroof,z0,.81,.14,16.5);
  }
  for(const dx of [-2.7,2.7]){
   for(const zz of [z0-7.8,z0+7.8])
    box("arched entrance canopy support","metal",x+dx,7.5,zz,.17,13.4,.17);
  }
  // Connecting pedestrian walkway from the stairs to the station.
  const bridgeX=side*20.0;
  box("entrance bridge deck","concreteLight",bridgeX,11.8,z0,11.8,.75,6.4);
  for(const dz of [-2.8,2.8]){
   box("entrance bridge stainless rail","silver",bridgeX,13.4,z0+dz,11.9,.13,.12);
   box("entrance bridge tinted glazing","glass",bridgeX,12.65,z0+dz,11.5,1.35,.10);
  }
 }
}
// Exterior station nameplate on masonry at entry. Words rendered separately
// by Cesium label to preserve Bangla glyph support.
for(const side of [-1,1]){
 box("Agargaon station nameplate background","white",side*16.5,15.55,-41.2,.20,1.30,11.6);
 box("green line nameplate border","sign",side*16.65,14.85,-41.2,.06,.12,11.6);
}
// Roadside lamp posts and illustrative traffic.
for(const side of [-1,1])for(let z=-111;z<=111;z+=28){
 box("roadside streetlamp pole","silver",side*32,4.9,z,.17,9.8,.17);
 link("streetlamp bent arm","silver",[side*32,9.70,z],[side*29.3,9.80,z],.13,.13);
 box("streetlamp light head","lamp",side*29.4,9.69,z,.65,.14,.32);
}
car(-15,-96,"carWhite");
car(-25,-62,"carRed");
car(-16,94,"carGreen");
car(21,101,"carWhite");
car(28,-106,"carWhite");
bus(25,18);
bus(-22,-115,-1);
rickshaw(28,64);
rickshaw(-26,101);
rickshaw(16,-85);
for(const x of [-38,38])for(const z of [-85,86])greenery(x,z,4.4);
const meshBuffer=Buffer.concat(bytes);
const gltf={
 asset:{version:"2.0",generator:"Agargaon MRT-6 photographed-feature procedural architecture v1"},
 scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,
 buffers:[{byteLength:meshBuffer.length,uri:"data:application/octet-stream;base64,"+meshBuffer.toString("base64")}],
 bufferViews,accessors,
 extras:{
  subject:"Agargaon elevated metro station (MRT Line 6), Dhaka, Bangladesh",
  classification:"photo-referenced architectural approximation, not a surveyed 3D scan",
  orientation:"local glTF Z is longitudinal rail direction; same layout convention as original MRT6 model",
  facade:"green curved roof, brick/concrete facade, platform glass, stair entrances, covered footbridges",
  notReal:"vehicle traffic is static decoration, roads and geometry are approximated; do not infer actual building measurements",
  sources:[
   "https://commons.wikimedia.org/wiki/File:Agargaon_metro_station_entrance_15.jpg",
   "https://commons.wikimedia.org/wiki/Category:Agargaon_metro_station"
  ],
  count:nodes.length
 }
};
const output=join(assets,"agargaon-station.gltf");
writeFileSync(output,JSON.stringify(gltf));
console.log("Agargaon 3D station created:",output,"nodes="+nodes.length,"meshes="+meshes.length);
