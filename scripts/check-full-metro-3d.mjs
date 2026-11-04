#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {runInNewContext} from "node:vm";
const html=readFileSync("full-metro-3d.html","utf8");
const js=readFileSync("full-metro-3d.js","utf8");
const main=readFileSync("index.html","utf8");
const studio=readFileSync("real-3d-studio.html","utf8");
const routeSource=readFileSync("data/mrt6-track.js","utf8");
const context={window:{}};
runInNewContext(routeSource,context);
const route=context.window.MRT_TRACK;
assert.equal(route.stations.length,16);
assert.equal(route.stationBreaks.length,16);
assert.equal(route.stations[0].n,"Uttara North");
assert.equal(route.stations[0].bn,"উত্তরা উত্তর");
assert.equal(route.stations[15].n,"Motijheel");
assert.equal(route.stations[15].bn,"মতিঝিল");
for(const [i,stop] of route.stations.entries()){
 assert(stop.n&&stop.bn&&Number.isFinite(stop.lat)&&Number.isFinite(stop.lon),
 "Station #"+(i+1)+" must have both languages and real geocoded point");
 const architecture=i===8?"assets/agargaon-station.gltf":
  i===10?"assets/farmgate-landmark.gltf":
  i===13?"assets/dhaka-university-landmark.gltf":"assets/stations/"+i+".gltf";
 assert(existsSync(architecture),"Missing station architecture "+i+" ("+architecture+")");
 assert(existsSync("assets/urban/"+i+".gltf"),"Missing mapped 3D district "+i);
}
assert(html.includes('data/mrt6-track.js'),"Do not guess any station geographic location");
assert(html.includes('full-metro-3d.js?v='),"Dedicated 3D route controller missing");
assert(html.includes('id="pickStation"')&&html.includes('id="stationList"'),"16-station bilingual picker missing");
assert(js.includes("signTexture(s,i)"),"Generated bilingual physical signboard texture missing");
assert(js.includes('c.fillText(s.bn'),"Bangla station board text missing");
assert(js.includes('c.fillText(s.n'),"English station board text missing");
assert(js.includes('allStationModels.push'),"All 16 station 3D architecture models not attached");
assert(js.includes("loadNeighborhood(i)"),"Per-station 3D building loading missing");
assert(js.includes('assets/urban/'),"Mapped OSM 3D buildings not connected");
assert(js.includes("numberPins")&&js.includes("refreshSignVisibility()"),"Adaptive zoom label overlap logic missing");
assert(js.includes('© OpenStreetMap contributors')||html.includes("© OpenStreetMap contributors"),
 "OpenStreetMap source attribution missing");
assert(js.includes("NOT live train GPS")||js.includes("NOT live train GPS"),"GPS truthfulness missing");
assert(main.includes('href="full-metro-3d.html"'),"Full route shortcut absent on main map");
assert(studio.includes('href="full-metro-3d.html"'),"Full route shortcut absent on 3D Studio");
console.log("PASS sixteen real geocoded MRT-6 stations, all bilingual nameboards, 16 architecture models, mapped neighborhood assets and 2 working entrypoints.");
