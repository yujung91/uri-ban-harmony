import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const listeners={};const input={dataset:{lyric:'0-0'},value:'',addEventListener:(event,handler)=>listeners[event]=handler};
const root={innerHTML:'',querySelectorAll:selector=>selector==='[data-lyric]'?[input]:[]};
const context=vm.createContext({document:{querySelector:s=>s==='#melody-editor'?root:null,querySelectorAll:s=>s==='#melody-editor [data-lyric]'?[input]:[]},esc:x=>x,$:()=>null,setTimeout,clearTimeout});
vm.runInContext(fs.readFileSync('public/music.js','utf8')+';globalThis.editor=HM;',context);
const HM=context.editor;let stored,changes=0;HM.setChangeHandler(song=>{stored=song;changes++});
HM.mount({tempo:100,bars:[[{pitch:0,duration:1,lyric:''}],[],[],[]]});
input.value='친';input.oninput({isComposing:true});assert.equal(stored,undefined);
listeners.compositionend();assert.equal(stored.bars[0][0].lyric,'친','compositionend commits Korean without a final input event');
input.value='구';input.oninput({isComposing:true});input.onblur();assert.equal(stored.bars[0][0].lyric,'구','blur commits visible input');
input.value='말';HM.syncLyrics();assert.equal(stored.bars[0][0].lyric,'말','Next/save flushes visible input even if keyboard events are missing');
const count=changes;HM.syncLyrics();assert.equal(changes,count,'unchanged input does not trigger repeated autosaves');
input.value='';input.onchange();assert.equal(stored.bars[0][0].lyric,'','clearing input is saved');
input.value='한';listeners.compositionend();assert.equal(stored.bars[0][0].lyric,'한','decomposed Hangul normalizes before taking one character');
console.log('PASS: Korean IME compositionend, blur/change, explicit Next/save flush, unchanged-input idempotence, deletion and Hangul normalization.');


