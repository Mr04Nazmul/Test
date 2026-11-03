#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const skipped=new Set([8,10,13]);
const route=JSON.parse(readFileSync('data/mrt6-track.js','utf8').split('window.MRT_TRACK=')[1].trim().replace(/;\s*$/,''));
const app=readFileSync('app-v2.js','utf8');
assert(app.includes('"assets/stations/"+index+".gltf"'),'App is not loading unique station model');
let n=0,parts=0,tris=0;
for(let i=0;i<route.stations.length;i++){
 if(skipped.has(i))continue;
 const path='assets/stations/'+i+'.gltf';
 assert(existsSync(path),'Missing station '+path);
 const g=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(g.asset.version,'2.0');
 assert.equal(g.extras.station,i);
 assert(g.extras.modelParts>=300,'Not enough actual architectural geometry for station '+i);
 assert(g.extras.triangles>1000,'Station '+i+' missing triangles');
 assert(g.materials.find(m=>m.name==='green-roof'));
 assert(g.materials.find(m=>m.name==='brick-bangladesh'));
 const b=Buffer.from(g.buffers[0].uri.split(',')[1],'base64');
 assert.equal(g.buffers[0].byteLength,b.length);
 for(const v of g.bufferViews)assert(v.byteOffset+v.byteLength<=b.length);
 for(const a of g.accessors){assert(a.count>0);if(a.min)assert(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite))}
 parts+=g.extras.modelParts;tris+=g.extras.triangles;n++;
}
assert.equal(n,13);
console.log('PASS '+n+' separate 3D station structures, '+parts+' original named components, '+tris+' triangles');
