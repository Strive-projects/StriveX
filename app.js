var KEY="strive.data.v2", OLD="strive.tasks.v1", tasks=[], habits=[], exams=[], fin=[], ts=0, filter="today";
function load(){try{var d=JSON.parse(localStorage.getItem(KEY)||"null");
  if(d){tasks=d.tasks||[];habits=d.habits||[];exams=d.exams||[];fin=d.fin||[];ts=d.ts||0}
  else tasks=JSON.parse(localStorage.getItem(OLD)||"[]")}catch(e){}}
function snap(){return {tasks:tasks,habits:habits,exams:exams,fin:fin,ts:ts}}
function save(){ts=Date.now();try{localStorage.setItem(KEY,JSON.stringify(snap()))}catch(e){}push()}
function $(id){return document.getElementById(id)}
function pad(n){return String(n).padStart(2,"0")}
function dstr(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function dueMs(t){if(!t.date)return null;return new Date(t.date+"T"+(t.time||"23:59")).getTime()}
function fmt(t){
  if(!t.date)return "Без срока";
  var today=dstr(new Date()),tom=dstr(new Date(Date.now()+864e5)),d=t.date;
  var w=d===today?"Сегодня":d===tom?"Завтра":d.split("-").reverse().join(".");
  return w+(t.time?", "+t.time:"");
}
function isToday(t){return !t.date||t.date<=dstr(new Date())}
function esc(s){return s.replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}

function render(){
  var tt=tasks.filter(isToday), dn=tt.filter(function(t){return t.done}).length;
  var p=tt.length?Math.round(dn/tt.length*100):0;
  $("pct").textContent=p+"%"; $("fill").style.width=p+"%";
  var items=tasks.filter(function(t){
    return filter==="done"?t.done:filter==="today"?(isToday(t)&&!t.done):!t.done;
  }).sort(function(a,b){return (dueMs(a)||9e15)-(dueMs(b)||9e15)});
  var ul=$("list");
  if(!items.length){
    ul.innerHTML='<div class="empty">'+(filter==="done"?"Пока ничего не выполнено.":filter==="today"?"На сегодня задач нет. Добавь первую выше.":"Список пуст.")+"</div>";
    return;
  }
  ul.innerHTML=items.map(function(t){
    var late=!t.done&&!t.missed&&dueMs(t)&&dueMs(t)<Date.now();
    return '<li class="'+(t.done?"done ":"")+(t.missed?"missed ":"")+(late?"late":"")+'" data-id="'+t.id+'">'
    +'<button class="chk" data-a="chk" aria-label="Отметить выполненной">'+(t.done?"✓":t.missed?"✗":"")+'</button>'
    +'<div class="body"><div class="t">'+esc(t.title)+'</div><div class="m">'+fmt(t)
    +(t.rep?" · повтор":"")+(t.missed?" · не выполнено":late?" · просрочено":"")+'</div></div>'
    +'<button class="del" data-a="del" aria-label="Удалить">×</button></li>';
  }).join("");
}

$("f").addEventListener("submit",function(e){
  e.preventDefault();
  var title=$("title").value.trim(); if(!title)return;
  var date=$("date").value, time=$("time").value, rem=+$("rem").value;
  if(time&&!date)date=dstr(new Date());
  tasks.push({id:Date.now()+"",title:title,date:date,time:time,rem:rem,rep:$("rep").value,done:false,fired:false});
  save(); $("f").reset(); render();
  if(rem>=0&&date)askPerm();
});

$("list").addEventListener("click",function(e){
  var b=e.target.closest("button"); if(!b)return;
  var id=b.closest("li").dataset.id, t=tasks.find(function(x){return x.id===id});
  if(b.dataset.a==="del")tasks=tasks.filter(function(x){return x.id!==id});
  if(b.dataset.a==="chk"&&t){
    t.done=!t.done;
    if(t.done){t.missed=false;spawnNext(t)}
  }
  save(); render();
});

$("tabs").addEventListener("click",function(e){
  var b=e.target.closest("button"); if(!b)return;
  filter=b.dataset.f;
  [].forEach.call($("tabs").children,function(x){x.classList.toggle("on",x===b)});
  render();
});

/* ===== Звонок, мелодия и подтверждение «сделано / не сделано» ===== */
var actx=null,alarmT=null,alarmN=0,cur=null,baseTitle=document.title;
function audio(){try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();if(actx.state==="suspended")actx.resume();return actx}catch(e){return null}}
["click","keydown","touchstart"].forEach(function(ev){document.addEventListener(ev,function(){audio()},{once:true,passive:true})});
function melody(){
  var c=audio();if(!c)return;
  var seq=[[659,0],[784,.16],[988,.32],[1319,.48],[988,.8],[1319,.96],[1568,1.12],[1319,1.44],[1568,1.6],[2093,1.76]];
  var t0=c.currentTime+.03;
  seq.forEach(function(n){
    var o=c.createOscillator(),g=c.createGain(),t=t0+n[1];
    o.type="triangle";o.frequency.value=n[0];
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.8,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.3);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+.32);
  });
}
function vib(){try{navigator.vibrate&&navigator.vibrate([300,150,300,150,500])}catch(e){}}
function startAlarm(){
  stopAlarm();melody();vib();alarmN=0;
  alarmT=setInterval(function(){if(++alarmN>9)stopAlarm();else{melody();vib()}},3000);
  document.title="🔔 Время! — Strive";
}
function stopAlarm(){
  clearInterval(alarmT);alarmT=null;document.title=baseTitle;
  try{window.strive&&strive.stop()}catch(e){}
}
function toast(msg){
  var t=$("toast"); t.innerHTML="<div>🔔 "+esc(msg)+'</div><button type="button">Понятно</button>';
  t.style.display="block"; t.querySelector("button").onclick=function(){t.style.display="none"};
}
function askPerm(){
  try{if("Notification" in window&&Notification.permission==="default")Notification.requestPermission().then(permInfo)}catch(e){}
}
function permInfo(){
  var s="";
  try{s="Notification" in window?(Notification.permission==="granted"?"Уведомления включены":"Уведомления выключены"):"Уведомления не поддерживаются"}catch(e){}
  $("perm").textContent=s;
}
function sysNote(msg){
  try{if("Notification" in window&&Notification.permission==="granted"){
    var n=new Notification("Strive",{body:msg,requireInteraction:true,icon:"icon-192.png",tag:"strive"});
    n.onclick=function(){window.focus();n.close()};
  }}catch(e){}
}
function spawnNext(t){
  if(!t.rep||!t.date||t.repd)return;
  t.repd=true;
  var step=t.rep==="d"?1:7,today=dstr(new Date()),d=new Date(t.date+"T00:00");
  d.setDate(d.getDate()+step);
  while(dstr(d)<today)d.setDate(d.getDate()+step);
  tasks.push({id:Date.now()+Math.random().toString(36).slice(2,5),title:t.title,date:dstr(d),time:t.time,rem:t.rem,rep:t.rep,done:false,fired:false});
}
function pendingList(){
  var now=Date.now(),res=[],today=dstr(new Date());
  tasks.forEach(function(t){
    var d=dueMs(t);
    if(t.done||t.missed||t.rem<0||!d||!t.date)return;
    if(now>=d&&!(t.snz>now))res.push({k:"t",o:t});
  });
  habits.forEach(function(h){
    if(!h.time||h.askd===today||h.days.indexOf(today)>=0||h.snz>now)return;
    if(now>=new Date(today+"T"+h.time).getTime())res.push({k:"h",o:h});
  });
  return res;
}
function showAsk(it,more){
  cur=it;var o=it.o;
  if(it.k==="t"){
    $("ask-t").textContent=o.title;
    $("ask-m").textContent="Время вышло ("+fmt(o)+"). Ты это сделал(а)?";
    $("ask-y").textContent="✓ Сделано";$("ask-n").textContent="✗ Не сделано";
  }else{
    $("ask-t").textContent="Привычка: "+o.name;
    $("ask-m").textContent="Сегодня уже выполнил(а)?";
    $("ask-y").textContent="✓ Да, сделал(а)";$("ask-n").textContent="✗ Нет, пропустил(а)";
  }
  $("ask-q").textContent=more?"Ещё вопросов: "+more:"";
  $("ask").style.display="flex";
  startAlarm();sysNote((it.k==="t"?"Задача: ":"Привычка: ")+(o.title||o.name)+" — сделано?");
  try{window.strive&&strive.alert()}catch(e){}
}
function answer(kind){
  if(!cur)return;
  var it=cur,o=it.o,today=dstr(new Date());
  if(kind==="later")o.snz=Date.now()+600000;
  else if(it.k==="t"){
    if(kind==="yes"){o.done=true;o.missed=false}else o.missed=true;
    spawnNext(o);
  }else{
    o.miss=o.miss||[];
    if(kind==="yes"){
      if(o.days.indexOf(today)<0)o.days.push(today);
      o.miss=o.miss.filter(function(x){return x!==today});
    }else{o.askd=today;if(o.miss.indexOf(today)<0)o.miss.push(today)}
  }
  cur=null;stopAlarm();$("ask").style.display="none";
  save();renderAll();
  setTimeout(check,500);
}
$("ask-y").onclick=function(){answer("yes")};
$("ask-n").onclick=function(){answer("no")};
$("ask-l").onclick=function(){answer("later")};
function check(){
  var now=Date.now(),ch=false;
  tasks.forEach(function(t){
    var d=dueMs(t);
    if(t.done||t.missed||t.fired||t.rem<=0||!d||!t.date)return;
    if(now>=d-t.rem*60000&&now<d){
      t.fired=true;ch=true;
      var msg="Скоро: "+t.title+" ("+fmt(t)+")";
      toast(msg);melody();vib();sysNote(msg);
      try{window.strive&&strive.alert()}catch(e){}
    }
  });
  if(ch){save();render()}
  if(!cur){var p=pendingList();if(p.length)showAsk(p[0],p.length-1)}
}

