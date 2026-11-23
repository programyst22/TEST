(() => {
  "use strict";
  const START_CAPITAL=100, AGENT_COUNT=10, START_PER_AGENT=START_CAPITAL/AGENT_COUNT;
  const names=["Momentum","Mean Reversion","Breakout","Trend Follower","Contrarian","Fast Scalp","Slow Scout","Volatility","Dip Buyer","Consensus"];
  const descriptions=["Ищет ускорение цены","Покупает отклонения вниз","Ловит выход из диапазона","Следует за трендом","Ищет обратный сигнал","Частые короткие сделки","Редкие осторожные входы","Реагирует на волатильность","Покупает локальные просадки","Голосует по общему сигналу"];
  const $=id=>document.getElementById(id);
  let agents,price,history,logs,running,timer,peak,tradeCount,wins;
  const fmt=n=>Number(n).toFixed(2);
  const signed=n=>(n>=0?"+":"")+fmt(n);
  function reset(){stop();price=1;history=Array(40).fill(1);logs=[];peak=100;tradeCount=0;wins=0;agents=names.map((name,i)=>({name,description:descriptions[i],cash:START_PER_AGENT,units:0,entry:0,realized:0,trades:0,wins:0,signal:0}));render();draw();$("statusText").textContent="Остановлен";$("statusDot").parentElement.classList.remove("running");}
  function stop(){running=false;if(timer)clearInterval(timer);timer=null;}
  function equity(){return agents.reduce((s,a)=>s+a.cash+a.units*price,0);}
  function step(){
    const momentum=history[history.length-1]-history[Math.max(0,history.length-6)];
    const noise=(Math.random()-.49)*.035;
    price=Math.max(.25,price*(1+noise+momentum*.12));
    history.push(price);if(history.length>90)history.shift();
    const recent=history.slice(-12),mean=recent.reduce((a,b)=>a+b,0)/recent.length;
    const vol=Math.abs(price-mean)/mean;
    agents.forEach((a,i)=>{
      const m=momentum/Math.max(.0001,price),dev=(price-mean)/mean;
      let score=[m*12,-dev*10,(price>Math.max(...recent.slice(0,-1))?1:-.5),m*8,-m*8,(Math.random()-.5)*1.5,m*3,vol*18*(Math.random()-.5),-dev*12,(m-dev)*5][i];
      a.signal=score;
      if(a.units===0&&score>(i===6?0.9:0.45)&&a.cash>1){
        const spend=a.cash*(i===6?.18:i===5?.35:.28),units=spend/price;
        a.cash-=spend;a.units+=units;a.entry=price;a.trades++;tradeCount++;
        addLog(a.name,"BUY",price,0);
      }else if(a.units>0&&(score<-.25||price>a.entry*1.035||price<a.entry*.965)){
        const proceeds=a.units*price,profit=proceeds-a.units*a.entry;
        a.cash+=proceeds;a.units=0;a.realized+=profit;a.entry=0;a.trades++;tradeCount++;if(profit>0){a.wins++;wins++;}
        addLog(a.name,"SELL",price,profit);
      }
    });
    const eq=equity();peak=Math.max(peak,eq);render();draw();
  }
  function addLog(agent,action,p,pnl){logs.unshift({time:new Date().toLocaleTimeString("ru-RU"),agent,action,price:p,pnl});logs=logs.slice(0,60);}
  function render(){
    const eq=equity(),pnl=eq-START_CAPITAL,dd=(peak-eq)/peak*100;
    $("equity").textContent=fmt(eq);$("pnl").textContent=signed(pnl);$("pnl").className=pnl>=0?"positive":"negative";
    $("pnlPct").textContent=signed(pnl/START_CAPITAL*100)+"%";$("trades").textContent=tradeCount;
    $("winrate").textContent="Закрытых плюсовых: "+wins;$("drawdown").textContent=fmt(dd)+"%";$("price").textContent=price.toFixed(4);
    $("agents").innerHTML=agents.map(a=>{const val=a.cash+a.units*price,pl=val-START_PER_AGENT;return '<div class="agent"><div class="agent-top"><span>'+a.name+'</span><span class="balance">'+fmt(val)+'</span></div><small>'+a.description+' · '+(a.units?"В позиции":"Без позиции")+' · P/L '+signed(pl)+'</small><div class="bar"><span style="width:'+Math.max(0,Math.min(100,val/START_PER_AGENT*50))+'%"></span></div></div>';}).join("");
    $("journal").innerHTML=logs.length?logs.map(l=>'<tr><td>'+l.time+'</td><td>'+l.agent+'</td><td>'+l.action+'</td><td>'+l.price.toFixed(4)+'</td><td class="'+(l.pnl>=0?"positive":"negative")+'">'+signed(l.pnl)+'</td></tr>').join(""):'<tr><td colspan="5" class="empty">Пока нет сделок. Запусти симуляцию.</td></tr>';
  }
  function draw(){
    const c=$("chart"),ctx=c.getContext("2d"),w=c.clientWidth||600,h=150,dpr=window.devicePixelRatio||1;
    c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
    const min=Math.min(...history)*.99,max=Math.max(...history)*1.01,range=max-min||1;
    ctx.strokeStyle="#263650";ctx.lineWidth=1;for(let y=25;y<h;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    ctx.beginPath();history.forEach((v,i)=>{const x=i/(history.length-1)*w,y=h-12-(v-min)/range*(h-24);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle="#f5c76b";ctx.lineWidth=2;ctx.stroke();
  }
  $("startBtn").addEventListener("click",()=>{if(running)return;running=true;$("statusText").textContent="Работает";$("statusDot").parentElement.classList.add("running");timer=setInterval(step,850);});
  $("pauseBtn").addEventListener("click",()=>{stop();$("statusText").textContent="Пауза";$("statusDot").parentElement.classList.remove("running");});
  $("resetBtn").addEventListener("click",reset);
  $("clearLogBtn").addEventListener("click",()=>{logs=[];render();});
  window.addEventListener("resize",draw);
  reset();
})();