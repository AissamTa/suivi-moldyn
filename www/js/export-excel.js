/* ═══════════════════════════════════════════════════════════════
   export-excel.js — GÉNÉRATION DU FICHIER EXCEL

   ⛔  NE PAS MODIFIER SANS DEMANDE EXPLICITE.

   La mise en page reproduit le modèle de l'entreprise :
   position des cellules, fusions, bordures, hauteurs de ligne,
   police Calibri, titre rouge. Toute retouche ici change le
   fichier reçu par la production.

   Disposition :
     A1:K1   titre       « MOLDYN technical plastic maroc »
     A2..A5  en-tête     Date / Mat / Shift / PROCESS
     L6      colonnes    1h..8h (C..J) + TOTAL (K)
     L7+     références  une ligne par réf, minimum 6 lignes
     bas-g.  légende     codes d'arrêt numérotés (ordre = config.CODES)
     bas-d.  COMMENTAIRE 1H..8H

   Dépendances : ExcelJS (chargé dans index.html), frDate() de utils.js,
                 MOLDYN_CONFIG.CODES, toast() de app.js.

   Modifications autorisées à ce jour (2 seulement) :
     · date écrite en JJ/MM/AAAA au lieu de l'ISO
     · commentaire de l'opérateur ajouté après la durée
       « ATT VALIDATION 30 min - Scanner ma kay9rach »
   ═══════════════════════════════════════════════════════════════ */

