// Calendário do ciclo (status por dia) e gráfico de saldo diário.
const SVG_NS="http://www.w3.org/2000/svg";
function shortBalance(minutes) { return (minutes>0 ? "+" : minutes<0 ? "−" : "")+Math.floor(Math.abs(minutes)/60)+":"+String(Math.abs(minutes)%60).padStart(2,"0"); }
function pt(date) { return date.split("-").reverse().join("/"); }
function svgNode(name,attributes={}) {
  const node=document.createElementNS(SVG_NS,name);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
  return node;
}
function renderCalendar() {
  const grid=$("#calendar-grid"), chart=$("#balance-chart"), range=selectedRange();
  grid.replaceChildren(); chart.replaceChildren();
  if (!range) { $("#balance-chart-caption").textContent="Período inválido."; return; }
  const byDate=new Map(filteredRecords().map((record)=>[record.date,record]));
  const first=new Date(range.from+"T12:00:00"), last=new Date(range.to+"T12:00:00");
  const dates=[];
  for (const day=new Date(first); day<=last && dates.length<400; day.setDate(day.getDate()+1)) dates.push(localDate(day));
  for (let index=0; index<first.getDay(); index++) { const pad=document.createElement("span"); pad.className="calendar-pad"; grid.append(pad); }
  const today=localDate(), series=[];
  dates.forEach((date,index)=>{
    const record=byDate.get(date), calc=record ? calculate(record) : null, weekday=new Date(date+"T12:00:00").getDay();
    const button=document.createElement("button");
    button.type="button"; button.dataset.date=date;
    button.className="calendar-day"+(record ? " calendar-day--"+record.type : " calendar-day--empty")+(weekday===0 || weekday===6 ? " calendar-day--weekend" : "")+(date===today ? " calendar-day--today" : "");
    const number=document.createElement("span"); number.className="calendar-day__n";
    number.textContent=Number(date.slice(8))+(index===0 || date.endsWith("-01") ? " "+new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{ month:"short" }).replace(".","") : "");
    button.append(number);
    if (calc) {
      const value=document.createElement("span");
      value.className="calendar-day__v"+(calc.balance>0 ? " calendar-day__v--positive" : calc.balance<0 ? " calendar-day__v--negative" : "");
      value.textContent=shortBalance(calc.balance);
      button.append(value);
      series.push({ date,balance:calc.balance });
    }
    button.setAttribute("aria-label",number.textContent+(calc ? " "+shortBalance(calc.balance) : "")+", "+pt(date)+(record ? ", "+TYPES[record.type]+", saldo "+signed(calc.balance) : ", sem registro; ativar para registrar"));
    grid.append(button);
  });
  renderBalanceChart(chart,series);
}
function renderBalanceChart(chart,series) {
  const caption=$("#balance-chart-caption");
  chart.parentElement.hidden=series.length===0;
  if (!series.length) return;
  const width=600, height=140, mid=height/2, room=mid-16, maxAbs=Math.max(60,...series.map((item)=>Math.abs(item.balance)));
  const slot=width/series.length, barWidth=Math.min(16,slot*0.7);
  chart.append(svgNode("line",{ class:"chart-axis",x1:0,y1:mid,x2:width,y2:mid }));
  series.forEach((item,index)=>{
    const barHeight=Math.max(2,Math.abs(item.balance)/maxAbs*room), x=index*slot+(slot-barWidth)/2;
    const bar=svgNode("rect",{ class:"chart-bar "+(item.balance>0 ? "chart-bar--positive" : item.balance<0 ? "chart-bar--negative" : "chart-bar--zero"),x:x.toFixed(1),y:(item.balance>=0 ? mid-barHeight : mid).toFixed(1),width:barWidth.toFixed(1),height:barHeight.toFixed(1),rx:2 });
    const title=svgNode("title"); title.textContent=pt(item.date)+": "+signed(item.balance);
    bar.append(title); chart.append(bar);
  });
  const best=series.reduce((a,b)=>b.balance>a.balance ? b : a), worst=series.reduce((a,b)=>b.balance<a.balance ? b : a);
  const summary="Maior saldo: "+signed(best.balance)+" em "+pt(best.date).slice(0,5)+"; menor: "+signed(worst.balance)+" em "+pt(worst.date).slice(0,5)+".";
  caption.textContent="Saldo por dia (acima da linha: positivo; abaixo: negativo). "+summary;
  chart.setAttribute("aria-label","Saldo por dia. "+summary);
}
$("#calendar-grid").addEventListener("click",(event)=>{
  const cell=event.target.closest("[data-date]"); if (!cell) return;
  const record=records.find((item)=>item.date===cell.dataset.date);
  if (record) { editRecord(record.id); return; }
  resetForm(); setTimeout(()=>{ $("#work-date").value=cell.dataset.date; updateForecast(); },0); focusNewRecord();
});
