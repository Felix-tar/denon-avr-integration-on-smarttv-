const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 17.11.2026: OK on a Denon source tile sends the TV's own CEC "Start" (HdmiDevicesOperate([0,type]) like the settings
// dialog) right away and once more after the confirmed receiver switch. Only for an unambiguous, receiver-named CEC
// device; never to TV/audio system. No start hint (removed on the owner's request the same day).
function setup(o){
 o=o||{};let now=0,route='LauncherHis',modId='LauncherHis',queue=[],selected=[],original=0,done,ops=[];
 const view={allInputsData:[{sourceId:'TV'},{sourceId:'HDMI1'}],__flexSourcesOrig(){original++;route='LiveTV';modId='LiveTV';}};
 const sources=o.sources||[{port:3,command:'BD',name:'PS5',autoName:'PlayStation 5',label:'PS5'},{port:4,command:'GAME1',name:'PC',autoName:'',label:'PC'}];
 const cec={names:o.names||['HDMI1-PlayStation 5','HDMI1-AVC-X3800H'],types:o.types||[4,5]};
 const body={kids:[],appendChild(e){e.parentNode=body;body.kids.push(e);},removeChild(e){e.parentNode=null;body.kids.splice(body.kids.indexOf(e),1);}};
 const document={body,getElementById:id=>body.kids.filter(k=>k.id===id)[0]||null,querySelectorAll:()=>[],createElement(){return {innerHTML:'',querySelector(){return {};}};}};
 const c={document,window:{__flex:{},modeljs:{cec:{getHdmiDevicesName:()=>cec.names,getHdmiDevicesType:()=>cec.types,HdmiDevicesOperate(a){ops.push(a.join(','));}}},
  __flexDenon:{state:()=>({pending:false,sources}),sourceStatus:()=>'Ausgewaehlt',selectSource(p,cb){selected.push(p);done=cb;return true;}}},
  UI:{getCurrentSubModuleId:()=>route,getCurrentModuleId:()=>modId,showToast(){},store:{state:{Source:{currSourceId:'HDMI1'}}}},inst:{stopped:false},fx:{keys:0},dialogUp:()=>false,log(){},
  Date:{now:()=>now},later:(fn,ms)=>queue.push({fn,at:now+ms}),openSources(){queue.push({fn:()=>{route='AllInputs';modId='LauncherHis';},at:now+300});}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);c.inputVm=()=>view;c.patchDenonInputs=()=>{};
 function run(to){while(queue.length){queue.sort((a,b)=>a.at-b.at);if(queue[0].at>to)break;let q=queue.shift();now=q.at;q.fn();}now=to;}
 return {c,run,selected,ops,body,finish:(e)=>done(e),original:()=>original,toLiveTV:()=>{route='LiveTV';modId='LiveTV';}};
}
// A: start on OK, second start after the receiver, native HDMI1; no DOM element added
let t=setup();t.c.chooseDenonSource(3);assert.deepEqual(t.ops,['0,4']);assert.equal(t.c.inst.sourceSwitch.cecEarly,'gesendet');
t.run(1000);assert.deepEqual(t.selected,[3]);t.finish();assert.equal(t.original(),1);assert.deepEqual(t.ops,['0,4','0,4']);assert.equal(t.c.inst.sourceSwitch.cec,'gesendet');
assert.equal(t.body.kids.length,0);
// B: console switched the TV via CEC meanwhile: complete, second start still sent
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.toLiveTV();t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'complete-hdmi1-already-active');assert.equal(t.original(),0);assert.deepEqual(t.ops,['0,4','0,4']);
// C: key during the switch cancels; no second start. D: receiver error: no second start
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.c.fx.keys++;t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-after-receiver');assert.deepEqual(t.ops,['0,4']);
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.finish('Testfehler');assert.deepEqual(t.ops,['0,4']);assert.equal(t.original(),0);
// E: no start: ambiguous type, no receiver name (PC), not in the CEC list, audio system, no CEC API
t=setup({names:['HDMI1-PlayStation 5','HDMI1-Xbox One','HDMI1-AVC-X3800H'],types:[4,4,5]});t.c.chooseDenonSource(3);t.run(1000);t.finish();
assert.equal(t.original(),1);assert.equal(t.ops.length,0);assert.equal(t.c.inst.sourceSwitch.cec,'Typ 4 nicht eindeutig');
t=setup();t.c.chooseDenonSource(4);t.run(1000);t.finish();assert.equal(t.original(),1);assert.equal(t.ops.length,0);assert.equal(t.c.inst.sourceSwitch.cec,'kein Geraetename');
t=setup({names:['HDMI1-AVC-X3800H'],types:[5]});t.c.chooseDenonSource(3);t.run(1000);t.finish();assert.equal(t.ops.length,0);assert.equal(t.c.inst.sourceSwitch.cec,'nicht in der CEC-Liste');
t=setup({sources:[{port:1,command:'SAT/CBL',name:'AVR',autoName:'AVC-X3800H',label:''}]});t.c.chooseDenonSource(1);t.run(1000);t.finish();assert.equal(t.ops.length,0);
t=setup();delete t.c.window.modeljs;t.c.chooseDenonSource(3);t.run(1000);t.finish();assert.equal(t.original(),1);assert.equal(t.c.inst.sourceSwitch.cec,'kein CEC');
// F: repeated OK while pending sends nothing new
t=setup();t.c.chooseDenonSource(3);t.c.chooseDenonSource(3);assert.deepEqual(t.ops,['0,4']);
console.log('Source wake: CEC Start on OK and after the receiver switch, no start hint; nothing on error/navigation or for ambiguous/unnamed/audio devices.');
