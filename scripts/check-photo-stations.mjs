#!/usr/bin/env node
import {readFileSync,existsSync} from "node:fs";
import assert from "node:assert/strict";
const profiles=JSON.parse(readFileSync("data/station-photo-profiles.json","utf8"));
const gallery=JSON.parse(readFileSync("assets/photo-stations/manifest.json","utf8"));
assert.equal(profiles.stations.length,16);
assert.equal(gallery.models.length,16);
assert(profiles.stations.filter(p=>p.photo).length>=10,"Too few verified photo references");
let totalTriangles=0,totalComponents=0,totalDraws=0;
const roofs=new Set(),scenes=new Set();
for(let i=0;i<16;i++){
 const p=profiles.stations[i],report=gallery.models[i],file="assets/photo-stations/"+i+".gltf";
 assert.equal(p.id,i);assert.equal(report.id,i);
 assert(existsSync(file),"Missing per-station reference overlay: "+file);
 const g=JSON.parse(readFileSync(file,"utf8"));
 assert.equal(g.asset.version,"2.0");
 assert.equal(g.extras.id,i);
 assert(g.extras.sourceGallery?.includes("thedailystar.net"));
 assert(g.extras.photographsEmbedded===false,"Do not redistribute Daily Star photos");
 assert(g.extras.precision.includes("Not a scanned/surveyed"),"No false photorealism claims");
 assert(g.meshes[0].primitives.length<=30,"Mobile draw calls too high: "+i);
 assert(g.extras.triangles>100,"Empty photoreferenced 3D scene: "+i);
 assert(g.extras.officialDesignWidthM>=23&&g.extras.officialDesignWidthM<=34);
 const decoded=Buffer.from(g.buffers[0].uri.split(",")[1],"base64");
 assert.equal(decoded.length,g.buffers[0].byteLength);
 for(const v of g.bufferViews)assert(v.byteOffset+v.byteLength<=decoded.length);
 for(const a of g.accessors){
  assert(a.count>0);
  if(a.min)assert(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite));
 }
 roofs.add(g.extras.roof);scenes.add(g.extras.scene);
 totalTriangles+=g.extras.triangles;
 totalComponents+=Object.values(g.extras.components).reduce((a,b)=>a+b,0);
 totalDraws+=g.meshes[0].primitives.length;
}
assert(roofs.size>=4,"Roof types not station-specific");
assert(scenes.size>=9,"Station neighborhoods not distinctive");
const motif=JSON.parse(readFileSync("assets/photo-stations/9.gltf","utf8"));
assert(motif.extras.components["triangular red roof motif"]>=10,"Bijoy Sarani red-green roof missing");
const round=JSON.parse(readFileSync("assets/photo-stations/5.gltf","utf8"));
assert(round.extras.components["Mirpur 10 circular glass office"]>0,"Mirpur 10 cylindrical blue building missing");
const pond=JSON.parse(readFileSync("assets/photo-stations/8.gltf","utf8"));
assert(pond.extras.components["water body"]>=1,"Agargaon pond missing");
const app=readFileSync("app-v2.js","utf8");
assert(app.includes("assets/photo-stations/"),"App fails to load photo-referenced overlay");
assert(app.includes("renderPhotoStationDetail("),"Station detail loader missing");
console.log("PASS",gallery.models.length,"individual photo-informed station scenes",
 totalComponents,"original parts",totalTriangles,"triangles",
 roofs.size,"roof types",scenes.size,"scene variants",totalDraws,"batched draw groups");
