#!/usr/bin/env node
/**
 * Optional REAL Dhaka street atmosphere import from Wikimedia Commons.
 * "A busy road in Dhaka.webm" by Masum-al-Hasan Rocky (2026),
 * licensed CC BY-SA 4.0, recorded near Jahangir Gate in Dhaka.
 * If the Commons API or conversion is unavailable, this step never breaks Pages.
 * We do not claim this is sound from a metro train or platform.
 */
import {mkdirSync,existsSync,writeFileSync,statSync,unlinkSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {pipeline} from "node:stream/promises";
import {Readable} from "node:stream";
import {createWriteStream} from "node:fs";
mkdirSync("assets/audio",{recursive:true});
const out="assets/audio/dhaka-road-recorded.mp3";
const credit='Source: "A busy road in Dhaka.webm" by Masum-al-Hasan Rocky (Wikimedia Commons), 25 August 2026.\n'
 +'Location: Road near Jahangir Gate, Dhaka, Bangladesh.\n'
 +'Original: https://commons.wikimedia.org/wiki/File:A_busy_road_in_Dhaka.webm\n'
 +'Creative Commons Attribution-ShareAlike 4.0 International: https://creativecommons.org/licenses/by-sa/4.0/\n'
 +'Modifications: audio track extracted, excerpted, resampled to 22050 Hz mono, compressed to MP3 for mobile website.\n'
 +'This recording is NOT recorded inside a Bangladesh metro train or station.\n';
writeFileSync("assets/audio/dhaka-road-recorded-LICENSE.txt",credit);
const skip=existsSync(out)&&statSync(out).size>50000;
if(skip){console.log("Using existing licensed genuine Dhaka audio",statSync(out).size);process.exit(0)}
let tmp="assets/audio/.dhaka-road-source.webm";
try{
 const api=new URL("https://commons.wikimedia.org/w/api.php");
 api.search=new URLSearchParams({action:"query",format:"json",prop:"videoinfo",viprop:"derivatives|url",titles:"File:A busy road in Dhaka.webm"}).toString();
 const r=await fetch(api,{headers:{"User-Agent":"DhakaMetro3D/1.0 (open source attribution https://github.com/Mr04Nazmul/Test)"},
  signal:AbortSignal.timeout(16000)});
 if(!r.ok)throw Error("Wikimedia API HTTP "+r.status);
 const json=await r.json();
 const page=Object.values(json.query?.pages||{})[0];
 const info=page?.videoinfo?.[0];
 if(!info)throw Error("Wikimedia video metadata unavailable");
 const list=(info.derivatives||[]).filter(v=>typeof v.src==="string"&&/\.webm(\?|$)/i.test(v.src));
 const preferred=list.find(x=>/\.240p\./.test(x.src))||
  list.find(x=>/240p/i.test(x.title||""))||list[0];
 if(!preferred)throw Error("No small, licensed video transcode available");
 const file=await fetch(preferred.src,{headers:{"User-Agent":"DhakaMetro3D/1.0 sound recording importer"},
  signal:AbortSignal.timeout(43000)});
 if(!file.ok||!file.body)throw Error("Commons transcode unavailable HTTP "+file.status);
 const len=Number(file.headers.get("content-length")||0);
 if(len>15000000)throw Error("Transcode is too large for small mobile extract");
 await pipeline(Readable.fromWeb(file.body),createWriteStream(tmp));
 const cmd=spawnSync("ffmpeg",["-hide_banner","-y","-nostdin","-loglevel","error",
  "-i",tmp,"-t","20","-vn","-ar","22050","-ac","1","-b:a","64k",out],{timeout:23000,encoding:"utf8"});
 if(cmd.status!==0)throw Error("ffmpeg could not extract genuine road audio: "+(cmd.stderr||"").slice(0,300));
 if(!existsSync(out)||statSync(out).size<50000)throw Error("Extracted audio unexpectedly empty");
 console.log("REAL recorded street audio imported from Wikimedia Commons:",statSync(out).size,"bytes");
}catch(e){
 console.warn("Real Dhaka field recording unavailable; synthesized local audio works without it:",e.message);
 if(existsSync(out)&&statSync(out).size<50000)unlinkSync(out);
}finally{if(existsSync(tmp))unlinkSync(tmp)}
