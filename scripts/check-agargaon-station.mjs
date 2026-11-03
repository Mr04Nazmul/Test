import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const p="assets/agargaon-station.gltf";
const m=JSON.parse(readFileSync(p,"utf8"));
assert.equal(m.asset.version,"2.0");
assert(m.extras?.count>=500,"Expected detailed station architecture instead of empty model");
assert(m.nodes.length<=4,"Mobile scene must be GPU-batched instead of thousands of draw calls");
assert(m.meshes.length>=1);
assert(m.meshes[0].primitives.length<=40,"Too many Cesium draw calls");
assert(m.textures?.length>=5&&m.images?.length>=5,"Station needs embedded original PBR surface textures");
for(const mesh of m.meshes)assert(mesh.primitives.every(p=>p.attributes.TEXCOORD_0!==undefined),"PBR texture UV missing");
assert(m.buffers.length===1&&m.buffers[0].uri.startsWith("data:application/octet-stream;base64,"));
for(const node of m.nodes)assert(Number.isInteger(node.mesh)&&node.mesh>=0&&node.mesh<m.meshes.length);
for(const primitive of m.meshes[0].primitives){
 const positions=m.accessors[primitive.attributes.POSITION];
 assert(positions.count>0&&positions.min?.every(Number.isFinite));
 assert(primitive.attributes.NORMAL!==undefined);
 assert(primitive.indices!==undefined);
}
for(const required of [
 "weathered corrugated green canopy panel","red brick wall infill",
 "elevated concrete support pillar","platform exterior blue-tinted glass",
 "individual entrance staircase step","stair safety rail vertical",
 "entrance canopy green curved rib","green line nameplate border"
])assert(m.extras.detailedComponents[required]>=1,"Missing Agargaon photo-reference component: "+required);
for(const removed of ["asphalt carriageway","broken lane stripe","reflective local water feature","street vehicle body","Dhaka local mixed-use office or residential block"]){
 assert(!m.extras.detailedComponents[removed],"Do not reintroduce non-georeferenced Agargaon scenery: "+removed);
}
assert(m.extras?.notReal&&m.extras?.classification,"Need correct accuracy disclaimer");
console.log("PASS Agargaon photo-referenced detailed station glTF:",m.extras.count,"authored components",m.meshes[0].primitives.length,"batched materials");
