const fs=require('fs'),vm=require('vm'),assert=require('assert');
// Review 18.11.2026: end-to-end simulation with the real ui.js and sources.js, a fake file-IPC bridge with the measured
// timing (before-snapshot ~3 s, then the command, 1.5 s sleep, after-snapshot: ~8 s per command) and the launcher's
// CEC jump (the Denon announces itself as active source when it changes input; launcher -> LiveTV/HDMI1; a running Kodi
// is ended). Scenarios from the review: fast corrections (console -> console -> key/BACK/Kodi), second OK while waiting,
// ZMON in flight, BACK after the jump, and the normal paths. Invariant: the Denon is never left on a console the owner
// abandoned, and Kodi is never started into the jump.
function setup(opt){
  opt=opt||{};
  let now=0,queue=[],route=opt.route||'LauncherHis',cur='DMP',logs=[],hints=[],starts=[],events=[],kills=0;
  const later=(fn,ms)=>queue.push({fn,at:now+(ms||0)});
  const den=Object.assign({SI:'TV',ZM:'ON',Z2:'OFF'},opt.den||{});let response=null;const sent=[];
  const T={switchAt:3200,cecAfter:200,doneAt:8000,statusMs:900};
  function rawNow(){return 'ZM'+den.ZM+'\nSI'+den.SI+'\nZ2'+den.Z2+'\n';}
  const file={
    write(path,data){const [id,cmd]=data.split('\n');sent.push(cmd);
      if(/^SI/.test(cmd)){
        later(()=>{const prev=den.SI;den.SI=cmd.substr(2);events.push(now+' Denon '+prev+'->'+den.SI);
          if(den.SI!=='TV'&&prev!==den.SI&&den.ZM==='ON'&&opt.cec!==false)later(cecJump,T.cecAfter);},T.switchAt);
      }else if(cmd==='ZMON'){later(()=>{den.ZM='ON';if(den.SI!=='TV'&&opt.cecOnPower)later(cecJump,T.cecAfter);},T.switchAt);}
      else if(cmd==='Z2OFF'){later(()=>{den.Z2='OFF';},T.switchAt);}
      const dur=(cmd==='SOURCES'||cmd==='STATUS')?T.statusMs:T.doneAt;
      later(()=>{response=JSON.stringify({id,ok:true,error:'',raw:rawNow(),
        video:cmd==='SOURCES'&&!opt.videoUnavailable?'<Resolution><Input>---</Input></Resolution>':''});},dur);
      return 0;},
    read(){return response;}
  };
  function cecJump(){
    events.push(now+' CEC jump, route='+route);
    if(route==='LiveTV'&&cur==='HDMI1')return;
    route='LiveTV';cur='HDMI1';
    if(c.kodiRunning){c.kodiRunning=false;kills++;events.push(now+' Kodi ended by jump');}
  }
  const allInputsVm={$options:{name:'AllInputs'},_isDestroyed:false,_inactive:false,currentFocus:'AllInputsGridViewItem-0',showMenu:false,
    allInputsData:[{sourceId:'HDMI1'}],keydown(){},constructor:{options:{methods:{keydown(){}}}},$el:{children:[{}]}};
  allInputsVm.constructor.options.methods.keydown=function(){events.push(now+' native AllInputs OK');route='LiveTV';cur='HDMI1';};
  const UI={getCurrentSubModuleId:()=>route,getCurrentModuleId:()=>route,showToast(m){events.push(now+' toast '+m);},
    store:{state:{Source:{get currSourceId(){return cur;}}},commit(n,v){if(n==='Source/setCurrentSource')cur=v[0];}},
    popAllModule(){route='';},pushModule(m){route=m;},isSoftKeyboardShown:()=>false};
  const mtv={componentFocus:'LauncherMainTile-1'};
  function DOMParser(){}
  DOMParser.prototype.parseFromString=function(input){
    const video=input==='<Resolution><Input>---</Input></Resolution>';
    const field={textContent:'---'};
    const resolution={getElementsByTagName:name=>name==='Input'?[field]:[]};
    return {getElementsByTagName:name=>video&&name==='Resolution'?[resolution]:[]};
  };
  const c={console,JSON,Math,String,Number,Error,RegExp,Array,Object,parseInt,isNaN,DOMParser,
    document:{getElementById:(id)=>id==='AllInputs'&&route==='AllInputs'?{__vue__:allInputsVm}:null,querySelectorAll:()=>[],createElement(){return {style:{},appendChild(){}};},body:null},
    UI,inst:{stopped:false},fx:{keys:0,hard:0},dialogUp:()=>false,log:m=>logs.push(now+' '+m),kodiToast:(t)=>{if(t)hints.push(now+' '+t);},
    TM_BACK:{8:1,409:1,461:1},launcherSig:()=>route+'|idle',
    homeIdle:()=>route==='LauncherHis',uiReadyNow:()=>true,noAppInStack:()=>true,mainTilesVm:()=>route==='LauncherHis'?mtv:null,
    later,openSources(){route='AllInputs';},kodiRunning:false};
  c.Date={now:()=>now};
  c.window=c;c.window.hisense={file};c.window.__flex={};c.window.modeljs={cec:{getHdmiDevicesName:()=>['HDMI1-AVC-X3800H'],getHdmiDevicesType:()=>[5],HdmiDevicesOperate(){}}};
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(__dirname+'/ui.js','utf8'),c);
  vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);
  const D=c.__flexDenon;
  D.state().sources.push({port:2,command:'MPLAY',name:'Xbox One',label:'Xbox One',hidden:false,autoName:'Kodi'},{port:3,command:'BD',name:'PS5',label:'PS5',hidden:false,autoName:'PlayStation 5'});
  D.refresh();
  (function tk(){D.tick(true,route==='LauncherHis'||route==='AllInputs'||route==='LiveTV');later(tk,1000);})();
  function run(to){while(queue.length){queue.sort((a,b)=>a.at-b.at);if(queue[0].at>to)break;const q=queue.shift();now=q.at;q.fn();}now=to;}
  function key(k){c.fx.keys++;c.denonKeyDown(k);}
  function kodiOk(){c.fx.keys++;const start=()=>{starts.push(now);if(route==='LauncherHis')c.kodiRunning=true;};if(!c.denonBeforeStart('Kodi',start))start();}
  return {c,D,den,sent,run,key,kodiOk,events,logs,hints,starts,kills:()=>kills,setRoute:r=>route=r,route:()=>route,cur:()=>cur,at:()=>now,
    cmds:()=>sent.filter(x=>x!=='SOURCES'&&x!=='STATUS'),phase:()=>c.inst.sourceSwitch&&c.inst.sourceSwitch.phase};
}
const has=(arr,s)=>arr.some(x=>String(x).indexOf(s)>=0);
const dump=t=>'\n cmds '+JSON.stringify(t.cmds())+'\n events '+t.events.join(' | ')+'\n logs '+t.logs.filter(l=>/Denon|Kodi/.test(l)).join(' | ')+'\n hints '+t.hints.join(' | ');
let t;
// N1) normal: PS5 from the row; Denon switches, jump, confirmed; picture watch would follow
t=setup();t.run(2000);t.c.chooseDenonSource(3);t.run(30000);
assert.equal(t.den.SI,'BD',dump(t));assert.equal(t.route(),'LiveTV');assert.ok(/complete-hdmi1-already-active|tv-hdmi1/.test(t.phase()),dump(t));
// N2) normal: on the PS5 (confirmed), HOME, Kodi: Kodi starts at once, Denon to TV (no jump on SITV)
t.setRoute('LauncherHis');t.c.fx.keys++;t.run(31000);t.kodiOk();assert.equal(t.starts.length,1);t.run(60000);assert.equal(t.den.SI,'TV');assert.equal(t.c.kodiRunning,true);assert.equal(t.kills(),0);
// A) list path: Xbox then PS5 in the sources list; the Xbox jump closes the list -> PS5 still switched (directly)
t=setup({route:'AllInputs'});t.run(2000);t.c.chooseDenonSource(2);t.run(2500);t.key(40);t.c.chooseDenonSource(3);t.run(25000);   // before the picture watch (the fake bridge reports no picture)
assert.equal(t.den.SI,'BD',dump(t));assert.deepEqual(t.cmds(),['SIMPLAY','SIBD'],dump(t));assert.equal(t.route(),'LiveTV');
// B) direct: Xbox, PS5 (service busy), then a key before PS5 is sent -> PS5 dropped, Denon back to TV
t=setup();t.run(2000);t.c.chooseDenonSource(2);t.run(2600);t.key(13);t.key(39);t.key(13);t.c.chooseDenonSource(3);t.run(2700);t.key(37);t.run(90000);
assert.equal(t.den.SI,'TV',dump(t));assert.equal(t.cmds().indexOf('SIBD'),-1);assert.equal(t.cmds()[t.cmds().length-1],'SITV',dump(t));
// C) direct: Xbox, PS5, BACK -> Denon back to TV
t=setup();t.run(2000);t.c.chooseDenonSource(2);t.run(2600);t.key(13);t.key(39);t.key(13);t.c.chooseDenonSource(3);t.run(2800);t.key(8);t.run(90000);
assert.equal(t.den.SI,'TV',dump(t));
// C0) Xbox, BACK (before the jump) -> Denon back to TV
t=setup();t.run(2000);t.c.chooseDenonSource(2);t.run(2600);t.key(8);t.run(90000);assert.equal(t.den.SI,'TV',dump(t));
// D) Xbox, PS5, key, Kodi OK -> Kodi never started into the jump; Denon TV; hint to start again via HOME
t=setup();t.run(2000);t.c.chooseDenonSource(2);t.run(2400);t.key(13);t.key(39);t.key(13);t.c.chooseDenonSource(3);t.run(2700);t.key(37);t.run(2900);t.kodiOk();t.run(90000);
assert.equal(t.kills(),0,dump(t));assert.equal(t.starts.length,0,dump(t));assert.equal(t.den.SI,'TV',dump(t));assert.ok(has(t.hints,'über HOME neu wählen'),dump(t));
// D0) the incident: Xbox, Kodi right after -> no kill, Denon TV, hint
t=setup();t.run(2000);t.c.chooseDenonSource(2);t.run(2400);t.kodiOk();t.run(90000);
assert.equal(t.kills(),0,dump(t));assert.equal(t.den.SI,'TV');assert.equal(t.starts.length,0);
// E) incident + impatient second OK on Kodi: swallowed, still no kill, no start into the jump
t=setup();t.run(2000);t.c.chooseDenonSource(2);t.run(2400);t.kodiOk();t.run(3000);t.kodiOk();t.run(4000);t.kodiOk();t.run(90000);
assert.equal(t.kills(),0,dump(t));assert.equal(t.starts.length,0,dump(t));assert.equal(t.den.SI,'TV');
// E2) same without a jump (Denon announces nothing): Kodi starts exactly once after TV audio, no 'abgebrochen'
t=setup({cec:false});t.run(2000);t.c.chooseDenonSource(2);t.run(2400);t.kodiOk();t.run(3000);t.kodiOk();t.run(90000);
assert.equal(t.starts.length,1,dump(t));assert.equal(t.c.kodiRunning,true);assert.equal(t.den.SI,'TV');assert.ok(!has(t.hints,'abgebrochen'),dump(t));
// F) 'PC am Schreibtisch' (MAIN off, ZONE2 on, MAIN input GAME1): Xbox, Kodi while ZMON is in flight -> MAIN ends on TV
t=setup({den:{ZM:'OFF',Z2:'ON',SI:'GAME1'},cec:false});t.run(2000);t.c.chooseDenonSource(2);t.run(11000);assert.deepEqual(t.cmds(),['Z2OFF','ZMON']);t.kodiOk();t.run(90000);
assert.equal(t.den.ZM,'ON');assert.equal(t.den.SI,'TV',dump(t));assert.equal(t.starts.length,1,dump(t));assert.equal(t.cmds().indexOf('SIMPLAY'),-1);
// F2) ... and if the Denon announces itself on power-on (jump): no kill, Denon TV
t=setup({den:{ZM:'OFF',Z2:'ON',SI:'GAME1'},cecOnPower:true});t.run(2000);t.c.chooseDenonSource(2);t.run(11000);t.kodiOk();t.run(90000);
assert.equal(t.kills(),0,dump(t));assert.equal(t.den.SI,'TV',dump(t));
// F3) Kodi while only Z2OFF is in flight: MAIN stays off (nothing to undo), Kodi starts after the step
t=setup({den:{ZM:'OFF',Z2:'ON',SI:'GAME1'},cec:false});t.run(2000);t.c.chooseDenonSource(2);t.run(3000);t.kodiOk();t.run(90000);
assert.equal(t.den.ZM,'OFF',dump(t));assert.deepEqual(t.cmds(),['Z2OFF'],dump(t));assert.equal(t.starts.length,1,dump(t));
// G) PS5 chosen, jump to HDMI1, BACK to close the infobar -> PS5 stays (choice completes)
t=setup();t.run(2000);t.c.chooseDenonSource(3);t.run(6000);assert.equal(t.route(),'LiveTV');t.key(8);t.run(25000);
assert.equal(t.den.SI,'BD',dump(t));assert.equal(t.phase(),'complete-hdmi1-already-active',dump(t));
// H) Xbox chosen by mistake and left alone: no picture -> after the watch Denon back to TV with the hint
t=setup();t.run(2000);t.c.chooseDenonSource(2);t.run(120000);assert.equal(t.den.SI,'TV',dump(t));assert.ok(has(t.hints,'Xbox One: kein Bild'),dump(t));
// H2) The receiver answers, but its video metadata is unavailable.
t=setup({videoUnavailable:true});t.run(2000);t.c.chooseDenonSource(2);t.run(120000);
assert.equal(t.den.SI,'MPLAY',dump(t));assert.ok(!has(t.hints,'Xbox One: kein Bild'),dump(t));
console.log('Simulation (real ui.js + sources.js, bridge timing, CEC jump): no Kodi start into the jump, Denon never left on an abandoned console, fast corrections, ZMON in flight, BACK after the jump, picture fallback.');
