import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const p="assets/agargaon-station.gltf";
const m=JSON.parse(readFileSync(p,"utf8"));
assert.equal(m.asset.version,"2.0");
assert(m.nodes.length>=550,"Detailed station expected many distinct components");
assert(m.meshes.length>=20);
assert(m.textures?.length>=5&&m.images?.length>=5,"Station needs embedded original PBR surface textures");
for(const mesh of m.meshes)assert(mesh.primitives[0].attributes.TEXCOORD_0!==undefined,"PBR texture UV missing");
assert(m.buffers.length===1&&m.buffers[0].uri.startsWith("data:application/octet-stream;base64,"));
for(const node of m.nodes){
 assert(Number.isInteger(node.mesh)&&node.mesh>=0&&node.mesh<m.meshes.length);
 assert(node.translation.length===3&&node.translation.every(Number.isFinite));
 assert(node.scale.length===3&&node.scale.every(n=>Number.isFinite(n)&&n>0));
 if(node.rotation)assert(node.rotation.length===4&&node.rotation.every(Number.isFinite));
}
for(const required of [
 "weathered corrugated green canopy panel","red brick wall infill",
 "elevated concrete support pillar","platform exterior blue-tinted glass",
 "individual entrance staircase step","stair safety rail vertical",
 "entrance canopy green curved rib","asphalt carriageway",
 "street vehicle body","bus glazing","autorickshaw rear wheel",
 "Dhaka local mixed-use office or residential block","reflective local water feature"
])assert(m.nodes.some(n=>n.name===required),"Missing Agargaon photo-reference component: "+required);
assert(m.extras?.notReal&&m.extras?.classification,"Need correct accuracy disclaimer");
console.log("PASS Agargaon photo-referenced detailed station glTF:",m.nodes.length,"nodes",m.meshes.length,"mesh materials");
