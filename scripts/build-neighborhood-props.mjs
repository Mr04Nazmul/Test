#!/usr/bin/env node
/* Original approximate Farmgate street micro-models. Metres, Y-up, Z along line.
   Not photogrammetry, not real-time, no third-party imagery or copied assets. */
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('assets',{recursive:true});
const colors={concrete:'#ada9a0',old:'#817c75',plaster:'#c5b7a5',brick:'#936653',glass:'#375469',metal:'#58646c',silver:'#b5b9b4',black:'#2a3238',wires:'#23292e',asphalt:'#414449',white:'#eceae0',yellow:'#e5bd51',green:'#2f7055',leaves:'#315d3e',leaf2:'#588053',tree:'#65513a',red:'#bb4938',blue:'#2c6c9e',teal:'#168783',orange:'#cc873e',purple:'#844c73',fabric:'#d1ab6f',skin:'#ae7758',skin2:'#d49b73',shirt:'#507aa1',shirt2:'#e0d8be',pants:'#404d60',shoes:'#2d3439',darkglass:'#23343e'};
let groups={},parts=0;
function get(m){return groups[m]||(groups[m]={p:[],n:[],i:[]})}
function tri(m,a,b,c){const g=get(m),k=g.p.length/3,u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;for(const p of [a,b,c]){g.p.push(...p);g.n.push(...n.map(x=>x/l))}g.i.push(k,k+1,k+2)}
function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d)}
function box(m,x,y,z,w,h,d,ang=0){const c=Math.cos(ang),s=Math.sin(ang),p=(u,v,t)=>[x+c*u-s*t,y+v,z+s*u+c*t],u=w/2,v=d/2,a=p(-u,0,-v),b=p(u,0,-v),c1=p(u,h,-v),d1=p(-u,h,-v),e=p(-u,0,v),f=p(u,0,v),g=p(u,h,v),j=p(-u,h,v);quad(m,a,b,c1,d1);quad(m,f,e,j,g);quad(m,e,a,d1,j);quad(m,b,f,g,c1);quad(m,d1,c1,g,j);quad(m,e,f,b,a);parts++}
function pole(m,a,b,r,n=8){let axis=b.map((v,i)=>v-a[i]),len=Math.hypot(...axis);if(!len)return;let d=axis.map(v=>v/len),seed=Math.abs(d[1])>.9?[1,0,0]:[0,1,0],u=[d[1]*seed[2]-d[2]*seed[1],d[2]*seed[0]-d[0]*seed[2],d[0]*seed[1]-d[1]*seed[0]],l=Math.hypot(...u);u=u.map(v=>v/l);const v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]],point=(p,t)=>p.map((x,i)=>x+r*(Math.cos(t)*u[i]+Math.sin(t)*v[i]));for(let k=0;k<n;k++){const t=k*2*Math.PI/n,t2=(k+1)*2*Math.PI/n;quad(m,point(a,t),point(b,t),point(b,t2),point(a,t2));}parts++}
function ball(m,x,y,z,r){const L=5,N=9,pt=(p,t)=>[x+r*Math.cos(p)*Math.cos(t),y+r*Math.sin(p),z+r*Math.cos(p)*Math.sin(t)];for(let i=0;i<L;i++)for(let j=0;j<N;j++){let a=-Math.PI/2+Math.PI*i/L,b=-Math.PI/2+Math.PI*(i+1)/L,t=2*Math.PI*j/N,u=2*Math.PI*(j+1)/N;quad(m,pt(a,t),pt(a,u),pt(b,u),pt(b,t));}parts++}
function umbrella(x,z,i){pole('metal',[x,0,z],[x,2.7,z],.05);for(let j=0;j<10;j++){const a=j*2*Math.PI/10,b=(j+1)*2*Math.PI/10;tri(['red','teal','blue','orange','purple'][(j+i)%5],[x,2.9,z],[x+1.6*Math.cos(a),2.34,z+1.6*Math.sin(a)],[x+1.6*Math.cos(b),2.34,z+1.6*Math.sin(b)]);}}
function human(x,z,i){const h=1.5+(i*7%9)*.041,skin=i%4===0?'skin2':'skin',shirt=['shirt','shirt2','red','blue','green','purple'][i%6];for(let s of [-1,1]){box('shoes',x+s*.13,.02,z,.24,.12,.37);box('pants',x+s*.13,.12,z,.22,h*.37,.24);pole(skin,[x+s*.3,h*.71,z],[x+s*.37,h*.42,z+.07],.074,6);}box(shirt,x,h*.40,z,.5,h*.37,.3);pole(skin,[x,h*.77,z],[x,h*.88,z],.08,6);ball(skin,x,h*.95,z,.16);}
function save(name){const materials=Object.entries(colors).map(([k,c])=>({name:k,pbrMetallicRoughness:{baseColorFactor:[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255).concat(1),roughnessFactor:k.includes('glass')?.25:.82,metallicFactor:k==='metal'?.55:0},doubleSided:true})),names=Object.keys(colors);let buf=[],views=[],acc=[],prim=[],offset=0,triangleCount=0;function array(v,kind,n,bounds=false){const a=kind===5126?new Float32Array(v):new Uint32Array(v),b=Buffer.from(a.buffer),ix=views.length;views.push({buffer:0,byteOffset:offset,byteLength:b.length,target:kind===5126?34962:34963});offset+=b.length;buf.push(b);const o={bufferView:ix,componentType:kind,count:v.length/n,type:n===3?'VEC3':'SCALAR'};if(bounds){o.min=[Infinity,Infinity,Infinity];o.max=[-Infinity,-Infinity,-Infinity];for(let j=0;j<v.length;j++){let k=j%3;o.min[k]=Math.min(o.min[k],v[j]);o.max[k]=Math.max(o.max[k],v[j])}}return acc.push(o)-1}
for(const [m,g] of Object.entries(groups)){if(!g.i.length)continue;const p=array(g.p,5126,3,true),n=array(g.n,5126,3),i=array(g.i,5125,1);prim.push({attributes:{POSITION:p,NORMAL:n},indices:i,material:names.indexOf(m),mode:4});triangleCount+=g.i.length/3}
const binary=Buffer.concat(buf),gltf={asset:{version:'2.0',generator:'Dhaka MRT-6 station neighborhood procedural 3D'},scene:0,scenes:[{nodes:[0]}],nodes:[{name,mesh:0}],meshes:[{name,primitives:prim}],materials,buffers:[{uri:'data:application/octet-stream;base64,'+binary.toString('base64'),byteLength:binary.length}],bufferViews:views,accessors:acc,extras:{source:'illustrative street furniture around OSM-anchored MRT-6 stations; tree and pedestrian placements are not mapped survey data',units:'metres',partCount:parts,triangles:triangleCount,verifiedActualLocation:false}};
writeFileSync('assets/'+name+'.gltf',JSON.stringify(gltf));console.log(name,parts+' parts',triangleCount+' triangles',Math.round(binary.length/1024)+' KiB');groups={};parts=0;}


