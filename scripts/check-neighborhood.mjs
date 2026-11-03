#!/usr/bin/env node
// Validate all generated neighborhood glTF files before deployment.
import {readFileSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
let totalTriangles=0,totalBytes=0;
for(let i=0;i<16;i++){
 const path='assets/nearby/'+i+'.gltf';
 const model=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(model.asset.version,'2.0','Invalid glTF version at station '+i);
 assert(model.scene===0 && model.scenes[0].nodes.length,'Missing default scene '+i);
 assert(model.materials?.length>=5,'Missing separate materials '+i);
 const primitives=model.meshes?.[0]?.primitives||[];
 assert(primitives.length>=4,'Insufficient geometry groups '+i);
 const b=model.buffers?.[0];
 assert(b&&b.uri.startsWith('data:application/octet-stream;base64,'),'Missing embedded buffer '+i);
 const raw=Buffer.from(b.uri.split(',')[1],'base64');
 assert.equal(raw.length,b.byteLength,'Buffer size mismatch '+i);
 for(const view of model.bufferViews){
  assert(view.byteOffset>=0 && view.byteOffset+view.byteLength<=raw.length,'Bad bufferView offset '+i);
 }
 for(const access of model.accessors){
  assert(access.count>0,'Empty accessor '+i);
 }
 const triangles=primitives.reduce((sum,p)=>sum+Math.floor(model.accessors[p.indices].count/3),0);
 assert(triangles>1000,'Too little 3D geometry for station '+i);
 totalTriangles+=triangles;totalBytes+=statSync(path).size;
}
console.log('PASS 16 actual 3D neighborhood glTF meshes:',totalTriangles,'triangles;',Math.round(totalBytes/1024),'KiB');
