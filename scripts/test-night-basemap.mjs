import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const calls=[];
function load(file, modules={}) {
 const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{if(!(name in modules))throw Error(`Unexpected dependency ${name}`);return modules[name];}});
 return exports;
}
const config=load('src/app/config/map-themes.config.ts');
assert.equal(config.MAP_THEMES.night.url,'https://tile.openstreetmap.org/{z}/{x}/{y}.png','night map must no longer request key-required CARTO tiles');
const leaflet={tileLayer:(url,options)=>{const layer={url,options,addTo:map=>{calls.push({url,options});return layer;}};return layer;}};
const {MapThemeService}=load('src/app/services/map-theme/map-theme.service.ts',{
 '@angular/core':{Injectable:()=>type=>type},leaflet,
 '../../config/map-themes.config':config,'../brightness/brightness.service':{},
});
let notify;const brightness={brightness$:{subscribe:fn=>{notify=fn;}},getCurrentState:()=>({sunElevation:-12})};
const service=new MapThemeService(brightness);const removed=[];service.initializeWithMap({removeLayer:layer=>removed.push(layer)});
assert.equal(calls.length,1);assert.equal(calls[0].options.className,'night-basemap');assert.equal(calls[0].options.updateWhenIdle,true);
assert.match(calls[0].options.attribution,/openstreetmap.org\/copyright/);
notify({sunElevation:-15});assert.equal(calls.length,1,'stable night brightness must not rebuild tiles');
notify({sunElevation:5});assert.equal(removed.length,1);assert.equal(calls.length,3,'daytime keeps the existing imagery and labels');
console.log('test-night-basemap.mjs: PASS');
