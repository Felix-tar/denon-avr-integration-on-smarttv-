const fs=require('fs'),vm=require('vm'),assert=require('assert');
let sent=[],response=null,clock=Date.now();
const root={appendChild(e){e.parentNode=this;},removeChild(e){e.parentNode=null;}};
const context={window:{hisense:{file:{write(p,v){sent.push(v);return 0;},read(){return response;}}}},
 document:{body:root,createElement(){return {innerHTML:''};}},Date:class extends Date{static now(){return clock;}},Math,JSON};
vm.runInNewContext(fs.readFileSync(__dirname+'/ui.js','utf8'),context);
const d=context.window.__flexDenon;
const raw='ZMON\nZ2OFF\nZ2GAME1\nSITV\nMV445\nMUOFF\nMSDOLBY AUDIO-DSUR\nCVFL 50\nCVSW 62\nPSTONE CTRL OFF\nPSBAS 50\nPSTRE 50\nPSDYNEQ OFF\nPSDYNVOL OFF\nPSMULTEQ:OFF\n';
function reply(ok=true,extra={}){response=JSON.stringify(Object.assign({id:sent[sent.length-1].split('\n')[0],ok,raw,error:ok?'':'Testfehler'},extra));d.tick(true);clock+=1000;}
assert.equal(sent.length,0);d.open();assert.equal(sent.length,1);assert.equal(sent[0].split('\n')[1],'SOURCES');reply();
d.key(39);d.key(40); // volume
assert.equal(sent.length,1);d.key(13);d.key(37);assert.equal(sent.length,1); // edit without apply
d.key(8);assert.equal(sent.length,1); // cancel
d.key(13);d.key(37);d.key(13);assert.equal(sent[1].split('\n')[1],'MV44');reply();
d.key(37);d.key(40);d.key(39);d.key(13);assert.equal(sent.length,2); // profile confirmation
d.key(8);assert.equal(sent.length,2);
d.close();d.tick(false);assert.equal(sent.length,2);
d.open();reply();d.key(40);d.key(39);d.key(13);d.key(13);assert.equal(sent[sent.length-1].split('\n')[1],'Z2OFF');reply(false);
assert.equal(d.state().pending,false);assert.equal(d.state().notice,'Testfehler');
d.close();
console.log('Denon UI: opening/focus read-only, edit/apply/cancel, profile confirmation and stop-on-error passed');

// A closed Denon panel must still complete Sources callbacks, only after all acknowledgements.
d.state().sources.push({port:4,command:'GAME1',name:'PC'});
let selected=0;
assert.equal(d.selectSource(4,()=>selected++),true);
assert.equal(sent[sent.length-1].split('\n')[1],'SIGAME1');
assert.equal(selected,0);reply();assert.equal(selected,1);
clock+=16000;
assert.equal(d.selectSource(4,()=>selected++),true);
assert.equal(sent[sent.length-1].split('\n')[1],'Z2OFF');reply();
assert.equal(sent[sent.length-1].split('\n')[1],'ZMON');assert.equal(selected,1);reply();
assert.equal(sent[sent.length-1].split('\n')[1],'SIGAME1');assert.equal(selected,1);reply();assert.equal(selected,2);
let selectionError='';assert.equal(d.selectSource(4,e=>{if(e)selectionError=e;else selected++;}),true);reply(false);assert.equal(selected,2);assert.equal(selectionError,'Testfehler');
console.log('Sources sequence: fresh status skips redundant power commands; stale status verifies all steps; callback only on success.');

