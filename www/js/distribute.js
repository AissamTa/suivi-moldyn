/* ═══════════════════════════════════════════════════════════════
   distribute.js — Bouton 🪄 : répartir un total sur les heures

   Principe : ne rien redemander de ce qui est déjà saisi.

     · case remplie (0 compris) → valeur gardée telle quelle
     · case vide                → recalculée

   « 4000 en tout, mais 3H a eu une pause, j'ai fait 200 » :
   taper 200 dans 3H, laisser le reste vide, appuyer sur 🪄, entrer
   4000. Les 7 cases vides se partagent 3800.

   « 5H n'a pas tourné » : taper 0 dans 5H — elle est gardée à 0 et
   sort d'elle-même du partage.

   Le total est toujours exactement respecté : le reste de la division
   est distribué une unité à la fois sur les premières heures libres.
   Aucune pièce n'est perdue ni inventée.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Calcule la répartition.
 *
 * @param {number}   total  Total à atteindre, toutes heures confondues.
 * @param {string[]} hours  Les 8 cases actuelles ('' = libre).
 * @returns {{hours:string[], libres:number, gardees:number[], reste:number, deficit:boolean}}
 */
function calculerRepartition(total, hours){
  const sortie  = hours.slice();
  const libres  = [];
  const gardees = [];
  let dejaPose  = 0;

  hours.forEach((v, i) => {
    if (String(v).trim() === ''){
      libres.push(i);
    } else {
      const n = parseFloat(v) || 0;
      dejaPose += n;
      gardees.push(i + 1);
    }
  });

  // Rien à calculer : toutes les cases sont déjà remplies
  if (libres.length === 0){
    return { hours: sortie, libres: 0, gardees, reste: 0, deficit: false };
  }

  // Le total demandé ne couvre même pas les valeurs gardées :
  // on ne retire rien à ce que l'opérateur a saisi, on met les
  // heures libres à 0 et on le signale.
  const reste = Math.round(total) - dejaPose;
  if (reste < 0){
    libres.forEach(i => { sortie[i] = '0'; });
    return { hours: sortie, libres: libres.length, gardees, reste, deficit: true };
  }

  const base = Math.floor(reste / libres.length);
  let rab = reste - base * libres.length;

  libres.forEach(i => {
    sortie[i] = String(base + (rab > 0 ? 1 : 0));
    if (rab > 0) rab--;
  });

  return { hours: sortie, libres: libres.length, gardees, reste, deficit: false };
}

/* ─── Feuille de saisie ──────────────────────────────────────── */

let repartitionRefIdx = null;

function ouvrirRepartition(idx){
  repartitionRefIdx = idx;
  const feuille = document.getElementById('rep');
  const champ   = document.getElementById('rep-total');

  champ.value = '';
  document.getElementById('rep-ref').textContent =
    refs[idx].ref ? refs[idx].ref : `Référence ${idx + 1}`;

  majApercuRepartition();
  feuille.classList.add('open');
  setTimeout(() => champ.focus(), 120);
}

function fermerRepartition(){
  document.getElementById('rep').classList.remove('open');
  repartitionRefIdx = null;
}

function majApercuRepartition(){
  if (repartitionRefIdx === null) return;
  const total = parseFloat(document.getElementById('rep-total').value) || 0;
  const r = calculerRepartition(total, refs[repartitionRefIdx].hours);

  // Ce que l'opérateur doit comprendre avant d'appuyer
  const info = document.getElementById('rep-info');
  if (r.libres === 0){
    info.textContent = 'Toutes les heures sont déjà remplies. Videz une case pour pouvoir répartir.';
    info.className = 'rep-info warn';
  } else if (r.deficit){
    info.textContent = `Les heures saisies totalisent déjà plus que ${total}. Les heures vides resteront à 0.`;
    info.className = 'rep-info warn';
  } else if (r.gardees.length){
    info.textContent = `${r.reste} pcs partagées sur ${r.libres} heure${r.libres>1?'s':''} · ${r.gardees.map(h=>h+'H').join(', ')} gardée${r.gardees.length>1?'s':''}`;
    info.className = 'rep-info';
  } else {
    info.textContent = `${r.reste} pcs partagées sur les ${r.libres} heures`;
    info.className = 'rep-info';
  }

  document.getElementById('rep-preview').innerHTML = r.hours.map((v, h) => {
    const garde = String(refs[repartitionRefIdx].hours[h]).trim() !== '';
    return `<div class="rep-cell${garde ? ' keep' : ''}">
              <span>${h + 1}H</span><b>${esc(v === '' ? '—' : v)}</b>
            </div>`;
  }).join('');

  const somme = r.hours.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  document.getElementById('rep-sum').textContent = `Total après répartition : ${somme} pcs`;
  document.getElementById('rep-go').disabled = (r.libres === 0);
}

function appliquerRepartition(){
  if (repartitionRefIdx === null) return;
  const total = parseFloat(document.getElementById('rep-total').value) || 0;
  const r = calculerRepartition(total, refs[repartitionRefIdx].hours);
  if (r.libres === 0) return;

  refs[repartitionRefIdx].hours = r.hours;
  renderRefs();
  updateFoot();
  fermerRepartition();
  toast(`Réparti sur ${r.libres} heure${r.libres > 1 ? 's' : ''}`);
}

function initRepartition(){
  document.getElementById('rep-total').addEventListener('input', majApercuRepartition);
  document.getElementById('rep-go').addEventListener('click', appliquerRepartition);
  document.getElementById('rep-cancel').addEventListener('click', fermerRepartition);
  document.getElementById('rep-backdrop').addEventListener('click', fermerRepartition);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && repartitionRefIdx !== null) fermerRepartition();
  });
}
