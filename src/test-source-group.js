const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 17.11.2026: Konsolen row above the home tiles (openDenonGroup), keys like the tile menu.
function setup(){
 const body={kids:[],appendChild(e){e.parentNode=body;body.kids.push(e);},removeChild(e){e.parentNode=null;body.kids.splice(body.kids.indexOf(e),1);}};
 function mk(){const el={className:'',style:{},kids:[],textContent:'',appendChild(x){x.parentNode=el;el.kids.push(x);}};return el;}
 const sources=[{port:3,command:'BD',name:'PS5',autoName:'PlayStation 5',label:'PS5'},{port:4,command:'GAME1',name:'PC',autoName:'GeForce RTX 3080',label:'PC'},
  {port:2,command:'MPLAY',name:'Xbox One',autoName:'Kodi',label:'Xbox One'},{port:1,command:'SAT/CBL',name:'CBL/SAT',autoName:'',label:''}];
 const status={3:'Betriebsstatus unbekannt',4:'Signal 2160p60',2:'Ausgewaehlt'};
 const vmv={componentFocus:'LauncherMainTile-1'},chosen=[],logs=[];
 const c={document:{body,createElement:mk,getElementById:()=>null,querySelectorAll:()=>[]},
  window:{__flex:{},__flexDenon:{state:()=>({sources}),sourceStatus:s=>status[s.port]||'Betriebsstatus unbekannt'}},
  tm:{open:false},ss:{state:'off'},gal:{open:false},fx:{keys:0,hard:0},homeIdle:()=>true,uiReadyNow:()=>true,dialogUp:()=>false,
  mainTilesVm:()=>vmv,isTileMenuKey:k=>k===567,SS_PASS_KEYS:{400:1,411:1,412:1,413:1},TM_BACK:{8:1,409:1,461:1},log:m=>logs.push(m)};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);c.chooseDenonSource=p=>chosen.push(p);
 const key=(k,o)=>c.denonGroupKey(vmv,Object.assign({keyCode:k,repeat:false},o||{}));
 return {c,body,vmv,chosen,status,key,row:()=>body.kids.filter(k=>k.id==='flex-denon-group')[0]};
}
let t=setup();assert.equal(t.c.openDenonGroup(1,'LauncherMainTile-1'),true);let r=t.row();assert.ok(r);
const tiles=r.kids.filter(k=>/dg-tile/.test(k.className));assert.equal(tiles.length,3);
assert.deepEqual(tiles.map(x=>x.kids[0].textContent),['PS5','PC','Xbox One']);
assert.deepEqual(tiles.map(x=>x.kids[1].textContent),['','Bild 2160p60','am Denon gewählt']);
assert.equal(tiles[0].className,'dg-tile focus');assert.equal(r.kids[0].textContent,'Konsolen');
assert.equal(t.key(39),true);assert.equal(tiles[1].className,'dg-tile focus');assert.equal(t.key(39),true);assert.equal(t.key(39),true);assert.equal(tiles[2].className,'dg-tile focus');
assert.equal(t.key(37),true);assert.equal(t.key(38),true);assert.ok(t.row());
assert.equal(t.key(13,{repeat:true}),true);assert.equal(t.chosen.length,0);
assert.equal(t.key(13),true);assert.deepEqual(t.chosen,[4]);assert.ok(!t.row());assert.equal(t.c.dg.open,false);
// back / down close and are consumed; volume passes and keeps the row; other keys close and pass on
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');assert.equal(t.key(8),true);assert.ok(!t.row());
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');assert.equal(t.key(40),true);assert.ok(!t.row());
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');assert.equal(t.key(412),undefined);assert.ok(t.row());
assert.equal(t.key(36),undefined);assert.ok(!t.row());assert.equal(t.chosen.length,0);
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');assert.equal(t.key(567),undefined);assert.ok(!t.row());
// focus moved, hard event, screensaver: closed by the key path and by the 1-s check
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');t.vmv.componentFocus='LauncherMainTile-2';assert.equal(t.key(13),undefined);assert.ok(!t.row());assert.equal(t.chosen.length,0);
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');t.c.fx.hard++;t.c.checkDenonGroup();assert.ok(!t.row());
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');t.status[3]='Signal 2160p60';t.c.checkDenonGroup();assert.equal(t.row().kids[1].kids[1].textContent,'Bild 2160p60');
t=setup();t.c.openDenonGroup(1,'LauncherMainTile-1');t.c.stopDenonSources();assert.ok(!t.row());
// not opened: tile menu open, screensaver, dialog, nothing listed
t=setup();t.c.tm.open=true;assert.equal(t.c.openDenonGroup(1,'LauncherMainTile-1'),false);
t=setup();t.c.ss.state='ui-off';assert.equal(t.c.openDenonGroup(1,'LauncherMainTile-1'),false);
t=setup();t.c.dialogUp=()=>true;assert.equal(t.c.openDenonGroup(1,'LauncherMainTile-1'),false);
t=setup();t.c.window.__flexDenon.state=()=>({sources:[]});assert.equal(t.c.openDenonGroup(1,'LauncherMainTile-1'),false);
// position: centred over the tile, clamped to the screen
t=setup();t.c.openDenonGroup(0,'LauncherMainTile-0');assert.equal(t.row().style.left,'40px');assert.equal(t.row().style.width,'820px');
console.log('Konsolen row: lists receiver-known devices with status; arrows/OK/back like the tile menu; closes on focus change, hard event, stop; other keys pass on.');
