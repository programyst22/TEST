(() => {
"use strict";
const START=10, STORAGE_KEY="rugs-paper-v2";
const NAMES=["Momentum","Trend Rider","Dip Buyer","Breakout","Mean Revert","Conservative","Scalper","Volume Scout","Risk Guard","Contrarian"];
const BUY=[.001,.002,-.006,.004,-.004,.006,.001,.002,.008,-.003];
const SELL=[-.012,-.015,-.025,-.01,.008,-.018,-.008,-.012,-.02,-.006];
const SIZE=[.25,.30,.20,.35,.20,.15,.40,.25,.10,.20];
const $=id=>document.getElementById(id);
let agents=[],price=1,history=[],tick=0,active=false,botRunning=false,trades=[],market=[],rounds=[],lastState=null,lastGameId="",socket=null,lastMessageAt=0,connected=false,connectWatchdog=null;
const finite=(v,d=NaN)=>Number.isFinite(Number(v))?Number(v):d;
function safeSave(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({market:market.slice(-5000),rounds:rounds.slice(-300),trades:trades.slice(0,300)}));}catch(e){setDataStatus("Хранилище браузера заполнено");}}
function restore(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");market=Array.isArray(x.market)?x.market:[];rounds=Array.isArray(x.rounds)?x.rounds:[];trades=Array.isArray(x.trades)?x.trades:[];}catch(e){market=[];rounds=[];trades=[];}}
function setDataStatus(s){const el=$("dataStatus");if(el)el.textContent=s;}
function initAgents(){agents=NAMES.map((name,i)=>({name,cash:START,units:0,entryCost:0,entryPrice:0,realized:0,closed:0,wins:0,action:"Ожидание",lastTradeTick:-1}));}
function init(){restore();initAgents();history=[];tick=0;price=1;render();draw();renderStats();}
function setConnection(status,detail=""){const el=$("connectionStatus");if(!el)return;el.textContent=detail?status+" · "+detail:status;el.className="connection "+(status==="Подключено"?"online":status==="Ошибка"?"offline":"pending");}
function connectionErrorText(err){
 const parts=[err?.message,err?.type,err?.description,err?.context?.name,err?.context?.transport?("transport="+err.context.transport):"",err?.context?.previousTransport?("previous="+err.context.previousTransport):"",err?.data?.message].filter(Boolean);
 return parts.join(" · ").slice(0,220)||"Неизвестная ошибка handshake";
}
function connect(){
 if(!window.io){setConnection("Ошибка","Socket.IO CDN не загрузился; проверьте сеть/блокировщик");return;}
 let attempt=0, watchdog=null, fallbackTimer=null;
 const closeCurrent=()=>{if(watchdog)clearTimeout(watchdog);if(fallbackTimer)clearTimeout(fallbackTimer);if(socket){socket.removeAllListeners();socket.disconnect();socket=null;}};
 const openConnection=withVersion=>{
  closeCurrent();
  connected=false;
  setConnection("Подключение",withVersion?"повтор с frontend-version":"Socket.IO polling handshake");
  const options={
   path:"/socket.io/",
   transports:["polling","websocket"],
   timeout:20000,
   reconnection:true,
   reconnectionAttempts:Infinity,
   reconnectionDelay:2000,
   reconnectionDelayMax:15000,
   randomizationFactor:0.5,
   forceNew:true,
   upgrade:true,
   rememberUpgrade:false,
   ...(withVersion?{query:{"frontend-version":"1.0"}}:{})
  };
  socket=window.io("https://backend.rugs.fun",options);
  watchdog=setTimeout(()=>{if(!connected)setConnection("Нет соединения","handshake не завершён за 20 секунд; см. диагностику");},22000);
  socket.on("connect",()=>{
   connected=true;if(watchdog)clearTimeout(watchdog);if(fallbackTimer)clearTimeout(fallbackTimer);
   const transport=socket.io?.engine?.transport?.name||"неизвестно";
   setConnection("Подключено","Socket.IO · "+transport);
   if(socket.io?.engine)socket.io.engine.on("upgrade",()=>setConnection("Подключено","Socket.IO · websocket"));
   $("lastUpdate").textContent="Канал установлен; ожидаем игровые события";
  });
  socket.onAny((event,...args)=>{
   const when=new Date().toLocaleTimeString("ru-RU");
   const summary=Array.isArray(args)&&args[0]&&typeof args[0]==="object"?
    Object.keys(args[0]).slice(0,7).join(", "):typeof args[0];
   $("roundMeta").textContent="Последнее событие: "+event+(summary?" · поля: "+summary:"")+" · "+when;
   if(event!=="gameStateUpdate"&&event!=="newTrade"&&event!=="gameEnd")recordEvent("server:"+event,{keys:summary});
  });
  socket.on("disconnect",reason=>{connected=false;setConnection("Отключено",String(reason||"соединение закрыто"));});
  socket.on("connect_error",err=>{
   connected=false;
   const detail=connectionErrorText(err);
   setConnection("Ошибка",detail);
   $("lastUpdate").textContent="Ошибка соединения до получения игровых данных";
   if(!withVersion&&attempt===0){
    attempt=1;
    fallbackTimer=setTimeout(()=>openConnection(true),1800);
   }
  });
  socket.on("gameStateUpdate",onGameState);
  socket.on("gameEnd",onGameEnd);
  socket.on("sideBetUpdate",data=>recordEvent("sideBetUpdate",data));
  socket.on("newTrade",data=>recordEvent("newTrade",data));
  socket.io.on("reconnect_attempt",n=>setConnection("Повтор подключения","попытка "+n));
  socket.io.on("reconnect_error",err=>setConnection("Ошибка повтора",connectionErrorText(err)));
  socket.io.on("error",err=>setConnection("Ошибка транспорта",connectionErrorText(err)));
  socket.io.on("open",()=>{
   const engine=socket?.io?.engine;
   if(engine)engine.on("connection_error",err=>setConnection("Ошибка handshake",connectionErrorText(err)));
  });
 };
 openConnection(false);
}
function recordEvent(type,data){market.push({type,receivedAt:Date.now(),gameId:lastGameId,tick,price,payload:data??null});if(market.length>5000)market.shift();safeSave();renderStats();}
function onGameState(raw){
 const data=raw?.data&&typeof raw.data==="object"?raw.data:raw||{};
 const p=finite(data.price??data.multiplier);if(!Number.isFinite(p)||p<=0)return;
 const nextTick=finite(data.tickCount??data.tick,tick),gameId=String(data.gameId??data.id??lastGameId);
 if(gameId&&lastGameId&&gameId!==lastGameId){finishRound("game_id_changed");history=[];}
 if(gameId)lastGameId=gameId;
 const isNew=history.length===0||nextTick!==tick;
 price=p;tick=nextTick;active=data.active!==undefined?!!data.active:data.status==="active";
 lastState={price,tick,active,peakPrice:finite(data.peakPrice??data.peak,p),cooldown:finite(data.cooldownTimer??data.cooldown,0),gameId,timestamp:finite(data.timestamp,Date.now())};
 lastMessageAt=Date.now();
 if(isNew){history.push({tick,price,time:lastMessageAt});if(history.length>500)history.shift();recordEvent("gameStateUpdate",{tick,price,active,peakPrice:lastState.peakPrice,gameId});if(botRunning)runAgents();}
 $("roundState").textContent=active?"Раунд активен":"Ожидание раунда";
 $("roundMeta").textContent=[gameId?"ID: "+gameId:"","Тик: "+tick,"Пик: "+lastState.peakPrice.toFixed(4)].filter(Boolean).join(" · ");
 $("tick").textContent="Тик #"+tick;$("price").textContent=price.toFixed(4);
 const start=history[0]?.price||price,change=start?(price/start-1)*100:0;
 $("priceChange").textContent=(change>=0?"+":"")+change.toFixed(2)+"% от начала наблюдения";
 $("priceChange").className="muted "+(change>=0?"positive":"negative");
 $("lastUpdate").textContent="Последнее обновление: "+new Date(lastMessageAt).toLocaleTimeString("ru-RU");
 render();draw();renderStats();
}
function runAgents(){
 if(!lastState||!active||history.length<3)return;
 const n=history.length,short=history[Math.max(0,n-4)].price,long=history[Math.max(0,n-12)].price;
 const momentum=short?price/short-1:0,trend=long?price/long-1:0,signal=momentum*.7+trend*.3;
 agents.forEach((a,i)=>{
  if(tick===a.lastTradeTick)return;
  if(a.units===0&&a.cash>=.5&&signal>BUY[i]){
   const spend=Math.min(a.cash,a.cash*SIZE[i]);a.units=spend/price;a.cash-=spend;a.entryCost=spend;a.entryPrice=price;a.action="ПОКУПКА";a.lastTradeTick=tick;log(a,"BUY",spend);
  }else if(a.units>0&&(signal<SELL[i]||(lastState.peakPrice>0&&price<lastState.peakPrice*.72))){
   const amount=a.units*price,pnl=amount-a.entryCost;a.cash+=amount;a.realized+=pnl;a.closed++;if(pnl>0)a.wins++;a.units=0;a.entryCost=0;a.entryPrice=0;a.action="ПРОДАЖА";a.lastTradeTick=tick;log(a,"SELL",amount,pnl);
  }else a.action=a.units>0?"ДЕРЖИТ":"ОЖИДАНИЕ";
 });
}
function log(a,side,amount,pnl=null){trades.unshift({time:Date.now(),name:a.name,side,price,amount,pnl,gameId:lastGameId,tick});if(trades.length>300)trades.pop();safeSave();}
function onGameEnd(data){finishRound("gameEnd",data);$("roundState").textContent="Раунд завершён";$("roundMeta").textContent=data?.gameId?"ID: "+data.gameId:"Ожидаем следующий раунд";recordEvent("gameEnd",data);}
function finishRound(reason,data={}){
 if(!lastState)return;
 rounds.unshift({gameId:lastGameId||data.gameId||"unknown",endedAt:Date.now(),lastTick:tick,peak:Math.max(...history.map(x=>x.price),lastState.peakPrice||price),finalPrice:finite(data.finalPrice,price),reason});
 if(rounds.length>300)rounds.pop();safeSave();renderStats();
}
function render(){
 const total=agents.reduce((s,a)=>s+a.cash+a.units*price,0);
 $("totalBalance").innerHTML=total.toFixed(2)+' <small>COINS</small>';
 $("agents").innerHTML=agents.map(a=>{const value=a.cash+a.units*price,pnl=value-START,pct=pnl/START*100,wr=a.closed?a.wins/a.closed*100:0;return '<article class="agent"><div class="agentTop"><span>'+a.name+'</span><span class="'+(pnl>=0?"positive":"negative")+'">'+(pnl>=0?"+":"")+pnl.toFixed(2)+'</span></div><div class="agentMeta"><span>'+a.action+'</span><span>'+value.toFixed(2)+' coins</span></div><div class="bar"><span style="width:'+Math.max(2,Math.min(100,50+pct*3))+'%"></span></div><div class="agentMeta"><span>Сделок закрыто '+a.closed+' · Win '+wr.toFixed(0)+'%</span><span>Наличные '+a.cash.toFixed(2)+'</span></div></article>'}).join("");
 $("trades").innerHTML=trades.length?trades.slice(0,30).map(t=>'<tr><td>'+new Date(t.time).toLocaleTimeString("ru-RU")+'</td><td>'+t.name+'</td><td class="'+(t.side==="BUY"?"positive":"negative")+'">'+(t.side==="BUY"?"Покупка":"Продажа")+'</td><td>'+Number(t.price).toFixed(4)+'</td><td>'+Number(t.amount).toFixed(3)+'</td><td>'+(t.pnl===null?"—":(t.pnl>=0?"+":"")+t.pnl.toFixed(3))+'</td></tr>').join(""):'<tr><td colspan="6" class="muted">Сделок пока нет</td></tr>';
}
function renderStats(){
 if($("eventsCount"))$("eventsCount").textContent=market.length.toLocaleString("ru-RU");
 if($("roundsCount"))$("roundsCount").textContent=rounds.length.toLocaleString("ru-RU");
 if($("savedCount"))$("savedCount").textContent=trades.length.toLocaleString("ru-RU");
 if($("dataStatus"))$("dataStatus").textContent=market.length?"Данные сохраняются в этом браузере":"Ожидание первых событий";
 const ranking=agents.map(a=>({name:a.name,pnl:a.cash+a.units*price-START,closed:a.closed,win:a.closed?a.wins/a.closed:0})).sort((a,b)=>b.pnl-a.pnl);
 if($("ranking"))$("ranking").innerHTML=ranking.map((a,i)=>'<div class="rankRow"><span>#'+(i+1)+' '+a.name+'</span><strong class="'+(a.pnl>=0?"positive":"negative")+'">'+(a.pnl>=0?"+":"")+a.pnl.toFixed(3)+'</strong><small>'+a.closed+' закрыто · '+(a.win*100).toFixed(0)+'% win</small></div>').join("");
}
function draw(){
 const c=$("chart");if(!c)return;const ctx=c.getContext("2d"),w=c.clientWidth||600,h=170,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 if(history.length<2){ctx.fillStyle="#91a0b5";ctx.font="13px system-ui";ctx.fillText("Ожидаем реальные обновления цены rugs.fun…",12,30);return;}
 const values=history.map(x=>x.price),min=Math.min(...values)*.995,max=Math.max(...values)*1.005,range=max-min||1;
 ctx.strokeStyle="#2a394e";ctx.lineWidth=1;for(let i=1;i<4;i++){const y=h*i/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.beginPath();values.forEach((v,i)=>{const x=i/(values.length-1)*w,y=h-((v-min)/range)*(h-12)-6;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=values.at(-1)>=values[0]?"#48d6a0":"#ff6f7d";ctx.lineWidth=2.5;ctx.stroke();
}
function download(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
$("startBtn").addEventListener("click",()=>{botRunning=!botRunning;$("startBtn").textContent=botRunning?"Остановить paper-агентов":"Запустить paper-агентов";if(botRunning&&lastState)runAgents();render();});
$("stepBtn").addEventListener("click",()=>{if(lastState){runAgents();render();}});
$("resetBtn").addEventListener("click",()=>{botRunning=false;$("startBtn").textContent="Запустить paper-агентов";initAgents();render();renderStats();});
$("exportMarket").addEventListener("click",()=>download("rugs-market-events.json",JSON.stringify(market,null,2),"application/json"));
$("exportTrades").addEventListener("click",()=>{const rows=[["time","agent","side","price","amount","pnl","gameId","tick"],...trades.map(t=>[new Date(t.time).toISOString(),t.name,t.side,t.price,t.amount,t.pnl,t.gameId,t.tick])];download("rugs-paper-trades.csv",rows.map(r=>r.map(v=>'"'+String(v??"").replaceAll('"','""')+'"').join(",")).join("\n"),"text/csv;charset=utf-8");});
window.addEventListener("resize",draw);
setInterval(()=>{if(connected&&lastMessageAt&&Date.now()-lastMessageAt>15000)setConnection("Подключено, но нет данных","последнее событие более 15 секунд назад");else if(connected&&!lastMessageAt)setConnection("Подключено","ждём первое gameStateUpdate");},5000);
init();connect();
})();