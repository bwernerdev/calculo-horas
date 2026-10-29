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
  const regularFontId=3+pages.length*2, boldFontId=regularFontId+1, objects=[];
  objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds=pages.map((_,index)=>3+index*2); objects[2]=`<< /Type /Pages /Kids [${pageIds.map((id)=>`${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  const text=(value,x,y,size=9,font="F1",color="0.10 0.15 0.24")=>`BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfText(value)}) Tj ET`;
  const fill=(x,y,width,height,color)=>`${color} rg ${x} ${y} ${width} ${height} re f`;
  const line=(x1,y1,x2,y2,color="0.86 0.89 0.94")=>`${color} RG ${x1} ${y1} m ${x2} ${y2} l S`;
  pages.forEach((page,index)=>{
    const pageId=3+index*2, contentId=pageId+1;
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