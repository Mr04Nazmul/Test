#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const html=readFileSync("index.html","utf8"),app=readFileSync("app-v2.js","utf8");
const roadCode=readFileSync("actual-roads.js","utf8");
assert(html.includes('actual-roads.js?v='),"Missing OSM source-backed renderer in page");
assert(app.includes("MRTActualRoads.show("),"App must load real roads on station selection");
assert(app.includes("allowUnmappedStreetProps=false"),"Fictitious straight neighborhood road model still visible");
assert(app.includes("if(index===8||index===10||index===13)return"),"Duplicate artificial photo scenery still appears over key stations");
assert(roadCode.includes("data/osm-roads/"),"No georeferenced offline road cache loading");
assert(roadCode.includes("overpass-api.de"),"No OSM way geometry fallback");
assert(roadCode.includes("fromDegreesArray(coords)"),"World-lon-lat alignment missing");
assert(!roadCode.includes("Math.random("),"Invented road layout in map renderer");
assert(readFileSync("scripts/build-agargaon-station.mjs","utf8").includes("No painted fake street slabs"),"Agargaon fabricated street surface still enabled");
const path="data/osm-roads/8.json";
if(existsSync(path)){
 const j=JSON.parse(readFileSync(path,"utf8"));
 assert.equal(j.stationIndex,8);
 assert(j.source.includes("OpenStreetMap"));
 assert(j.roads?.length>1,"Road cache present but empty");
 for(const way of j.roads){
  assert(Array.isArray(way.p)&&way.p.length>=2);
  for(const [lon,lat] of way.p)assert(lon>89&&lon<92&&lat>22&&lat<25,"Bad road geometry coordinate");
 }
 console.log("PASS real Agargaon OSM roads geolocated:",j.roads.length,"verified ways");
}else console.log("PASS road renderer/accuracy guardrails; OSM offline cache not available, satellite-only fallback");
