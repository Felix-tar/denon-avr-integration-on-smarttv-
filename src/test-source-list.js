const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 17.11.2026: Sources window keeps a sleeping PS5 selectable (receiver knows it via CEC), no IP probing.
const view={allInputsData:[{sourceId:'TV',name:'TV'},{sourceId:'HDMI1',name:'HDMI 1'}],currentFocus:'AllInputsGridViewItem-1',keydown(){},$el:{children:[{}]}};
let sources=[{port:2,command:'MPLAY',name:'Kodi Pi',autoName:'Kodi',label:'Kodi Pi'},{port:3,command:'BD',name:'PS5',autoName:'PlayStation 5',label:'PS5'},
 {port:1,command:'SAT/CBL',name:'CBL/SAT',autoName:'',label:''}];
let status={1:'Betriebsstatus unbekannt',2:'Betriebsstatus unbekannt',3:'Betriebsstatus unbekannt'};
const c={window:{__flex:{},__flexDenon:{state:()=>({sources:sources,data:{SI:'GAME1',ZM:'ON'}}),sourceStatus:s=>status[s.port]}},
 UI:{getCurrentSubModuleId:()=>'AllInputs'},inst:{},document:{getElementById:()=>null,querySelectorAll:()=>[]}};
vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);c.inputVm=()=>view;
const ids=()=>view.allInputsData.map(x=>x.sourceId).join(',');
c.patchDenonInputs();assert.equal(ids(),'TV,HDMI1,flex-denon-source-2,flex-denon-source-3');
assert.equal(view.allInputsData[3].name,'PS5');assert.equal(view.allInputsData[3].hasSignal,false);assert.equal(view.allInputsData[3].linked,false);
status[3]='Signal 2160p60';c.window.__flexDenon.state=()=>({sources:sources,data:{SI:'BD',ZM:'ON'}});c.patchDenonInputs();
assert.equal(view.allInputsData[3].hasSignal,true);assert.equal(view.allInputsData[3].linked,true);assert.equal(ids(),'TV,HDMI1,flex-denon-source-2,flex-denon-source-3');
sources[1].autoName='';sources[1].label='';c.patchDenonInputs();assert.equal(ids(),'TV,HDMI1,flex-denon-source-2');
assert.equal(view.currentFocus,'AllInputsGridViewItem-1');
sources[0].hidden=true;c.patchDenonInputs();assert.equal(ids(),'TV,HDMI1');
console.log('Sources window: sleeping but receiver-known devices stay listed; signal/selection only change status; unnamed inputs removed, focus kept.');
