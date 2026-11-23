const fs=require('fs'),vm=require('vm'),assert=require('assert');
function setup(){
 let now=0,route='LauncherHis',queue=[],selected=[],original=0,done;
 const view={allInputsData:[{sourceId:'TV'},{sourceId:'HDMI1'}],__flexSourcesOrig(){original++;}};
 const c={window:{__flex:{},__flexDenon:{state:()=>({pending:false}),selectSource(p,cb){selected.push(p);done=cb;return true;}}},UI:{getCurrentSubModuleId:()=>route,showToast(){}},inst:{stopped:false},fx:{keys:0},dialogUp:()=>false,log(){},Date:{now:()=>now},later:(fn,ms)=>queue.push({fn,at:now+ms}),openSources(){queue.push({fn:()=>route='AllInputs',at:now+300});}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);c.inputVm=()=>view;c.patchDenonInputs=()=>{};
 function run(to){while(queue.length){queue.sort((a,b)=>a.at-b.at);if(queue[0].at>to)break;let q=queue.shift();now=q.at;q.fn();}now=to;}
 return {c,run,selected,finish:(error)=>done(error),original:()=>original,view};
}
let t=setup();t.c.chooseDenonSource(4);t.run(100);assert.equal(t.selected.length,0);t.run(1000);assert.deepEqual(t.selected,[4]);assert.equal(t.original(),0);t.finish();assert.equal(t.original(),1);assert.equal(t.view.currentFocus,'AllInputsGridViewItem-1');
t=setup();t.c.chooseDenonSource(4);t.run(100);t.c.fx.keys++;t.run(1000);assert.equal(t.selected.length,0);
console.log('Sources switching: async route transition waits; receiver success precedes native HDMI1; user navigation cancels.');

let active={$options:{name:'AllInputs'},_isDestroyed:false,_inactive:false};
let wrapper={$options:{name:'keep-alive'},_vnode:{componentInstance:active}};
let lookup={window:{__flex:{}},document:{getElementById:()=>({__vue__:wrapper}),querySelectorAll:()=>[]}};
vm.createContext(lookup);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),lookup);
assert.equal(lookup.inputVm(),active);active._inactive=true;assert.equal(lookup.inputVm(),null);active._inactive=false;active._isDestroyed=true;assert.equal(lookup.inputVm(),null);
console.log('Sources lookup: active keep-alive render found; inactive/destroyed views rejected.');

t=setup();t.c.chooseDenonSource(4);t.run(1000);t.finish('Testfehler');assert.equal(t.original(),0);assert.equal(t.c.inst.sourceSwitch.phase,'failed');t.c.chooseDenonSource(4);t.run(2000);assert.equal(t.selected.length,2);
console.log('Failed source selection unlocks immediately for retry; no native HDMI action on failure.');
