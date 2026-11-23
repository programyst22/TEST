(() => {
"use strict";
const START=10;
const NAMES=["Momentum","Trend Rider","Dip Buyer","Breakout","Mean Revert","Conservative","Scalper","Volume Scout","Risk Guard","Contrarian"];
const RISKS=[.08,.12,.10,.15,.07,.05,.18,.11,.04,.13];
const $=id=>document.getElementById(id);
let agents=[],price=1,history=[],tick=0,active=false,botRunning=false,trades=[],lastState=null,lastGameId="",socket=null,seenTicks=new Set();
const finite=(v,fallback)=>Number.isFinite(Number(v))?Number(v):fallback;
function init(){
 agents=NAMES.map((name,i)=>({name,cash:START,units:0,action:"Ожидание",risk:RISKS[i],lastTradeTick:-1}));
 history=[];trades=[];tick=0;price=1;render();draw();
}
function setConnection(status,detail=""){
 const el=$("connectionStatus"); if(!el)return;
 el.textContent=detail?status+" · "+detail:status;
 el.className="connection "+(status==="Подключено"?"online":status==="Ошибка"?"offline":"pending");
}
function connect(){
 if(!window.io){setConnection("Ошибка","Socket.IO не загрузился");return;}
 setConnection("Подключение","rugs.fun");
 socket=window.io("https://backend.rugs.fun?frontend-version=1.0",{
  transports:["websocket","polling"],timeout:10000,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:1500,reconnectionDelayMax:10000
 });
 socket.on("connect",()=>setConnection("Подключено","получаем live-данные"));
 socket.on("disconnect",reason=>setConnection("Отключено",reason));
 socket.on("connect_error",err=>setConnection("Ошибка",err.message||"соединение"));
 socket.on("gameStateUpdate",onGameState);
 socket.on("gameEnd",data=>{ $("roundState").textContent="Раунд завершён"; $("roundMeta").textContent=data?.gameId?("ID: "+data.gameId):"Ожидаем следующий раунд"; });
}
function onGameState(raw){
 const data=raw?.data&&typeof raw.data==="object"?raw.data:raw||{};
 const nextPrice=finite(data.price??data.multiplier,NaN);
 if(!Number.isFinite(nextPrice)||nextPrice<=0)return;
 const nextTick=finite(data.tickCount??data.tick,tick);
 const gameId=String(data.gameId??data.id??"");
 if(gameId&&lastGameId&&gameId!==lastGameId){history=[];seenTicks.clear();}
 if(gameId)lastGameId=gameId;
 const isNew=nextTick!==tick||history.length===0;
 price=nextPrice;tick=nextTick;active=data.active!==undefined?!!data.active:(data.status==="active");
 lastState={price,tick,active,peakPrice:finite(data.peakPrice??data.peak,price),cooldown:finite(data.cooldownTimer??data.cooldown,0),gameId,timestamp:finite(data.timestamp,Date.now())};
 if(isNew){history.push(price);if(history.length>240)history.shift();if(botRunning)runAgents();}
 $("roundState").textContent=active?"Раунд активен":"Ожидание раунда";
 $("roundMeta").textContent=[gameId?"ID: "+gameId:"", "Тик: "+tick, "Пик: "+lastState.peakPrice.toFixed(3)].filter(Boolean).join(" · ");
 $("tick").textContent="Тик #"+tick;
 $("price").textContent=price.toFixed(4);
 const start=history[0]||price,change=start?(price/start-1)*100:0;
 $("priceChange").textContent=(change>=0?"+":"")+change.toFixed(2)+"% от начала наблюдения";
 $("priceChange").className="muted "+(change>=0?"positive":"negative");
 render();draw();
}
function runAgents(){
 if(!lastState||!active)return;
 const n=history.length,short=history[Math.max(0,n-4)]||price,long=history[Math.max(0,n-12)]||price;
 const momentum=short?price/short-1:0,trend=long?price/long-1:0;
 agents.forEach((a,i)=>{
  const value=a.cash+a.units*price;
  const signal=momentum*.7+trend*.3;
  const buyThreshold=[.001,.002,-.006,.004,-.004,.006,.001,.002,.008,-.003][i];
  const sellThreshold=[-.012,-.015,-.025,-.01,.008,-.018,-.008,-.012,-.02,-.006][i];
  if(a.units===0&&a.cash>=.5&&signal>buyThreshold&&tick!==a.lastTradeTick){
   const fraction=[.25,.3,.2,.35,.2,.15,.4,.25,.1,.2][i];
   const spend=Math.min(a.cash,a.cash*fraction);
   a.units=spend/price;a.cash-=spend;a.action="ПОКУПКА";a.lastTradeTick=tick;log(a,"BUY",spend);
  }else if(a.units>0&&(signal<sellThreshold||lastState.peakPrice>0&&price<lastState.peakPrice*.72)&&tick!==a.lastTradeTick){
   const amount=a.units*price;a.cash+=amount;a.units=0;a.action="ПРОДАЖА";a.lastTradeTick=tick;log(a,"SELL",amount);
  }else a.action=a.units>0?"ДЕРЖИТ":"ОЖИДАНИЕ";
 });
}
function log(a,side,amount){trades.unshift({time:new Date().toLocaleTimeString("ru-RU"),name:a.name,side,price,amount});trades=trades.slice(0,30);}
function render(){
 const total=agents.reduce((s,a)=>s+a.cash+a.units*price,0);
 $("totalBalance").innerHTML=total.toFixed(2)+' <small>COINS</small>';
 $("agents").innerHTML=agents.map(a=>{const value=a.cash+a.units*price,pnl=value-START,pct=pnl/START*100;return '<article class="agent"><div class="agentTop"><span>'+a.name+'</span><span class="'+(pnl>=0?"positive":"negative")+'">'+(pnl>=0?"+":"")+pnl.toFixed(2)+'</span></div><div class="agentMeta"><span>'+a.action+'</span><span>'+value.toFixed(2)+' coins</span></div><div class="bar"><span style="width:'+Math.max(2,Math.min(100,50+pct*3))+'%"></span></div><div class="agentMeta"><span>Наличные '+a.cash.toFixed(2)+'</span><span>Токены '+a.units.toFixed(3)+'</span></div></article>'}).join("");
 $("trades").innerHTML=trades.length?trades.map(t=>'<tr><td>'+t.time+'</td><td>'+t.name+'</td><td class="'+(t.side==="BUY"?"positive":"negative")+'">'+(t.side==="BUY"?"Покупка":"Продажа")+'</td><td>'+t.price.toFixed(4)+'</td><td>'+t.amount.toFixed(3)+'</td></tr>').join(""):'<tr><td colspan="5" class="muted">Сделок пока нет</td></tr>';
}
function draw(){
 const c=$("chart");if(!c)return;const ctx=c.getContext("2d"),w=c.clientWidth||600,h=170,dpr=window.devicePixelRatio||1;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 if(history.length<2){ctx.fillStyle="#91a0b5";ctx.font="13px system-ui";ctx.fillText("Ожидаем реальные обновления цены rugs.fun…",12,30);return;}
 const min=Math.min(...history)*.995,max=Math.max(...history)*1.005,range=max-min||1;
 ctx.strokeStyle="#2a394e";ctx.lineWidth=1;for(let i=1;i<4;i++){const y=h*i/4;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.beginPath();history.forEach((v,i)=>{const x=i/(history.length-1)*w,y=h-((v-min)/range)*(h-12)-6;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=history.at(-1)>=history[0]?"#48d6a0":"#ff6f7d";ctx.lineWidth=2.5;ctx.stroke();
}
$("startBtn").addEventListener("click",()=>{botRunning=!botRunning;$("startBtn").textContent=botRunning?"Остановить paper-агентов":"Запустить paper-агентов";if(botRunning&&lastState)runAgents();render();});
$("stepBtn").addEventListener("click",()=>{if(lastState){runAgents();render();}});
$("resetBtn").addEventListener("click",()=>{botRunning=false;$("startBtn").textContent="Запустить paper-агентов";init();});
window.addEventListener("resize",draw);
init();connect();
})();