/* Scene complements actual OSM building-footprint meshes (urban/*.gltf).
 * Station-specific props are original 3D geometry, not 2D photos.
 * Location of each tree, pavement and person is illustrative; DO NOT imply
 * exact street surveys. Local metres: Y up, Z along the elevated railway.
 */
mkdirSync('assets/nearby',{recursive:true});
const locations=['Uttara North','Uttara Center','Uttara South','Pallabi','Mirpur 11','Mirpur 10','Kazipara','Shewrapara','Agargaon','Bijoy Sarani','Farmgate','Karwan Bazar','Shahbagh','Dhaka University','Bangladesh Secretariat','Motijheel'];
function landscape(id){
 const campus=id===13,open=id===8||id===12||id===13,market=id===10||id===11||id===15;
 let treeCount=0,peopleCount=0,lampCount=0;
 // Slender urban street lamps, roadside planters, tactile paving.
 for(const side of [-1,1]){
  for(let z=-120;z<=120;z+=30){
   const x=side*34;
   pole('metal',[x,0,z],[x,9,z],.11,8);
   pole('silver',[x,9,z],[x-side*2.2,9.5,z+.45],.077,6);
   box('white',x-side*2.2,9.35,z+.45,1.2,.22,.45);
   box('yellow',x-side*2.2,9.34,z+.45,1,.035,.35);
   lampCount++;
   box('concrete',side*39,.04,z,1.6,.16,5.8);
  }
  // Long strips near the station represent sidewalks rather than surveyed roads.
  for(let z=-132;z<=132;z+=6){
   box('old',side*43,.03,z,.14,.23,4.8);
   if(z%18===0)box('white',side*29,.05,z,.11,.021,3.2);
  }
 }
 const trees=campus?54:open?32:market?12:21;
 for(let i=0;i<trees;i++){
  const side=i%2===0?1:-1;
  const x=side*(campus?52+(i*7%70):53+(i*13%50));
  const z=-140+(i*37%280);
  // Avoid modelling foliage under the main viaduct; otherwise approximate location.
  const height=campus?6.4+(i*3%4):4.8+(i*3%5);
  pole('tree',[x,0,z],[x,height,z],.17+(i%3)*.035,7);
  const tint=i%3?'leaves':'leaf2';
  ball(tint,x,height+.5,z,2.2+(i%4)*.26);
  ball('leaf2',x-1.4,height-.1,z+1,1.45);
  ball('leaves',x+1.3,height-.35,z-1.2,1.54);
  if(i%4===0){box('old',x,.02,z,2.4,.3,2.4);box('green',x,.32,z,1.65,.35,1.5);}
  treeCount++;
 }
 const walkers=campus?34:market?70:28;
 for(let i=0;i<walkers;i++){
  const side=(i%4<2)?-1:1;
  const x=side*(34+(i*11%14)),z=-130+(i*29%260);
  human(x,z,i+id*31);peopleCount++;
 }
 // Stop-side shelters, benches and litter bins. These are contextual models,
 // not precise reconstructions of licensed land-use maps.
 for(const side of [-1,1]){
  for(let z of [-80,78]){
   const x=side*48;
   box('concrete',x,.03,z,4,.18,5);
   for(let sx of [-1,1])pole('metal',[x+sx*1.6,.2,z-2],[x+sx*1.6,3.3,z-2],.07);
   box('teal',x,3.25,z-2,4.5,.17,4.4);
   box('metal',x,.65,z,2.7,.13,.52);
   box('old',x,.15,z,2.5,.15,.38);
   box('green',x+side*2.7,.02,z,1.2,.9,1.1);
  }
 }
 // Dhaka University / Shahbagh green campus character differs from market areas.
 if(campus||id===12){
  for(let i=0;i<13;i++){
   const side=i%2?1:-1,x=side*(65+(i%4)*7),z=-125+i*20;
   box('concrete',x,.03,z,2.4,.34,2.5);
   for(let k=-1;k<=1;k++)ball(k%2?'leaves':'leaf2',x+k*.57,.72,z,.63);
  }
 }
 if(market&&id!==10){
  for(let i=0;i<9;i++){
   const side=i%2?1:-1,x=side*46,z=-104+i*24;
   box('tree',x,0,z,1.5,.73,1.15);
   box(['orange','red','teal','blue'][i%4],x,.84,z,2,.14,1.7);
   if(i%3===0)umbrella(x,z,i);
  }
 }
 save('nearby/'+id);
 console.log(locations[id]+': '+treeCount+' individually modeled trees, '+peopleCount+' pedestrians, '+lampCount+' lamps');
}
for(let id=0;id<locations.length;id++)landscape(id);
