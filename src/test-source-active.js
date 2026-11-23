const fs=require('fs'),vm=require('vm'),assert=require('assert');
// 17.11.2026: a Denon input is listed when the receiver knows a device there (CEC/HDMI name, "Auto") or the owner
// named it, independent of power state or signal; name "-" hides it. The home screen gets ONE tile "Konsolen".
let inputs=[{port:3,name:'PS5',command:'BD',autoName:'PlayStation 5',label:'PS5',status:'Betriebsstatus unbekannt'},
 {port:4,name:'PC',command:'GAME1',autoName:'GeForce RTX 3080',label:'',status:'Signal 2160p60'},
 {port:1,name:'CBL/SAT',command:'SAT/CBL',autoName:'',label:'',status:'Signal 1080p50'},
 {port:5,name:'Beamer',command:'AUX1',autoName:'',label:'Beamer',status:'Receiver MAIN aus'}];
let c={window:{__flex:{},__flexDenon:{state:()=>({sources:inputs}),sourceStatus:s=>s.status}}};
vm.createContext(c);vm.runInContext(fs.readFileSync(__dirname+'/sources.js','utf8'),c);
const ports=()=>c.denonListedSources().map(s=>s.port).join(',');
assert.equal(ports(),'3,4,5');
inputs[0].status='Status nicht aktuell';inputs[1].status='Ausgewaehlt';assert.equal(ports(),'3,4,5');
inputs[0].autoName='';assert.equal(ports(),'3,4,5');inputs[0].label='';assert.equal(ports(),'4,5');
inputs.push({port:2,name:'konsole',command:'MPLAY',autoName:'Kodi',label:'',hidden:true,status:'Betriebsstatus unbekannt'});assert.equal(ports(),'4,5');
inputs[inputs.length-1].hidden=false;assert.equal(ports(),'4,5,2');
let tiles=c.denonHomeTiles();assert.equal(tiles.length,1);assert.equal(tiles[0].appId,'flex-denon-group');assert.equal(tiles[0].appName,'Konsolen');assert.equal(tiles[0].denonGroup,true);assert.ok(!tiles[0].denonPort);
inputs.length=0;assert.equal(c.denonHomeTiles().length,0);
console.log('Listed sources: receiver-known device or owner label, independent of signal/power; name - hides; one Konsolen tile on the home screen.');
