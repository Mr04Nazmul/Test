#!/usr/bin/env node
/**
 * Verify MRT-6 local road locations against real OpenStreetMap ways.
 * Runs at GitHub Actions build time and stores georeferenced roads as JSON.
 * Fail-open on Overpass network instability: NEVER fabricate coordinates.
 * Usage: node scripts/refresh-real-roads.mjs --station 8
 *        node scripts/refresh-real-roads.mjs --all
 * © OpenStreetMap contributors / ODbL 1.0
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from "node:fs";
const route=JSON.parse(readFileSync("data/mrt6-track.js","utf8").split("window.MRT_TRACK=")[1].trim().replace(/;\s*$/,""));
const all=process.argv.includes("--all");
const n=process.argv.indexOf("--station");
const list=all?route.stations.map((_,i)=>i):[n>=0?Number(process.argv[n+1]):8];
const endpoints=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"];
const whitelist=/^(primary|secondary|tertiary|residential|service|unclassified|living_street|pedestrian)$/;
const roadWidth=tag=>{
 const width=Number.parseFloat(tag?.width||"");
 return Number.isFinite(width)&&width>=1.8&&width<=40?width:null;
};
async function download(lat,lon){
 const query='[out:json][timeout:15];way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified|living_street|pedestrian)$"](around:750,'+lat+','+lon+');out geom;';
 let last;
 for(const endpoint of endpoints){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),22000);
  try{
   const res=await fetch(endpoint+"?data="+encodeURIComponent(query),{
    headers:{"User-Agent":"DhakaMetro3D/1.2 (OSM ODbL geographic road cache)"},signal:ctrl.signal});
   if(!res.ok)throw Error("Overpass HTTP "+res.status);
   const body=await res.json();
   if(!Array.isArray(body.elements))throw Error("Not a valid Overpass way response");
   return body.elements.filter(x=>x.type==="way"&&whitelist.test(x.tags?.highway||""))
    .map(x=>({
     id:x.id,type:x.tags.highway,name:x.tags?.name||null,
     width:roadWidth(x.tags),lanes:Number(x.tags?.lanes)||null,
     p:(x.geometry||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
      .map(p=>[p.lon,p.lat])
    })).filter(x=>x.p.length>=2).slice(0,230);
  }catch(e){last=e}finally{clearTimeout(timer)}
 }
 throw last||Error("OSM data not available");
}
mkdirSync("data/osm-roads",{recursive:true});
let found=0,miss=0;
for(const i of list){
 if(!Number.isInteger(i)||i<0||i>=route.stations.length)throw Error("Invalid MRT6 station "+i);
 const station=route.stations[i],path="data/osm-roads/"+i+".json";
 try{
  const roads=await download(station.lat,station.lon);
  if(roads.length<2)throw Error("OSM returned too few road ways");
  const j={stationIndex:i,stationName:station.n,
   source:"© OpenStreetMap contributors, Open Database License (ODbL)",
   sourceURL:"https://www.openstreetmap.org/copyright",
   coordinates:"WGS84 [longitude, latitude], source way geometry",
   roadWidthNote:"Only width tags when mapped; missing widths estimated by viewer",
   retrievedAt:new Date().toISOString(),roads};
  writeFileSync(path,JSON.stringify(j));
  found++;console.log("OSM",i,station.n,roads.length,"real road segments saved");
 }catch(e){
  miss++;
  if(existsSync(path))console.warn("OSM offline; retaining previous mapped road cache",i,String(e));
  else console.warn("OSM offline; no imaginary roads will be added",i,String(e));
 }
}
console.log("Road cache refresh:",found,"stations refreshed,",miss,"unavailable (real imagery fallback)");
