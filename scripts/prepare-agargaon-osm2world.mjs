#!/usr/bin/env node
/**
 * Prepare a real OpenStreetMap .osm extract for OSM2World photoreal PBR export.
 * Uses public OSM way/point geometry only, no scraped Google 3D assets.
 * Live Overpass is preferred. Cached footprint fallback does not invent roads.
 * Attribution © OpenStreetMap contributors (ODbL 1.0).
 */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
const lat=23.7784483,lon=90.3801611,radius=560;
const center=[lon,lat],root=resolve("build/osm2world");
mkdirSync(root,{recursive:true});
const xmlOutput=resolve(root,"agargaon-source.osm");
const metadataOutput=resolve(root,"source-metadata.json");
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const coord=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1])&&Math.abs(p[0]-lon)<.015&&Math.abs(p[1]-lat)<.015;
const distance=p=>Math.hypot((p[0]-lon)*101800,(p[1]-lat)*111200);
const ring=a=>{
 const pts=(a||[]).filter(coord);
 if(pts.length>3&&distanceBetween(pts[0],pts.at(-1))<.2)pts.pop();
 return pts.length>=3?pts:[];
};
function distanceBetween(a,b){return Math.hypot((a[0]-b[0])*101800,(a[1]-b[1])*111200)}
function centerOf(poly){return poly.reduce((x,p)=>[x[0]+p[0]/poly.length,x[1]+p[1]/poly.length],[0,0])}
function loadCachedBuildings(){
 const file=JSON.parse(readFileSync("data/buildings/8.json","utf8"));
 const current=(file.buildings||[]).map(o=>({type:"building",p:ring(o.p),h:o.h||null,id:o.id||null}));
 const src=readFileSync("data/buildings/8.js","utf8");
 const pre="window.MRT_OFFLINE_BUILDINGS[8]=";
 const at=src.indexOf(pre);
 const legacy=at<0?[]:JSON.parse(src.slice(at+pre.length).trim().replace(/;\s*$/,"")).features
   .map(o=>({type:o.t||"yes",p:ring(o.p),h:o.h||null,id:o.id||null}));
 const out=[];
 for(const item of [...current,...legacy]){
  if(item.p.length<3||distance(centerOf(item.p))>radius+115)continue;
  const c=centerOf(item.p);
  const duplicate=out.some(x=>distanceBetween(centerOf(x.p),c)<12);
  if(duplicate)continue;
  out.push(item);
 }
 return out;
}
function fallbackOSM(){
 const buildings=loadCachedBuildings();
 const roads=existsSync("data/osm-roads/8.json")?JSON.parse(readFileSync("data/osm-roads/8.json","utf8")).roads||[]:[];
 let n=0,w=0;
 const nodes=[],ways=[];
 const nodeIds=new Map();
 function getNode(p){
  const key=p.map(v=>Number(v).toFixed(7)).join("|");
  if(nodeIds.has(key))return nodeIds.get(key);
  const id=--n;
  nodes.push('<node id="'+id+'" version="1" lat="'+p[1].toFixed(7)+'" lon="'+p[0].toFixed(7)+'" />');
  nodeIds.set(key,id);return id;
 }
 function addWay(points,tags,closed=false){
  const pts=points.filter(coord);
  if(pts.length<(closed?3:2))return;
  let ref=pts.map(getNode);
  if(closed&&ref[0]!==ref.at(-1))ref.push(ref[0]);
  const a=['<way id="'+(--w)+'" version="1">'];
  for(const id of ref)a.push('<nd ref="'+id+'"/>');
  for(const [k,v] of Object.entries(tags)){
   if(v===null||v===undefined||String(v)==="")continue;
   a.push('<tag k="'+esc(k)+'" v="'+esc(v)+'"/>');
  }
  a.push('</way>');ways.push(a.join(""));
 }
 for(const o of buildings){
  const type=["commercial","residential","industrial","apartments","house","office","retail"].includes(o.type)?o.type:"yes";
  const tags={building:type};
  if(Number.isFinite(Number(o.h))&&Number(o.h)>2&&Number(o.h)<160)tags.height=o.h;
  addWay(o.p,tags,true);
 }
 // Only georeferenced OSM highway ways, if a real OSM cache exists.
 for(const road of roads){
  if(!road.p||road.p.length<2||!road.type)continue;
  const tags={highway:road.type};
  if(road.width)tags.width=road.width;
  if(road.name)tags.name=road.name;
  addWay(road.p,tags);
 }
 // Reuse the actual OSM-derived MRT-6 route, not fake parallel railway lines.
 const js=readFileSync("data/mrt6-track.js","utf8").split("window.MRT_TRACK=")[1];
 if(js){
  const route=JSON.parse(js.trim().replace(/;\s*$/,""));
  const pts=route.points.filter(([la,lo])=>distance([lo,la])<radius+220)
    .map(([la,lo])=>[lo,la]);
  if(pts.length>=3)addWay(pts,{railway:"light_rail",bridge:"yes",layer:1,source:"OpenStreetMap MRT-6 route"},false);
 }
 const minLat=lat-radius/111200,maxLat=lat+radius/111200,
       minLon=lon-radius/(111200*Math.cos(lat*Math.PI/180)),maxLon=lon+radius/(111200*Math.cos(lat*Math.PI/180));
 const text='<?xml version="1.0" encoding="UTF-8"?>\n<osm version="0.6" generator="DhakaMetro3D source-only OSM reconstruction" copyright="OpenStreetMap contributors" attribution="https://www.openstreetmap.org/copyright" license="https://opendatacommons.org/licenses/odbl/1-0/">\n'
  +'<bounds minlat="'+minLat+'" minlon="'+minLon+'" maxlat="'+maxLat+'" maxlon="'+maxLon+'"/>\n'
  +nodes.join('\n')+'\n'+ways.join('\n')+'\n</osm>\n';
 if(buildings.length<35||!text.includes("</osm>"))throw Error("Not enough mapped building data to generate OSM2World model");
 return {text,mode:"cached-OSM-footprints",buildings:buildings.length,roads:roads.length,trees:0,ways:ways.length};
}
async function directOpenStreetMapAPI(){
 // OpenStreetMap's primary read-only map extract endpoint, not Google's map.
 // Small 1.1km bounding box; unlike public Overpass, it requires no OSM query
 // execution time and returns the actual referenced highway, water and tree tags.
 const dLat=radius/111200,dLon=radius/(111200*Math.cos(lat*Math.PI/180));
 const bbox=[lon-dLon,lat-dLat,lon+dLon,lat+dLat].map(x=>x.toFixed(6)).join(",");
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),48000);
 try{
  const url="https://api.openstreetmap.org/api/0.6/map?bbox="+bbox;
  const res=await fetch(url,{signal:ctrl.signal,headers:{"User-Agent":"DhakaMetro3D-OSM2World-source-mapper/1.0"}});
  if(!res.ok)throw Error("OSM map API HTTP "+res.status);
  const text=await res.text();
  const ways=(text.match(/<way\b/g)||[]).length,roadWays=(text.match(/<tag k="highway" v="/g)||[]).length;
  if(!text.includes("<osm")||!text.includes("</osm>")||ways<50||roadWays<6||text.length>20_000_000)
   throw Error("Map extract incomplete: "+ways+" ways, "+roadWays+" road ways");
  return {text,mode:"live-OSM-map-API",ways,roads:roadWays,trees:(text.match(/<tag k="natural" v="tree"/g)||[]).length,host:url.split("?")[0]};
 }catch(e){console.warn("Primary OSM API unavailable:",String(e));return null}
 finally{clearTimeout(timer)}
}
async function liveOverpass(){
 const area='(around:'+radius+','+lat+','+lon+')';
 const query='[out:xml][timeout:55];('+
   'way["building"]'+area+';way["building:part"]'+area+';'+
   'way["highway"~"^(primary|secondary|tertiary|residential|service|unclassified|pedestrian|footway)$"]'+area+';'+
   'way["railway"]'+area+';way["natural"="water"]'+area+';'+
   'way["landuse"~"^(grass|forest|residential|commercial|industrial|meadow)$"]'+area+';'+
   'node["natural"="tree"]'+area+';'+
   ');(._;>;);out body;';
 const hosts=[
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter"
 ];
 for(const host of hosts){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),62000);
  try{
   const res=await fetch(host+"?data="+encodeURIComponent(query),{signal:ctrl.signal,headers:{"User-Agent":"DhakaMetro3D-OSM2World-urban-reconstruction/1.0"}});
   if(!res.ok)throw Error("Overpass "+res.status);
   const text=await res.text();
   const ways=(text.match(/<way\b/g)||[]).length,trees=(text.match(/<tag k="natural" v="tree"/g)||[]).length;
   if(!text.includes("<osm")||!text.includes("</osm>")||ways<35||text.length>14_000_000)throw Error("Invalid/sparse/oversized OSM response");
   return {text,mode:"live-OpenStreetMap",ways,trees,host};
  }catch(e){console.warn(host+": "+String(e))}
  finally{clearTimeout(timer)}
 }
 return null;
}
const forceCached=process.argv.includes("--cached");
const osm=!forceCached?(await directOpenStreetMapAPI()||await liveOverpass()):null;
const prepared=osm||fallbackOSM();
writeFileSync(xmlOutput,prepared.text);
const manifest={
 generator:"OSM2World via real OpenStreetMap geometry",
 inputMode:prepared.mode,center:{longitude:lon,latitude:lat},radiusMeters:radius,
 source:"© OpenStreetMap contributors, ODbL 1.0",sourceURL:"https://www.openstreetmap.org/copyright",
 roadLayout:"Source OSM ways only; no invented roads or shop locations",
 accuracy:"Source mapped 2D footprints; missing building heights, window designs and roof colors may be inferred by OSM2World.",
 features:{ways:prepared.ways??null,buildings:prepared.buildings??null,roads:prepared.roads??null,trees:prepared.trees??null},
 buildAt:new Date().toISOString()
};
writeFileSync(metadataOutput,JSON.stringify(manifest,null,2));
console.log("OSM2World input prepared",prepared.mode,prepared.ways??prepared.buildings,
  "ways,",prepared.text.length,"XML bytes");
