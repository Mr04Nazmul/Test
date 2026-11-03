/* Actual source-backed metro neighborhood roads.
 * © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright
 * No straight guessed "roads" are generated. When mapped roads cannot be
 * retrieved, existing real satellite / OSM imagery stays visible unchanged.
 * Road widths are stylistic approximations; alignments are OSM ways.
 */
(function(root){
"use strict";
const cache=new Map();
const MAX_ROADS=115;
let entities=[],abort=null,lastStation=null,sequence=0;
const allowed=new Set(["primary","secondary","tertiary","residential","service","unclassified","living_street","pedestrian"]);
const widths={primary:15,secondary:12,tertiary:9,residential:6.8,service:4.1,unclassified:6,living_street:4,pedestrian:4};
function goodPoint(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>89&&p[0]<92&&p[1]>22&&p[1]<25}
function cleanWays(raw){
 if(!Array.isArray(raw))return [];
 const seen=new Set(),ways=[];
 for(const item of raw){
  const kind=String(item.type||item.highway||"");
  if(!allowed.has(kind)||!Array.isArray(item.p)||item.p.length<2)continue;
  const points=item.p.filter(goodPoint);
  if(points.length<2)continue;
  const id=String(item.id??points[0].join(","));
  if(seen.has(id))continue;
  seen.add(id);ways.push({id,kind,points});
 }
 return ways.slice(0,250);
}
function fromOverpass(elements){
 if(!Array.isArray(elements))return [];
 return cleanWays(elements.filter(x=>x.type==="way"&&allowed.has(x.tags?.highway)).map(e=>({
  id:e.id,type:e.tags.highway,p:(e.geometry||[]).map(v=>[v.lon,v.lat])
 })));
}
function moveToNearest(ways,center){
 const [lon,lat]=center;
 const dist=w=>Math.min(...w.points.map(p=>Math.hypot((p[0]-lon)*101800,(p[1]-lat)*111200)));
 return ways.map(w=>({...w,d:dist(w)})).sort((a,b)=>a.d-b.d).slice(0,MAX_ROADS);
}
function clear(viewer){
 if(abort)abort.abort();
 for(const e of entities)viewer.entities.remove(e);
 entities=[];lastStation=null;
}
async function tryCache(i,signal){
 // Prefer independently sourced real road-line GeoJSON-style data generated
 // via Overpass on GitHub Actions. Old building files rarely contain roads.
 for(const path of ["./data/osm-roads/"+i+".json","./data/buildings/"+i+".json"]){
  try{
   const res=await fetch(path,{signal,cache:"no-store"});
   if(!res.ok)continue;
   const json=await res.json();
   const roads=cleanWays(json.roads);
   if(roads.length)return roads;
  }catch(e){if(signal.aborted)throw e}
 }
 return [];
}
async function fromLiveOSM(lat,lon,signal){
 // Exactly one station query. No scraping Google Maps / Google Earth.
 const q='[out:json][timeout:15];way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified|living_street|pedestrian)$"](around:650,'+lat+','+lon+');out geom;';
 const services=[
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
 ];
 for(const host of services){
  try{
   const response=await fetch(host+"?data="+encodeURIComponent(q),{signal,mode:"cors"});
   if(!response.ok)continue;
   const result=await response.json();
   const ways=fromOverpass(result.elements);
   if(ways.length)return ways;
  }catch(e){if(signal.aborted)throw e}
 }
 return [];
}
function draw(viewer,ways,center){
 const C=root.Cesium;
 for(const w of moveToNearest(ways,center)){
  const coords=w.points.flatMap(([lon,lat])=>[lon,lat]);
  if(coords.length<4)continue;
  const minor=w.kind==="pedestrian"||w.kind==="living_street";
  entities.push(viewer.entities.add({
   name:"OSM verified alignment: "+w.kind+" road (width estimated)",
   corridor:{
    positions:C.Cartesian3.fromDegreesArray(coords),
    width:widths[w.kind]||5.5,height:0.35,
    material:C.Color.fromCssColorString(minor?"#9d9c91":"#62656a").withAlpha(minor?.72:.86),
    outline:false
   }
  }));
 }
 return entities.length;
}
async function show(viewer,i,station,onReport){
 const token=++sequence;
 clear(viewer);
 if(!station||!Number.isFinite(station.lat)||!Number.isFinite(station.lon))return 0;
 const ctr=new AbortController();abort=ctr;
 const signal=ctr.signal;
 // Don't wait on public OSM APIs forever while a 3D station is rendering.
 const timeout=setTimeout(()=>ctr.abort(),16500);
 try{
  let roads=cache.get(i);
  let source="cached OSM";
  if(!roads){
   roads=await tryCache(i,signal);
   if(!roads.length){
    source="OSM Overpass";
    roads=await fromLiveOSM(station.lat,station.lon,signal);
   }
   if(roads.length)cache.set(i,roads);
  }
  if(token!==sequence||signal.aborted)return 0;
  if(!roads.length){
   lastStation=i;
   onReport?.("এই স্টেশনের সত্যিকারের road geometry এখন পাওয়া যায়নি—কল্পিত রাস্তা আঁকিনি।");
   return 0;
  }
  lastStation=i;
  const n=draw(viewer,roads,[station.lon,station.lat]);
  onReport?.(n+"টি OpenStreetMap road way দিয়ে সঠিক অবস্থানে রাস্তা দেখানো হচ্ছে (width আনুমানিক)।");
  return n;
 }catch(e){
  if(token===sequence&&!signal.aborted)onReport?.("OSM road source unavailable; real map imagery remains visible.");
  return 0;
 }finally{clearTimeout(timeout)}
}
function hide(viewer){++sequence;clear(viewer)}
root.MRTActualRoads={show,hide,getCount:()=>entities.length,getStation:()=>lastStation,
 source:"© OpenStreetMap contributors (ODbL 1.0). Real road way positions; widths estimated."};
})(window);
