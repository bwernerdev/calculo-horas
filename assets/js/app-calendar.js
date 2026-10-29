// Calendário do ciclo (status e pendências), previsão para zerar, evolução por ciclo e gráfico de saldo diário.
const SVG_NS="http://www.w3.org/2000/svg";
let calendarFocusDate="";
function pt(date) { return date.split("-").reverse().join("/"); }
function monthShort(date) { return new Date(date+"T12:00:00").toLocaleDateString("pt-BR",{ month:"short" }).replace(".",""); }
function svgNode(name,attributes={}) {
  const node=document.createElementNS(SVG_NS,name);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
  return node;
}
function renderCalendar() {
  const grid=$("#calendar-grid"), range=selectedRange();
  const hadFocus=grid.contains(document.activeElement);
  const focusDate=hadFocus ? document.activeElement.dataset.date : calendarFocusDate;
  grid.replaceChildren(); $("#balance-chart").replaceChildren();
  if (!range) { $("#balance-chart-caption").textContent="Período inválido."; $("#pending-count").hidden=true; renderForecast(); renderCycleHistory(); return; }
  const today=localDate();
  const model=HoursInsights.calendarModel(range,new Map(filteredRecords().map((record)=>[record.date,record])),today);
  const tabDate=model.days.some((day)=>day.date===focusDate) ? focusDate : model.days.find((day)=>day.isToday)?.date || model.days.find((day)=>day.record)?.date || model.days[0]?.date;
  for (let index=0; index<model.leadingBlanks; index++) { const pad=document.createElement("span"); pad.className="calendar-pad"; grid.append(pad); }
  const series=[];
  model.days.forEach((entry,index)=>{
    const record=entry.record, calc=record ? calculate(record) : null;
    const button=document.createElement("button");
    button.type="button"; button.dataset.date=entry.date; button.tabIndex=entry.date===tabDate ? 0 : -1;
    button.className="calendar-day"+(record ? " calendar-day--"+record.type : " calendar-day--empty")+(entry.weekday===0 || entry.weekday===6 ? " calendar-day--weekend" : "")+(entry.isToday ? " calendar-day--today" : "")+(entry.pending ? " calendar-day--pending" : "");
    const number=document.createElement("span"); number.className="calendar-day__n";
    number.textContent=entry.day+(index===0 || entry.day===1 ? " "+monthShort(entry.date) : "");
    button.append(number);
    if (calc) {
      const value=document.createElement("span");
      value.className="calendar-day__v"+(calc.balance>0 ? " calendar-day__v--positive" : calc.balance<0 ? " calendar-day__v--negative" : "");
      value.textContent=HoursInsights.shortBalance(calc.balance);
      button.append(value);
      series.push({ date:entry.date,balance:calc.balance });
    }
    button.setAttribute("aria-label",number.textContent+(calc ? " "+HoursInsights.shortBalance(calc.balance) : "")+", "+pt(entry.date)+(record ? ", "+TYPES[record.type]+", saldo "+signed(calc.balance) : entry.pending ? ", dia útil sem registro; ativar para registrar" : ", sem registro; ativar para registrar"));
    grid.append(button);
  });
  const pending=model.days.filter((day)=>day.pending).length, chip=$("#pending-count");
  chip.hidden=pending===0; chip.textContent=pending+(pending===1 ? " pendência" : " pendências");
  if (hadFocus) grid.querySelector(`[data-date="${tabDate}"]`)?.focus();
  renderBalanceChart($("#balance-chart"),series);
  renderForecast();
  renderCycleHistory();
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
function renderForecast() {
  const element=$("#cycle-forecast");
  element.hidden=true;
  const range=selectedRange();
  if (historyRange || !range) return;
  const list=filteredRecords();
  const remaining=HoursInsights.remainingWorkdays(range,new Set(list.map((record)=>record.date)),localDate());
  const balance=HoursCalculator.summarize(list,settings.target).balance;
  const forecast=HoursInsights.forecastToZero({ balance,remainingDays:remaining.length,targetMinutes:settings.target,maxMinutes:MAX_DAILY_WORK_MINUTES });
  if (!forecast) return;
  const days=forecast.remainingDays+(forecast.remainingDays===1 ? " dia útil" : " dias úteis");
  element.textContent=balance===0 ? `Faltam ${days}: mantenha ${duration(settings.target)} por dia.`
    : forecast.exceedsLimit ? `Faltam ${days}: zerar exigiria mais de ${duration(MAX_DAILY_WORK_MINUTES)} por dia.`
    : balance<0 ? `Faltam ${days}: trabalhe ${duration(forecast.workedPerDay)} por dia para zerar.`
    : `Faltam ${days}: com ${duration(forecast.workedPerDay)} por dia você ainda fecha em zero.`;
  element.title="Considera dias úteis (segunda a sexta) sem registro até o fim do ciclo; feriados não são descontados.";
  element.hidden=false;
}
function renderCycleHistory() {
  const svg=$("#cycle-history-chart"), labels=$("#cycle-history-labels");
  svg.replaceChildren(); labels.replaceChildren();
  const items=HoursInsights.cycleBalances(records,(list)=>HoursCalculator.summarize(list,settings.target).balance,HoursCycle,12);
  $("#cycle-history").hidden=items.length<2;
  if (items.length<2) return;
  const width=600, height=150, top=10, bottom=10, plot=height-top-bottom;
  const maxPositive=Math.max(60,...items.map((item)=>item.balance)), maxNegative=Math.max(60,...items.map((item)=>-item.balance)), span=maxPositive+maxNegative;
  const zero=top+plot*maxPositive/span, slot=width/items.length, barWidth=Math.min(36,slot*0.6);
  svg.append(svgNode("line",{ class:"chart-axis",x1:0,y1:zero,x2:width,y2:zero }));
  items.forEach((item,index)=>{
    const barHeight=Math.max(2,Math.abs(item.balance)/span*plot), x=index*slot+(slot-barWidth)/2;
    const bar=svgNode("rect",{ class:"chart-bar "+(item.balance>0 ? "chart-bar--positive" : item.balance<0 ? "chart-bar--negative" : "chart-bar--zero"),x:x.toFixed(1),y:(item.balance>=0 ? zero-barHeight : zero).toFixed(1),width:barWidth.toFixed(1),height:barHeight.toFixed(1),rx:3 });
    const title=svgNode("title"); title.textContent="Ciclo fechado em "+monthShort(item.month+"-01")+"/"+item.month.slice(2,4)+": "+signed(item.balance)+" ("+item.days+" registro(s))";
    bar.append(title); svg.append(bar);
    const label=document.createElement("span");
    const month=document.createElement("strong"), value=document.createElement("small");
    month.textContent=monthShort(item.month+"-01")+"/"+item.month.slice(2,4);
    value.textContent=HoursInsights.shortBalance(item.balance);
    value.className=item.balance>0 ? "value-pos" : item.balance<0 ? "value-neg" : "";
    label.append(month,value); labels.append(label);
  });
  const best=items.reduce((a,b)=>b.balance>a.balance ? b : a), worst=items.reduce((a,b)=>b.balance<a.balance ? b : a);
  $("#cycle-history-caption").textContent="Saldo de cada ciclo fechado. Melhor: "+signed(best.balance)+" ("+best.month+"); pior: "+signed(worst.balance)+" ("+worst.month+").";
  svg.setAttribute("aria-label",$("#cycle-history-caption").textContent);
}
$("#calendar-grid").addEventListener("focusin",(event)=>{ if (event.target.dataset?.date) calendarFocusDate=event.target.dataset.date; });
$("#calendar-grid").addEventListener("keydown",(event)=>{
  const cells=[...$("#calendar-grid").querySelectorAll("[data-date]")], index=cells.indexOf(document.activeElement);
  if (index<0) return;
  const step={ ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7 }[event.key];
  const next=step!==undefined ? index+step : event.key==="Home" ? 0 : event.key==="End" ? cells.length-1 : null;
  if (next===null) return;
  event.preventDefault();
  const target=cells[Math.max(0,Math.min(cells.length-1,next))];
  cells[index].tabIndex=-1; target.tabIndex=0; target.focus();
});
$("#calendar-grid").addEventListener("click",(event)=>{
  const cell=event.target.closest("[data-date]"); if (!cell) return;
  const record=records.find((item)=>item.date===cell.dataset.date);
  if (record) { editRecord(record.id); return; }
  resetForm(); setTimeout(()=>{ $("#work-date").value=cell.dataset.date; updateForecast(); },0); focusNewRecord();
});
