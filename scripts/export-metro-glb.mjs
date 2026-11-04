#!/usr/bin/env node
/** Export real textured .glb geometry; no screenshots or copied Google tiles. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync} from "node:fs";
import {dirname} from "node:path";
function bin(uri){
 if(typeof uri!=="string"||!uri.startsWith("data:")||!uri.includes(";base64,"))throw Error("Asset requires local embedded base64");
 return Buffer.from(uri.slice(uri.indexOf(",")+1),"base64");
}
function convert(input,output){
 const doc=JSON.parse(readFileSync(input,"utf8"));
 if(doc.asset?.version!=="2.0"||doc.buffers?.length!==1)throw Error("Expected one-buffer glTF2 "+input);
 const original=bin(doc.buffers[0].uri);
 if(original.length!==doc.buffers[0].byteLength)throw Error("Unexpected glTF buffer size");
 const blobs=[original];let size=original.length;
 for(const img of doc.images||[]){
  if(!img.uri)continue;
  const bytes=bin(img.uri),pad=(4-size%4)%4;
  if(pad){blobs.push(Buffer.alloc(pad));size+=pad}
  img.bufferView=doc.bufferViews.length;
  doc.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});
  img.mimeType=img.mimeType||"image/png";delete img.uri;
  blobs.push(bytes);size+=bytes.length;
 }
 doc.buffers=[{byteLength:size}];
 const payload=Buffer.concat(blobs),json=Buffer.from(JSON.stringify(doc));
 const text=Buffer.alloc((json.length+3)&~3,0x20),data=Buffer.alloc((payload.length+3)&~3);
 json.copy(text);payload.copy(data);
 const out=Buffer.alloc(12+8+text.length+8+data.length);
 out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(text.length,12);out.writeUInt32LE(0x4e4f534a,16);
 text.copy(out,20);
 const second=20+text.length;
 out.writeUInt32LE(data.length,second);out.writeUInt32LE(0x004e4942,second+4);
 data.copy(out,second+8);
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,out);
 return {path:output,bytes:out.length,meshPrimitives:doc.meshes.reduce((n,m)=>n+m.primitives.length,0)};
}
const jobs=[
 ["assets/agargaon-station.gltf","assets/glb/agargaon-station.glb"],
 ["assets/urban/8.gltf","assets/glb/agargaon-osm-buildings.glb"],
 ["assets/photo-stations/9.gltf","assets/glb/bijoy-sarani-reference.glb"]
];
for(let i=0;i<16;i++)jobs.push(["assets/photo-stations/"+i+".gltf","assets/glb/station-"+i+"-photo-reference.glb"]);
const created=[];
for(const [a,b] of jobs)if(existsSync(a))created.push(convert(a,b));
if(!created.find(e=>e.path==="assets/glb/agargaon-station.glb")||!created.find(e=>e.path==="assets/glb/agargaon-osm-buildings.glb"))throw Error("Agargaon downloadable mesh not generated");
writeFileSync("assets/glb/manifest.json",JSON.stringify({
 provenance:"Actual 3D geometry, built from OSM mapped footprints or photo-inspired architectural approximations (not exact scanned city).",
 license:"© OpenStreetMap contributors / ODbL; new procedural 3D art",
 models:created},null,2));
console.log("Exported",created.length,"binary GLB model files, total MB",Math.round(created.reduce((a,b)=>a+b.bytes,0)/100000)/10);
