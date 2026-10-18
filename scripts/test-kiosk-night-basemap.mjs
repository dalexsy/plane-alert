import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source=fs.readFileSync('scripts/mirror-kiosk/planes-kiosk-night-basemap.js','utf8');
class Image {
 constructor(src){this.src=src;this.layer={classList:{add(){},remove(){}}};}
 closest(){return this.layer;}
}
const night=new Image('https://a.basemaps.cartocdn.com/dark_all/9/275/167@2x.png');
const weather=new Image('https://tile.openweathermap.org/map/clouds/9/275/167.png');
const day=new Image('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/9/167/275');
const empty=new Image('');
const images=[night,weather,day,empty];const mounted=[];let observer;
const pane={querySelectorAll:selector=>selector==='img'?images:[]};
const document={querySelector:()=>pane,head:{append:node=>mounted.push(node)},body:{append:node=>mounted.push(node)},createElement:()=>({style:{},remove(){}})};
const context={document,window:{},URL,HTMLImageElement:Image,location:new URL('https://planes.dryl.io/?kiosk=1'),MutationObserver:class{constructor(fn){observer=fn;}observe(target){assert.equal(target,pane);}disconnect(){}}};
const script=new vm.Script(source);
assert.equal(script.runInNewContext(context).provider,'OpenStreetMap');
assert.equal(night.src,'https://tile.openstreetmap.org/9/275/167.png');
assert.match(weather.src,/openweathermap/);assert.match(day.src,/arcgisonline/);assert.equal(empty.src,'');
assert.equal(mounted.length,2);script.runInNewContext(context);assert.equal(mounted.length,2,'repeat health checks must not duplicate observers or attribution');
const future=new Image('https://b.basemaps.cartocdn.com/dark_all/10/550/334.png');images.push(future);
observer([{type:'childList',addedNodes:[future]}]);assert.equal(future.src,'https://tile.openstreetmap.org/10/550/334.png');
context.window.__planesNightBasemap.restore();assert.match(night.src,/cartocdn/);assert.match(future.src,/cartocdn/);
context.location=new URL('https://planes.dryl.io/');assert.equal(script.runInNewContext(context).reason,'not-kiosk');
console.log('test-kiosk-night-basemap.mjs: PASS');
