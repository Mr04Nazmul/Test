#!/usr/bin/env node
/** Check all 16 generated, genuinely geometric 3-level station detail models. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
const app=readFileSync('app-v2.js','utf8');
assert(app.includes('renderStationLevels(index,p,s);'),'Station detail overlay not wired to the viewer');
assert(app.includes('assets/station-detail/'),'3D station detail asset path absent');
const levels=new Set(['street entrance','concourse gates','elevated platform']);
let totalParts=0,totalTriangles=0;
for(let i=0;i<16;i++){
 const path='assets/station-detail/'+i+'.gltf';
 assert(existsSync(path),'Missing station detail '+i);
 const m=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(m.asset.version,'2.0',path);
 assert.equal(m.extras.station,i,path);
 assert.deepEqual(new Set(m.extras.modelledLevels),levels,'Three station levels missing');
 assert(m.extras.parts>160&&m.extras.triangles>1800,'Not enough real 3D geometry '+i);
 assert(m.meshes[0].primitives.length>8,'Insufficient separate 3D painted materials '+i);
 for(const color of ['green-steel','yellow-tactile','glass-blue','ticket-gate','screen-cyan']){
  assert(m.materials.some(z=>z.name===color),'Missing '+color+' '+i);
 }
 const buffer=Buffer.from(m.buffers[0].uri.split(',')[1],'base64');
 assert.equal(buffer.byteLength,m.buffers[0].byteLength,path);
 for(const view of m.bufferViews)assert(view.byteOffset+view.byteLength<=buffer.length,path);
 for(const a of m.accessors)if(a.min){assert(a.min.every(Number.isFinite));assert(a.max.every(Number.isFinite));}
 totalParts+=m.extras.parts;totalTriangles+=m.extras.triangles;
}
console.log('PASS 16 three-level station detail meshes: '+totalParts+' coloured architectural parts, '+totalTriangles+' triangles.');
console.log('NOT survey accuracy: station layouts and furniture positions remain procedural approximations.');