$("theme").onclick=function(){
  var r=document.documentElement, dark=r.dataset.theme?r.dataset.theme==="dark":matchMedia("(prefers-color-scheme: dark)").matches;
  r.dataset.theme=dark?"light":"dark";
};

load(); render(); permInfo(); check();
setInterval(check,15000);
document.addEventListener("visibilitychange",function(){if(!document.hidden){check();render()}});

// Заставка: показываем один раз за сеанс, закрывается сама или по клику
(function(){
  var sp=$("splash"); if(!sp)return;
  var seen=false; try{seen=sessionStorage.getItem("strive.splash")==="1"}catch(e){}
  function close(){sp.classList.add("hide"); setTimeout(function(){sp.remove()},700)}
  if(seen){sp.remove();return}
  try{sessionStorage.setItem("strive.splash","1")}catch(e){}
  sp.addEventListener("click",close);
  setTimeout(close,2900);
})();

/* ===== Вкладки ===== */
$("nav").addEventListener("click",function(e){
  var b=e.target.closest("button"); if(!b)return;
  [].forEach.call($("nav").children,function(x){x.classList.toggle("on",x===b)});
  ["tasks","habits","fin","exams"].forEach(function(v){$("v-"+v).hidden=(v!==b.dataset.v)});
  renderAll();
});
function renderAll(){render();renderHabits();renderFin();renderExams()}

