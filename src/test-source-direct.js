const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 18.11.2026: choosing a Denon device from the home screen / Konsolen row switches directly (Denon, then the TV like the
// launcher's sources list: Source/setCurrentSource ['HDMI1',17], popAllModule, LiveTV/setShowFlgArr, pushModule('LiveTV')),
// without opening the sources list. From inside the list, or with an app in the module stack: the list's own path.
function setup(o){
 o=o||{};let now=0,route=o.route||'LauncherHis',queue=[],selected=[],original=0,done,calls=[],src=o.src||'DMP',toasts=[];
 const view={allInputsData:[{sourceId:'TV'},{sourceId:'HDMI1'}],__flexSourcesOrig(){original++;route='LiveTV';}};
 const sources=[{port:3,command:'BD',name:'PS5',autoName:'PlayStation 5',label:'PS5'},{port:4,command:'GAME1',name:'PC',autoName:'',label:'PC'}];
 const store={state:{Source:{get currSourceId(){return src;}}},commit(n,v){calls.push('commit '+n+' '+JSON.stringify(v));if(n==='Source/setCurrentSource'&&!o.slow)src=v[0];}};
 const UI={getCurrentSubModuleId:()=>route,getCurrentModuleId:()=>route,showToast(){},store,
  popAllModule(){calls.push('popAllModule');route='';},pushModule(m){calls.push('pushModule '+m);route=m;}};
 const c={document:{getElementById:()=>null,querySelectorAll:()=>[]},
  window:{__flex:{},modeljs:{cec:{getHdmiDevicesName:()=>['HDMI1-PlayStation 5','HDMI1-AVC-X3800H'],getHdmiDevicesType:()=>[4,5],HdmiDevicesOperate(){}}},
   __flexDenon:{state:()=>({pending:false,sources,notice:'Zeitlimit',data:{ZM:'ON',SI:'TV'}}),sourceStatus:()=>'Ausgewaehlt',refresh:()=>true,selectTv:()=>true,abortSequence:()=>false,selectSource(p,cb){selected.push(p);done=cb;return true;}}},
  UI,inst:{stopped:false},fx:{keys:0},dialogUp:()=>false,log(){},kodiToast:(t)=>toasts.push(t),
  homeIdle:()=>route==='LauncherHis',uiReadyNow:()=>true,noAppInStack:()=>!o.app,
  Date:{now:()=>now},later:(fn,ms)=>queue.push({fn,at:now+ms}),openSources(){calls.push('openSources');queue.push({fn:()=>route='AllInputs',at:now+300});}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);c.inputVm=()=>view;c.patchDenonInputs=()=>{};
 function run(to){while(queue.length){queue.sort((a,b)=>a.at-b.at);if(queue[0].at>to)break;let q=queue.shift();now=q.at;q.fn();}now=to;}
 return {c,run,selected,calls,toasts,finish:e=>done(e),original:()=>original,setRoute:r=>route=r,setSrc:x=>src=x};
}
// A: from home, TV on DMP: Denon first, then the list's own calls, never openSources
let t=setup();t.c.chooseDenonSource(3);t.run(1000);assert.deepEqual(t.selected,[3]);assert.equal(t.calls.indexOf('openSources'),-1);assert.equal(t.calls.length,0);
t.finish();assert.deepEqual(t.calls,['commit Source/setCurrentSource ["HDMI1",17]','popAllModule',
 'commit LiveTV/setShowFlgArr ["showPassword",true,"showInfobar",true]','pushModule LiveTV']);assert.equal(t.original(),0);
assert.equal(t.c.inst.sourceSwitch.phase,'tv-hdmi1');assert.equal(t.c.inst.sourceSwitch.direct,true);assert.deepEqual(t.toasts,['PS5 wird gestartet …','']);
// B: store already on HDMI1 (home over HDMI1): no source command, like the list
t=setup({src:'HDMI1'});t.c.chooseDenonSource(3);t.run(1000);t.finish();assert.deepEqual(t.calls.slice(0,1),['popAllModule']);assert.equal(t.calls[t.calls.length-1],'pushModule LiveTV');
// C: source slow to confirm: LiveTV after 1 s at the latest
t=setup({slow:true});t.c.chooseDenonSource(3);t.run(1000);t.finish();assert.equal(t.calls.indexOf('pushModule LiveTV'),-1);t.run(2100);assert.equal(t.calls[t.calls.length-1],'pushModule LiveTV');
// D: key / navigation during the Denon switch: no TV switch
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.c.fx.keys++;t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-after-receiver');assert.equal(t.calls.length,0);assert.deepEqual(t.toasts.slice(-1),['']);
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.setRoute('AllApps');t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-after-receiver');assert.equal(t.calls.length,0);
// E: receiver error: no TV switch, popup removed
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.finish('Testfehler');assert.equal(t.c.inst.sourceSwitch.phase,'failed');assert.equal(t.calls.length,0);assert.deepEqual(t.toasts.slice(-1),['']);
// F: TV already on LiveTV/HDMI1 when the Denon confirms: nothing more
t=setup();t.c.chooseDenonSource(3);t.run(1000);t.setRoute('LiveTV');t.setSrc('HDMI1');t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'complete-hdmi1-already-active');assert.equal(t.calls.length,0);
// G: app in the module stack: the launcher's list decides (openSources + its own OK path)
t=setup({app:true});t.c.chooseDenonSource(3);assert.deepEqual(t.calls,['openSources']);t.run(1000);t.finish();assert.equal(t.original(),1);assert.equal(t.c.inst.sourceSwitch.direct,false);
// H: from inside the sources list: its own OK path
t=setup({route:'AllInputs'});t.c.chooseDenonSource(3);t.run(1000);assert.equal(t.calls.indexOf('openSources'),-1);t.finish();assert.equal(t.original(),1);
// I: before the Denon is asked, a key cancels
t=setup();t.c.window.__flexDenon.state=()=>({pending:true,sources:[]});t.c.chooseDenonSource(3);t.run(0);t.c.fx.keys++;t.c.window.__flexDenon.state=()=>({pending:false,sources:[]});t.run(1000);
assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-before-send');assert.equal(t.selected.length,0);
console.log('Direct switch: Denon, then the list\'s own calls without showing it; same-source and slow-source cases; cancel on key/navigation/error; list path with app in stack or inside the list.');
