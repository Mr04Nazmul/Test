/* Lightweight, real OSM footprint based 3D environment for MRT-6.
 * Buildings are created from actual mapped footprints, with inferred colors and
 * missing heights. Only visible station neighborhoods stream to Cesium.
 * © OpenStreetMap contributors, ODbL 1.0
 */
(function(){
"use strict";
const C=window.Cesium;
const BASE="data/3d-city/t/";
const MAX_MOBILE=190,MAX_DESKTOP=390,Z=15;
let viewer=null,route=null,current=[],job=0,manifest=null;
const cache=new Map();
const colors=["#d8c8b1","#d7a28e","#b6cbd0","#c2beb9","#d2d3bf","#a6b8c3"];
function tileXY(lon,lat){
 const n=2**Z;
 return [Math.floor((lon+180)/360*n),
 Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n)];
}
function distance(a,b,c,d){
 return Math.hypot((a-c)*111320*Math.cos(b*Math.PI/180),(b-d)*111320);
}
function clear(){
 for(const e of current)viewer.entities.remove(e);
 current.length=0;
}
async function fetchTile(x,y){
 const k=x+"/"+y;
 if(cache.has(k))return cache.get(k);
 try{
  const r=await fetch(BASE+Z+"/"+k+".json",{cache:"force-cache"});
  if(!r.ok)return [];
  const result=await r.json();
  if(cache.size>22)cache.delete(cache.keys().next().value);
  cache.set(k,result);
  return result;
 }catch(e){return []}
}
function feature(r,s){
 const [p,h,kind]=r;
 if(!Array.isArray(p)||p.length<3||p.length>95)return null;
 const centroid=p.reduce((v,q)=>[v[0]+q[0]/p.length,v[1]+q[1]/p.length],[0,0]);
 const d=distance(centroid[0],centroid[1],s.lon,s.lat);
 if(d>520)return null;
 return {p,h,kind,d};
}
function putBuilding(b){
 const p=b.p,flat=p.flatMap(q=>[q[0],q[1]]);
 const seed=Math.round(Math.abs(p[0][0]*1e5+p[0][1]*1e6))|0;
 const h=b.h>2?Math.min(b.h,220):9+(seed%7)*3.2;
 const color=C.Color.fromCssColorString(colors[(Math.abs(seed)+b.kind)%colors.length]).withAlpha(.98);
 try {
  const e=viewer.entities.add({
   name:"Mapped OSM building footprint — visualized facade; height may be estimated",
   polygon:{hierarchy:C.Cartesian3.fromDegreesArray(flat),height:.4,
      extrudedHeight:h,material:color,outline:false},
   properties:{osmFootprint:true,estimatedHeight:b.h<=2,visualizedHeight:h}
  });
  current.push(e);
 }catch(err){/* skip malformed geometry without blocking rest */}
}
async function load(index){
 if(!viewer||!route)return;
 const s=route.stations[index];
 if(!s)return;
 const token=++job;clear();
 if(!manifest||!manifest.ready)return;
 const [cx,cy]=tileXY(s.lon,s.lat);
 const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[-1,1],[1,-1]];
 const results=await Promise.all(offsets.map(([dx,dy])=>fetchTile(cx+dx,cy+dy)));
 if(token!==job)return;
 const footprints=[];
 const seen=new Set();
 for(const data of results){
  for(const row of data||[]){
   const b=feature(row,s);if(!b)continue;
   const k=b.p[0][0]+":"+b.p[0][1];
   if(!seen.has(k)){seen.add(k);footprints.push(b)}
  }
 }
 footprints.sort((a,b)=>a.d-b.d);
 const cap=window.innerWidth<760?MAX_MOBILE:MAX_DESKTOP;
 footprints.slice(0,cap).forEach(putBuilding);
 const notice=document.getElementById("corridorInfo");
 if(notice)notice.textContent=footprints.length?
  "OSM 3D: "+current.length+" nearby actual mapped building footprints shown · building colors & missing heights estimated":
  "No mapped footprints for this segment yet · using existing station 3D";
}
async function init(v,r){
 viewer=v;route=r;
 try{
  const response=await fetch("data/3d-city/manifest.json",{cache:"no-store"});
  manifest=await response.json();
  if(!manifest.ready)manifest=null;
 }catch(e){manifest=null}
 const el=document.getElementById("corridorInfo");
 if(el)el.textContent=manifest?
  "Real OSM 3D buildings enabled · map tiles loaded only near selected station":
  "OSM corridor tiles pending; existing 3D station environments remain available";
}
function hide(){job++;if(viewer)clear()}
window.MRT_CORRIDOR_3D={init,load,hide};
})();