/* ===== Привычки ===== */
var WD=["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
function lastDays(n){var r=[];for(var i=n-1;i>=0;i--){var d=new Date();d.setDate(d.getDate()-i);r.push(d)}return r}
function streak(h){var s=0,d=new Date();if(h.days.indexOf(dstr(d))<0)d.setDate(d.getDate()-1);
  while(h.days.indexOf(dstr(d))>=0){s++;d.setDate(d.getDate()-1)}return s}
function renderHabits(){
  var el=$("hlist");
  if(!habits.length){el.innerHTML='<div class="empty">Добавь первую привычку, например «Читать 20 минут».</div>';return}
  el.innerHTML=habits.map(function(h){
    var st=streak(h),mm=h.miss||[];
    return '<li class="hab" data-id="'+h.id+'"><div class="body"><div class="t">'+esc(h.name)+'</div>'
    +'<div class="m">'+(st?"🔥 "+st+" дн. подряд":"Серии пока нет")+(h.time?" · ⏰ "+h.time:"")+'</div><div class="days">'
    +lastDays(7).map(function(d){var k=dstr(d),on=h.days.indexOf(k)>=0,ms=mm.indexOf(k)>=0;
      return '<button class="dy'+(on?" on":ms?" miss":"")+'" data-a="day" data-d="'+k+'" aria-label="'+k+'"><span>'+WD[d.getDay()]+'</span>'+(on?"✓":ms?"✗":d.getDate())+'</button>'}).join("")
    +'</div></div><button class="del" data-a="del" aria-label="Удалить">×</button></li>'}).join("");
}
$("hf").addEventListener("submit",function(e){
  e.preventDefault();var n=$("hname").value.trim(),tm=$("htime").value;if(!n)return;
  habits.push({id:Date.now()+"",name:n,days:[],miss:[],time:tm});save();$("hf").reset();renderHabits();
  if(tm)askPerm();
});
$("hlist").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  var id=b.closest("li").dataset.id,h=habits.find(function(x){return x.id===id});
  if(b.dataset.a==="del")habits=habits.filter(function(x){return x.id!==id});
  if(b.dataset.a==="day"&&h){
    h.miss=h.miss||[];var i=h.days.indexOf(b.dataset.d);
    if(i<0){h.days.push(b.dataset.d);h.miss=h.miss.filter(function(x){return x!==b.dataset.d})}else h.days.splice(i,1);
  }
  save();renderHabits();
});

