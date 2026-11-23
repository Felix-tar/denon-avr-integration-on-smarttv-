const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 17./18.11.2026: small popup while switching to a Denon device (kodiToast), no full-screen cover: from OK until the TV switched
// or the choice ended.
function setup(o){
 o=o||{};let now=0,route='LauncherHis',queue=[],done,toasts=[];
 const sources=[{port:3,command:'BD',name:'PS5',autoName:'PlayStation 5',label:'PS5'},{port:4,command:'GAME1',name:'PC',autoName:'',label:'PC'}];
 const UI={getCurrentSubModuleId:()=>route,getCurrentModuleId:()=>route,showToast(){},store:{state:{Source:{currSourceId:'DMP'}},commit(){}},popAllModule(){},pushModule(m){route=m;}};
 const c={document:{getElementById:()=>null,querySelectorAll:()=>[],createElement(){throw new Error('no DOM expected');}},
  window:{__flex:{},modeljs:{cec:{getHdmiDevicesName:()=>['HDMI1-PlayStation 5','HDMI1-AVC-X3800H'],getHdmiDevicesType:()=>[4,5],HdmiDevicesOperate(){}}},
   __flexDenon:{state:()=>({pending:false,sources,notice:'Zeitlimit',data:{ZM:'ON',SI:'TV'}}),sourceStatus:()=>'Ausgewaehlt',refresh:()=>true,selectTv:()=>true,selectSource(p,cb){done=cb;return o.refuse?false:true;}}},
  UI,inst:{stopped:false},fx:{keys:0},dialogUp:()=>false,log(){},homeIdle:()=>route==='LauncherHis',uiReadyNow:()=>true,noAppInStack:()=>true,
  kodiToast:(t,ms)=>toasts.push(t),Date:{now:()=>now},later:(fn,ms)=>queue.push({fn,at:now+ms}),openSources(){}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);
 function run(to){while(queue.length){queue.sort((a,b)=>a.at-b.at);if(queue[0].at>to)break;let q=queue.shift();now=q.at;q.fn();}now=to;}
 return {c,run,toasts,finish:e=>done(e)};
}
let t=setup();t.c.chooseDenonSource(3);assert.deepEqual(t.toasts,['PS5 wird gestartet …']);t.run(1000);assert.equal(t.toasts.length,1);t.finish();assert.deepEqual(t.toasts.slice(-1),['']);
t=setup();t.c.chooseDenonSource(4);assert.deepEqual(t.toasts,['Umschalten auf PC …']);t.run(1000);t.finish('Testfehler');assert.deepEqual(t.toasts.slice(-1),['']);
t=setup();t.c.chooseDenonSource(3);t.run(0);t.c.fx.keys++;t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-after-receiver');assert.deepEqual(t.toasts.slice(-1),['']);
t=setup({refuse:true});t.c.chooseDenonSource(3);t.run(1000);assert.deepEqual(t.toasts.slice(-1),['']);
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.run(82000);assert.equal(t.c.inst.sourceSwitch.phase,'timeout-or-error');assert.deepEqual(t.toasts.slice(-1),['']);
t=setup();t.c.chooseDenonSource(3);t.c.stopDenonSources();assert.deepEqual(t.toasts.slice(-1),['']);
console.log('Switch popup: small hint on OK, removed on completion, error, cancel, refusal, timeout and stop; no full-screen element.');
