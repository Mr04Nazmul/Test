/* MRT-6 planning visualization: existing georeferenced 16 stations PLUS
 * approximate last 1.16 km Motijheel–Kamalapur extension.
 * Extension alignment is a diagrammatic guide, NOT verified OSM rail geometry,
 * and Kamalapur is not shown as an operating station.
 * Terminal approximate coordinate: https://www.openstreetmap.org/?mlat=23.7329588&mlon=90.4254561
 */
(function(){
 "use strict";
 const base=window.MRT_TRACK;
 if(!base||!Array.isArray(base.stations))return;
 const r={...base,points:base.points.map(p=>p.slice()),stations:base.stations.map(s=>({...s})),
   stationBreaks:base.stationBreaks.slice()};
 r.points.push([23.72855,90.4201],[23.7297,90.4221],[23.7313,90.4240],[23.7329588,90.4254561]);
 r.stations.push({n:"Kamalapur",bn:"কমলাপুর",lat:23.7329588,lon:90.4254561,
   future:true,positionQuality:"approximate proposed terminal"});
 r.stationBreaks.push(r.points.length-1);
 r.extensionSource="Motijheel–Kamalapur planning concept; 1.16km planned section, alignment between known points approximate";
 window.MRT_3D_ROUTE=r;
})();
