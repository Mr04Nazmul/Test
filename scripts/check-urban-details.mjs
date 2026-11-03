#!/usr/bin/env node
import {existsSync,readFileSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
const output='assets/urban-details/';
const manifest=JSON.parse(readFileSync(output+'manifest.json','utf8'));
const models=manifest.models;
assert(Array.isArray(models),'Detail manifest models missing');
assert(models.length>=14,'Less than fourteen neighborhoods have generated detail assets');
let facades=0,props=0,bytes=0,trees=0;
for(const item of models){
 const filename=output+item.station+'.gltf';
 assert(existsSync(filename),'No neighborhood file: '+filename);
 const g=JSON.parse(readFileSync(filename,'utf8'));
 assert.equal(g.asset.version,'2.0');
 assert(g.meshes[0].primitives.length>=2,'Bad material geometry');
 assert(g.accessors.some(a=>a.type==='VEC3'&&Array.isArray(a.min)&&a.min.every(Number.isFinite)));
 assert(g.extras.shapes>1,'No details created for station '+item.station);
 assert(g.extras.buildingFootprints>=1,'No mapped building anchors');
 assert(g.extras.license.includes('OpenStreetMap'),'Attribution missing');
 bytes+=statSync(filename).size;facades+=item.shops;props+=item.shapes;trees+=item.trees;
}
const app=readFileSync('app-v2.js','utf8');
assert(app.includes('assets/urban-details/'),'Neighbourhood layer not loaded');
assert(app.includes('distanceDisplayCondition:new C.DistanceDisplayCondition(0,1550)'),'Low-detail rendering distance not configured');
assert(facades>60,'Need a meaningful number of shopfronts');
console.log('PASS',models.length,'urban-detail tiles,',facades,'storefronts,',trees,'illustrative trees,',
 props,'modeled parts,',(bytes/1024/1024).toFixed(2),'MB.');
console.log('CAVEAT: Local detail features are visual reconstructions, not real surveyed buildings or verified businesses.');
