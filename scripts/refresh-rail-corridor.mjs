#!/usr/bin/env node
/**
 * Fill gaps BETWEEN all 16 MRT-6 station neighbourhoods using open OSM data.
 * Source: OpenStreetMap, ODbL 1.0. No Google imagery or 3D tiles extracted.
 * Fetch is explicitly opt-in (manual GitHub Action); resumable per tile.
 *
 * node scripts/refresh-rail-corridor.mjs --fetch
 * node scripts/refresh-rail-corridor.mjs --fetch --max=8
 * node scripts/refresh-rail-corridor.mjs       // rebuild manifest only
 */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const path='data/corridor';mkdirSync(path,{recursive:true});
const track=JSON.parse(readFileSync('data/mrt6-track.js','utf8').split('window.MRT_TRACK=')[1].trim().replace(/;\\s*$/,''));
const meters=(a,b)=>Math.hypot((a[1]-b[1])*111320*Math.cos((a[0]+b[0])*Math.PI/360),(a[0]-b[0])*111320);
const center=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const MAX=Number((process.argv.find(x=>x.startsWith('--max='))||'--max=40').split('=')[1]);
const points=track.points,breaks=track.stationBreaks,positions=[];
const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative.at(-1)+meters(points[i-1],points[i]));
function pointAt(m){
 let i=0;while(i<cumulative.length-2&&cumulative[i+1]<m)i++;
 return center(points[i],points[i+1],Math.max(0,Math.min(1,(m-cumulative[i])/(cumulative[i+1]-cumulative[i]||1))));
}
for(let i=0;i<breaks.length-1;i++){
 const begin=cumulative[breaks[i]],end=cumulative[breaks[i+1]],length=end-begin;
 // Gap midpoint sampling with <=800m spacing, no invented footprints.
 const count=Math.max(1,Math.ceil(length/800));
 for(let j=0;j<count;j++){
  const m=begin+(j+.5)*length/count;
  const p=pointAt(m),id=String(positions.length).padStart(3,'0');
  positions.push({id,betweenStations:[i,i+1],alongMeters:Math.round(m),
   center:{lat:Number(p[0].toFixed(7)),lon:Number(p[1].toFixed(7))},radiusMeters:480});
 }
}
function polygon(e){
 if(!Array.isArray(e.geometry)||e.geometry.length<4)return null;
 const p=e.geometry.filter(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lon)).map(n=>[Number(n.lon.toFixed(7)),Number(n.lat.toFixed(7))]);
 if(p.length<4||p.length>180)return null;
 const h=parseFloat(e.tags?.height),levels=parseFloat(e.tags?.['building:levels']);
 const height=Number.isFinite(h)&&h>2?h:Number.isFinite(levels)&&levels>0?levels*3.15:null;
 const obj={id:e.id,p};
 if(height!==null)obj.h=Math.round(height*10)/10;
 return obj;
}
function road(e){
 if(!Array.isArray(e.geometry)||e.geometry.length<2)return null;
 const p=e.geometry.filter(n=>Number.isFinite(n.lat)&&Number.isFinite(n.lon)).map(n=>[Number(n.lon.toFixed(7)),Number(n.lat.toFixed(7))]);
 if(p.length<2)return null;
 return {id:e.id,type:e.tags.highway,p};
}
async function requestTile(tile){
 const s=tile.center,r=tile.radiusMeters;
 const q='[out:json][timeout:45];(way["building"](around:'+r+','+s.lat+','+s.lon+');way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified|living_street)$"](around:'+r+','+s.lat+','+s.lon+');node["natural"="tree"](around:'+r+','+s.lat+','+s.lon+'););out geom;';
 const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
 for(const endpoint of endpoints){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
  try{
   const resp=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(q),signal:controller.signal});
   if(!resp.ok)throw Error('HTTP '+resp.status);
   const raw=await resp.json();
   if(!Array.isArray(raw.elements))throw Error('Unexpected OSM response');
   const buildings=[],roads=[],trees=[],seen=new Set();
   for(const e of raw.elements){
    if(e.type==='way'&&e.tags?.building){
     const p=polygon(e);if(p&&!seen.has('b'+e.id)){seen.add('b'+e.id);buildings.push(p)}
    }else if(e.type==='way'&&e.tags?.highway){
     const p=road(e);if(p&&!seen.has('r'+e.id)){seen.add('r'+e.id);roads.push(p)}
    }else if(e.type==='node'&&e.tags?.natural==='tree'&&Number.isFinite(e.lon)&&Number.isFinite(e.lat))
     trees.push([Number(e.lon.toFixed(7)),Number(e.lat.toFixed(7))]);
   }
   if(buildings.length+roads.length<5)throw Error('Insufficient mapped objects; keep previous cache');
   return {id:tile.id,center:tile.center,betweenStations:tile.betweenStations,
    radiusMeters:r,buildings,roads,trees,source:'© OpenStreetMap contributors ODbL 1.0',
    license:'https://www.openstreetmap.org/copyright',
    fetchedAt:new Date().toISOString(),accuracy:'Mapped geometry, inferred building heights when OSM height absent; no Google imagery copied'};
  }catch(e){console.log('Tile',tile.id,endpoint,'failed:',e.message)}
  finally{clearTimeout(timer)}
 }
 return null;
}
let updated=0,examined=0;
for(const tile of positions){
 const destination=path+'/'+tile.id+'.json';
 if(existsSync(destination))continue; // keep successful prior tiles
 if(!process.argv.includes('--fetch'))continue;
 if(examined>=MAX)break;
 examined++;
 const found=await requestTile(tile);
 if(found){writeFileSync(destination,JSON.stringify(found));updated++;
  console.log('Saved OSM tile',tile.id,found.buildings.length,'buildings',found.roads.length,'roads');}
}
const all=positions.map(t=>({...t,exists:existsSync(path+'/'+t.id+'.json')}));
const manifest={generator:'scripts/refresh-rail-corridor.mjs',source:'© OpenStreetMap contributors ODbL 1.0',
 tileCount:positions.length,available:all.filter(t=>t.exists).length,tiles:all,
 description:'These are along-track corridor patches, separate from station-centered tiles; missing tiles remain empty instead of fake buildings.'};
writeFileSync(path+'/manifest.json',JSON.stringify(manifest,null,2));
console.log('Corridor candidate tiles:',all.length,'saved:',manifest.available,'new:',updated);
