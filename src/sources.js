/* Included INSIDE flex.js closure. Native TV inputs retain their original handlers. */
  var denonInputRef = null, denonInputMethods = null, sourceOffset = 0, sourceLayout = '';
  function denonSources() {return window.__flexDenon ? window.__flexDenon.state().sources || [] : [];}
  // Ein Denon-Eingang erscheint, sobald der Denon dort ein Geraet kennt (Name per CEC bzw. HDMI-Kennung,
  // "Auto" in seiner Namensliste) oder der Besitzer ihm einen Namen gegeben hat. Das gilt auch im Ruhemodus
  // des Geraets und ohne IP-Abfrage (17.11.2026). Ob gerade ein Bild kommt, zeigt nur der Status.
  // Name "-" (hidden) blendet einen Eingang aus, auch wenn der Denon dort noch einen alten Geraetenamen kennt.
  function denonSourceListed(s){return !!(s&&!s.hidden&&(s.autoName||s.label));}
  // ---- Kachel "Konsolen" (Wunsch des Besitzers 17.11.2026) ----
  // Statt je einer Kachel pro Denon-Geraet eine Kachel "Konsolen"; OK oeffnet darueber eine Reihe mit den Geraeten.
  // Gebaut wie das Kachel-Menue (openTileMenu): eigenes DOM ueber der Startseite, Tasten ueber handleTileKey, gilt nur,
  // solange die Startseite vorne und frei ist und die Kachel den Fokus hat (Schutzregeln 5/6). Es verbraucht nur die
  // eigenen Tasten (Pfeile, OK, Zurueck); jede andere Taste schliesst und geht unveraendert weiter. In "Quellen"
  // stehen die Geraete weiter einzeln.
  var DENON_GROUP_TILE={appName:'Konsolen',appId:'flex-denon-group',uid:'flex-denon-group',cmd:6,url:'',img:'static/flex/tile-denon-source.png',appReList:[],visibility:'',denonGroup:true};
  var DG_STEP=260,dg={open:false,el:null,items:[],idx:0,focus:'',hard:0};
  function denonListedSources(){var out=[],src=denonSources();for(var i=0;i<src.length;i++)if(denonSourceListed(src[i]))out.push(src[i]);return out;}
  function denonHomeTiles(){return denonListedSources().length?[DENON_GROUP_TILE]:[];}
  function denonGroupState(s){
    var st='';try{st=window.__flexDenon.sourceStatus(s);}catch(e){st='';}
    return st.indexOf('Signal ')===0?'Bild '+st.substr(7):st==='Ausgewaehlt'?'am Denon gewählt':'';
  }
  function renderDenonGroup(){
    for(var i=0;i<dg.items.length;i++){var c='dg-tile'+(i===dg.idx?' focus':'');if(dg.items[i].el.className!==c)dg.items[i].el.className=c;}
  }
  function openDenonGroup(idx,focus){
    if(dg.open||tm.open)return false;
    if(!homeIdle()||!uiReadyNow()||dialogUp()||ss.state!=='off'||gal.open)return false;
    var list=denonListedSources();if(!list.length)return false;
    var el=document.createElement('div');el.id='flex-denon-group';
    // ueber der Kachel: sichtbare Kachel n hat ihre Mitte bei 160 + 200 * n px (wie das Kachel-Menue), sourceOffset
    // ist die Verschiebung des Karussells
    var w=40+list.length*DG_STEP,center=160+200*(idx-sourceOffset);
    el.style.width=w+'px';el.style.left=Math.max(40,Math.min(1920-40-w,center-w/2))+'px';
    var t=document.createElement('div');t.className='dg-title';t.textContent='Konsolen';el.appendChild(t);
    dg.items=[];
    for(var i=0;i<list.length;i++){
      var it=document.createElement('div');it.className='dg-tile';it.style.left=(20+i*DG_STEP)+'px';
      var n=document.createElement('div');n.className='dg-name';n.textContent=list[i].name;it.appendChild(n);
      var st=document.createElement('div');st.className='dg-state';st.textContent=denonGroupState(list[i]);it.appendChild(st);
      el.appendChild(it);dg.items.push({el:it,state:st,port:list[i].port,name:list[i].name});
    }
    var h=document.createElement('div');h.className='dg-hint';h.textContent='OK: einschalten · Zurück: schließen';el.appendChild(h);
    (document.body||document.documentElement).appendChild(el);
    dg.el=el;dg.open=true;dg.idx=0;dg.focus=String(focus||'');dg.hard=fx.hard;renderDenonGroup();
    log('Konsolen-Reihe offen ('+list.length+' Geraete)');
    return true;
  }
  function closeDenonGroup(why){
    if(!dg.open)return;
    dg.open=false;if(dg.el&&dg.el.parentNode)dg.el.parentNode.removeChild(dg.el);
    dg.el=null;dg.items=[];log('Konsolen-Reihe geschlossen ('+why+')');
  }
  function denonGroupValid(vm){
    return dg.hard===fx.hard&&homeIdle()&&uiReadyNow()&&!dialogUp()&&ss.state==='off'&&!gal.open&&!!vm&&String(vm.componentFocus||'')===dg.focus;
  }
  function checkDenonGroup(){   // 1-s-Takt: gueltig halten und den Status der Geraete nachfuehren
    if(!dg.open)return;
    if(!denonGroupValid(mainTilesVm())){closeDenonGroup('Startseite nicht mehr frei');return;}
    var src=denonSources();
    for(var i=0;i<dg.items.length;i++)for(var j=0;j<src.length;j++)if(src[j].port===dg.items[i].port){var t=denonGroupState(src[j]);if(dg.items[i].state.textContent!==t)dg.items[i].state.textContent=t;}
  }
  // Taste bei offener Reihe (aus handleTileKey): true = verbraucht, undefined = Original (Reihe ist dann zu)
  function denonGroupKey(vm,e){
    var k=e.keyCode;
    if(!denonGroupValid(vm)){closeDenonGroup('Startseite nicht mehr frei');return undefined;}
    if(isTileMenuKey(k)){if(e.repeat)return true;closeDenonGroup('Einstellungstaste');return undefined;}
    if(SS_PASS_KEYS[k]===1)return undefined;            // Power, Lautstaerke, Stumm wie immer, Reihe bleibt
    if(TM_BACK[k]===1||k===40){if(!e.repeat)closeDenonGroup('Taste '+k);return true;}
    if(k===37||k===39){var n=dg.idx+(k===39?1:-1);if(n>=0&&n<dg.items.length){dg.idx=n;renderDenonGroup();}return true;}
    if(k===38)return true;
    if(k===13){
      if(!e.repeat){var it=dg.items[dg.idx];closeDenonGroup('Auswahl '+(it?it.name:''));if(it)chooseDenonSource(it.port);}
      return true;
    }
    closeDenonGroup('Taste '+k);return undefined;
  }
  function inputVm() {
    // Vue keep-alive can own the root DOM node; the rendered component is in _vnode.
    function rendered(v){for(var depth=0;v&&depth<6;depth++){
      if(v.$options&&v.$options.name==='AllInputs'&&!v._isDestroyed&&!v._inactive)return v;
      v=v._vnode&&v._vnode.componentInstance;
    }return null;}
    var root=document.getElementById('AllInputs'),current=root&&rendered(root.__vue__);if(current)return current;
    var all=document.querySelectorAll('div');
    for(var i=0;i<all.length;i++){var v=rendered(all[i].__vue__);if(v)return v;}
    return null;
  }
  function focusedDenonInput(vm){
    if(!vm||vm.showMenu)return null;
    var n=parseInt(String(vm.currentFocus).split('-')[1],10),it=vm.allInputsData&&vm.allInputsData[n];
    return it&&it.denonPort?it:null;
  }
  // Weckt das Geraet am Denon-Eingang mit dem TV-eigenen CEC-Befehl "Start" (Einstellungen > System > HDMI & CEC >
  // CEC-Geraeteliste > Geraet > Start ruft HdmiDevicesOperate([0, Typ]), 309.js Cec2Enter). Am TV geprueft 17.11.2026:
  // weckt die PS5 aus dem Ruhemodus, eine laufende PS5 bleibt an. Der Befehl adressiert nach Geraetetyp, darum nur,
  // wenn der Denon dort einen Geraetenamen kennt, der TV genau dieses Geraet per CEC kennt und kein zweites Geraet
  // desselben Typs; nie an TV (0) oder Audiosystem (5). Im Zweifel nichts senden.
  // Typ des Geraets an diesem Denon-Eingang, wenn der TV genau dieses Geraet per CEC kennt und kein zweites Geraet
  // desselben Typs (HdmiDevicesOperate adressiert nach Typ); sonst der Grund als Text. Nie TV (0) oder Audiosystem (5).
  function cecDeviceType(s){
    if(!s||!s.autoName)return 'kein Geraetename';
    var cec=window.modeljs&&window.modeljs.cec;if(!cec||typeof cec.HdmiDevicesOperate!=='function')return 'kein CEC';
    var names=cec.getHdmiDevicesName()||[],types=cec.getHdmiDevicesType()||[],hit=-1,i;
    for(i=0;i<names.length;i++)if(String(names[i]).replace(/^HDMI[0-9]+-/,'')===s.autoName)hit=i;
    if(hit<0)return 'nicht in der CEC-Liste';
    var t=types[hit],same=0;for(i=0;i<types.length;i++)if(types[i]===t)same++;
    if(typeof t!=='number'||t===0||t===5||same!==1)return 'Typ '+t+' nicht eindeutig';
    return t;
  }
  function cecStartDevice(port){
    try{
      var src=denonSources(),s=null,i;for(i=0;i<src.length;i++)if(src[i].port===port)s=src[i];
      var t=cecDeviceType(s);if(typeof t!=='number')return t;
      window.modeljs.cec.HdmiDevicesOperate([0,t]);log('Denon: CEC-Start an '+s.autoName+' (Typ '+t+')');return 'gesendet';
    }catch(e){return 'Fehler: '+e;}
  }
  // Nach dem bestaetigten Denon-Wechsel den CEC-Start noch einmal senden (am TV geprueft: eine laufende PS5 bleibt an),
  // falls der erste beim OK nicht ankam. Eine Startanzeige gibt es bewusst nicht: die PS5 ist meist schneller in der
  // Benutzerauswahl, als der Denon ihr Bild meldet (Besitzer 17.11.2026, Anzeige wieder entfernt).
  function afterDenonSwitch(port){inst.sourceSwitch.cec=cecStartDevice(port);}
  // ---- Kein Bild am gewaehlten Eingang (18.11.2026: Xbox gewaehlt, die nicht angeschlossen ist -> kein Bild, kein Ton) ----
  // Nach jedem bestaetigten Wechsel des Denon auf ein Geraet: kommt innerhalb von SIG_WAIT_* kein Bild (der Denon meldet
  // "Signal ..."), zurueck auf TV-Ton mit kleinem Hinweis. Der TV bleibt, wo er ist (Schutzregel 4: keine Modulwechsel
  // per Zeitgeber); HOME fuehrt zur Startseite. Aus, sobald ein Bild kommt, der Denon einen anderen Eingang hat oder eine
  // neue Wahl kommt. Geweckte Konsolen (CEC-Start, PS5 braucht bis ~20 s) bekommen laenger.
  // Review 18.11.2026: entschieden wird erst auf einer Statusabfrage nach Fristende (sonst auf einem bis zu 5 s alten
  // Stand); Standby/Neustart dazwischen (fx.hard) beendet die Pruefung; die TV-Anfrage prueft bei der Ausfuehrung noch
  // einmal, ob der Denon weiter auf diesem Geraet steht (ein inzwischen gewaehltes Profil bleibt).
  var SIG_WAIT_CEC_MS=40000,SIG_WAIT_MS=20000,SIG_POLL_MS=5000,SIG_LAST_MS=12000,sigWatch=null;
  function hint(text,ms){try{kodiToast(text,ms);}catch(e){}}
  function stopSignalWatch(){sigWatch=null;}
  function startSignalWatch(port,woken){
    var src=denonSources(),s=null,i;for(i=0;i<src.length;i++)if(src[i].port===port)s=src[i];
    if(!s)return;
    var w={port:port,cmd:s.command,name:s.name,at:Date.now(),until:Date.now()+(woken?SIG_WAIT_CEC_MS:SIG_WAIT_MS),polled:0,hard:fx.hard};sigWatch=w;
    (function step(){
      if(sigWatch!==w||inst.stopped)return;
      if(fx.hard!==w.hard){sigWatch=null;return;}
      var cur=null,all=denonSources(),st=window.__flexDenon.state()||{},data=st.data||{};
      for(var j=0;j<all.length;j++)if(all[j].port===port)cur=all[j];
      if(data.SI&&data.SI!==w.cmd){sigWatch=null;log('Denon: Bildpruefung '+w.name+' beendet (Eingang '+data.SI+')');return;}
      if(cur&&window.__flexDenon.sourceStatus(cur).indexOf('Signal ')===0){sigWatch=null;log('Denon: Bild von '+w.name+' nach '+Math.round((Date.now()-w.at)/1000)+' s');return;}
      if(Date.now()>=w.until){
        if(!(st.sourceAt>=w.until)&&Date.now()<w.until+SIG_LAST_MS){
          if(w.polled<w.until){try{if(window.__flexDenon.refresh())w.polled=Date.now();}catch(e){}}
          later(step,1000);return;
        }
        sigWatch=null;
        if(!(st.sourceAt>=w.until)){
          log('Denon: Bildstatus nach Zeitlimit nicht verfuegbar');
          return;
        }
        if(data.ZM==='ON'&&data.SI===w.cmd){
          log('Denon: kein Bild von '+w.name+', zurueck auf TV-Ton');
          denonToTv(null,function(x){return x.ZM==='ON'&&x.SI===w.cmd;});
          hint(w.name+': kein Bild – Denon zurück auf TV-Ton',6000);
        }
        return;
      }
      if(Date.now()-w.polled>=SIG_POLL_MS){try{if(window.__flexDenon.refresh())w.polled=Date.now();}catch(e){}}
      later(step,1000);
    })();
  }
  // ---- Kodi oder App von der Startseite, waehrend der Denon auf einem Geraet steht (Besitzer 17.11.2026) ----
  // Der Denon folgt dem TV nicht von selbst auf TV-Ton. Beim OK auf der Kodi- oder einer App-Kachel stellt flex.js ihn
  // darum auf TV, ohne Frage und ohne ZONE2 anzufassen; die App startet unveraendert sofort. Eine Konsole laeuft dabei
  // weiter: in den Ruhemodus laesst sich die PS5 vom TV aus nicht schicken (am TV gemessen: der "Standby" des TV-Menues,
  // HdmiDevicesOperate([1, Typ]), ist nur ein Tastendruck <User Control Pressed>, den sie ignoriert; den echten
  // <Standby> an ein Geraet bietet der Launcher nicht an). Sie geht mit dem TV in den Ruhemodus (Ausschaltverbindung
  // der PS5). Damit sie Kodi nicht per CEC verdraengt, ist an der PS5 die One-Touch-Wiedergabe aus. Eine fruehere
  // Fassung fragte vor dem Start ("In Ruhemodus versetzen") und wurde deshalb wieder entfernt.
  function denonAutoTv(app){
    try{
      var st=window.__flexDenon&&window.__flexDenon.state();
      if(!st||!st.data||st.data.ZM!=='ON')return false;
      var src=denonSources(),s=null;
      for(var i=0;i<src.length;i++)if(src[i].command===st.data.SI&&denonSourceListed(src[i]))s=src[i];
      if(!s)return false;
      var running=window.__flexDenon.sourceStatus(s).indexOf('Signal ')===0;
      stopSignalWatch();
      denonToTv();
      log('Denon: '+app+' gestartet, Denon von '+s.name+' auf TV-Ton');
      hint(running?s.name+' läuft im Hintergrund weiter · Denon auf TV-Ton':'Denon auf TV-Ton',4000);
      return true;
    }catch(e){log('Denon-TV-Fehler: '+e);return false;}
  }
  // Denon auf TV-Ton. Ist der Dienst belegt, reiht ui.js die Anfrage ein und holt sie nach (selectTv). want: siehe selectTv.
  function denonToTv(cb,want){
    var ok=false;
    try{ok=window.__flexDenon.selectTv(function(err){log(err?'Denon: TV-Ton nicht bestaetigt: '+err:'Denon: auf TV-Ton');if(cb)cb(err);},want);}catch(e){ok=false;}
    if(!ok){log('Denon: TV-Ton nicht moeglich');if(cb)cb('nicht moeglich');}
  }
  // ---- Neue Wahl des Nutzers bricht eine laufende Konsolenwahl ab (18.11.2026) ----
  // Am TV: Xbox gewaehlt, sofort danach Kodi gestartet; die Xbox-Wahl lief weiter, der Denon wechselte den Eingang,
  // meldete sich per CEC als aktive Quelle, der Launcher sprang auf HDMI1 und flex.js beendete Kodi. Jetzt: Kodi, eine App
  // (Kachel oder App-Taste), eine andere Konsole oder Zurueck verwerfen die laufende Wahl; ihre restlichen Denon-Schritte
  // entfallen, der gerade laufende endet noch.
  // Review 18.11.2026: Hatte die verworfene Wahl schon einen Schritt gesendet (auch Z2OFF/ZMON: ein eingeschaltetes MAIN
  // steht sonst auf seinem alten Geraete-Eingang) oder selbst eine solche Wahl abgeloest (prevDirty), bringt settleToTv den
  // Denon danach zurueck auf TV-Ton, entschieden auf dem Stand nach dem letzten Schritt (nur wenn MAIN an und nicht auf TV).
  // Folgt eine neue Konsole, erbt sie diese Pflicht und erfuellt sie, falls sie selbst nicht gesendet wird. Bis der Denon
  // bestaetigt zurueck ist (+2,5 s), warten Starts von Kodi und Apps (unsettled, hoechstens 45 s, Standby beendet es).
  var DEFER_SETTLE_MS=2500,DEFER_MAX_MS=25000,UNSETTLED_MAX_MS=45000,unsettled=null,pendingStart=null;
  function unsettledActive(){if(unsettled&&(unsettled.hard!==fx.hard||Date.now()>=unsettled.until))unsettled=null;return !!unsettled;}
  function settleToTv(why){
    var m={hard:fx.hard,until:Date.now()+UNSETTLED_MAX_MS};unsettled=m;
    log('Denon: zurueck auf TV-Ton nach verworfener Wahl ('+why+')');
    denonToTv(function(){later(function(){if(unsettled===m)unsettled=null;},DEFER_SETTLE_MS);},function(x){return x.ZM==='ON'&&x.SI!=='TV';});
  }
  function denonChoiceActive(){return !!sourceChoice;}
  function denonSupersede(why,noTv){
    var c=sourceChoice;if(!c)return {active:false,dirty:false};
    sourceChoice=null;c.superseded=true;
    var input=false;if(c.sent){try{input=!!window.__flexDenon.abortSequence();}catch(e){input=false;}}
    var dirty=!!(c.sent||c.prevDirty);
    if(inst.sourceSwitch&&inst.sourceSwitch.port===c.port)inst.sourceSwitch.phase='superseded';
    denonBusy('');stopSignalWatch();
    log('Denon: Wahl von HDMI '+c.port+' verworfen ('+why+')'+(input?', Eingangswechsel war schon unterwegs':dirty?', Denon-Schritte waren schon unterwegs':''));
    if(dirty&&!noTv)settleToTv('HDMI '+c.port);
    return {active:true,dirty:dirty};
  }
  // Tasten aus flex.js onKey (keydown; die Taste geht unveraendert weiter). Zurueck/Menue verwirft eine laufende Wahl nur,
  // solange sie dort wartet, wo sie gewaehlt wurde (Startseite, Quellen-Liste). Ist der TV schon auf HDMI1 gesprungen
  // (CEC des Denon), gehoert Zurueck dem Launcher und die Wahl laeuft zu Ende (Review 18.11.2026: vorher schickte Zurueck
  // zum Schliessen der Infoleiste den Denon von der eben gewaehlten PS5 zurueck auf TV). App-Tasten (Netflix 616,
  // Amazon 617, YouTube 619) starten eine App wie OK auf einer App-Kachel. Lautstaerke und Stumm aendern an einem
  // wartenden Start nichts (wie bei der Wahl selbst).
  var DENON_APP_KEYS={616:1,617:1,619:1};
  function denonKeyDown(k){
    if(pendingStart&&(k===411||k===412||k===413))pendingStart.keys=fx.keys;
    if(!sourceChoice)return;
    if(DENON_APP_KEYS[k]===1){denonSupersede('Taste '+k);return;}
    if(TM_BACK[k]!==1)return;
    var front=false;try{front=homeIdle()||UI.getCurrentSubModuleId()==='AllInputs';}catch(e){front=false;}
    if(front)denonSupersede('Taste '+k);
  }
  // Vor dem Start von Kodi oder einer App von der Startseite (flex.js handleTileKey). false = der Aufrufer startet sofort
  // wie bisher (der Denon geht parallel auf TV-Ton). true = Taste verbraucht: der Denon ist nach einer verworfenen Wahl
  // noch nicht zurueck auf TV-Ton. Dann wartet der Start darauf und laeuft danach nach erneuter Pruefung (Schutzregel 3:
  // keine Taste dazwischen, gleicher Launcher-Zustand launcherSig, Startseite frei, gleiche Kachel), sonst ein Hinweis.
  // Ein weiteres OK auf dieselbe Kachel waehrend des Wartens wird verbraucht und haelt den Start (Review 18.11.2026: vorher
  // startete das zweite OK sofort, und der CEC-Sprung beendete Kodi wieder); OK auf eine andere Kachel ersetzt ihn.
  function denonBeforeStart(app,start){
    var sup=denonSupersede('Start von '+app);
    if(pendingStart){
      var f='';try{f=String(mainTilesVm().componentFocus||'');}catch(e){f='';}
      if(f===pendingStart.focus&&fx.hard===pendingStart.hard){pendingStart.keys=fx.keys;log('Denon: '+app+' wartet schon auf TV-Ton');return true;}
      pendingStart.done=true;pendingStart=null;
    }
    if(sup.dirty||unsettledActive()){deferStart(app,start);return true;}
    denonAutoTv(app);
    return false;
  }
  function deferStart(app,start){
    var p={app:app,keys:fx.keys,hard:fx.hard,focus:'',sig:'',at:Date.now(),done:false};pendingStart=p;
    try{p.focus=String(mainTilesVm().componentFocus||'');}catch(e){p.focus='';}
    try{p.sig=launcherSig();}catch(e){p.sig='';}
    denonBusy(app+' startet gleich …');
    log('Denon: Start von '+app+' wartet auf TV-Ton');
    function go(why){
      p.done=true;if(pendingStart===p)pendingStart=null;denonBusy('');
      var v=null,home=false,ok=false;
      try{
        home=homeIdle();v=mainTilesVm();
        ok=why==='Denon auf TV'&&!inst.stopped&&fx.keys===p.keys&&fx.hard===p.hard&&home&&uiReadyNow()&&!dialogUp()&&
          !!p.sig&&launcherSig()===p.sig&&!!v&&String(v.componentFocus||'')===p.focus;
      }catch(e){ok=false;}
      if(!ok){
        log('Denon: Start von '+app+' verworfen ('+why+')');
        if(!inst.stopped)hint(home?app+': Start abgebrochen – bitte noch einmal wählen':app+' nicht gestartet – über HOME neu wählen',4000);
        return;
      }
      log('Denon: Start von '+app+' (Denon auf TV)');start();
    }
    (function wait(){
      if(p.done)return;
      if(inst.stopped||fx.hard!==p.hard){p.done=true;if(pendingStart===p)pendingStart=null;return;}
      if(!unsettledActive()){go('Denon auf TV');return;}
      if(Date.now()-p.at>=DEFER_MAX_MS){go('Zeitlimit, Denon nicht zurueck');return;}
      later(wait,250);
    })();
  }
  // Kleine Anzeige beim Wechsel auf ein Denon-Geraet (Besitzer 17.11.2026: kleines Popup, kein Vollbild): ab dem OK bis
  // der TV umgeschaltet hat oder die Wahl endet. Nutzt den Hinweis von flex.js (kodiToast); ohne ihn (Tests) nichts.
  function denonBusy(text){try{kodiToast(text||'',text?20000:0);}catch(e){}}
  // TV auf HDMI1 wie die Quellen-Liste des Launchers (AllInputs.vue keydown, OK auf einem Eingang, 126.js):
  // SourceSwitchByUser(a, 17) ist UI.store.commit('Source/setCurrentSource', [a, 17]) (app.js PubFunc tt), dann
  // popAllModule() und openLiveTVModule(): warten, bis die Quelle steht (dort hoechstens ~1 s), dann
  // LiveTV/setShowFlgArr ['showPassword', true, 'showInfobar', true] und pushModule('LiveTV'). Gleiche Aufrufe und Werte,
  // nur ohne den sichtbaren Quellen-Bildschirm (Besitzer 17.11.2026: kein Springen in die Quellen, kein Flackern).
  // Steht der Store schon auf HDMI1, entfaellt der Quellenbefehl wie in der Liste (a === getCurrentSource()).
  function tvToHdmi1(){
    var cur='';try{cur=UI.store.state.Source.currSourceId;}catch(e){cur='';}
    if(cur!=='HDMI1')UI.store.commit('Source/setCurrentSource',['HDMI1',17]);
    UI.popAllModule();
    var n=0;
    (function wait(){
      var now='';try{now=UI.store.state.Source.currSourceId;}catch(e){now='';}
      if(now!=='HDMI1'&&++n<20){later(wait,50);return;}
      try{UI.store.commit('LiveTV/setShowFlgArr',['showPassword',true,'showInfobar',true]);}catch(e){}
      UI.pushModule('LiveTV');
      log('Denon: TV auf HDMI1 (wie die Quellen-Liste'+(cur==='HDMI1'?', Quelle stand schon':'')+(now!=='HDMI1'?', Quelle nach 1 s noch nicht bestaetigt':'')+')');
    })();
  }
  var sourceChoice = null;
  window.__flex.denonSwitchState=function(){return inst.sourceSwitch||null;};
  // Wahl eines Denon-Geraets. Von der Startseite bzw. der Konsolen-Reihe: direkt (Denon umschalten, dann tvToHdmi1), ohne
  // Quellen-Bildschirm. Aus der Quellen-Liste selbst (Eintrag dort gewaehlt) oder wenn eine App im Modul-Stapel liegt
  // (Schutzregel 2: dann entscheidet der Launcher ueber seine Liste): wie bisher ueber die Liste und ihren eigenen OK-Pfad.
  function chooseDenonSource(port){
    if(!window.__flexDenon)return;
    // Dieselbe Konsole noch einmal (z. B. ueber die Konsolen-Reihe, waehrend der Dienst noch belegt ist): bestaetigt die
    // laufende Wahl, die Tasten dazwischen brechen sie nicht ab (Review 18.11.2026). Eine andere Konsole loest sie ab und
    // erbt deren unterwegs befindliche Denon-Schritte (prevDirty, siehe denonSupersede).
    var prevDirty=false;
    if(sourceChoice){
      if(sourceChoice.port===port){sourceChoice.keys=fx.keys;log('Denon: HDMI '+port+' ist schon gewaehlt');return;}
      prevDirty=denonSupersede('neue Wahl: HDMI '+port,true).dirty;
    }
    if(pendingStart){pendingStart.done=true;pendingStart=null;}   // ein wartender Kodi-/App-Start ist damit hinfaellig
    stopSignalWatch();
    var inList=UI.getCurrentSubModuleId()==='AllInputs',direct=false;
    try{direct=!inList&&noAppInStack();}catch(e){direct=false;}
    var choice={port:port,keys:0,until:Date.now()+90000,opening:!inList,routeUntil:Date.now()+5000,prevDirty:prevDirty};sourceChoice=choice;
    inst.sourceSwitch={port:port,phase:'waiting',direct:direct};
    // CEC-Start sofort auf die Taste, parallel zum Denon-Wechsel (die Konsole braucht die Zeit zum Hochfahren)
    inst.sourceSwitch.cecEarly=cecStartDevice(port);
    var busyName='';try{var bs=denonSources();for(var bi=0;bi<bs.length;bi++)if(bs[bi].port===port)busyName=bs[bi].name;}catch(e){busyName='';}
    denonBusy(inst.sourceSwitch.cecEarly==='gesendet'?busyName+' wird gestartet …':'Umschalten auf '+(busyName||'HDMI '+port)+' …');
    if(!inList&&!direct)openSources();
    // Wahl endet, ohne selbst gesendet zu haben: erbt sie Schritte einer verworfenen Wahl, Denon zurueck auf TV-Ton
    function drop(phase){
      if(sourceChoice===choice)sourceChoice=null;
      if(phase)inst.sourceSwitch.phase=phase;
      choice.sent=false;denonBusy('');
      if(choice.prevDirty)settleToTv('HDMI '+port+' nicht gesendet');
    }
    function onHdmi1(){try{return UI.getCurrentSubModuleId()==='LiveTV'&&UI.store.state.Source.currSourceId==='HDMI1';}catch(e){return false;}}
    function timeout(){later(function(){if(sourceChoice===choice&&!choice.superseded){sourceChoice=null;inst.sourceSwitch.phase='timeout-or-error';denonBusy('');UI.showToast(window.__flexDenon.state().notice);}},80000);}
    function receiverDone(error){
      sourceChoice=null;denonBusy('');
      if(error){inst.sourceSwitch.phase='failed';inst.sourceSwitch.error=error;log('Denon: Quellenwechsel fehlgeschlagen: '+error);UI.showToast(error);if(choice.prevDirty)settleToTv('HDMI '+port+' fehlgeschlagen');return false;}
      inst.sourceSwitch.phase='receiver-confirmed';
      startSignalWatch(port,inst.sourceSwitch.cecEarly==='gesendet');
      if(onHdmi1()){
        inst.sourceSwitch.phase='complete-hdmi1-already-active';log('Denon: bestaetigt, TV bereits auf HDMI1');
        if(!inst.stopped&&fx.keys===choice.keys&&!dialogUp())afterDenonSwitch(port);
        return false;
      }
      return true;
    }
    function attemptDirect(){
      if(sourceChoice!==choice||inst.stopped)return;
      if(Date.now()>choice.until||fx.keys!==choice.keys||dialogUp()){drop('cancelled-before-send');return;}
      var bs0=window.__flexDenon.state();if(bs0.pending||bs0.busy){later(attemptDirect,400);return;}
      inst.sourceSwitch.phase='receiver';
      choice.sent=true;
      if(!window.__flexDenon.selectSource(port,function(error){
        if(choice.superseded)return;
        if(!receiverDone(error))return;
        var free=false;try{free=homeIdle()&&uiReadyNow()&&noAppInStack();}catch(e){free=false;}
        if(inst.stopped||fx.keys!==choice.keys||dialogUp()||!free){inst.sourceSwitch.phase='cancelled-after-receiver';log('Denon: HDMI-Wechsel abgebrochen nach Navigation/Dialog');return;}
        inst.sourceSwitch.phase='tv-hdmi1';log('Denon: bestaetigt, HDMI1 direkt');tvToHdmi1();afterDenonSwitch(port);
      })){drop('');return;}
      timeout();
    }
    function attempt(){
      if(sourceChoice!==choice||inst.stopped)return;
      if(Date.now()>choice.until||fx.keys!==choice.keys||dialogUp()){drop('cancelled-before-send');return;}
      if(UI.getCurrentSubModuleId()!=='AllInputs'){
        if(choice.opening&&Date.now()<choice.routeUntil){later(attempt,100);return;}
        // CEC-Sprung der abgeloesten Wahl (der Denon wechselte noch auf deren Eingang): der TV steht schon auf HDMI1, also
        // ohne Liste weiter wie die direkte Wahl; deren Rueckruf endet mit 'complete-hdmi1-already-active'
        if(choice.prevDirty&&onHdmi1()){choice.opening=false;log('Denon: Liste durch CEC-Sprung geschlossen, HDMI '+port+' direkt');attemptDirect();return;}
        drop('cancelled-route');return;
      }
      choice.opening=false;
      var v=inputVm();
      var bs1=window.__flexDenon.state();if(!v||bs1.pending||bs1.busy){later(attempt,400);return;}
      patchDenonInputs();var original=v.__flexSourcesOrig;if(typeof original!=='function'){drop('');return;}
      inst.sourceSwitch.phase='receiver';
      choice.sent=true;
      if(!window.__flexDenon.selectSource(port,function(error){
        if(choice.superseded)return;
        if(!receiverDone(error))return;
        if(inst.stopped||fx.keys!==choice.keys||UI.getCurrentSubModuleId()!=='AllInputs'||dialogUp()||v._isDestroyed){inst.sourceSwitch.phase='cancelled-after-receiver';log('Denon: HDMI-Wechsel abgebrochen nach Navigation/Dialog');return;}
        for(var i=0;i<v.allInputsData.length;i++)if(v.allInputsData[i].sourceId==='HDMI1'){
          inst.sourceSwitch.phase='tv-hdmi1';v.currentFocus='AllInputsGridViewItem-'+i;original.call(v,{keyCode:13,repeat:false});log('Denon: bestaetigt, nativer HDMI1-Wechsel angefordert');afterDenonSwitch(port);return;
        }
      })){drop('');return;}
      timeout();
    }
    later(function(){choice.keys=fx.keys;(direct?attemptDirect:attempt)();},0);
  }
  function denonInputKey(vm,orig,args){
    var e=args[0],it=focusedDenonInput(vm);
    if(it&&e&&(e.keyCode===13||e.keyCode===77||e.keyCode===567||e.keyCode===(window.CONST&&CONST.KEY.VK_MENU))){
      if(!inst.stopped&&e.keyCode===13&&!e.repeat)chooseDenonSource(it.denonPort);
      else if(!inst.stopped&&e.keyCode!==13)UI.showToast('Namen unter Alle Apps > Denon > Quellennamen aendern');
      return true;
    }
    return orig.apply(vm,args);
  }
  function patchDenonInputs(){
    if(UI.getCurrentSubModuleId()!=='AllInputs')return;
    var v=inputVm();if(!v)return;
    if(v.$el&&v.$el.children&&v.$el.children[0])v.$el.children[0].id='flex-input-cover';
    var methods=v.constructor&&v.constructor.options&&v.constructor.options.methods;
    if(methods&&methods.keydown&&methods.keydown.__flexSourcesOwner!==inst){
      var original=methods.keydown;while(original.__flexSourcesOrig)original=original.__flexSourcesOrig;
      var wrapped=function(){return denonInputKey(this,original,arguments);};
      wrapped.__flexSources=true;wrapped.__flexSourcesOwner=inst;wrapped.__flexSourcesOrig=original;methods.keydown=wrapped;denonInputMethods=methods;
    }
    if(v.__flexSourcesOwner!==inst){var ownOriginal=methods&&methods.keydown?methods.keydown:v.keydown;while(ownOriginal.__flexSourcesOrig)ownOriginal=ownOriginal.__flexSourcesOrig;v.__flexSourcesOrig=ownOriginal;v.__flexSourcesOwner=inst;v.keydown=function(){return denonInputKey(v,ownOriginal,arguments);};}
    denonInputRef=v;
    var data=v.allInputsData,base=null,src=denonSources();
    if(!data||!src.length)return;
    var focusedIndex=parseInt(String(v.currentFocus).split('-')[1],10),focusedId=data[focusedIndex]&&data[focusedIndex].sourceId,changed=false;
    for(var di=data.length-1;di>=0;di--)if(data[di].denonPort){
      var keep=sourceChoice&&sourceChoice.port===data[di].denonPort;
      for(var si=0;si<src.length;si++)if(src[si].port===data[di].denonPort&&denonSourceListed(src[si]))keep=true;
      if(!keep){data.splice(di,1);changed=true;}
    }
    for(var i=0;i<data.length;i++)if(data[i].sourceId==='HDMI1')base=data[i];
    if(!base)return;
    for(i=0;i<src.length;i++){
      var s=src[i],id='flex-denon-source-'+s.port,found=null;
      if(!denonSourceListed(s)&&!(sourceChoice&&sourceChoice.port===s.port))continue;
      for(var j=0;j<data.length;j++)if(data[j].sourceId===id)found=data[j];
      var state=window.__flexDenon.sourceStatus(s),title=s.name;
      if(!found){found=JSON.parse(JSON.stringify(base));found.sourceId=id;found.denonPort=s.port;found.icon='static/flex/tile-denon.png';found.Locked=false;found.locked=false;found.name=title;found.rename=title;found.deviceName=state;found.hasSignal=false;found.linked=false;data.push(found);}
      found.name=found.rename=title;found.deviceName='';
      found.hasSignal=state.indexOf('Signal ')===0;
      found.linked=window.__flexDenon.state().data.SI===s.command&&window.__flexDenon.state().data.ZM==='ON';
    }
    if(changed&&!v.showMenu){var next=Math.max(0,Math.min(focusedIndex,data.length-1));for(i=0;i<data.length;i++)if(data[i].sourceId===focusedId)next=i;v.currentFocus='AllInputsGridViewItem-'+next;}
  }
  function sourceCarousel(){
    var v=mainTilesVm(),st=window.UI&&launcherState(UI.store);if(!v||!st)return;
    var n=parseInt(String(v.componentFocus).split('-')[1],10);
    if(isNaN(n))n=st.mainTileListIndex||0;
    if(n<sourceOffset)sourceOffset=n;
    if(n>sourceOffset+8)sourceOffset=n-8;
    sourceOffset=Math.max(0,Math.min(sourceOffset,Math.max(0,st.mainTileData.length-9)));
    var key=st.mainTileData.length+':'+sourceOffset;
    if(key!==sourceLayout){
      sourceLayout=key;var css='';
      for(var i=0;i<st.mainTileData.length;i++)css+='#LauncherMainTile-'+i+'{left:'+(2.4+(i-sourceOffset)*6.667)+'rem !important;top:1.43rem !important;visibility:'+(i>=sourceOffset&&i<sourceOffset+9?'visible':'hidden')+' !important;transition:left 0.25s ease !important;}';
      var old=document.getElementById('flex-source-slide');if(old)old.parentNode.removeChild(old);
      var style=document.createElement('style');style.id='flex-source-slide';style.textContent=css;document.head.appendChild(style);
    }
    for(var k=0;k<st.mainTileData.length;k++){
      var tile=st.mainTileData[k];
      var el=document.getElementById('LauncherMainTile-'+k);if(!el)continue;
      var label=el.querySelector('.flex-source-label');
      var face=el.querySelector('.main');
      if(!tile.denonPort&&!tile.denonGroup){if(label)label.parentNode.removeChild(label);if(face)face.className=face.className.replace(/\s*flex-denon-face/g,'');continue;}
      if(!face)continue;
      if(face.className.indexOf('flex-denon-face')<0)face.className+=' flex-denon-face';
      if(!label){label=document.createElement('div');label.className='flex-source-label';}
      if(label.parentNode!==face)face.appendChild(label);
      label.textContent=tile.appName;
    }
  }
  function stopDenonSources(){
    if(denonInputRef&&denonInputRef.__flexSourcesOrig){denonInputRef.keydown=denonInputRef.__flexSourcesOrig.bind(denonInputRef);delete denonInputRef.__flexSourcesOrig;delete denonInputRef.__flexSourcesOwner;}
    if(denonInputMethods&&denonInputMethods.keydown.__flexSources)denonInputMethods.keydown=denonInputMethods.keydown.__flexSourcesOrig;
    var s=document.getElementById('flex-source-slide');if(s)s.parentNode.removeChild(s);
    closeDenonGroup('Stopp');
    denonBusy('');
    stopSignalWatch();
    if(pendingStart){pendingStart.done=true;pendingStart=null;}
    unsettled=null;
  }
