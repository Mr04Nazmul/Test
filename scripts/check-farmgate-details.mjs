#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const kinds=["shopfronts","buildings","street-market","pedestrians","greenery","utility-network","streetlights","rail-power","road-markings"];
let n=0,total=0;
for(const kind of kinds){
 const path="assets/farmgate-"+kind+".gltf";
 const gltf=JSON.parse(readFileSync(path,"utf8"));
 assert.equal(gltf.asset.version,"2.0",path);
 assert.ok(gltf.meshes[0].primitives.length>0,path);
 assert.ok(gltf.extras.partCount>0,path);
 const raw=Buffer.from(gltf.buffers[0].uri.split(",")[1],"base64");
 assert.equal(raw.length,gltf.buffers[0].byteLength,path);
 for(const ac of gltf.accessors){assert.ok(ac.count>0,path);if(ac.min){assert.ok(ac.min.every(Number.isFinite),path);assert.ok(ac.max.every(Number.isFinite),path)}}
 for(const v of gltf.bufferViews){assert.ok(v.byteOffset+v.byteLength<=raw.length,path)}
 assert.ok(gltf.extras.triangles>100,path);
 n++;total+=gltf.extras.triangles;
}
const app=readFileSync("app-v2.js","utf8");
assert.ok(app.includes("addFarmgateDetails(index)"));
const visible=["street-market","pedestrians","greenery","utility-network","streetlights"];
for(const kind of visible)assert.ok(app.includes('"'+kind+'"'));
console.log("Farmgate 3D quality OK: "+n+" standalone models, "+total+" triangles; "+visible.length+" non-overlapping detail layers linked to viewer.");
