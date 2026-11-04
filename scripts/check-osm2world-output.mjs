#!/usr/bin/env node
/** Validate OSM2World's real mesh (not a flat image or empty placeholder). */
import {readFileSync,writeFileSync,statSync} from "node:fs";
import assert from "node:assert/strict";
const file="assets/osm2world/agargaon-osm2world.glb";
const b=readFileSync(file);
assert(b.length>120_000,"OSM2World output too small to contain a district");
assert(b.length<95_000_000,"Avoid committing a >95 MB GLB to the GitHub Pages branch");
assert.equal(b.toString("ascii",0,4),"glTF");
assert.equal(b.readUInt32LE(4),2);
assert.equal(b.readUInt32LE(8),b.length,"GLB header length must be exact");
assert.equal(b.toString("ascii",16,20),"JSON");
const jsonLen=b.readUInt32LE(12);
const j=JSON.parse(b.subarray(20,20+jsonLen).toString("utf8").trim());
assert.equal(j.asset.version,"2.0");
assert(j.meshes?.length>=1,"Generated file must contain 3D meshes");
assert(j.accessors?.some(a=>a.type==="VEC3"&&a.count>30),"Expected real triangle coordinate geometry");
const input=JSON.parse(readFileSync("build/osm2world/source-metadata.json","utf8"));
const report={
 pipeline:"tordanik/OSM2World 0.4.0 · OpenStreetMap urban geometry",
 generatedAt:new Date().toISOString(),
 center:input.center,radiusMeters:input.radiusMeters,
 inputMode:input.inputMode,source:input.source,sourceURL:input.sourceURL,
 accuracy:input.accuracy,roadLayout:input.roadLayout,
 file:"agargaon-osm2world.glb",bytes:b.length,meshCount:j.meshes.length,
 materialCount:j.materials?.length||0,imageCount:j.images?.length||0,
 gltfVersion:j.asset.version
};
writeFileSync("assets/osm2world/manifest.json",JSON.stringify(report,null,2));
console.log("PASS OSM2World 3D scene:",JSON.stringify(report));