/* ===== Экзамены ===== */
function daysLeft(d){var x=new Date(d+"T00:00"),n=new Date();n.setHours(0,0,0,0);return Math.round((x-n)/864e5)}
var ETYPES=["Экзамен","Зачёт","Проект","Реферат","Курсовая","Другое"];
function gradeNum(g){var n=parseFloat(String(g||"").replace(",","."));return isNaN(n)?null:n}
function examLi(x){
  var n=daysLeft(x.date),lab=n<0?"Уже прошёл":n===0?"Сегодня!":n===1?"Завтра":"Через "+n+" дн.";
  return '<li data-id="'+x.id+'"><div class="cd'+(n>=0&&n<=3?" hot":"")+(n<0?" past":"")+'"><b>'+(n<0?"✓":n)+'</b><span>'+(n<0?"прошёл":"дн.")+'</span></div>'
  +'<div class="body"><div class="t">'+esc(x.name)+'</div><div class="m">'+esc(x.type||"Экзамен")+" · "+x.date.split("-").reverse().join(".")+" · "+lab+'</div>'
  +'<label class="gr">Оценка<input class="gi" maxlength="12" placeholder="—" value="'+esc(x.grade||"")+'"></label></div>'
  +'<button class="del" data-a="del" aria-label="Удалить">×</button></li>';
}
function renderExams(){
  var el=$("elist");
  if(!exams.length){el.innerHTML='<div class="empty">Добавь экзамен, проект или реферат: посчитаю дни и сохраню оценку.</div>';return}
  var up=exams.filter(function(x){return daysLeft(x.date)>=0}).sort(function(a,b){return a.date<b.date?-1:1});
  var past=exams.filter(function(x){return daysLeft(x.date)<0}).sort(function(a,b){return a.date<b.date?1:-1});
  var nums=past.map(function(x){return gradeNum(x.grade)}).filter(function(v){return v!==null});
  var avg=nums.length?Math.round(nums.reduce(function(s,v){return s+v},0)/nums.length*100)/100:null;
  el.innerHTML=(up.length?'<h3 class="sec">Предстоящие</h3><ul>'+up.map(examLi).join("")+'</ul>':"")
   +(past.length?'<h3 class="sec">История и оценки'+(avg!==null?' · средняя '+String(avg).replace(".",",")+' (по '+nums.length+')':"")+'</h3><ul>'+past.map(examLi).join("")+'</ul>':"");
}
$("ef").addEventListener("submit",function(e){
  e.preventDefault();var n=$("ename").value.trim(),d=$("edate").value;if(!n||!d)return;
  exams.push({id:Date.now()+"",name:n,date:d,type:$("etype").value,grade:$("egrade").value.trim()});
  save();$("ef").reset();renderExams();
});
$("elist").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  var id=b.closest("li").dataset.id;exams=exams.filter(function(x){return x.id!==id});save();renderExams();
});
$("elist").addEventListener("change",function(e){
  if(!e.target.classList.contains("gi"))return;
  var id=e.target.closest("li").dataset.id,x=exams.find(function(v){return v.id===id});
  if(x){x.grade=e.target.value.trim();save();renderExams()}
});

/* ===== Финансы ===== */
var CUR=" ₽", MONTHS=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],
  fmon=dstr(new Date()).slice(0,7), editInc=false,
  NUM=/^(\d+(?:[.,]\d+)?)(?:₽|руб[а-яё]*\.?|р\.?)?$/i, UNIT=/^(?:₽|руб[а-яё]*\.?|р\.?)$/i;
