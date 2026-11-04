#!/usr/bin/env node
/**
 * Georeferenced per-station source for OSM2World (official OSM map API).
 * No invented polygons, terrain roads, or Google Earth/MAP tile scraping.
 * Usage: node scripts/prepare-station-osm2world.mjs <stationIndex>
 */
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
const raw=readFileSync("data/mrt6-track.js","utf8");
const route=JSON.parse(raw.split("window.MRT_TRACK=")[1].trim().replace(/;\s*$/,""));
const i=Number(process.argv[2]),r=Number(process.env.OSM_RADIUS_M||260);
if(!Number.isInteger(i)||i<0||i>=16)throw Error("Station index must be 0...15");
if(!Number.isFinite(r)||r<150||r>500)throw Error("OSM radius outside safe request bounds");
const station=route.stations[i],lat=station.lat,lon=station.lon;
const dLat=r/111200,dLon=r/(111200*Math.cos(lat*Math.PI/180));
const bbox=[lon-dLon,lat-dLat,lon+dLon,lat+dLat].map(n=>n.toFixed(6)).join(",");
const output="build/osm2world/station-"+i+"-source.osm";
mkdirSync("build/osm2world",{recursive:true});
const url="https://api.openstreetmap.org/api/0.6/map?bbox="+bbox;
const a=new AbortController(),timer=setTimeout(()=>a.abort(),60000);
try{
 const response=await fetch(url,{signal:a.signal,headers:{"User-Agent":"MRT6-GitHub-3D-models/1.0 (OpenStreetMap derived)" }});
 if(!response.ok)throw Error("Official OSM API HTTP "+response.status);
 const xml=await response.text();
 const ways=(xml.match(/<way\b/g)||[]).length;
 const buildings=(xml.match(/<tag k="building" v="/g)||[]).length;
 const roads=(xml.match(/<tag k="highway" v="/g)||[]).length;
 if(xml.length<50000||xml.length>17_000_000||!xml.includes("<osm")||!xml.includes("</osm>")||ways<28||buildings<10||roads<4)
  throw Error("OSM extract sparse/incomplete: "+JSON.stringify({ways,buildings,roads,bytes:xml.length}));
 writeFileSync(output,xml);
 const manifest={stationIndex:i,name:station.n,bangla:station.bn,latitude:lat,longitude:lon,
  requestRadiusM:r,source:"© OpenStreetMap contributors (ODbL 1.0)",
  inputMode:"official-OSM-map-API",ways,buildings,roads,bytes:xml.length,
  accuracy:"Actual mapped 2D features. Unmapped objects absent; facade, colors, roofs, untagged building heights inferred."};
 writeFileSync("build/osm2world/station-"+i+"-source.json",JSON.stringify(manifest,null,2));
 console.log("PASS mapped station geometry",JSON.stringify(manifest));
}finally{clearTimeout(timer)}
