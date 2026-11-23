const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 18.11.2026: robust console switching (owner chose an Xbox that is not connected, then Kodi; Kodi was ended and there was
// no sound). New choices supersede a running one; a superseded choice with steps out sends the Denon back to TV audio and
// Kodi/app starts wait for it; queued TV audio; no picture after a console choice -> back to TV audio with a hint.
// Review 18.11.2026 (cases R*): second OK while waiting, BACK/key/new console before the replacing choice is sent,
// ZMON in flight, BACK after the CEC jump, app keys, volume, launcher change, STR, deadline on fresh status.
function setup(o){
 o=o||{};let now=0,route='LauncherHis',queue=[],done=null,calls=[],src='DMP',hints=[],logs=[],starts=[],sig='LauncherHis|LauncherHis|idle||false';
 const sources=[{port:2,command:'MPLAY',name:'Xbox One',autoName:'Kodi',label:'Xbox One'},{port:3,command:'BD',name:'PS5',autoName:'PlayStation 5',label:'PS5'},
  {port:4,command:'GAME1',name:'PC',autoName:'GeForce RTX 3080',label:'PC'}];
 const den={data:{ZM:'ON',SI:'TV'},status:{},busy:false,pending:false,sel:[],tv:[],wants:[],aborts:0,input:false,refreshes:0,sourceAt:0,
  state(){return {pending:den.pending,busy:den.busy,sources,notice:'Zeitlimit',data:den.data,sourceAt:den.sourceAt};},
  sourceStatus(s){return den.status[s.port]||(den.data.SI===s.command?'Ausgewaehlt':'Betriebsstatus unbekannt');},
  selectSource(p,cb){den.sel.push(p);done=cb;return true;},abortSequence(){den.aborts++;done=null;return den.input;},
  selectTv(cb,want){den.tv.push(cb||null);den.wants.push(want||null);return true;},refresh(){den.refreshes++;den.sourceAt=now;return true;}};
 const store={state:{Source:{get currSourceId(){return src;}}},commit(n,v){calls.push('commit '+n);if(n==='Source/setCurrentSource')src=v[0];}};
 const vmv={componentFocus:'LauncherMainTile-1'};
 const UI={getCurrentSubModuleId:()=>route,getCurrentModuleId:()=>route,showToast(){},store,popAllModule(){calls.push('popAllModule');route='';},pushModule(m){calls.push('pushModule '+m);route=m;}};
 const c={document:{getElementById:()=>null,querySelectorAll:()=>[]},
  window:{__flex:{},modeljs:{cec:{getHdmiDevicesName:()=>['HDMI1-PlayStation 5','HDMI1-AVC-X3800H'],getHdmiDevicesType:()=>[4,5],HdmiDevicesOperate(){calls.push('cec');}}},__flexDenon:den},
  UI,inst:{stopped:false},fx:{keys:0,hard:0},dialogUp:()=>false,log:m=>logs.push(m),kodiToast:(t)=>hints.push(t),TM_BACK:{8:1,409:1,461:1},
  launcherSig:()=>sig,homeIdle:()=>route==='LauncherHis',uiReadyNow:()=>true,noAppInStack:()=>true,mainTilesVm:()=>vmv,
  Date:{now:()=>now},later:(fn,ms)=>queue.push({fn,at:now+ms}),openSources(){calls.push('openSources');route='AllInputs';}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);
 function run(to){while(queue.length){queue.sort((a,b)=>a.at-b.at);if(queue[0].at>to)break;let q=queue.shift();now=q.at;q.fn();}now=to;}
 return {c,den,run,calls,hints,logs,starts,vmv,finish:e=>{const d=done;done=null;if(d)d(e);},hasCb:()=>!!done,setRoute:r=>route=r,setSrc:s=>src=s,setSig:s=>sig=s,at:()=>now,
  key:k=>{c.fx.keys++;c.denonKeyDown(k);},
  start:(app)=>c.denonBeforeStart(app||'Kodi',()=>starts.push(app||'Kodi'))};
}
const has=(arr,s)=>arr.some(x=>String(x).indexOf(s)>=0);
// 1) Xbox chosen, Kodi right after while the Xbox input change is in flight: choice aborted, Denon to TV first, Kodi later
let t=setup();t.c.chooseDenonSource(2);t.run(0);assert.deepEqual(t.den.sel,[2]);t.den.input=true;
assert.equal(t.start(),true);assert.equal(t.den.aborts,1);assert.equal(t.c.inst.sourceSwitch.phase,'superseded');assert.equal(t.hasCb(),false);
assert.equal(t.starts.length,0);assert.equal(t.den.tv.length,1);assert.ok(has(t.hints,'Kodi startet gleich'));
assert.equal(t.den.wants[0]({ZM:'ON',SI:'MPLAY'}),true);assert.equal(t.den.wants[0]({ZM:'ON',SI:'TV'}),false);assert.equal(t.den.wants[0]({ZM:'OFF',SI:'MPLAY'}),false);
t.den.tv[0]();t.run(2400);assert.equal(t.starts.length,0);t.run(2600);assert.deepEqual(t.starts,['Kodi']);assert.equal(t.calls.indexOf('pushModule LiveTV'),-1);
t.run(40000);assert.deepEqual(t.starts,['Kodi']);   // no second start
// 1b) ... and the launcher jumped to HDMI1 meanwhile (CEC): no Kodi start, hint to go HOME and choose again
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.start();t.setRoute('LiveTV');t.den.tv[0]();t.run(3000);
assert.equal(t.starts.length,0);assert.ok(has(t.hints,'über HOME neu wählen'));
// 1c) key pressed while waiting, or focus moved: no start
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.start();t.c.fx.keys++;t.den.tv[0]();t.run(3000);assert.equal(t.starts.length,0);assert.ok(has(t.hints,'Start abgebrochen'));
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.start();t.vmv.componentFocus='LauncherMainTile-5';t.den.tv[0]();t.run(3000);assert.equal(t.starts.length,0);
// 1d) Denon never comes back: no start at all (R: U11), hint after 25 s
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.start();t.run(24900);assert.equal(t.starts.length,0);assert.ok(!has(t.hints,'Start abgebrochen'));
t.run(25300);assert.equal(t.starts.length,0);assert.ok(has(t.hints,'Start abgebrochen'));
// 2) choice superseded with only Z2OFF/ZMON out (no SI yet): also back to TV (decided after the step), start waits (R: C5)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=false;assert.equal(t.start(),true);assert.equal(t.den.aborts,1);assert.equal(t.den.tv.length,1);
t.den.tv[0]();t.run(3000);assert.deepEqual(t.starts,['Kodi']);
// 2b) choice not sent yet (service busy): nothing to abort, Kodi starts right away (caller)
t=setup();t.den.busy=true;t.c.chooseDenonSource(2);t.run(0);assert.equal(t.den.sel.length,0);assert.equal(t.start(),false);assert.equal(t.den.aborts,0);assert.equal(t.den.tv.length,0);
t.den.busy=false;t.run(2000);assert.equal(t.den.sel.length,0);   // the dropped choice never sends later
// 3) no running choice: unchanged behaviour (denonAutoTv when the Denon is on a device)
t=setup();t.den.data.SI='BD';t.den.status[3]='Signal 2160p60';assert.equal(t.start(),false);assert.equal(t.den.tv.length,1);assert.ok(has(t.hints,'läuft im Hintergrund weiter'));
// 4) another console while one runs: the old one is superseded (no TV in between), the new one is sent once the service is free
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.den.busy=true;t.c.chooseDenonSource(3);assert.equal(t.den.aborts,1);assert.equal(t.den.tv.length,0);
t.run(1000);assert.deepEqual(t.den.sel,[2]);t.den.busy=false;t.run(1500);assert.deepEqual(t.den.sel,[2,3]);assert.equal(t.c.inst.sourceSwitch.port,3);
t.den.data.SI='BD';t.finish();assert.equal(t.den.tv.length,0);   // new console confirmed: no TV audio
// 4b) the same console again while it runs: re-confirms (keys between do not cancel it), no abort, no second send (R: U12)
t=setup();t.den.busy=true;t.c.chooseDenonSource(3);t.run(0);t.c.fx.keys+=2;t.c.chooseDenonSource(3);t.den.busy=false;t.run(1000);assert.deepEqual(t.den.sel,[3]);assert.equal(t.den.aborts,0);
// 4c) late callback of a superseded choice does nothing
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=false;t.c.denonSupersede('Test',true);t.finish();assert.equal(t.calls.length,0);
// 5) BACK on the start screen during a running choice: superseded, Denon back to TV (steps were out)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;assert.equal(t.c.denonChoiceActive(),true);t.key(8);assert.equal(t.den.tv.length,1);assert.equal(t.c.denonChoiceActive(),false);
t=setup();t.den.busy=true;t.c.chooseDenonSource(2);t.run(0);t.key(8);assert.equal(t.den.tv.length,0);assert.equal(t.c.denonChoiceActive(),false);   // nothing sent: nothing to undo
// 6) picture check: Xbox (no CEC) confirmed, no picture -> after 20 s (decided on a status read after the deadline) back to TV
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();
t.run(19000);assert.equal(t.den.tv.length,0);assert.ok(t.den.refreshes>=3);t.run(21000);assert.equal(t.den.tv.length,1);assert.ok(has(t.hints,'Xbox One: kein Bild'));
assert.equal(t.den.wants[0]({ZM:'ON',SI:'MPLAY'}),true);assert.equal(t.den.wants[0]({ZM:'ON',SI:'GAME1'}),false);   // profile chosen meanwhile stays (R: U7)
// 6a) the deadline read shows a picture: no revert (R: U6)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();t.run(19500);t.den.refresh=function(){t.den.refreshes++;t.den.sourceAt=t.at();t.den.status[2]='Signal 1080p60';return true;};
t.run(30000);assert.equal(t.den.tv.length,0);assert.ok(has(t.logs,'Bild von Xbox One'));
// 6a2) the AVR never answers the deadline read: do not switch based on old data
{const t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();
 t.den.refresh=function(){t.den.refreshes++;return false;};
 t.run(35000);assert.equal(t.den.tv.length,0,'unknown picture status must not switch AVR');}
// 6b) picture comes: no revert
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();t.run(6000);t.den.status[2]='Signal 1080p60';t.run(30000);assert.equal(t.den.tv.length,0);assert.ok(has(t.logs,'Bild von Xbox One'));
// 6c) PS5 woken by CEC: 40 s before giving up
t=setup();t.c.chooseDenonSource(3);t.run(0);t.den.data.SI='BD';t.finish();t.run(30000);assert.equal(t.den.tv.length,0);t.run(41000);assert.equal(t.den.tv.length,1);
// 6d) Denon switched elsewhere meanwhile: stop, no revert
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();t.run(5000);t.den.data.SI='GAME1';t.run(30000);assert.equal(t.den.tv.length,0);
// 6e) also when the TV switch was cancelled by a key (Denon still on the dead input)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.c.fx.keys++;t.den.data.SI='MPLAY';t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-after-receiver');t.run(21000);assert.equal(t.den.tv.length,1);
// 6f) a new choice / Kodi start ends the check
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();t.run(3000);t.start();t.den.tv.length=0;t.run(30000);assert.equal(t.den.tv.length,0);
// 6g) standby/STR during the check ends it (R: U9)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();t.run(8000);t.c.fx.hard++;t.run(40000);assert.equal(t.den.tv.length,0);
// 7) stop of the instance ends the check and a waiting start
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.data.SI='MPLAY';t.finish();t.c.stopDenonSources();t.run(30000);assert.equal(t.den.tv.length,0);
t=setup();t.c.chooseDenonSource(2);t.run(0);t.start();t.c.stopDenonSources();t.c.inst.stopped=true;t.den.tv[0]();t.run(5000);assert.equal(t.starts.length,0);
// R1) second OK on the same tile while waiting: swallowed, Kodi starts exactly once, no 'abgebrochen' (C1/C3/C7)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.c.fx.keys++;t.start();t.run(1000);t.c.fx.keys++;assert.equal(t.start(),true);assert.equal(t.starts.length,0);
t.den.tv[0]();t.run(5000);assert.deepEqual(t.starts,['Kodi']);assert.ok(!has(t.hints,'Start abgebrochen'));
// R1b) OK on another tile while waiting replaces the waiting start silently
t=setup();t.c.chooseDenonSource(2);t.run(0);t.start('Kodi');t.run(500);t.c.fx.keys+=2;t.vmv.componentFocus='LauncherMainTile-3';assert.equal(t.start('Netflix'),true);
t.den.tv[0]();t.run(5000);assert.deepEqual(t.starts,['Netflix']);assert.ok(!has(t.hints,'Start abgebrochen'));
// R2) BACK with steps out, then Kodi: Kodi waits for TV audio (C3)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.key(8);assert.equal(t.den.tv.length,1);t.c.fx.keys++;assert.equal(t.start(),true);assert.equal(t.starts.length,0);
t.den.tv[0]();t.run(3000);assert.deepEqual(t.starts,['Kodi']);
// R3) after TV audio confirmed + 2.5 s: immediate again
t=setup();t.c.chooseDenonSource(2);t.run(0);t.key(8);t.den.tv[0]();t.run(3000);assert.equal(t.start(),false);
// R4) Xbox sent, PS5 chosen while busy, a key before PS5 is sent: PS5 dropped, Denon back to TV (C0 B)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.input=true;t.den.busy=true;t.c.fx.keys++;t.c.chooseDenonSource(3);t.run(100);assert.equal(t.den.tv.length,0);
t.c.fx.keys++;t.run(1000);assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-before-send');assert.equal(t.den.tv.length,1);assert.deepEqual(t.den.sel,[2]);
// R5) ... BACK instead of a key: PS5 (not sent) superseded, inherited steps -> TV (C0 C)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.busy=true;t.c.chooseDenonSource(3);t.run(100);t.key(8);assert.equal(t.den.tv.length,1);
// R6) ... Kodi instead: deferred, not started at once (C0 D)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.den.busy=true;t.c.chooseDenonSource(3);t.run(100);t.c.fx.keys++;assert.equal(t.start(),true);assert.equal(t.starts.length,0);assert.equal(t.den.tv.length,1);
t.den.busy=false;t.den.tv[0]();t.run(3000);assert.deepEqual(t.starts,['Kodi']);assert.deepEqual(t.den.sel,[2]);
// R7) BACK after the CEC jump (TV already on LiveTV/HDMI1): choice runs on, Denon stays on the console (C4)
t=setup();t.c.chooseDenonSource(3);t.run(0);t.setRoute('LiveTV');t.setSrc('HDMI1');t.key(8);assert.equal(t.c.denonChoiceActive(),true);assert.equal(t.den.tv.length,0);
t.den.data.SI='BD';t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'complete-hdmi1-already-active');assert.equal(t.den.tv.length,0);
// R8) app keys (Netflix 616) supersede like an app tile; other keys do not (U10)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.key(37);assert.equal(t.c.denonChoiceActive(),true);t.key(616);assert.equal(t.c.denonChoiceActive(),false);assert.equal(t.den.tv.length,1);
// R9) volume/mute while waiting does not cancel the start (U15)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.start();t.key(412);t.key(413);t.den.tv[0]();t.run(3000);assert.deepEqual(t.starts,['Kodi']);
// R10) app start without a key while waiting (DIAL cast: launcher state changes): no start (C2)
t=setup();t.c.chooseDenonSource(2);t.run(0);t.start();t.setSig('LauncherHis|LauncherHis|starting|YouTube|false');t.den.tv[0]();t.run(3000);assert.equal(t.starts.length,0);
// R11) STR while waiting: no start, no hint afterwards
t=setup();t.c.chooseDenonSource(2);t.run(0);t.start();t.c.fx.hard++;t.den.tv[0]();t.run(30000);assert.equal(t.starts.length,0);assert.equal(t.c.denonBeforeStart('Kodi',()=>{}),false);
// R12) list path: the superseded choice's CEC jump closed the list, TV already on HDMI1: the new choice goes on directly
t=setup();t.c.chooseDenonSource(2);t.run(0);t.setRoute('AllInputs');t.den.busy=true;t.c.chooseDenonSource(3);t.run(50);t.setRoute('LiveTV');t.setSrc('HDMI1');t.run(400);t.den.busy=false;t.run(1300);
assert.deepEqual(t.den.sel,[2,3]);t.den.data.SI='BD';t.finish();assert.equal(t.c.inst.sourceSwitch.phase,'complete-hdmi1-already-active');assert.equal(t.den.tv.length,0);
// R12b) ... without an inherited step (route changed by something else): cancelled as before
t=setup();t.setRoute('AllInputs');t.den.busy=true;t.c.chooseDenonSource(3);t.run(50);t.setRoute('LiveTV');t.setSrc('HDMI1');t.run(500);assert.equal(t.c.inst.sourceSwitch.phase,'cancelled-route');assert.equal(t.den.tv.length,0);
// R13) a console chosen while a start waits: the waiting start is dropped silently
t=setup();t.c.chooseDenonSource(2);t.run(0);t.start();t.c.fx.keys+=2;t.c.chooseDenonSource(3);t.den.tv[0]();t.run(5000);assert.equal(t.starts.length,0);assert.ok(!has(t.hints,'Start abgebrochen'));
// R14) failed new console with an inherited step: Denon back to TV
t=setup();t.c.chooseDenonSource(2);t.run(0);t.c.chooseDenonSource(3);t.run(1000);assert.deepEqual(t.den.sel,[2,3]);t.finish('Testfehler');assert.equal(t.c.inst.sourceSwitch.phase,'failed');assert.equal(t.den.tv.length,1);
console.log('Robust switching: supersede on new choice/Kodi/app/app key/back (not after the CEC jump), Denon back to TV after any sent step, starts wait for it (second OK held, re-checked incl. launcherSig, 25-s cap without start), picture check on fresh status with fallback to TV audio.');