function money(n){return (Math.round(n*100)/100).toLocaleString("ru-RU")+CUR}
function shiftMon(m,n){var p=m.split("-"),d=new Date(+p[0],+p[1]-1+n,1);return d.getFullYear()+"-"+pad(d.getMonth()+1)}
function monLabel(m){var p=m.split("-");return MONTHS[+p[1]-1]+" "+p[0]}
function daysIn(m){var p=m.split("-");return new Date(+p[0],+p[1],0).getDate()}
function sumBy(list,type){return list.filter(function(x){return x.type===type}).reduce(function(s,x){return s+x.amt},0)}
function normCat(s){s=s.trim().toLowerCase();return s.charAt(0).toUpperCase()+s.slice(1)}
function isNum(w){return NUM.test(w)}
function numOf(w){return +w.match(NUM)[1].replace(",",".")}
// «еда 200, игротека 300», «200р еда 300р игротека», «+5000 подработка»
function parseQuick(s){
  var res=[],bad=[];
  s.split(/[,;\n]+/).forEach(function(part){
    part=part.trim();if(!part)return;
    var inc=false;if(part.charAt(0)==="+"){inc=true;part=part.slice(1)}
    var tk=part.split(/\s+/).filter(function(w){return w&&!UNIT.test(w)}),groups=[];
    if(tk.length&&isNum(tk[0])){
      var cur2=null;
      tk.forEach(function(w){if(isNum(w)){cur2={amt:numOf(w),nm:[]};groups.push(cur2)}else if(cur2)cur2.nm.push(w)});
    }else{
      var nm=[];
      tk.forEach(function(w){if(isNum(w)){groups.push({amt:numOf(w),nm:nm});nm=[]}else nm.push(w)});
      if(nm.length)bad.push(nm.join(" "));
    }
    groups.forEach(function(g){
      if(!(g.amt>0))return;
      var name=g.nm.join(" ").trim();
      res.push({inc:inc,amt:g.amt,cat:name?normCat(name):(inc?"Доход":"Другое")});
    });
  });
  return {res:res,bad:bad};
}
function renderFin(){
  $("fmon").textContent=monLabel(fmon);
  var list=fin.filter(function(x){return x.date.slice(0,7)===fmon});
  var base=list.filter(function(x){return x.base});
  var inc=sumBy(list,"in"),exp=sumBy(list,"out"),bal=inc-exp,has=base.length>0;
  // доход за месяц
  if(!has||editInc){
    $("finc").innerHTML='<div class="incbox"><b>'+(has?"Изменить доход за месяц":"Доход за "+monLabel(fmon).toLowerCase())+'</b>'
     +'<div class="m">Сколько ты получаешь в этом месяце (стипендия, зарплата, помощь)? Дальше просто записывай траты каждый день.</div>'
     +'<div class="incrow"><input id="incv" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Например: 30000" value="'+(has?base[0].amt:"")+'"><button class="add" id="incs" type="button">Сохранить</button></div></div>';
  }else{
    $("finc").innerHTML='<div class="incline"><span>Доход за месяц: <b>'+money(base.reduce(function(s,x){return s+x.amt},0))+'</b></span><button id="ince" type="button" class="lnk">изменить</button></div>';
  }
  $("fsum").innerHTML=
    '<div class="fs"><span>Доходы</span><b class="pos">'+money(inc)+'</b></div>'
   +'<div class="fs"><span>Расходы</span><b class="neg">'+money(exp)+'</b></div>'
   +'<div class="fs"><span>Остаток</span><b class="'+(bal<0?"neg":"pos")+'">'+money(bal)+'</b></div>';
  var nowD=new Date(),curM=dstr(nowD).slice(0,7),isCur=fmon===curM,dim=daysIn(fmon);
  var elapsed=isCur?nowD.getDate():(fmon<curM?dim:0),avg=elapsed?exp/elapsed:0;
  var left=isCur?dim-nowD.getDate()+1:0,perDay=(isCur&&bal>0&&left)?bal/left:0;
  $("fsum2").innerHTML=
    '<div class="fs"><span>Средний расход в день</span><b>'+money(avg)+'</b></div>'
   +(isCur?'<div class="fs"><span>Можно тратить в день</span><b class="'+(bal>0?"pos":"neg")+'">'+money(perDay)+'</b></div>'
          :'<div class="fs"><span>Операций за месяц</span><b>'+list.length+'</b></div>');
  // быстрые категории
  var cnt={};fin.forEach(function(x){if(x.type==="out")cnt[x.cat]=(cnt[x.cat]||0)+1});
  var top=Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a]}).slice(0,6);
  if(!top.length)top=["Еда","Транспорт","Учёба","Развлечения"];
  $("fchips").innerHTML=top.map(function(c){return '<button type="button" class="chip" data-c="'+esc(c)+'">'+esc(c)+'</button>'}).join("");
  // категории расходов
  var by={};list.forEach(function(x){if(x.type==="out")by[x.cat]=(by[x.cat]||0)+x.amt});
  var cats=Object.keys(by).sort(function(a,b){return by[b]-by[a]});
  $("fcats").innerHTML=cats.length?cats.map(function(c){var p=exp?Math.round(by[c]/exp*100):0;
    return '<div class="cat"><div class="ct"><span>'+esc(c)+'</span><span>'+money(by[c])+' · '+p+'%</span></div><div class="cb"><div style="width:'+p+'%"></div></div></div>'}).join("")
    :'<div class="empty">В этом месяце расходов нет.</div>';
  // расходы по дням
  var ds=[],i;for(i=0;i<dim;i++)ds.push(0);
  list.forEach(function(x){if(x.type==="out")ds[+x.date.slice(8,10)-1]+=x.amt});
  var dm=Math.max.apply(null,ds.concat([1]));
  $("fdays").innerHTML='<div class="dbars">'+ds.map(function(v,k){
    return '<div class="dcol" title="'+(k+1)+': '+money(v)+'"><i style="height:'+Math.round(v/dm*100)+'%"></i><span>'+((k+1)%5===0||k===0?(k+1):"")+'</span></div>'}).join("")+'</div>';
  // 6 месяцев
  var ms=[];for(i=5;i>=0;i--)ms.push(shiftMon(fmon,-i));
  var data=ms.map(function(m){var l=fin.filter(function(x){return x.date.slice(0,7)===m});return {m:m,i:sumBy(l,"in"),o:sumBy(l,"out")}});
  var mx=Math.max.apply(null,data.map(function(d){return Math.max(d.i,d.o)}).concat([1]));
  $("fchart").innerHTML=data.map(function(d){
    return '<div class="col'+(d.m===fmon?" cur":"")+'"><div class="bars"><i class="bi" style="height:'+Math.round(d.i/mx*100)+'%" title="'+money(d.i)+'"></i><i class="bo" style="height:'+Math.round(d.o/mx*100)+'%" title="'+money(d.o)+'"></i></div><span>'+MONTHS[+d.m.split("-")[1]-1].slice(0,3)+'</span></div>'}).join("")
    +'<div class="leg"><span><i class="bi"></i>Доходы</span><span><i class="bo"></i>Расходы</span></div>';
  // операции по дням
  var ops=list.slice().sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a.id<b.id?1:-1)}),html="",lastD="";
  ops.forEach(function(x){
    if(x.date!==lastD){lastD=x.date;
      var dt=ops.filter(function(y){return y.date===x.date&&y.type==="out"}).reduce(function(s,y){return s+y.amt},0);
      html+='<li class="dh"><span>'+x.date.split("-").reverse().join(".")+'</span>'+(dt?'<span>−'+money(dt)+'</span>':"")+'</li>';
    }
    html+='<li data-id="'+x.id+'"><div class="body"><div class="t">'+esc(x.cat)+(x.note?" · "+esc(x.note):"")+'</div></div>'
    +'<b class="'+(x.type==="in"?"pos":"neg")+'">'+(x.type==="in"?"+":"−")+money(x.amt)+'</b>'
    +'<button class="del" data-a="del" aria-label="Удалить">×</button></li>';
  });
  $("flist").innerHTML=ops.length?html:'<div class="empty">Операций пока нет. Впиши первую трату выше.</div>';
}
$("finc").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  if(b.id==="ince"){editInc=true;renderFin();return}
  if(b.id==="incs"){
    var v=parseFloat($("incv").value);if(!(v>0))return;
    fin=fin.filter(function(x){return !(x.base&&x.date.slice(0,7)===fmon)});
    fin.push({id:"b"+Date.now(),type:"in",amt:v,cat:"Доход за месяц",note:"",date:fmon+"-01",base:true});
    editInc=false;save();renderFin();
  }
});
$("fchips").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  var q=$("fq"),v=q.value;
  q.value=v+(v&&!/[\s,]$/.test(v)?", ":"")+b.dataset.c+" ";q.focus();
});
$("fprev").onclick=function(){fmon=shiftMon(fmon,-1);renderFin()};
$("fnext").onclick=function(){fmon=shiftMon(fmon,1);renderFin()};
$("ff").addEventListener("submit",function(e){
  e.preventDefault();
  var date=$("fdate").value,pr=parseQuick($("fq").value);
  if(!date)return;
  if(!pr.res.length){$("fmsg").textContent="Не понял. Напиши так: еда 200, игротека 300";return}
  pr.res.forEach(function(r,i){fin.push({id:Date.now()+"-"+i,type:r.inc?"in":"out",amt:r.amt,cat:r.cat,note:"",date:date})});
  fmon=date.slice(0,7);
  $("fmsg").textContent="Добавлено: "+pr.res.map(function(r){return (r.inc?"+":"")+r.cat+" "+money(r.amt)}).join(", ")
    +(pr.bad.length?". Пропустил без суммы: "+pr.bad.join(", "):"");
  $("fq").value="";save();renderFin();
});
$("flist").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  var li=b.closest("li");if(!li||!li.dataset.id)return;
  var id=li.dataset.id;fin=fin.filter(function(x){return x.id!==id});save();renderFin();
});
$("fdate").value=dstr(new Date());

