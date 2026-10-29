// Exportação CSV e PDF e download de arquivos.
$("#export-csv").addEventListener("click",()=>{
  const header=["Data","Tipo","Entrada","Saída","Intervalo (min)","Trabalhado","Saldo"];
  const rows=filteredRecords().map((r)=>{ const c=calculate(r); return [r.date,TYPES[r.type],r.start,r.end,r.break,duration(c.worked),signed(c.balance)]; });
  const csv="\uFEFF"+[header,...rows].map((row)=>row.map(escapeCell).join(";")).join("\r\n"); const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); link.download=`horas-${historyFilenameSuffix()}.csv`; link.click(); URL.revokeObjectURL(link.href);
});
function pdfText(value) {
  return String(value).replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)");
}

function buildPdf() {
  const list=filteredRecords();
  const totals=HoursCalculator.summarize(list,targetFor);
  const rows=list.map((record)=>({record,calc:calculate(record)}));
  const pages=[]; let position=0;
  if (!rows.length) pages.push([]);
  while (position<rows.length) { const capacity=pages.length===0 ? 22 : 29; pages.push(rows.slice(position,position+capacity)); position+=capacity; }
  if (rows.length && selectedRange()) pages.push("calendar");
  const regularFontId=3+pages.length*2, boldFontId=regularFontId+1, objects=[];
  objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds=pages.map((_,index)=>3+index*2); objects[2]=`<< /Type /Pages /Kids [${pageIds.map((id)=>`${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  const text=(value,x,y,size=9,font="F1",color="0.10 0.15 0.24")=>`BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(value)}) Tj ET`;
  const fill=(x,y,width,height,color)=>`${color} rg ${x} ${y} ${width} ${height} re f`;
  const line=(x1,y1,x2,y2,color="0.86 0.89 0.94")=>`${color} RG ${x1} ${y1} m ${x2} ${y2} l S`;
  const TYPE_RGB={ trabalho:[49,87,213], folga:[15,118,110], feriado:[160,74,7], ferias:[124,58,237], falta:[180,35,24], compensacao:[71,85,105] };
  const pdfColor=(rgb,alpha=1)=>rgb.map((value)=>((value*alpha+255*(1-alpha))/255).toFixed(3)).join(" ");
  function calendarPageCommands(pageIndex) {
    const range=selectedRange(), today=localDate();
    const model=HoursInsights.calendarModel(range,new Map(list.map((record)=>[record.date,record])),today);
    const commands=[fill(0,760,595,82,"0.12 0.25 0.68"),text("CONTROLE DE JORNADA",42,810,9,"F2","0.76 0.82 1"),text("Calendário do ciclo",42,783,21,"F2","1 1 1"),text(`Período: ${historyPeriodLabel()}`,325,787,7,"F1","0.88 0.91 1")];
    const cellWidth=73, cellHeight=44, gridTop=730;
    ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].forEach((label,column)=>commands.push(text(label,42+column*cellWidth+cellWidth/2-8,gridTop+8,7,"F2","0.38 0.43 0.52")));
    model.days.forEach((entry,index)=>{
      const slot=model.leadingBlanks+index, column=slot%7, row=Math.floor(slot/7);
      const x=42+column*cellWidth, y=gridTop-(row+1)*cellHeight, rgb=entry.record ? TYPE_RGB[entry.record.type] : null;
      commands.push(fill(x+1,y+1,cellWidth-2,cellHeight-2,rgb ? pdfColor(rgb,0.16) : "0.97 0.98 1"),text(String(entry.day),x+6,y+cellHeight-14,8,"F2","0.10 0.15 0.24"));
      if (entry.record) {
        const calc=calculate(entry.record), balanceColor=calc.balance>0 ? "0.02 0.42 0.24" : calc.balance<0 ? "0.70 0.14 0.10" : "0.38 0.43 0.52";
        commands.push(text(TYPES[entry.record.type],x+6,y+8,6.5,"F1",pdfColor(rgb)),text(HoursInsights.shortBalance(calc.balance).replace("−","-"),x+cellWidth-36,y+cellHeight-14,7.5,"F2",balanceColor));
      } else if (entry.pending) commands.push(fill(x+cellWidth-10,y+cellHeight-10,5,5,"0.70 0.14 0.10"));
    });
    const gridRows=Math.ceil((model.leadingBlanks+model.days.length)/7), legendY=gridTop-gridRows*cellHeight-22;
    Object.entries(TYPES).forEach(([key,label],index)=>{ const x=42+index*86; commands.push(fill(x,legendY,8,8,pdfColor(TYPE_RGB[key])),text(label,x+12,legendY,7,"F1","0.24 0.31 0.43")); });
    commands.push(fill(42,legendY-16,5,5,"0.70 0.14 0.10"),text("Dia útil sem registro",54,legendY-16,7,"F1","0.24 0.31 0.43"));
    const series=model.days.filter((entry)=>entry.record).map((entry)=>({ date:entry.date,balance:calculate(entry.record).balance }));
    const chartTop=legendY-52, chartHeight=150, mid=chartTop-chartHeight/2;
    commands.push(text("SALDO POR DIA",42,chartTop+14,9,"F2","0.24 0.31 0.43"),line(42,mid,553,mid,"0.70 0.74 0.80"));
    if (series.length) {
      const maxAbs=Math.max(60,...series.map((item)=>Math.abs(item.balance))), slot=511/series.length, barWidth=Math.min(14,slot*0.7);
      series.forEach((item,index)=>{
        const barHeight=Math.max(1,Math.abs(item.balance)/maxAbs*(chartHeight/2-8)), x=42+index*slot+(slot-barWidth)/2;
        commands.push(fill(x.toFixed(1),(item.balance>=0 ? mid : mid-barHeight).toFixed(1),barWidth.toFixed(1),barHeight.toFixed(1),item.balance>0 ? "0.02 0.42 0.24" : item.balance<0 ? "0.70 0.14 0.10" : "0.60 0.64 0.70"));
      });
      commands.push(text(series[0].date.split("-").reverse().join("/"),42,mid-chartHeight/2-12,7,"F1","0.45 0.49 0.57"),text(series.at(-1).date.split("-").reverse().join("/"),515,mid-chartHeight/2-12,7,"F1","0.45 0.49 0.57"));
    }
    commands.push(line(42,44,553,44),text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} | Meu Banco de Horas`,42,27,7,"F1","0.45 0.49 0.57"),text(`Página ${pageIndex+1} de ${pages.length}`,493,27,7,"F1","0.45 0.49 0.57"));
    return commands;
  }
  pages.forEach((page,index)=>{
    const pageId=3+index*2, contentId=pageId+1;
    if (page==="calendar") {
      const calendarStream=calendarPageCommands(index).join("\n");
      objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId]=`<< /Length ${calendarStream.length} >>\nstream\n${calendarStream}\nendstream`;
      return;
    }
    const commands=[fill(0,760,595,82,"0.12 0.25 0.68"),text("CONTROLE DE JORNADA",42,810,9,"F2","0.76 0.82 1"),text("Relatório de horas",42,783,21,"F2","1 1 1"),text(`Período: ${historyPeriodLabel()}   |   Meta diária: ${duration(settings.target)}`,325,787,7,"F1","0.88 0.91 1")];
    let tableTop;
    if (index===0) {
      const cards=[
        {label:historyRange ? "SALDO DO PERIODO" : "SALDO DO CICLO",value:signed(totals.balance),bg:"0.91 0.93 1",fg:"0.12 0.25 0.68"},
        {label:"HORAS POSITIVAS",value:`+${duration(totals.positive)}`,bg:"0.89 0.97 0.93",fg:"0.02 0.42 0.24"},
        {label:"HORAS NEGATIVAS",value:`-${duration(totals.negative)}`,bg:"1 0.91 0.90",fg:"0.70 0.14 0.10"},
        {label:"TOTAL TRABALHADO",value:duration(totals.worked),bg:"0.95 0.96 0.98",fg:"0.10 0.15 0.24"}
      ];
      cards.forEach((card,cardIndex)=>{ const x=42+cardIndex*130; commands.push(fill(x,675,120,64,card.bg),text(card.label,x+10,719,7,"F2","0.38 0.43 0.52"),text(card.value,x+10,692,14,"F2",card.fg)); });
      tableTop=646;
    } else tableTop=735;
    commands.push(text("REGISTROS DO PERÍODO",42,tableTop+13,9,"F2","0.24 0.31 0.43"));
    const headerY=tableTop-22; commands.push(fill(42,headerY,511,24,"0.12 0.25 0.68"));
    const columns=[42,105,180,230,278,349,439];
    ["Data","Tipo","Entrada","Saída","Intervalo","Trabalhado","Saldo"].forEach((label,column)=>commands.push(text(label,columns[column]+6,headerY+8,7,"F2","1 1 1")));
    let rowY=headerY-23;
    page.forEach(({record,calc},rowIndex)=>{
      if (rowIndex%2===0) commands.push(fill(42,rowY,511,23,"0.97 0.98 1"));
      const values=[record.date.split("-").reverse().join("/"),TYPES[record.type],record.start||"-",record.end||"-",record.type==="trabalho"?`${record.break} min`:"-",duration(calc.worked),signed(calc.balance)];
      values.forEach((value,column)=>{ const balanceColor=column===6 ? (calc.balance>0 ? "0.02 0.42 0.24" : calc.balance<0 ? "0.70 0.14 0.10" : "0.38 0.43 0.52") : "0.16 0.21 0.30"; commands.push(text(value,columns[column]+6,rowY+8,7.5,column===6?"F2":"F1",balanceColor)); });
      commands.push(line(42,rowY,553,rowY)); rowY-=23;
    });
    if (!page.length) commands.push(text(historyRange ? "Nenhum registro no periodo pesquisado." : "Nenhum registro no ciclo selecionado.",42,rowY-12,10,"F1","0.38 0.43 0.52"));
    commands.push(line(42,44,553,44),text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} | Meu Banco de Horas`,42,27,7,"F1","0.45 0.49 0.57"),text(`Página ${index+1} de ${pages.length}`,493,27,7,"F1","0.45 0.49 0.57"));
    const stream=commands.join("\n");
    objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId]=`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[regularFontId]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[boldFontId]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  let pdf="%PDF-1.4\n%âãÏÓ\n"; const offsets=[0];
  for (let id=1;id<objects.length;id++) { offsets[id]=pdf.length; pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref=pdf.length; pdf+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id=1;id<objects.length;id++) pdf+=`${String(offsets[id]).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array([...pdf].map((character)=>character.charCodeAt(0)&255));
}

