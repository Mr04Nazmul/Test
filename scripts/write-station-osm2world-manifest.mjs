#!/usr/bin/env node
import {readFileSync,writeFileSync,readdirSync,statSync,existsSync} from "node:fs";
const folder="assets/osm2world/stations";
const raw=readFileSync("data/mrt6-track.js","utf8");
const route=JSON.parse(raw.split("window.MRT_TRACK=")[1].trim().replace(/;\s*$/,""));
const entries=[];
for(let i=0;i<16;i++){
 if(i===8){entries.push({id:i,name:route.stations[i].n,bn:route.stations[i].bn,
  model:"../agargaon-osm2world.glb",source:"OSM2World official OSM API",available:true,coverageMeters:560});continue}
 const path=folder+"/"+i+".glb",meta=folder+"/"+i+".json";
 if(!existsSync(path)||!existsSync(meta))continue;
 const j=JSON.parse(readFileSync(meta,"utf8")),s=statSync(path).size;
 if(s<150000||s>95000000||j.stationIndex!==i||j.inputMode!=="official-OSM-map-API")continue;
 entries.push({id:i,name:j.name,bn:j.bangla,model:i+".glb",source:j.inputMode,
  buildings:j.buildings,roads:j.roads,coverageMeters:j.requestRadiusM,bytes:s,available:true});
}
const manifest={source:"© OpenStreetMap contributors · ODbL 1.0",
 generator:"tordanik/OSM2World 0.4.0",stationCount:route.stations.length,
 generatedAt:new Date().toISOString(),available:entries.length,stations:entries,
 accuracy:"OSM-mapped geography, inferred or incomplete facade/height/material values. No Google Earth copied imagery, no actual train GPS."};
writeFileSync(folder+"/manifest.json",JSON.stringify(manifest,null,2));
console.log("Validated OSM2World station models:",entries.length,"/16 (including Agargaon)");