/* ===== Supabase: вход и синхронизация ===== */
var sb=null,user=null,pushT=null,skipped=false;
try{if(window.supabase&&window.STRIVE_CONFIG&&STRIVE_CONFIG.url.indexOf("http")===0)sb=supabase.createClient(STRIVE_CONFIG.url,STRIVE_CONFIG.key)}catch(e){}
function setSync(s){$("sync").textContent=s}
function showAuth(on){$("auth").style.display=on?"flex":"none"}
function push(){
  if(!sb||!user)return;
  clearTimeout(pushT);
  pushT=setTimeout(function(){
    sb.from("user_data").upsert({user_id:user.id,data:snap(),updated_at:new Date().toISOString()})
      .then(function(r){setSync(r.error?"Ошибка синхронизации":"Синхронизировано")});
  },800);
}
function pull(){
  setSync("Синхронизация…");
  sb.from("user_data").select("data").eq("user_id",user.id).maybeSingle().then(function(r){
    var d=r.data&&r.data.data;
    if(d&&(d.ts||0)>ts){tasks=d.tasks||[];habits=d.habits||[];exams=d.exams||[];fin=d.fin||[];ts=d.ts;
      try{localStorage.setItem(KEY,JSON.stringify(snap()))}catch(e){}setSync("Синхронизировано")}
    else push();
    renderAll();
  });
}
function authDo(kind){
  var em=$("em").value.trim(),pw=$("pw").value;
  if(!em||pw.length<6){$("amsg").textContent="Введи email и пароль от 6 символов";return}
  $("amsg").textContent="Подожди…";
  var p=kind==="up"?sb.auth.signUp({email:em,password:pw}):sb.auth.signInWithPassword({email:em,password:pw});
  p.then(function(r){
    if(r.error){$("amsg").textContent=r.error.message;return}
    if(!r.data.session)$("amsg").textContent="Подтверди email по письму, потом нажми «Войти»";
  });
}
function initAuth(){
  if(!sb){setSync(!window.supabase?"Без аккаунта: библиотека Supabase не загрузилась (интернет/блокировка)":"Без аккаунта: ключи не заполнены в config.js");return}
  $("accbtn").hidden=false;
  $("bin").onclick=function(){authDo("in")};
  $("bup").onclick=function(){authDo("up")};
  $("skip").onclick=function(){skipped=true;showAuth(false)};
  $("accbtn").onclick=function(){if(user)sb.auth.signOut();else showAuth(true)};
  sb.auth.onAuthStateChange(function(ev,s){
    user=(s&&s.user)||null;
    $("accbtn").textContent=user?"Выйти":"Войти";
    if(user){showAuth(false);pull()}
    else{setSync("Не выполнен вход");if(!skipped)showAuth(true)}
  });
}
renderAll();initAuth();
