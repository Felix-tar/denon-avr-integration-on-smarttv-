/* FLEX Denon UI, ES5/Cobalt. File IPC only; no receiver write on opening/focusing. */
(function () {
  'use strict';
  if (window.__flexDenon) window.__flexDenon.close();
  var d = { opened: false, el: null, cat: 0, row: 0, side: 0, edit: false,
    data: {}, rows: [], pending: null, last: 0, notice: '', undo: null, sequence: null,
    sources: [], labels: {}, pollAt: 0, tvQueue: [], seqKind: '', seqInput: false, sourceAt: 0, videoFor: '', resolution: '', typing: false, onSelected: null };
  var cats = ['Uebersicht', 'Quellen & Zonen', 'Lautsprecherpegel', 'Klang', 'Audyssey', 'Quellennamen', 'Diagnose'];
  var labels = {FL:'Front links',FR:'Front rechts',C:'Center',SW:'Subwoofer',SW2:'Subwoofer 2',SW3:'Subwoofer 3',SW4:'Subwoofer 4',SL:'Surround links',SR:'Surround rechts',SBL:'Surround hinten links',SBR:'Surround hinten rechts',FHL:'Height vorne links',FHR:'Height vorne rechts',TFL:'Top vorne links',TFR:'Top vorne rechts',TML:'Top Mitte links',TMR:'Top Mitte rechts',TRL:'Top hinten links',TRR:'Top hinten rechts'};
  function esc(v) { return String(v === undefined ? 'Nicht gemeldet' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function read() { try { var s=window.hisense.file.read('flexdenon/response',1);return typeof s==='string'?JSON.parse(s):null; } catch(e){return null;} }
  function parse(raw) {
    var data={}, a=raw.split(/\r?\n/), keys=['SYSDA ','PSTONE CTRL ','PSMULTEQ:','PSDYNVOL ','PSDYNEQ ','PSBAS ','PSTRE ','ZM','SI','MV','MU','MS'];
    for(var i=0;i<a.length;i++) {
      var s=a[i],m=s.match(/^CV([A-Z0-9]+) ([0-9]{2,3})$/);
      if(m&&labels[m[1]])data['CV'+m[1]+' ']=m[2];
      if(s==='Z2ON'||s==='Z2OFF')data.Z2POWER=s.substr(2);
      if(s==='Z2GAME1'||s==='Z2TV')data.Z2SOURCE=s.substr(2);
      for(var j=0;j<keys.length;j++)if(s.indexOf(keys[j])===0) {
        var v=s.substr(keys[j].length).replace(/\s+$/, '');
        if(keys[j]==='MV'&&!/^[0-9]{2,3}$/.test(v))continue;
        data[keys[j]]=v;break;
      }
    }
    return data;
  }
  function number(v) {return /^[0-9]{2,3}$/.test(v||'')?(v.length===2?Number(v):Number(v)/10):null;}
  function encoded(v){var i=Math.round(v*10);return i%10===0?('0'+Math.floor(i/10)).slice(-2):('00'+i).slice(-3);}
  function xml(s){return new DOMParser().parseFromString(s,'text/xml');}
  function text(el,tag){var n=el.getElementsByTagName(tag)[0];return n?n.textContent:'';}
  function updateVideoMetadata(a){
    d.sourceAt=0;d.videoFor='';d.resolution='';
    if(!a.video||!d.data.SI)return;
    try {
      var res=xml(a.video).getElementsByTagName('Resolution')[0];
      var input=res?text(res,'Input').replace(/^\s+|\s+$/g,''):'';
      if(!input)return;
      d.sourceAt=Date.now();d.videoFor=d.data.SI;d.resolution=input;
    }catch(e){ /* Kein beobachteter Bildstatus. */ }
  }
  function sourceMetadata(a,command){
    if(command==='SOURCES'&&a.ok)updateVideoMetadata(a);
    // Geraete an den Quellen werden nicht mehr per IP abgefragt (15.11.2026): Umschalten macht CEC.
    if(a.labels)d.labels=a.labels;
    if(!a.assign||!a.names)return;
    try {
      var doc=xml(a.assign),names=xml(a.names),map={},rename={},items=doc.getElementsByTagName('SelectionList')[0].getElementsByTagName('HDMI')[0].getElementsByTagName('Item');
      for(var i=0;i<items.length;i++)map[items[i].getAttribute('index')]=items[i].textContent;
      var ns=names.getElementsByTagName('Source');for(i=0;i<ns.length;i++)rename[ns[i].getAttribute('index')]={name:text(ns[i],'Rename'),auto:text(ns[i],'Auto')};
      var rows=doc.documentElement.childNodes,result=[],commands={'1':'SAT/CBL','3':'BD','4':'GAME1','5':'MPLAY','7':'AUX1','8':'AUX2'};
      for(i=0;i<rows.length;i++)if(rows[i].nodeName==='Source'){
        var id=rows[i].getAttribute('index'),port=Number(map[text(rows[i],'HDMI')]),r=rename[id]||{};
        if(port>=1&&port<=6&&commands[id])result.push({port:port,command:commands[id],name:(d.labels[port]&&d.labels[port]!=='-'?d.labels[port]:'')||r.name||('HDMI '+port),label:d.labels[port]&&d.labels[port]!=='-'?d.labels[port]:'',hidden:d.labels[port]==='-',receiverName:r.name||'',autoName:r.auto||''});
      }
      result.sort(function(x,y){return x.port-y.port;});d.sources=result;
    }catch(e){d.notice='Quellenliste konnte nicht gelesen werden';}
  }
  function sourceStatus(s){
    var fresh=Date.now()-d.sourceAt<60000;
    if(fresh&&d.data.ZM==='ON'&&s.command===d.data.SI&&d.videoFor===s.command&&d.resolution&&d.resolution!=='---')return 'Signal '+d.resolution;
    if(!d.sourceAt||Date.now()-d.sourceAt>60000)return 'Status nicht aktuell';
    if(d.data.ZM!=='ON')return 'Receiver MAIN aus';
    if(s.command===d.data.SI)return d.videoFor===s.command&&d.resolution&&d.resolution!=='---'?'Signal '+d.resolution:'Ausgewaehlt';
    return 'Betriebsstatus unbekannt';
  }
  function selectSource(port,done){
    if(d.pending||d.sequence)return false;
    for(var i=0;i<d.sources.length;i++)if(d.sources[i].port===port){
      d.onSelected=done;d.undo=null;d.sequence=[];d.seqKind='source';d.seqInput=false;
      var fresh=Date.now()-d.last<15000;
      if(!fresh||d.data.Z2POWER!=='OFF')d.sequence.push('Z2OFF');
      if(!fresh||d.data.ZM!=='ON')d.sequence.push('ZMON');
      d.sequence.push('SI'+d.sources[i].command);send(d.sequence.shift());return true;
    }
    return false;
  }
  // Denon auf TV-Ton (Eingang TV) beim Start einer TV-App von der Startseite (sources.js denonAutoTv, 17.11.2026):
  // bei frischem Status nur die noetigen Schritte, jeder gesichert, gesendet und nachgelesen. ZONE2 bleibt, wie sie ist
  // (PC am Schreibtisch), anders als bei selectSource.
  // Ist der Dienst belegt (Statusabfrage, andere Folge), wird die Anfrage eingereiht und im naechsten freien Takt ausgefuehrt
  // (18.11.2026: vorher nach 3 s verworfen, am TV "TV-Ton nicht gesetzt (Dienst belegt)", danach kein Ton). Mehrere
  // Anfragen werden zu einer zusammengefasst; jeder Rueckruf bekommt das Ergebnis.
  // want (optional): Pruefung auf dem Stand bei der Ausfuehrung (Review 18.11.2026: eine eingereihte Anfrage darf nicht
  // auf altem Stand entscheiden, z. B. ein inzwischen gewaehltes Profil zuruecknehmen). Sagen alle Anfragen mit want auf
  // frischem Stand "nicht noetig", wird nichts gesendet und jeder Rueckruf ohne Fehler aufgerufen.
  function selectTv(done,want){
    var r={done:done||null,want:want||null};
    if(d.pending||d.sequence){d.tvQueue.push(r);return true;}
    return runTv([r]);
  }
  function runTv(q){
    var need=Date.now()-d.last>=15000;   // Stand nicht frisch: wie bisher ausfuehren
    for(var i=0;i<q.length&&!need;i++){try{need=!q[i].want||!!q[i].want(d.data);}catch(e){need=true;}}
    var all=function(err){for(var j=0;j<q.length;j++)if(q[j].done){try{q[j].done(err);}catch(e){}}};
    if(!need){all();return true;}
    return startTv(all);
  }
  function startTv(done){
    done=done||function(){};
    d.onSelected=done;d.undo=null;d.sequence=[];d.seqKind='tv';
    var fresh=Date.now()-d.last<15000;
    if(!fresh||d.data.ZM!=='ON')d.sequence.push('ZMON');
    if(!fresh||d.data.SI!=='TV')d.sequence.push('SITV');
    if(!d.sequence.length){d.sequence=null;d.onSelected=null;d.seqKind='';done();return true;}
    send(d.sequence.shift());return true;
  }
  // Neue Wahl des Nutzers (Kodi, App, andere Konsole, Zurueck): eine laufende Konsolen-Umschaltfolge (selectSource) nicht
  // weiterfuehren. Der gerade laufende Befehl endet noch, weitere Schritte und der Rueckruf der alten Wahl entfallen.
  // Rueckgabe: true, wenn ein Eingangswechsel auf ein Geraet (SI..., nicht SITV) schon gesendet ist oder gerade laeuft;
  // dann meldet sich der Denon gleich per CEC als aktive Quelle, und der Launcher springt auf HDMI1.
  function abortSequence(){
    if(d.seqKind!=='source')return false;
    var input=d.seqInput||!!(d.pending&&/^SI/.test(d.pending.command)&&d.pending.command!=='SITV');
    d.sequence=null;d.onSelected=null;d.seqKind='';
    return input;
  }
  // Statusabfrage (Eingaenge, Bild) jetzt, wenn der Dienst frei ist; false = belegt.
  function refresh(){if(d.typing||d.pending||d.sequence||d.tvQueue.length)return false;d.pollAt=Date.now();send('SOURCES');return true;}
  function renameSource(port){
    var src=null;for(var i=0;i<d.sources.length;i++)if(d.sources[i].port===port)src=d.sources[i];
    if(!src||!window.UI||!UI.showSoftKeyboard)return;
    d.typing=true;d.typingAt=Date.now();
    try { UI.showSoftKeyboard({value:src.name,position:10,maxLength:18,curLang:'ENG',curMode:0,viewType:'text',workType:'text',curMarket:'EU',curArea:0,InputName:'Denon HDMI '+port,callback:function(){
      d.typing=false;var name=String(this.value||'').replace(/[\r\n]/g,' ').replace(/^\s+|\s+$/g,'');
      if(name)send('LABEL'+port+' '+name);else render();
    }}); } catch(e) { d.typing=false;d.notice='Tastatur nicht verfuegbar';render(); }
  }
  function send(command) {
    if(d.pending)return;
    if(d.seqKind==='source'&&/^SI/.test(command)&&command!=='SITV')d.seqInput=true;
    var id=String(Date.now())+'-'+String(Math.floor(Math.random()*100000));
    d.pending={id:id,command:command,time:Date.now()};
    d.notice=command==='STATUS'||command==='SOURCES'?'Status wird gelesen ...':'Wird gesichert, gesetzt und geprueft ...';
    try {
      var rc=window.hisense.file.write('flexdenon/request',id+'\n'+command+'\n',1);
      if(rc!==0&&rc!==undefined)throw new Error('Dateizugriff '+rc);
    } catch(e){d.pending=null;d.sequence=null;d.notice='TV-Dienst nicht erreichbar: '+e;selectionFailed(d.notice);}
    render();
  }
  function row(label,key,options,min,max,offset){return {label:label,key:key,options:options,min:min,max:max,offset:offset||0};}
  function rows(){
    var a=[],s=d.data,k;
    if(d.cat===0){
      a=[row('Wohnzimmer / MAIN','ZM',['OFF','ON']),row('Lautstaerke','MV',null,0,80,80),row('Stumm','MU',['OFF','ON']),{label:'Aktive Quelle',info:s.SI},{label:'Klangmodus',info:s.MS},{label:'Eingangssignal',info:s['SYSDA ']||'Nicht gemeldet'}];
    }else if(d.cat===1){
      a=[{label:'TV-Apps hoeren',profile:['Z2OFF','ZMON','SITV']},{label:'PC im Wohnzimmer',profile:['Z2OFF','ZMON','SIGAME1']},{label:'PC am Schreibtisch',profile:['Z2ON','Z2GAME1','ZMOFF']},row('MAIN Quelle','SI',['TV','GAME1']),row('ZONE2','Z2POWER',['OFF','ON']),row('ZONE2 Quelle','Z2SOURCE',['GAME1'])];
    }else if(d.cat===2){
      for(k in labels)if(labels.hasOwnProperty(k)&&s['CV'+k+' ']!==undefined)a.push(row(labels[k],'CV'+k+' ',null,38,62,50));
      if(!a.length)a.push({label:'Keine Kanaele gemeldet',info:'MAIN einschalten und aktualisieren'});
    }else if(d.cat===3){
      a=[row('Klangmodus','MS',['STEREO','DIRECT','PURE DIRECT','DOLBY AUDIO-DSUR','DTS NEURAL:X']),row('Klangregelung','PSTONE CTRL ',['OFF','ON']),row('Bass','PSBAS ',null,44,56,50),row('Hoehen','PSTRE ',null,44,56,50)];
    }else if(d.cat===4){
      a=[row('MultEQ XT32','PSMULTEQ:',['OFF','AUDYSSEY','BYP.LR','FLAT']),row('Dynamic EQ','PSDYNEQ ',['OFF','ON']),row('Dynamic Volume','PSDYNVOL ',['OFF','LIT','MED','HEV'])];
    }else if(d.cat===5){
      // Name "-" blendet den Eingang auf Startseite und in Quellen aus (17.11.2026, z. B. Geraet entfernt, der Denon
      // behaelt dessen CEC-Namen); ein anderer Name zeigt ihn wieder.
      for(var si=0;si<d.sources.length;si++)a.push({label:'Denon HDMI '+d.sources[si].port,info:d.sources[si].hidden?'ausgeblendet (Name -)':d.sources[si].name,rename:d.sources[si].port});
      if(!a.length)a.push({label:'Quellen laden',refresh:true});
    }else{
      var arc='Nicht gelesen',fmt='Nicht gelesen';
      try{arc=window.modeljs.sound.getArcDevExist()?'Erkannt':'Nicht erkannt';fmt={1:'Bitstream',2:'PCM',3:'Auto',4:'Dolby Digital',5:'Dolby Digital Plus'}[window.modeljs.sound.getDigitalAudioOut()]||'Unbekannt';}catch(e){}
      a=[{label:'Receiver',info:'Configured receiver'},{label:'ARC-Geraet am TV',info:arc},{label:'TV-Digitalausgang',info:fmt},{label:'Letzte Antwort',info:d.last?new Date(d.last).toLocaleTimeString():'Noch keine'}, {label:'Status aktualisieren',refresh:true}, {label:'Letzte Einzelaenderung zurueck',undo:true}];
    }
    for(var i=0;i<a.length;i++)if(a[i].key){
      var r=a[i];r.value=s[r.key];r.disabled=r.value===undefined;
      if(r.key==='PSBAS '||r.key==='PSTRE ')r.disabled=r.disabled||s['PSTONE CTRL ']!=='ON'||s['PSDYNEQ ']==='ON';
      if(r.key!=='ZM'&&r.key!=='Z2POWER'&&r.key!=='Z2SOURCE'&&s.ZM!=='ON')r.disabled=true;
      if(r.min!==undefined&&number(r.value)===null)r.disabled=true;
    }
    return a;
  }
  function value(r){
    if(r.profile)return 'OK: Profil bestaetigen';
    if(r.refresh)return 'OK';if(r.undo)return d.undo?'OK':'Noch keine';
    if(r.info!==undefined)return r.info;
    if(r.disabled)return 'Im aktuellen Zustand nicht verfuegbar';
    var v=d.edit&&d.side===1&&d.rows[d.row]&&d.rows[d.row].key===r.key?d.draft:r.value;
    if(r.min!==undefined){var n=number(v);return n===null?'Nicht gemeldet':(n-r.offset).toFixed(1)+' dB';}
    return {ON:'Ein',OFF:'Aus',TV:'TV Audio',GAME1:'PC (HDMI 4)',AUDYSSEY:'Reference','BYP.LR':'L/R Bypass',FLAT:'Flat',LIT:'Leicht',MED:'Mittel',HEV:'Stark'}[v]||v;
  }
  function render(){
    if(!d.opened)return;
    if(!d.el){d.el=document.createElement('div');d.el.id='flex-denon';document.body.appendChild(d.el);}
    d.rows=rows();d.row=Math.max(0,Math.min(d.row,d.rows.length-1));
    var html='<div class="dn-head"><div class="dn-brand">DENON</div><div class="dn-sub">AVC-X3800H &nbsp; / &nbsp; '+esc(d.data.SI||'Verbinden ...')+' &nbsp; / &nbsp; '+esc(d.data.MS||'')+'</div></div><div class="dn-nav">';
    for(var c=0;c<cats.length;c++)html+='<div class="dn-tab '+(c===d.cat?(d.side===0?'focus':'selected'):'')+'">'+esc(cats[c])+'</div>';
    html+='</div><div class="dn-content"><div class="dn-title">'+esc(cats[d.cat])+'</div>';
    var start=Math.max(0,d.row-5),end=Math.min(d.rows.length,start+7);
    for(var i=start;i<end;i++){var r=d.rows[i];html+='<div class="dn-row '+(d.side===1&&i===d.row?'focus ':'')+(r.disabled?'disabled':'')+'"><span>'+esc(r.label)+'</span><span class="dn-value">'+esc(value(r))+'</span></div>';}
    html+='</div><div class="dn-notice">'+esc(d.notice)+'</div><div class="dn-foot">'+(d.edit?'Links/Rechts: Wert waehlen &nbsp; OK: anwenden &nbsp; Zurueck: verwerfen':'Pfeile: navigieren &nbsp; OK: bearbeiten &nbsp; Zurueck: schliessen')+'</div>';
    d.el.innerHTML=html;
  }
  function close(){d.opened=false;d.edit=false;d.typing=false;if(!d.onSelected)d.sequence=null;if(d.el&&d.el.parentNode)d.el.parentNode.removeChild(d.el);d.el=null;}
  function open(){if(d.opened)return;d.opened=true;d.openedAt=Date.now();d.cat=0;d.row=0;d.side=0;d.edit=false;d.notice='';render();send('SOURCES');}
  function key(k){
    if(k===8||k===461||k===27){if(d.edit){d.edit=false;d.notice='Aenderung verworfen';render();}else close();return;}
    if(d.pending)return;
    if(d.edit){
      var r=d.rows[d.row];
      if(k===13){
        d.edit=false;
        if(r.profile){d.undo=null;d.sequence=r.profile.slice();send(d.sequence.shift());return;}
        if(d.draft===r.value){render();return;}
        var prefix=r.key==='Z2POWER'||r.key==='Z2SOURCE'?'Z2':r.key;
        d.undo=prefix+r.value;send(prefix+d.draft);return;
      }
      if(k===37||k===39){
        var delta=k===39?1:-1;
        if(r.options){var idx=r.options.indexOf(d.draft);d.draft=r.options[(idx+delta+r.options.length)%r.options.length];}
        else if(r.min!==undefined){var step=r.key==='PSBAS '||r.key==='PSTRE '?1:0.5;d.draft=encoded(Math.max(r.min,Math.min(r.max,number(d.draft)+delta*step)));}
      }
      render();return;
    }
    if(k===37){d.side=0;render();return;}
    if(k===39){d.side=1;render();return;}
    if(k===38||k===40){var dir=k===40?1:-1;if(d.side===0){d.cat=(d.cat+dir+cats.length)%cats.length;d.row=0;}else d.row=Math.max(0,Math.min(d.rows.length-1,d.row+dir));render();return;}
    if(k===13){
      if(d.side===0){d.side=1;render();return;}
      var a=d.rows[d.row];
      if(a.refresh){send('SOURCES');return;}
      if(a.rename){renameSource(a.rename);return;}
      if(a.undo&&d.undo){var u=d.undo;d.undo=null;send(u);return;}
      if(a.disabled){d.notice='Vom Receiver in diesem Zustand nicht verfuegbar';render();return;}
      if(a.key||a.profile){d.edit=true;d.draft=a.value;d.notice=a.profile?'OK schaltet Quellen und Zonen um. Zurueck bricht ab.':'Wert waehlen, dann mit OK anwenden.';render();}
    }
  }
  function tick(valid,sourceVisible){
    if(d.typing&&window.UI&&UI.isSoftKeyboardShown&&!UI.isSoftKeyboardShown()&&Date.now()-d.typingAt>1000){d.typing=false;render();}
    if(d.opened&&!valid&&!d.typing){close();return;}
    if(d.pending){
      var a=read();
      if(a&&a.id===d.pending.id){
        var command=d.pending.command;d.pending=null;
        if(a.raw){d.data=parse(a.raw);d.last=Date.now();}
        sourceMetadata(a,command);
        d.notice=a.ok?(command==='STATUS'||command==='SOURCES'?'Status aktuell':command.indexOf('LABEL')===0?'Anzeigename gespeichert':'Aenderung vom Receiver bestaetigt'):a.error;
        if(!a.ok){d.sequence=null;d.seqKind='';selectionFailed(d.notice);render();return;}
        if((d.opened||d.onSelected)&&d.sequence&&d.sequence.length){send(d.sequence.shift());return;}
        d.sequence=null;d.seqKind='';
        if(d.onSelected){var done=d.onSelected;d.onSelected=null;done();}
        render();
      }else if(Date.now()-d.pending.time>25000){d.pending=null;d.sequence=null;d.seqKind='';d.notice='Zeitlimit: Zustand unklar. Bitte Status aktualisieren.';selectionFailed(d.notice);render();}
    }else if(!d.sequence&&d.tvQueue.length){
      var q=d.tvQueue;d.tvQueue=[];
      runTv(q);
    }else if(d.opened&&!d.typing&&!d.edit&&Date.now()-d.last>10000)send('STATUS');
    else if(sourceVisible&&!d.opened&&!d.sequence&&Date.now()-d.pollAt>15000){d.pollAt=Date.now();send('SOURCES');}
  }
  function selectionFailed(message){if(d.onSelected){var done=d.onSelected;d.onSelected=null;done(message);}}
  window.__flexDenon={open:open,close:close,key:key,tick:tick,selectSource:selectSource,selectTv:selectTv,abortSequence:abortSequence,refresh:refresh,sourceStatus:sourceStatus,isTyping:function(){return d.typing;},isOpen:function(){return d.opened;},openedAt:function(){return d.openedAt;},state:function(){return {open:d.opened,pending:!!d.pending,data:d.data,notice:d.notice,sources:d.sources,sourceAt:d.sourceAt,busy:!!(d.pending||d.sequence||d.tvQueue.length)};}};
}());
