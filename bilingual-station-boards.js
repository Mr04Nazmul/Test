/* MRT-6 bilingual station boards — actual 3D anchors at mapped station locations.
   The boards' letters are original canvas typography, not copied station photos.
   WGS84 positions: data/mrt6-track.js (© OpenStreetMap contributors, ODbL).
   All board dimensions, heights and poles are visual approximations. */
(function(global) {
"use strict";
const bangla=[
"উত্তরা উত্তর","উত্তরা সেন্টার","উত্তরা দক্ষিণ","পল্লবী",
"মিরপুর ১১","মিরপুর ১০","কাজীপাড়া","শেওড়াপাড়া",
"আগারগাঁও","বিজয় সরণি","ফার্মগেট","কারওয়ান বাজার",
"শাহবাগ","ঢাকা বিশ্ববিদ্যালয়","বাংলাদেশ সচিবালয়","মতিঝিল"
];
const english=[
"Uttara North","Uttara Center","Uttara South","Pallabi",
"Mirpur 11","Mirpur 10","Kazipara","Shewrapara","Agargaon",
"Bijoy Sarani","Farmgate","Karwan Bazar","Shahbagh",
"Dhaka University","Bangladesh Secretariat","Motijheel"
];
const boardColors={green:"#00734e",mint:"#effff5",white:"#ffffff",yellow:"#f3c65a"};
function drawBoard(i){
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=344;
 const g=canvas.getContext("2d");
 g.fillStyle="#00684c";g.fillRect(0,0,1024,344);
 g.fillStyle="#08412f";g.fillRect(0,0,1024,22);g.fillRect(0,322,1024,22);
 g.fillStyle="#e9fff4";g.fillRect(23,30,978,284);
 g.fillStyle="#006848";g.fillRect(33,40,958,264);
 // Dark panel + route-number medallion match Bangladesh MRT styling, not exact signage.
 g.fillStyle="#006848";
 g.beginPath();g.arc(101,172,60,0,Math.PI*2);g.fill();
 g.fillStyle="#ffffff";g.font="bold 31px Arial,sans-serif";g.textAlign="center";g.fillText("MRT",101,165);
 g.font="bold 25px Arial,sans-serif";g.fillText("06",101,202);
 g.textAlign="left";g.fillStyle="#ffffff";
 let bnFont=bangla[i].length>18?49:bangla[i].length>11?61:74;
 g.font="800 "+bnFont+"px 'Noto Sans Bengali','Hind Siliguri',sans-serif";
 g.fillText(bangla[i],194,154,765);
 g.font="bold "+(english[i].length>20?44:english[i].length>13?53:64)+"px Arial,sans-serif";
 g.fillText(english[i],194,247,770);
 g.fillStyle="#e1c46a";g.fillRect(194,268,780,5);
 // Export browser-native canvas: full Unicode typography, high res, WebGL ready.
 return canvas;
}
const signsByViewer=new WeakMap();
function attach(viewer,stations,Cesium,options={}){
 if(!viewer||!Array.isArray(stations)||stations.length!==16||!Cesium)return null;
 if(signsByViewer.has(viewer))return signsByViewer.get(viewer);
 const C=Cesium,entities=[],boards=[],labels=[];
 const green=C.Color.fromCssColorString("#006a50"),white=C.Color.WHITE,
 frame=C.Color.fromCssColorString("#0e493c");
 stations.forEach((s,i)=>{
  const name=english[i],bn=bangla[i];
  const close=options.boardVisibility||2600;
  // Freestanding painted metal frame and twin support posts form a 3D object.
  const railHeight=options.railHeight||18,base=railHeight+16;
  const p=C.Cartesian3.fromDegrees(s.lon,s.lat,base);
  entities.push(viewer.entities.add({
   id:"bilingual-sign-frame-"+i,name:"MRT-6 station board · "+bn+" / "+name,
   position:p,box:{
    dimensions:new C.Cartesian3(10.0,0.26,3.15),material:frame,
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,close)
   }
  }));
  for(const offset of [-3.9,3.9]){
   // Support posts are illustrative and not surveyed station dimensions.
   const lon=s.lon+offset/(111320*Math.cos(s.lat*Math.PI/180));
   entities.push(viewer.entities.add({
    position:C.Cartesian3.fromDegrees(lon,s.lat,base-2.9),
    box:{dimensions:new C.Cartesian3(.19,.19,3.15),material:green,
     distanceDisplayCondition:new C.DistanceDisplayCondition(0,close)}
   }));
  }
  const board=viewer.entities.add({
   id:"mrt6-board-"+i,name:bn+" / "+name,
   position:C.Cartesian3.fromDegrees(s.lon,s.lat,base+0.03),
   billboard:{
    image:drawBoard(i),width:345,height:116,
    scaleByDistance:new C.NearFarScalar(220,0.8,close,0.42),
    distanceDisplayCondition:new C.DistanceDisplayCondition(0,close),
    disableDepthTestDistance:250,
    verticalOrigin:C.VerticalOrigin.CENTER
   },
   properties:{stationIndex:i,bengali:bn,english:name,source:"OSM route point; board dimensions illustrative"}
  });
  boards.push(board);entities.push(board);
  const overview=viewer.entities.add({
   id:"mrt6-overview-station-"+i,name:bn+" / "+name,
   position:C.Cartesian3.fromDegrees(s.lon,s.lat,railHeight+42),
   point:{pixelSize:11,color:green,outlineColor:white,outlineWidth:2,
    distanceDisplayCondition:new C.DistanceDisplayCondition(close,35000)},
   label:{
    text:bn+"\n"+name,
    font:"600 15px 'Noto Sans Bengali',sans-serif",
    fillColor:white,showBackground:true,
    backgroundColor:C.Color.fromCssColorString("#072b26").withAlpha(.88),
    backgroundPadding:new C.Cartesian2(9,6),
    pixelOffset:new C.Cartesian2(0,-23),
    style:C.LabelStyle.FILL_AND_OUTLINE,
    outlineColor:C.Color.BLACK,outlineWidth:2,
    distanceDisplayCondition:new C.DistanceDisplayCondition(close,35000)
   },
   properties:{stationIndex:i,bengali:bn,english:name}
  });
  labels.push(overview);entities.push(overview);
 });
 const api={
  boards,labels,
  names:stations.map((s,i)=>({index:i,english:english[i],bengali:bangla[i],
    lon:s.lon,lat:s.lat})),
  destroy(){for(const e of entities)viewer.entities.remove(e);signsByViewer.delete(viewer)},
  get(i){return {english:english[i],bengali:bangla[i]}}
 };
 signsByViewer.set(viewer,api);
 return api;
}
global.MRTBilingualBoards={attach,bangla,english};
})(window);
