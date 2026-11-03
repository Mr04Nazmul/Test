#!/usr/bin/env node
// Offline smoke test for real-OSM 3D gap tiles. Empty coverage is reported
// explicitly, never substituted with fake "Google live" buildings.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const source=JSON.parse(readFileSync('data/corridor/manifest.json','utf8'));
const models=JSON.parse(readFileSync('assets/corridor/manifest.json','utf8'));
assert(source.tileCount>=15,'Insufficient route-gap sampling');
assert.equal(models.modelCount,models.models.length);
assert.equal(models.neededTiles,source.tileCount);
const seen=new Set();
for(const entry of models.models){
 assert(!seen.has(entry.id),'Duplicate corridor tile '+entry.id);seen.add(entry.id);
 const path='assets/corridor/'+entry.id+'.gltf';
 assert(existsSync(path),'Missing tile '+entry.id);
 const obj=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(obj.asset.version,'2.0');
 assert(obj.extras.attribution.includes('OpenStreetMap'));
 assert(obj.extras.buildings+obj.extras.roads+obj.extras.trees>0);
 const bytes=Buffer.from(obj.buffers[0].uri.split(',')[1],'base64');
 assert.equal(bytes.length,obj.buffers[0].byteLength);
 for(const view of obj.bufferViews)
  assert(view.byteOffset>=0&&view.byteLength>0&&view.byteOffset+view.byteLength<=bytes.length);
 for(const a of obj.accessors){assert(a.count>0);if(a.min)assert(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite))}
}
const app=readFileSync('app-v2.js','utf8');
assert(app.includes('appendOSMCorridorSegments(i,token);'),'Viewer missing corridor model loader');
console.log('PASS',source.tileCount,'sampled rail corridor locations;',models.modelCount,
 'mapped segments with geometry. Unavailable segments remain explicitly missing.');