async function exportEntry(entry){
  try{
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Feuil1', { views:[{ rightToLeft:false, showGridLines:false }] });

    ws.columns = [
      { width: 5 }, { width: 15 },
      { width: 9 },{ width: 9 },{ width: 9 },{ width: 9 },
      { width: 9 },{ width: 9 },{ width: 9 },{ width: 9 },
      { width: 11 }
    ];

    const thin = { style:'thin', color:{argb:'FF161d24'} };
    const allBorders = { top:thin, left:thin, bottom:thin, right:thin };
    const centered = { vertical:'middle', horizontal:'center', wrapText:true };

    function styleCell(cell, opts={}){
      cell.border = allBorders;
      cell.alignment = opts.alignment || centered;
      cell.font = Object.assign({ name:'Calibri', size:11 }, opts.font||{});
      if(opts.fill) cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:opts.fill} };
    }

    ws.mergeCells('A1:K1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'MOLDYN technical plastic maroc';
    styleCell(titleCell, { font:{ bold:false, size:16, color:{argb:'FFCC0000'} } });
    ws.getRow(1).height = 26;

    function headerRow(rowNum, label, value, boldLabel){
      ws.mergeCells(`A${rowNum}:B${rowNum}`);
      ws.mergeCells(`C${rowNum}:K${rowNum}`);
      const lc = ws.getCell(`A${rowNum}`);
      lc.value = label;
      styleCell(lc, { font:{ bold:true, size: boldLabel? 14:12 } });
      const vc = ws.getCell(`C${rowNum}`);
      vc.value = value;
      styleCell(vc, { font:{ size:12 } });
      ws.getRow(rowNum).height = 20;
    }
    headerRow(2, 'Date', frDate(entry.date), false);
    headerRow(3, 'Mat', entry.mat||'', true);
    headerRow(4, 'Shift', entry.shift||'', false);
    headerRow(5, 'PROCESS', entry.process||'', false);

    ws.mergeCells('A6:B6');
    styleCell(ws.getCell('A6'), { font:{ bold:true, size:10 } });
    const hourCols = ['C','D','E','F','G','H','I','J'];
    hourCols.forEach((col,i)=>{
      const c = ws.getCell(`${col}6`);
      c.value = (i+1)+'h';
      styleCell(c, { font:{ bold:true, size:10 } });
    });
    const totalHead = ws.getCell('K6');
    totalHead.value = 'TOTAL';
    styleCell(totalHead, { font:{ bold:true, size:10 } });
    ws.getRow(6).height = 16;

    const refStart = 7;
    const MIN_REF_ROWS = 6;
    const refCount = Math.max(entry.references.length, MIN_REF_ROWS);
    entry.references.forEach((r, i)=>{
      const row = refStart + i;
      const total = r.hours.reduce((s,v)=> s+(parseFloat(v)||0), 0);
      const refCell = ws.getCell(`B${row}`);
      refCell.value = r.ref;
      styleCell(refCell, { font:{ size:11 } });
      hourCols.forEach((col,h)=>{
        const c = ws.getCell(`${col}${row}`);
        const v = r.hours[h];
        c.value = v===''? null : Number(v);
        styleCell(c, { font:{ size:11 } });
      });
      const totalCell = ws.getCell(`K${row}`);
      totalCell.value = total;
      styleCell(totalCell, { font:{ bold:true, size:13 } });
      ws.getRow(row).height = 32;
    });
    for(let i=entry.references.length; i<refCount; i++){
      const row = refStart + i;
      const cellsInRow = ['B', ...hourCols, 'K'];
      cellsInRow.forEach(col=>{
        const c = ws.getCell(`${col}${row}`);
        styleCell(c, { font:{ size:11 } });
      });
      ws.getRow(row).height = 32;
    }
    ws.mergeCells(`A${refStart}:A${refStart+refCount-1}`);
    const refLabelCell = ws.getCell(`A${refStart}`);
    refLabelCell.value = 'References'.split('').join('\n');
    styleCell(refLabelCell, { font:{ bold:true, size:10 }, alignment:{ vertical:'middle', horizontal:'center', wrapText:true } });

    const sectionStart = refStart + refCount + 1;

    CODES.forEach((code, i)=>{
      const row = sectionStart + i;
      ws.mergeCells(`B${row}:D${row}`);
      const numCell = ws.getCell(`A${row}`);
      numCell.value = i+1;
      styleCell(numCell, { font:{ size:11 } });
      const txtCell = ws.getCell(`B${row}`);
      txtCell.value = code;
      styleCell(txtCell, { font:{ size:11 }, alignment:{ vertical:'middle', horizontal:'center' } });
      ws.getRow(row).height = 20;
    });

    ws.mergeCells(`F${sectionStart}:K${sectionStart}`);
    const commTitle = ws.getCell(`F${sectionStart}`);
    commTitle.value = 'COMMENTAIRE';
    commTitle.font = { bold:true, size:15, name:'Calibri' };
    commTitle.alignment = { vertical:'middle', horizontal:'center' };

    for(let h=1; h<=8; h++){
      const row = sectionStart + h;
      const c = entry.comments[h] || {};
      // "ATT VALIDATION 30 min - Scanner ma kay9rach"
      let text = c.code ? (c.code + (c.mins ? ' ' + c.mins + ' min' : '')) : '';
      if(c.note && c.note.trim()) text = text ? (text + ' - ' + c.note.trim()) : c.note.trim();
      const hCell = ws.getCell(`F${row}`);
      hCell.value = h+'H';
      hCell.font = { bold:true, size:13, name:'Calibri' };
      hCell.alignment = { vertical:'middle', horizontal:'center' };
      ws.mergeCells(`G${row}:K${row}`);
      const txtCell = ws.getCell(`G${row}`);
      txtCell.value = text;
      txtCell.font = { size:11, name:'Calibri' };
      txtCell.alignment = { vertical:'middle', horizontal:'left' };
      ws.getRow(row).height = 20;
    }

    const filename = `Suivi_Production_${entry.date}_${entry.shift}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url = URL.createObjectURL(blob);
    document.getElementById('dl-text').textContent = filename;
    const link = document.getElementById('dl-link');
    link.href = url; link.download = filename;
    document.getElementById('dl').style.display = 'flex';
    document.querySelector('.tab[data-tab="fiche"]').click();
    toast('Fichier prêt en haut de la page');
  }catch(err){
    console.error('Export failed', err);
    toast('Échec de la génération du fichier');
  }
}