// 15.11.2026: no IP presence any more. A presence field from an old bridge is ignored,
// and the Denon read while the home screen is visible runs at most every 15 s.
d.close();d.open();reply(true,{presence:{'3':3}});
const ps5={port:3,command:'BD'};
assert.ok(['Konsole eingeschaltet','Konsole im Ruhemodus','Geraet erreichbar'].indexOf(d.sourceStatus(ps5))<0);
d.close();let before=sent.length;
d.tick(true,true);assert.equal(sent.length,before+1);assert.equal(sent[sent.length-1].split('\n')[1],'SOURCES');reply();
d.tick(true,true);assert.equal(sent.length,before+1);
clock+=15000;d.tick(true,true);assert.equal(sent.length,before+2);assert.equal(sent[sent.length-1].split('\n')[1],'SOURCES');reply();
d.tick(true,false);clock+=20000;d.tick(true,false);assert.equal(sent.length,before+2);
console.log('No IP presence: old presence field ignored; home-screen Denon read at most every 15 s, none when no source view is visible.');
// 17.11.2026: selectTv (Denon to TV audio on Kodi/app start, ZONE2 untouched): stale status verifies all steps, fresh status only
// what is missing, already on TV -> callback right away; failure reported to the callback; busy -> queued and run next tick
{let tvs=0,tvErr='';const bd='ZMON\nZ2OFF\nSIBD\nMV445\n';d.close();clock+=20000;
assert.equal(d.selectTv(e=>{if(e)tvErr=e;else tvs++;}),true);assert.equal(sent[sent.length-1].split('\n')[1],'ZMON');reply(true,{raw:bd});assert.equal(sent[sent.length-1].split('\n')[1],'SITV');assert.equal(tvs,0);reply();assert.equal(tvs,1);
let n=sent.length;assert.equal(d.selectTv(()=>tvs++),true);assert.equal(sent.length,n);assert.equal(tvs,2);
d.open();reply(true,{raw:bd});d.close();n=sent.length;
assert.equal(d.selectTv(e=>{if(e)tvErr=e;else tvs++;}),true);assert.equal(sent.length,n+1);assert.equal(sent[sent.length-1].split('\n')[1],'SITV');reply(false);assert.equal(tvErr,'Testfehler');assert.equal(tvs,2);
d.open();assert.equal(d.selectTv(()=>tvs++),true);assert.equal(d.state().busy,true);n=sent.length;reply(true,{raw:bd});d.close();d.tick(true,false);assert.equal(sent.length,n+1);assert.equal(sent[sent.length-1].split('\n')[1],'SITV');reply();assert.equal(tvs,3);assert.equal(d.state().busy,false);}
console.log('selectTv: Denon to TV audio with verified steps, only missing steps when fresh, errors to the callback, busy queued.');
// 18.11.2026: abortSequence ends a console sequence (no further steps, no callback) and reports whether an input command
// (SI..., not SITV) already went out or is in flight; refresh reads the receiver only when idle; queued TV requests coalesce.
{const bd='ZMON\nZ2ON\nSITV\nMV445\n';d.close();clock+=20000;d.state().sources.length=0;d.state().sources.push({port:2,command:'MPLAY',name:'Xbox One'});
let cb=0;assert.equal(d.selectSource(2,()=>cb++),true);assert.equal(sent[sent.length-1].split('\n')[1],'Z2OFF');
assert.equal(d.abortSequence(),false);reply(true,{raw:bd});assert.equal(d.state().busy,false);assert.equal(cb,0);   // aborted before the input step: no SI
assert.equal(d.selectSource(2,()=>cb++),true);reply(true,{raw:bd});assert.equal(sent[sent.length-1].split('\n')[1],'SIMPLAY');
assert.equal(d.abortSequence(),true);reply(true,{raw:bd});assert.equal(cb,0);assert.equal(d.abortSequence(),false);   // SI in flight; afterwards nothing to abort
let tv1=0,tv2=0;d.open();assert.equal(d.state().busy,true);assert.equal(d.selectTv(()=>tv1++),true);assert.equal(d.selectTv(()=>tv2++),true);assert.equal(d.refresh(),false);reply(true,{raw:bd});d.close();
let guard=0;while(d.state().busy&&guard++<10){d.tick(true,false);if(d.state().pending)reply(true,{raw:bd});}assert.equal(tv1,1);assert.equal(tv2,1);   // both queued requests answered once
assert.equal(d.refresh(),true);assert.equal(sent[sent.length-1].split('\n')[1],'SOURCES');reply();}
console.log('abortSequence/refresh/busy: console sequence abortable, input-in-flight reported, refresh only when idle, queued TV requests all answered.');
// Review 18.11.2026: selectTv(done,want) decides on the state when it runs (queued: after the running command); when every
// request says "not needed" on fresh status, nothing is sent and the callbacks get no error.
{const off='ZMOFF\nZ2ON\nSIGAME1\nMV445\n',on='ZMON\nZ2OFF\nSIMPLAY\nMV445\n',want=x=>x.ZM==='ON'&&x.SI!=='TV';d.close();clock+=20000;let r=[],n;
assert.equal(d.refresh(),true);reply(true,{raw:off});n=sent.length;
assert.equal(d.selectTv(e=>r.push(e||'a'),want),true);assert.equal(sent.length,n);assert.deepEqual(r,['a']);   // main zone off: nothing to do
assert.equal(d.refresh(),true);assert.equal(d.selectTv(e=>r.push(e||'b'),want),true);n=sent.length;reply(true,{raw:on});
d.tick(true,false);assert.equal(sent.length,n+1);assert.equal(sent[sent.length-1].split('\n')[1],'SITV');reply(true,{raw:'ZMON\nSITV\n'});assert.deepEqual(r,['a','b']);   // decided after the running command
assert.equal(d.refresh(),true);assert.equal(d.selectTv(e=>r.push(e||'c'),x=>x.SI==='MPLAY'),true);n=sent.length;reply(true,{raw:'ZMON\nSIGAME1\n'});
d.tick(true,false);assert.equal(sent.length,n);assert.deepEqual(r,['a','b','c']);assert.equal(d.state().busy,false);   // profile chosen meanwhile: kept
assert.equal(d.refresh(),true);d.selectTv(e=>r.push(e||'d'),x=>false);d.selectTv(e=>r.push(e||'e'));n=sent.length;reply(true,{raw:'ZMON\nSIGAME1\n'});
d.tick(true,false);assert.equal(sent.length,n+1);reply(true,{raw:'ZMON\nSITV\n'});assert.deepEqual(r,['a','b','c','d','e']);   // one request without check: executed, all answered
assert.equal(typeof d.state().sourceAt,'number');}
console.log('selectTv want: decided on the state at execution, nothing sent when not needed, callbacks always answered.');
