const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 17.11.2026: OK on Kodi/app from the home screen while the Denon is on a device input: Denon to TV audio, no question.
function setup(o){
 o=o||{};let now=0,queue=[];
 const sources=[{port:3,command:'BD',name:'PS5',autoName:'PlayStation 5',label:'PS5'},{port:4,command:'GAME1',name:'PC',autoName:'GeForce RTX 3080',label:'PC'},
  {port:1,command:'SAT/CBL',name:'CBL/SAT',autoName:'',label:''}];
 const data=o.data||{ZM:'ON',SI:'BD'},status=o.status||{3:'Signal 2160p60'},toasts=[],logs=[],tv={calls:0,cb:null,busy:o.busy||0};
 const c={document:{getElementById:()=>null,querySelectorAll:()=>[]},Date:{now:()=>now},
  window:{__flex:{},__flexDenon:{state:()=>({sources,data}),sourceStatus:s=>status[s.port]||'Ausgewaehlt',
   selectTv(cb){if(tv.busy>0){tv.busy--;return false;}tv.calls++;tv.cb=cb;return true;}}},
  inst:{stopped:false},log:m=>logs.push(m),kodiToast:(m)=>toasts.push(m),later:(fn,ms)=>queue.push({fn,at:now+ms})};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);
 function run(to){while(queue.length){queue.sort((a,b)=>a.at-b.at);if(queue[0].at>to)break;let q=queue.shift();now=q.at;q.fn();}now=to;}
 return {c,tv,toasts,logs,run};
}
let t=setup();assert.equal(t.c.denonAutoTv('Kodi'),true);assert.equal(t.tv.calls,1);assert.deepEqual(t.toasts,['PS5 läuft im Hintergrund weiter · Denon auf TV-Ton']);
t.tv.cb();assert.ok(t.logs.indexOf('Denon: auf TV-Ton')>=0);
t=setup({status:{3:'Ausgewaehlt'}});assert.equal(t.c.denonAutoTv('Netflix'),true);assert.deepEqual(t.toasts,['Denon auf TV-Ton']);
t=setup({data:{ZM:'ON',SI:'GAME1'}});assert.equal(t.c.denonAutoTv('Kodi'),true);assert.equal(t.tv.calls,1);   // PC too
t=setup({data:{ZM:'ON',SI:'TV'}});assert.equal(t.c.denonAutoTv('Kodi'),false);assert.equal(t.tv.calls,0);assert.equal(t.toasts.length,0);
t=setup({data:{ZM:'OFF',SI:'BD'}});assert.equal(t.c.denonAutoTv('Kodi'),false);assert.equal(t.tv.calls,0);
t=setup({data:{ZM:'ON',SI:'SAT/CBL'}});assert.equal(t.c.denonAutoTv('Kodi'),false);   // unnamed input: leave it
t=setup({busy:1});assert.equal(t.c.denonAutoTv('Kodi'),true);assert.equal(t.tv.calls,0);assert.ok(t.logs.indexOf('Denon: TV-Ton nicht moeglich')>=0);   // ui.js refused (should not happen: it queues)
t=setup();t.c.window.__flexDenon=undefined;assert.equal(t.c.denonAutoTv('Kodi'),false);
console.log('Auto TV audio: Denon to TV on Kodi/app start when on a named device input (with hint if a picture is reported); nothing on TV/off/unnamed; a refusal is logged (ui.js queues).');
