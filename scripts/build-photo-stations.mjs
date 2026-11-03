#!/usr/bin/env node
/**
 * MRT Line-6 original, per-station aerial-reference 3D architectural overlays.
 * Uses visual traits from the 2023 Daily Star gallery and 2016 DMTCL station
 * typology. NO copyrighted photographs are stored/exported in these models.
 * Outputs 16 independent glTF 2.0 meshes + machine-readable manifest.
 * All photo-inferred dimensions, unmatched roof parts, landmark arrangements
 * and street decorations remain ILLUSTRATIVE (not survey measurements).
 */
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
const dataset=JSON.parse(readFileSync("data/station-photo-profiles.json","utf8"));
const baseDir="assets/photo-stations";
mkdirSync(baseDir,{recursive:true});
const P=dataset.stations;
const colorHex={
 roof:"#238d68",roofEdge:"#125c4d",roofShine:"#55ab8e",red:"#ce5060",
 redEdge:"#9a303d",concrete:"#c4c0b7",frame:"#858e8d",brick:"#ac7160",
 lightBrick:"#cd9c88",glass:"#6491a2",glassBright:"#9fc9cf",glassDark:"#365c6e",
 white:"#d9dcd6",dark:"#454e53",asphalt:"#52575a",line:"#e1ded0",
 leaf:"#417c49",leaf2:"#64995a",trunk:"#6c5741",grass:"#7e9a6b",
 water:"#7298a0",waterShine:"#a5bdc0",towerBlue:"#2c5b7c",towerBlueLight:"#5191b5",
 gold:"#a5a68c",steel:"#697780",blueRoof:"#759caa",shade:"#78807b"
};
const C=Object.keys(colorHex);
const materials=C.map(name=>{
 const h=colorHex[name],rgb=[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)/255);
 const glass=name.toLowerCase().includes("glass")||name.startsWith("towerBlue");
 return {name,pbrMetallicRoughness:{baseColorFactor:[...rgb,1],
  metallicFactor:glass?.12:name==="steel"?.19:.035,
  roughnessFactor:glass?.26:.83},doubleSided:true};
});
const mIndex=Object.fromEntries(C.map((x,i)=>[x,i]));
function build(d){
 // Use the observed station-specific roof/brick palette, not one green for
 // all sixteen structures. Remaining material colours are illustrative.
 const toRGB=h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)/255);
 const scale=(hex,factor)=>{
  const rgb=toRGB(hex).map(x=>Math.min(.98,x*factor));
  return [...rgb,1];
 };
 const localMaterials=materials.map(m=>{
  const copy={...m,pbrMetallicRoughness:{...m.pbrMetallicRoughness}};
  const name=m.name;
  if(name==="roof")copy.pbrMetallicRoughness.baseColorFactor=[...toRGB(d.roofTone),1];
  if(name==="roofShine")copy.pbrMetallicRoughness.baseColorFactor=scale(d.roofTone,1.16);
  if(name==="roofEdge")copy.pbrMetallicRoughness.baseColorFactor=scale(d.roofTone,.65);
  if(name==="red")copy.pbrMetallicRoughness.baseColorFactor=[...toRGB(d.accent),1];
  if(name==="redEdge")copy.pbrMetallicRoughness.baseColorFactor=scale(d.accent,.7);
  if(name==="brick")copy.pbrMetallicRoughness.baseColorFactor=scale(d.accent,1.06);
  return copy;
 });
 const groups=C.map(()=>({p:[],n:[],i:[]}));const components={};
 function addTri(mat,a,b,c){
  const g=groups[mIndex[mat]],q=g.p.length/3;
  const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const len=Math.hypot(...n)||1;n=n.map(x=>x/len);
  for(const x of [a,b,c]){g.p.push(...x);g.n.push(...n)}
  g.i.push(q,q+1,q+2);
 }
 function quad(mat,a,b,c,e){addTri(mat,a,b,c);addTri(mat,a,c,e)}
 function box(mat,x,y,z,w,h,l,name="architectural component"){
  if(![x,y,z,w,h,l].every(Number.isFinite)||Math.min(w,h,l)<=0)throw Error("Bad model component");
  const ax=x-w/2,bx=x+w/2,ay=y-h/2,by=y+h/2,az=z-l/2,bz=z+l/2;
  quad(mat,[ax,ay,az],[ax,ay,bz],[ax,by,bz],[ax,by,az]);
  quad(mat,[bx,ay,bz],[bx,ay,az],[bx,by,az],[bx,by,bz]);
  quad(mat,[ax,ay,bz],[bx,ay,bz],[bx,by,bz],[ax,by,bz]);
  quad(mat,[bx,ay,az],[ax,ay,az],[ax,by,az],[bx,by,az]);
  quad(mat,[ax,by,az],[ax,by,bz],[bx,by,bz],[bx,by,az]);
  quad(mat,[ax,ay,bz],[ax,ay,az],[bx,ay,az],[bx,ay,bz]);
  components[name]=(components[name]||0)+1;
 }
 function beam(mat,a,b,width=.2,depth=.17,name="structural support"){
  const vec=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  const length=Math.hypot(...vec);if(length<.001)return;
  // Tetrahedrally braced slender beam, axis from a to b.
  const unit=vec.map(v=>v/length);
  const guide=Math.abs(unit[1])<.92?[0,1,0]:[1,0,0];
  let cross=[unit[1]*guide[2]-unit[2]*guide[1],unit[2]*guide[0]-unit[0]*guide[2],unit[0]*guide[1]-unit[1]*guide[0]];
  const cLen=Math.hypot(...cross)||1;cross=cross.map(x=>x/cLen*width/2);
  const p=(start,s)=>start.map((val,i)=>val+s*cross[i]);
  quad(mat,p(a,-1),p(a,1),p(b,1),p(b,-1));
  components[name]=(components[name]||0)+1;
 }
 function circleCylinder(mat,x,y,z,r,h,segments=22,name="cylindrical landmark"){
  for(let i=0;i<segments;i++){
   const a=i*Math.PI*2/segments,b=(i+1)*Math.PI*2/segments;
   const A=[x+r*Math.cos(a),y,z+r*Math.sin(a)],B=[x+r*Math.cos(b),y,z+r*Math.sin(b)];
   quad(mat,A,B,[B[0],y+h,B[2]],[A[0],y+h,A[2]]);
  }
  components[name]=(components[name]||0)+1;
 }
 function tree(x,z,h=5){
  box("trunk",x,h*.31,z,.26,h*.62,.27,"tree trunk");
  for(let k=0;k<3;k++)box(k%2?"leaf2":"leaf",x+(k-1)*.9,h*.79+(k%2)*.55,z+(k%2)*.65,2.5,h*.48,2.35,"tree canopy");
 }
 function office(x,z,w,l,levels,style=0){
  const h=levels*3.2;
  box(style%3===0?"lightBrick":style%3===1?"white":"brick",x,h/2,z,w,h,l,"multi-storey facade");
  box("concrete",x,h+.25,z,w+.7,.48,l+.55,"flat roof");
  const side=x<0?1:-1,faceX=x+side*(w/2+.08),cols=Math.min(7,Math.max(3,Math.round(l/3.6)));
  for(let level=0;level<levels;level++){
   const y=level*3.2+1.75;
   for(let col=0;col<cols;col++){
    const p=z+(col-(cols-1)/2)*(l-1.3)/cols;
    box(style%4===0?"glassBright":"glass",faceX,y,p,.16,1.48,(l-1.6)/cols*.71,"window");
   }
   if(level%2===1){
    box("shade",faceX+side*.45,y-1.15,z,.82,.18,l*.75,"balcony");
    box("steel",faceX+side*.88,y-.77,z,.07,.59,l*.73,"balcony rail");
   }
  }
  for(let t=0;t<2;t++)box("dark",x+(t-.5)*w*.35,h+.9,z+1.2,.9,1.2,1.0,"roof water tank");
 }
 function officeTower(x,z,levels=17){
  office(x,z,26,27,levels,2);
  for(let i=1;i<levels;i++){
   box("glassBright",x+13.14,i*3.2+1.4,z,.1,1.82,21,"reflective tower wall");
   box("steel",x+13.19,i*3.2+.23,z,.19,.2,22,"window horizontal rail");
  }
 }
 function pond(x,z,w,l){
  box("grass",x,.08,z,w+4,.16,l+4,"grassy banks");
  box("water",x,.2,z,w,.035,l,"water body");
  for(let i=0;i<8;i++)box("waterShine",x+(i-3.5)*w/9,.245,z+.5,.45,.02,l*.45,"pond surface reflection");
  for(let i=0;i<12;i++)tree(x+w/2+2,z-l/2+(i+.5)*l/12,4+(i%4)*.38);
 }
 function field(x,z,w,l){
  box("gold",x,.052,z,w,.065,l,"bare earth/open field");
  for(let i=0;i<14;i++)box("grass",x+(i%5-2)*w/6,.098,z+(i%7-3)*l/8,w/14,.045,l/15,"patchy greenery");
 }
 function roadway(x,z,w,l){
  box("asphalt",x,.04,z,w,.07,l,"road");
  for(let i=0;i<Math.floor(l/11);i++)
   box("line",x,.088,z-l/2+5.5+i*11,.12,.018,4.1,"lane marking");
 }
 function bridge(x,z,span){
  box("concrete",x,12.15,z,span,.75,5.9,"overhead pedestrian bridge");
  for(const k of [-2.5,2.5]){
   box("glass",x,13.75,z+k,span,2.15,.12,"glazed walkway");
   box("steel",x,14.95,z+k,span,.19,.17,"bridge handrail");
  }
  box("roofEdge",x,16.05,z,span+1,.20,7.1,"covered bridge canopy");
 }
 function market(x,z,count=8){
  for(let i=0;i<count;i++){
   const dx=x+(i%2)*5,dz=z+(i-(count-1)/2)*5.3;
   box("lightBrick",dx,1.2,dz,3.4,2.4,3.5,"street stall");
   box(["red","blueRoof","roof","shade"][i%4],dx,2.55,dz,4.0,.26,4.3,"market canopy");
  }
 }
 function amphitheatre(x,z){
  box("grass",x,.1,z,31,.12,30,"TSC campus plaza");
  for(let j=0;j<5;j++){
   const radius=7+j*2.5;
   for(let i=0;i<25;i++){
    const t=i/25*Math.PI*2;
    const xx=x+Math.cos(t)*radius,zz=z+Math.sin(t)*radius;
    box(j%2?"lightBrick":"concrete",xx,.23+j*.11,zz,1.85,.29,1.3,"TSC amphitheatre tier");
   }
  }
 }
 function circularBlueTower(x,z){
  const floors=13,r=13.8;
  circleCylinder("towerBlue",x,0,z,r,floors*3.1,32,"Mirpur 10 circular glass office");
  for(let i=0;i<floors;i++){
   circleCylinder(i%3===0?"glassBright":"towerBlueLight",x,i*3.1+2.6,z,r+.22,.28,32,"blue circular tower floor line");
   circleCylinder("steel",x,i*3.1+.05,z,r+.25,.10,32,"circular horizontal aluminium band");
  }
  box("white",x,floors*3.1+.23,z,15,.42,15,"rounded tower flat roof parapet");
 }
 // Separate reference-specific 3D neighborhood silhouettes. Do not cover
 // existing track or detailed station; additions begin >=45 m laterally.
 const city=d.scene;
 const dense=city.includes("dense")||city.includes("office")||city.includes("highrise")||city.includes("market");
 if(city==="uttara-open"){
  field(83,-74,85,92);field(-83,67,75,83);
  pond(93,57,58,74);pond(-101,-72,53,54);
  for(let i=0;i<6;i++)office(i%2?115:-112,-116+i*45,15,20,4+i%3,i);
  bridge(31,-42,33);
 }else if(city==="field-city"){
  field(94,15,90,145);
  for(let i=0;i<15;i++)office(-64-(i%3)*22,-130+(i*19)%255,13+(i%3)*3,15+(i%4)*2,6+i%5,i);
  roadway(55,-5,9,250);market(-48,-51,6);
 }else if(city==="mirpur-dense"){
  for(let i=0;i<22;i++){
   const side=i%2?1:-1,x=side*(52+(i%4)*23),z=-126+(i*41%252);
   office(x,z,13+i%4*3,15+i%3*4,4+(i*7%6),i);
  }
  roadway(51,0,12,250);market(-49,-69,9);
 }else if(city==="mirpur-roundabout"){
  circularBlueTower(76,22);
  for(let i=0;i<13;i++)office(i%2?111:-89,-125+i*20,18,19,6+i%6,i);
  roadway(52,0,15,240);roadway(103,-45,14,153);
  bridge(15,-92,93);market(-59,60,10);
 }else if(city==="pond-park"){
  pond(103,10,82,92);for(let i=0;i<26;i++)tree(45+i%6*12,-115+(i*27%205),5+i%5);
  office(-74,-75,21,25,6,2);office(-82,61,28,23,9,3);
 }else if(city==="bijoy-green"){
  for(let i=0;i<57;i++)tree((i%2?1:-1)*(48+(i*13%109)),-138+(i*29%270),5.4+(i%6)*.3);
  roadway(-79,13,16,257);roadway(75,-6,11,254);
  box("grass",112,.06,76,73,.12,63,"civic open green field");
  office(115,-83,37,26,3,1);
 }else if(city==="farmgate-market"){
  for(let i=0;i<21;i++)office((i%2?1:-1)*(55+i%5*19),-133+(i*31%266),18,19,6+(i*5%7),i);
  market(-48,61,18);roadway(60,0,15,270);
  bridge(17,66,53);
 }else if(city==="karwan-office"){
  officeTower(74,42,17);officeTower(125,-57,13);
  for(let i=0;i<11;i++)office(-55-(i%4)*22,-126+(i*22),20,21,8+(i%6),i);
  roadway(59,1,17,280);market(-56,80,10);
 }else if(city==="park-campus"){
  for(let i=0;i<d.trees;i++)tree((i%2?1:-1)*(52+i%8*14),-137+(i*43)%275,5+(i%5)*.6);
  office(125,-50,49,28,5,1);office(-122,85,45,35,4,2);
  roadway(70,0,11,270);
 }else if(city==="tsc-campus"){
  for(let i=0;i<d.trees;i++)tree((i%2?1:-1)*(48+i%8*11),-140+(i*31)%279,6+(i%6)*.55);
  amphitheatre(103,-31);office(117,81,55,25,3,0);
  office(-129,-57,51,36,3,1);
 }else if(city==="press-office"){
  for(let i=0;i<18;i++)office((i%2?1:-1)*(56+(i%4)*21),-122+(i*33)%245,22,23,6+(i%7),i);
  roadway(60,0,18,285);bridge(-29,-57,57);
 }else if(city==="motijheel-highrise"){
  for(let i=0;i<19;i++)office((i%2?1:-1)*(54+(i%4)*25),-132+(i*29)%269,21,24,9+(i*11%11),i);
  pond(133,33,37,75);roadway(58,0,17,280);
  market(-52,-85,8);
 }
 // Photo-based architecture highlighting above existing roofs; do not build
 // another full station over the specialist Agargaon/Farmgate/TSC models.
 if(!d.existingDetailed){
  const halfW=d.width/2,span=d.length;
  const arch=d.roof.includes("arch")||d.roof.includes("terminal"),redRoof=d.roof==="red-fin-arch";
  for(let i=0;i<25;i++){
   const x=(i-12)*d.width/25;
   const radial=1-Math.pow(x/(halfW+.3),2);
   const y=arch?29.3+2.6*radial:29.4+1.1*radial;
   box("roof",x,y,0,d.width/25+.06,.20,span+.6,"roof color matched green panel");
   box("roofShine",x,y+.15,0,.05,.075,span,"corrugated roof seam");
   if(i===0||i===24)box("roofEdge",x,y-.17,0,.25,.29,span+1.3,"green roof edge");
  }
  if(redRoof){
   for(let z=-span/2+9;z<span/2-8;z+=13.3){
    for(const side of [-1,1]){
     const midx=side*(d.width*.28);
     const base=29.45+1.7*(1-(midx/halfW)**2);
     addTri("red",[midx-3,base+.26,z-3.6],[midx+3.0,base+.48,z+3.4],[midx+3.0,base+2.7,z-3.3]);
     addTri("redEdge",[midx-3,base+.26,z-3.6],[midx+3.0,base+2.7,z-3.3],[midx+3.2,base+.50,z+3.4]);
     components["triangular red roof motif"]=(components["triangular red roof motif"]||0)+2;
    }
   }
  }
  for(const side of [-1,1]){
   for(let z=-span/2+8;z<span/2-6;z+=7){
    box("glass",side*(halfW-.1),22.75,z,.11,4.5,6.3,"photo-like station windows");
    box("frame",side*(halfW+.07),22.85,z+3.2,.23,4.8,.18,"station window mullion");
    box("brick",side*(halfW+.12),15.6,z,.29,2.2,5.0,"station reddish masonry band");
   }
   // Matching green covered entrance footbridges.
   bridge(side*29,side*39,30);
  }
  for(let z=-span/2+11;z<span/2-10;z+=12)
   beam("steel",[-halfW,25.8,z],[halfW,25.8,z],.23,.20,"roof truss");
 }
 // Photo-aligned landmark silhouette is original geometry; no photo texture copied.
 const buffers=[],bufferViews=[],accessors=[],primitives=[];let byteOffset=0,triangleCount=0;
 function accessor(arr,type,n,bounds=false){
  const typed=type===5126?new Float32Array(arr):new Uint32Array(arr);
  const buf=Buffer.from(typed.buffer),view=bufferViews.length;
  bufferViews.push({buffer:0,byteOffset,byteLength:buf.length,target:type===5126?34962:34963});
  byteOffset+=buf.length;buffers.push(buf);
  const a={bufferView:view,componentType:type,count:arr.length/n,type:n===3?"VEC3":"SCALAR"};
  if(bounds){
   a.min=Array(n).fill(Infinity);a.max=Array(n).fill(-Infinity);
   for(let k=0;k<arr.length;k++){const j=k%n;a.min[j]=Math.min(a.min[j],arr[k]);a.max[j]=Math.max(a.max[j],arr[k]);}
  }
  return accessors.push(a)-1;
 }
 for(let k=0;k<groups.length;k++){
  const g=groups[k];if(!g.i.length)continue;
  const p=accessor(g.p,5126,3,true),n=accessor(g.n,5126,3),ix=accessor(g.i,5125,1);
  primitives.push({attributes:{POSITION:p,NORMAL:n},indices:ix,material:k,mode:4});
  triangleCount+=g.i.length/3;
 }
 const blob=Buffer.concat(buffers);
 const data={asset:{version:"2.0",generator:"Dhaka MRT-6 Daily Star aerial reference study (original geometry)"},
  scenes:[{nodes:[0]}],scene:0,nodes:[{name:"Station "+d.id+" photo-informed architecture and surroundings",mesh:0}],
  meshes:[{primitives}],materials:localMaterials,buffers:[{byteLength:blob.length,
    uri:"data:application/octet-stream;base64,"+blob.toString("base64")}],
  bufferViews,accessors,
  extras:{id:d.id,station:d.n,scene:d.scene,roof:d.roof,
   officialDesignWidthM:d.width,proposedArchitectureType:d.type,
   photoRoofColor:d.roofTone,photoAccentColor:d.accent,
   referenceURL:d.photo,sourceGallery:dataset.gallery,
   sourcePhotoCreditedTo:dataset.photographer,sourceCopyrightOwner:dataset.publication,
   precision:"Visual likeness only. Shapes/colors approximate. Not a scanned/surveyed 1:1 replica.",
   photographsEmbedded:false,components,triangles:triangleCount,drawGroups:primitives.length}
 };
 writeFileSync(baseDir+"/"+d.id+".gltf",JSON.stringify(data));
 return {id:d.id,name:d.n,roof:d.roof,roofTone:d.roofTone,accent:d.accent,scene:d.scene,components:Object.values(components).reduce((a,b)=>a+b,0),triangles:triangleCount,drawGroups:primitives.length,bytes:blob.length,
  referenceURL:d.photo,verifiedDirectPhotoURL:!!d.photo};
}
const manifest=P.map(build);
writeFileSync(baseDir+"/manifest.json",JSON.stringify({gallery:dataset.gallery,photoEvidence:"Photo-inspired original 3D geometry. Licensed photographs NOT republished.",models:manifest},null,2));
console.log("Created",manifest.length,"unique photo-inspired MRT6 3D urban architecture meshes; triangles:",manifest.reduce((a,b)=>a+b.triangles,0));
