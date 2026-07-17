async function exportExcel(entry) {
  try {
    const filename = "Suivi_Production_" + entry.date + "_" + entry.shift + ".xlsx";
    const buffer = await wb.xlsx.writeBuffer();

    const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

    
    if (isNative) {
      const { Filesystem, Directory } = window.Capacitor.Plugins;
      const { Share } = window.Capacitor.Plugins;
      const base64Data = arrayBufferToBase64(buffer);
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });
      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: 'حفظ / مشاركة الملف'
      });
      toast('الملف جاهز - اختار فين تحفظو');
    } else {
      const blob = new Blob([buffer], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url = URL.createObjectURL(blob);
      document.getElementById('dl-text').textContent = filename;
      const link = document.getElementById('dl-link');
      link.href = url; link.download = filename;
      document.getElementById('dl').style.display = 'flex';
      toast('Fichier prêt en haut de la page');
    }

    document.querySelector('.tab[data-tab="fiche"]').click();
  } catch(err) {
    console.error('Export failed', err);
    toast('Échec de la génération du fichier');
  }
}
  