$("#export-pdf").addEventListener("click",()=>downloadFile(buildPdf(),`relatorio-horas-${historyFilenameSuffix()}.pdf`,"application/pdf"));

function downloadFile(content, filename, type) {
  const link=document.createElement("a"), url=URL.createObjectURL(new Blob([content],{type}));
  link.href=url; link.download=filename; link.hidden=true; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
}
$("#export-xlsx").addEventListener("click",()=>{
  const list=filteredRecords().slice().sort((a,b)=>a.date.localeCompare(b.date));
  const totals=HoursCalculator.summarize(list,targetFor);
  const rows=list.map((record)=>{ const calc=calculate(record); return [{ date:record.date },TYPES[record.type],record.start,record.end,record.type==="trabalho" ? record.break : "",calc.worked,calc.balance,duration(calc.worked),signed(calc.balance)]; });
  rows.push([{ bold:"Total" },"","","","",totals.worked,totals.balance,duration(totals.worked),signed(totals.balance)]);
  const bytes=HoursXlsx.build({ sheetName:"Horas",header:["Data","Tipo","Entrada","Saída","Intervalo (min)","Trabalhado (min)","Saldo (min)","Trabalhado","Saldo"],rows,widths:[12,14,9,9,15,17,12,13,13] },fflate);
  downloadFile(bytes,`horas-${historyFilenameSuffix()}.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});
