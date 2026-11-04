#!/usr/bin/env node
// Integrity and visual-subject checks for the user's original packaged GLB.
// Downloaded from the user's file, never from Google Earth or Maps tiles.
import {readFileSync,statSync} from "node:fs";
import assert from "node:assert/strict";
const name="assets/cinematic/agargaon-detailed.glb";
const buf=readFileSync(name);
assert(buf.length>=30_000_000,"Expected complete high-detail mesh, not placeholder");
assert.equal(buf.toString("ascii",0,4),"glTF");
assert.equal(buf.readUInt32LE(4),2,"GLB must be glTF2");
assert.equal(buf.readUInt32LE(8),buf.length,"GLB length must match file");
assert.equal(buf.toString("ascii",16,20),"JSON");
const len=buf.readUInt32LE(12);
const data=JSON.parse(buf.subarray(20,20+len).toString("utf8"));
assert.equal(data.asset.version,"2.0");
assert(data.meshes.length>=35,"Missing detailed architectural / traffic meshes");
assert(data.materials.length>=35,"Missing textured materials");
assert(data.images.length>=30,"Missing PBR texture images");
const names=new Set(data.meshes.map(x=>x.name));
for(const kind of ["concrete","roof_green","asphalt","plaster_old","glass","train_green","train_red","leaf","bus_green"]){
 assert(names.has(kind),"Original authored 3D model is missing "+kind);
}
const html=readFileSync("index.html","utf8"),app=readFileSync("app-v2.js","utf8");
assert(html.includes('id="cinematicView"'),"No accessible cinematic toggle");
assert(app.includes("assets/cinematic/agargaon-detailed.glb"),"Cinematic GLB is not connected to website");
assert(app.includes("C.Model.fromGltfAsync"),"Full-color 3D must wait for the GLB model to load");
assert(app.includes("hideMappedScene()"),"Mapped low-detail scene must be hidden in cinematic mode");
assert(app.includes("setCinematicCamera("),"360° independent model camera must be available");
assert(app.includes("setTimeout(()=>{if(!cinematicOn"),"Detailed 3D must open automatically on site load");
assert(!app.includes("viewer.entities.show="),"EntityCollection.show is not a valid way to hide mapped geometry");
assert(html.includes('id="cinematicView"'),"Cinematic toggle must remain accessible");
assert(html.includes('#cinematicView{'),"Cinematic toggle must be visible, not hidden in a horizontal menu");
assert(app.includes("MRTActualRoads"),"Mapped roads must still be available");
console.log("PASS",name,Math.round(buf.length/1048576*100)/100+" MiB",data.meshes.length,"3D material meshes",data.images.length,"embedded textures");
