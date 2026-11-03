#!/usr/bin/env node
/**
 * Optional build-time OSM refresh of mapped neighborhoods for 3 metro stations.
 * Never fabricates geometry, does not scrape Google data, and never fails Pages.
 * Real building/road/tree coordinates are © OpenStreetMap contributors, ODbL.
 * Tag-based height/road widths are unknown unless indicated as estimates.
 * Run: node scripts/refresh-osm-neighborhoods.mjs
 * Opt-in broader 16-station refresh: node scripts/refresh-osm-neighborhoods.mjs --all
 */
import {readFileSync,writeFileSync} from 'node:fs';
const route=JSON.parse(readFileSync('data/mrt6-track.js','utf8').split('window.MRT_TRACK=')[1].trim().replace(/;\s*$/,''));
const stations=route.stations;
const indices=process.argv.includes('--all')?stations.map((_,i)=>i):[8,10,13];
const userAgent='DhakaMetro3D-OpenStreetMap-Build/1.0 (free public research; nonrealtime)';
const urls=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
const radius=750;
function toPolygon(way){
 if(!Array.isArray(way.geometry)||way.geometry.length<4)return null;
 const p=way.geometry.filter(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lon)).map(n=>[Number(n.lon.toFixed(7)),Number(n.lat.toFixed(7))]);
 if(p.length<4||p.length>190)return null;
 const raw=Number.parseFloat(way.tags?.height),lv=Number.parseFloat(way.tags?.['building:levels']);
 const height=Number.isFinite(raw)&&raw>2?raw:Number.isFinite(lv)&&lv>0?lv*3.1:null;
 return {id:way.id,p,...(height?{h:Math.round(height*10)/10}:{})};
}
function toRoad(way){
 if(!Array.isArray(way.geometry)||way.geometry.length<2)return null;
 const p=way.geometry.filter(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lon)).map(n=>[Number(n.lon.toFixed(7)),Number(n.lat.toFixed(7))]);
 if(p.length<2)return null;
 return {id:way.id,type:way.tags?.highway||'road',p};
}
function metersTo(center,xy){return Math.hypot((xy[0]-center[0])*111320*Math.cos(center[1]*Math.PI/180),(xy[1]-center[1])*111320)}
async function queryOSM(s){
 const q='[out:json][timeout:24];(way["building"](around:'+radius+','+s.lat+','+s.lon+');way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified|living_street)$"](around:'+radius+','+s.lat+','+s.lon+');node["natural"="tree"](around:'+radius+','+s.lat+','+s.lon+'););out geom;';
 let fail=null;
 for(const url of urls){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','User-Agent':userAgent},body:'data='+encodeURIComponent(q),signal:controller.signal});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();if(!Array.isArray(data.elements))throw Error('Malformed Overpass response');
   return data.elements;
  }catch(e){fail=e}finally{clearTimeout(timer)}
 }
 throw fail||Error('OSM API unavailable');
}
for(const index of indices){
 const s=stations[index],center=[s.lon,s.lat],path='data/buildings/'+index+'.json';
 try{
  const original=JSON.parse(readFileSync(path,'utf8'));
  const elements=await queryOSM(s);
  const buildings=[],roads=[],trees=[];
  for(const el of elements){
   if(el.type==='way'&&el.tags?.building){const poly=toPolygon(el);if(poly)buildings.push(poly)}
   else if(el.type==='way'&&el.tags?.highway){const road=toRoad(el);if(road)roads.push(road)}
   else if(el.type==='node'&&el.tags?.natural==='tree'&&Number.isFinite(el.lon)&&Number.isFinite(el.lat))
    trees.push({id:el.id,p:[el.lon,el.lat]});
  }
  // Preserve a previous, more complete snapshot rather than overwriting it.
  if(buildings.length<Math.max(30,Math.ceil((original.buildings?.length||0)*.8))){
   console.log('Retaining offline station',index,'found',buildings.length,'vs cached',original.buildings?.length);
   continue;
  }
  buildings.sort((a,b)=>metersTo(center,a.p[0])-metersTo(center,b.p[0]));
  roads.sort((a,b)=>metersTo(center,a.p[0])-metersTo(center,b.p[0]));
  trees.sort((a,b)=>metersTo(center,a.p)-metersTo(center,b.p));
  const updated={station:index,stationName:s.n,center,bbox:radius+'m radius centered on OSM station point',
   polygonCount:buildings.length,buildings:buildings.slice(0,1400),roads:roads.slice(0,350),trees:trees.slice(0,450),
   source:'© OpenStreetMap contributors, ODbL 1.0',sourceUrl:'https://www.openstreetmap.org/copyright',
   sourceFetchedAt:new Date().toISOString(),heightPolicy:'OSM tagged heights when available; otherwise estimated for visualization',
   dataKind:'actual mapped footprints and positions; approximate meshes/textures'};
  writeFileSync(path,JSON.stringify(updated));
  console.log('OSM enriched',index,JSON.stringify({buildings:updated.buildings.length,roads:updated.roads.length,trees:updated.trees.length}));
 }catch(e){console.warn('OSM refresh unavailable for station',index,'using bundled geometry:',e.message)}
}
