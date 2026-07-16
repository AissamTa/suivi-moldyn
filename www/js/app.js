/* ═══════════════════════════════════════════════════════════════
   app.js — Logique de l'application

   Ce fichier tient l'état de la fiche en cours et l'affichage.
   Il ne contient ni la génération Excel (export-excel.js) ni le
   stockage (storage.js) ni les réglages (config.js).

   État :
     refs         [{ ref, hours[8] }]
     comments     { 1..8 : { code, mins, note } }
     editingId    fiche en cours de modification, sinon null
     localEntries fiches connues de cette session

   Chargement : config -> utils -> storage -> export-excel -> update -> app
   ═══════════════════════════════════════════════════════════════ */

let refs = [];
let comments = {};
let editingId = null;
let localEntries = [];

function newRef(){ return { ref:'', hours: Array(NB_H).fill('') }; }
function defaultComments(){
  const o = {};
  for(let h=1; h<=NB_H; h++) o[h] = {code:'', mins:'', note:''};
  return o;
}
const refTotal = r => r.hours.reduce((s,v)=> s+(parseFloat(v)||0), 0);
const grandTotal = () => refs.reduce((s,r)=> s+refTotal(r), 0);
const stopTotal = () => Object.values(comments).reduce((s,c)=> s+(parseInt(c.mins)||0), 0);

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.classList.remove('show'), 2600);
}

// ─── Confirmation ──────────────────────────────────────────────
// Remplace window.confirm() natif : selon le contexte d'exécution
// (aperçu encapsulé, certains WebView), la boîte de dialogue native
// peut être bloquée silencieusement — le bouton semble alors ne
// plus rien faire. Cette feuille maison ne dépend que du DOM.
let _cfResolve = null;

function askConfirm(message){
  document.getElementById('cf-msg').textContent = message;
  document.getElementById('cf').classList.add('open');
  return new Promise(resolve => { _cfResolve = resolve; });
}

function closeConfirm(result){
  document.getElementById('cf').classList.remove('open');
  if(_cfResolve){ const r = _cfResolve; _cfResolve = null; r(result); }
}

function initConfirm(){
  document.getElementById('cf-yes').addEventListener('click', ()=> closeConfirm(true));
  document.getElementById('cf-no').addEventListener('click', ()=> closeConfirm(false));
  document.getElementById('cf-backdrop').addEventListener('click', ()=> closeConfirm(false));
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && document.getElementById('cf').classList.contains('open')) closeConfirm(false);
  });
}

// ─── Onglets ───────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const t = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b=> b.classList.toggle('active', b===btn));
    document.getElementById('v-fiche').classList.toggle('active', t==='fiche');
    document.getElementById('v-dash').classList.toggle('active', t==='dash');
    document.getElementById('v-hist').classList.toggle('active', t==='hist');
    document.getElementById('foot').style.display = t==='fiche' ? 'flex' : 'none';
    if(t==='dash') renderDash();
    if(t==='hist') renderHist();
    window.scrollTo({top:0});
  });
});

// ─── Références ────────────────────────────────────────────────
function addRef(){ refs.push(newRef()); renderRefs(); }
function removeRef(i){
  refs.splice(i,1);
  if(refs.length===0) refs.push(newRef());
  renderRefs(); updateFoot();
}

function renderRefs(){
  const list = document.getElementById('ref-list');
  list.innerHTML = refs.map((r,i)=>`
    <div class="ref">
      <div class="ref-head">
        <input class="ref-name" type="text" value="${esc(r.ref)}" data-i="${i}"
               placeholder="RÉFÉRENCE ${i+1}" autocomplete="off">
        <div class="sig" data-sig="${i}">Σ ${refTotal(r)}</div>
        <button class="iconbtn" data-rep="${i}" aria-label="Répartir un total sur les heures">🪄</button>
        <button class="iconbtn danger" data-del="${i}" aria-label="Retirer la référence ${i+1}">🗑</button>
      </div>
      <div class="hours">
        ${r.hours.map((v,h)=>`
          <div class="hcell">
            <div class="hlab">${h+1}H</div>
            <input type="number" inputmode="numeric" value="${esc(v)}" data-r="${i}" data-h="${h}"
                   aria-label="Référence ${i+1}, heure ${h+1}">
          </div>`).join('')}
      </div>
    </div>`).join('');

  list.querySelectorAll('.ref-name').forEach(inp=>{
    inp.addEventListener('input', e=>{ refs[+e.target.dataset.i].ref = e.target.value; });
  });
  list.querySelectorAll('.hours input').forEach(inp=>{
    inp.addEventListener('focus', e=> e.target.select());
    inp.addEventListener('input', e=>{
      const i = +e.target.dataset.r;
      refs[i].hours[+e.target.dataset.h] = e.target.value;
      const sig = list.querySelector(`[data-sig="${i}"]`);
      if(sig) sig.textContent = 'Σ ' + refTotal(refs[i]);
      updateFoot();
    });
  });
  list.querySelectorAll('[data-rep]').forEach(b=>{
    b.addEventListener('click', ()=> ouvrirRepartition(+b.dataset.rep));
  });
  list.querySelectorAll('[data-del]').forEach(b=>{
    b.addEventListener('click', ()=> removeRef(+b.dataset.del));
  });
}

// ─── Arrêts ────────────────────────────────────────────────────
function renderStops(){
  const list = document.getElementById('stop-list');
  list.innerHTML = '';
  for(let h=1; h<=NB_H; h++){
    const c = comments[h] || {code:'',mins:'',note:''};
    const div = document.createElement('div');
    div.className = 'stop' + (c.code ? ' on' : '');
    div.dataset.h = h;
    div.innerHTML = `
      <div class="stop-head">
        <div class="hbadge">${h}H</div>
        <select class="inp" data-h="${h}" aria-label="Type d'arrêt heure ${h}">
          <option value="">Aucun arrêt</option>
          ${CODES.map(code=>`<option value="${code}" ${c.code===code?'selected':''}>${code}</option>`).join('')}
        </select>
        <input class="inp mins" type="number" inputmode="numeric" data-h="${h}"
               placeholder="min" value="${esc(c.mins)}" aria-label="Durée en minutes heure ${h}">
      </div>
      <input class="inp note" type="text" data-h="${h}" placeholder="Commentaire…"
             value="${esc(c.note)}" aria-label="Commentaire heure ${h}">
    `;
    list.appendChild(div);
  }
  list.querySelectorAll('select').forEach(sel=>{
    sel.addEventListener('change', e=>{
      const h = e.target.dataset.h;
      comments[h].code = e.target.value;
      e.target.closest('.stop').classList.toggle('on', !!e.target.value);
    });
  });
  list.querySelectorAll('.mins').forEach(inp=>{
    inp.addEventListener('focus', e=> e.target.select());
    inp.addEventListener('input', e=>{ comments[e.target.dataset.h].mins = e.target.value; updateFoot(); });
  });
  list.querySelectorAll('.note').forEach(inp=>{
    inp.addEventListener('input', e=>{ comments[e.target.dataset.h].note = e.target.value; });
  });
}

function updateFoot(){
  document.getElementById('f-total').textContent = 'Total : ' + grandTotal() + ' pcs';
  document.getElementById('f-stops').textContent = 'Arrêts : ' + stopTotal() + ' min';
}

// ─── Formulaire ────────────────────────────────────────────────
function resetForm(){
  document.getElementById('f-date').value = todayISO();
  document.getElementById('f-time').value = nowHM();
  document.getElementById('f-shift').value = MOLDYN_CONFIG.SHIFTS[0];
  document.getElementById('f-mat').value = '';
  document.getElementById('f-process').value = MOLDYN_CONFIG.PROCESS[0];
  refs = [newRef()];
  comments = defaultComments();
  editingId = null;
  renderRefs(); renderStops(); updateFoot();
}

async function saveEntry(){
  const date = document.getElementById('f-date').value;
  if(!date){ toast('Ajoute une date pour enregistrer'); return; }
  const cleanRefs = refs.filter(r=> r.ref.trim() !== '');
  if(cleanRefs.length===0){ toast('Ajoute au moins une référence'); return; }

  const id = editingId || uid();
  const entry = {
    id, date,
    heure: document.getElementById('f-time').value,
    mat: document.getElementById('f-mat').value,
    shift: document.getElementById('f-shift').value,
    process: document.getElementById('f-process').value,
    // deepCopy : la fiche enregistrée doit être figée, indépendante du formulaire
    references: deepCopy(cleanRefs),
    comments: deepCopy(comments),
    savedAt: new Date().toISOString()
  };

  const i = localEntries.findIndex(e=> e.id===id);
  if(i>=0) localEntries[i] = entry; else localEntries.push(entry);
  editingId = id;

  try{
    await window.storage.set('entries:'+id, JSON.stringify(entry), true);
    const idx = await getIndex();
    if(!idx.includes(id)){ idx.push(id); await setIndex(idx); }
    toast(window.__memoryOnly ? 'Fiche enregistrée (aperçu — non conservée à la fermeture)'
        : window.__localOnly  ? 'Fiche enregistrée sur cet appareil'
        : 'Fiche enregistrée et partagée');
  }catch(err){
    toast('Enregistrée sur cet appareil (partage indisponible)');
  }
}

async function loadLog(){
  try{
    const idx = await getIndex();
    for(const id of idx){
      if(localEntries.some(e=> e.id===id)) continue;
      try{
        const r = await window.storage.get('entries:'+id, true);
        if(r && r.value) localEntries.push(JSON.parse(r.value));
      }catch(err){}
    }
  }catch(err){}
}

// ─── Tableau de bord ───────────────────────────────────────────
function renderDash(){
  const tot = grandTotal();
  const nRefs = refs.filter(r=> r.ref.trim()!=='').length;
  const hourSums = Array.from({length:NB_H}, (_,h)=>
    refs.reduce((s,r)=> s + (parseFloat(r.hours[h])||0), 0));
  const worked = hourSums.filter(v=> v>0).length;

  document.getElementById('k-tot').innerHTML  = tot + '<small>pcs</small>';
  document.getElementById('k-refs').textContent = nRefs;
  document.getElementById('k-stop').innerHTML = stopTotal() + '<small>min</small>';
  document.getElementById('k-avg').innerHTML  = (worked ? Math.round(tot/worked) : 0) + '<small>pcs</small>';

  const max = Math.max(...hourSums, 1);
  document.getElementById('d-hours').innerHTML = hourSums.map((v,h)=>`
    <div class="bar-row">
      <div class="bl">${h+1}H</div>
      <div class="bar-track"><div class="bar-fill${v?'':' zero'}" style="width:${v? Math.max(3,(v/max)*100):100}%"></div></div>
      <div class="bv">${v}</div>
    </div>`).join('');

  document.getElementById('k-nfiches').textContent = localEntries.length;
  const cumul = localEntries.reduce((s,e)=>
    s + e.references.reduce((ss,r)=> ss + r.hours.reduce((x,v)=> x+(parseFloat(v)||0),0), 0), 0);
  document.getElementById('k-cumul').innerHTML = cumul + '<small>pcs</small>';
}

// ─── Historique ────────────────────────────────────────────────
function renderHist(){
  const box = document.getElementById('hist-list');
  if(localEntries.length===0){
    box.innerHTML = '<div class="empty">Aucune fiche enregistrée.<br>Remplis une fiche et appuie sur Enregistrer.</div>';
    return;
  }
  const list = [...localEntries].sort((a,b)=> (b.date+(b.heure||'')).localeCompare(a.date+(a.heure||'')));
  box.innerHTML = list.map(e=>{
    const t = e.references.reduce((s,r)=> s + r.hours.reduce((x,v)=> x+(parseFloat(v)||0),0), 0);
    return `<div class="h-item">
      <div class="h-top">
        <span class="d">${esc(frDate(e.date))}</span>
        <span class="s">${esc(e.shift||'')} · ${esc(e.mat||'—')} · ${esc(e.process||'')}</span>
        <span class="t">${t} pcs</span>
      </div>
      <div class="pills">${e.references.map(r=>`<span class="pill">${esc(r.ref)}</span>`).join('')}</div>
      <div class="h-acts">
        <button data-ed="${e.id}">Éditer</button>
        <button class="xls" data-xl="${e.id}">Excel</button>
        <button class="del" data-dl="${e.id}">Supprimer</button>
      </div>
    </div>`;
  }).join('');

  box.querySelectorAll('[data-ed]').forEach(b=> b.addEventListener('click', ()=>{
    loadIntoForm(localEntries.find(e=> e.id===b.dataset.ed));
  }));
  box.querySelectorAll('[data-xl]').forEach(b=> b.addEventListener('click', ()=>{
    exportEntry(localEntries.find(e=> e.id===b.dataset.xl));
  }));
  box.querySelectorAll('[data-dl]').forEach(b=> b.addEventListener('click', ()=> deleteEntry(b.dataset.dl)));
}

function loadIntoForm(entry){
  if(!entry) return;
  document.getElementById('f-date').value = entry.date;
  document.getElementById('f-time').value = entry.heure || nowHM();
  document.getElementById('f-mat').value = entry.mat||'';
  document.getElementById('f-shift').value = entry.shift||'Matin';
  document.getElementById('f-process').value = entry.process||'';
  refs = entry.references.map(r=>({ref:r.ref, hours:[...r.hours]}));
  if(refs.length===0) refs=[newRef()];
  comments = {...defaultComments()};
  for(let h=1; h<=NB_H; h++){
    const c = (entry.comments||{})[h];
    if(c) comments[h] = {code:c.code||'', mins:c.mins||'', note:c.note||''};
  }
  editingId = entry.id;
  renderRefs(); renderStops(); updateFoot();
  document.querySelector('.tab[data-tab="fiche"]').click();
  toast('Fiche chargée pour modification');
}

async function deleteEntry(id){
  if(!(await askConfirm("Supprimer cette fiche ?"))) return;
  localEntries = localEntries.filter(e=> e.id!==id);
  renderHist();
  try{
    await window.storage.delete('entries:'+id, true);
    const idx = await getIndex();
    await setIndex(idx.filter(x=> x!==id));
    toast('Fiche supprimée');
  }catch(err){ toast('Supprimée sur cet appareil'); }
}

// ─── Menus alimentés par config.js ─────────────────────────────
// Ajouter une machine ou un shift = éditer config.js, rien d'autre.
function remplirMenus(){
  document.getElementById('f-shift').innerHTML =
    MOLDYN_CONFIG.SHIFTS.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  document.getElementById('f-process').innerHTML =
    MOLDYN_CONFIG.PROCESS.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
}

// ─── Démarrage ─────────────────────────────────────────────────
document.getElementById('add-ref').addEventListener('click', addRef);
document.getElementById('save').addEventListener('click', saveEntry);
document.getElementById('cancel').addEventListener('click', async ()=>{
  if(await askConfirm('Vider la fiche en cours ?')){ resetForm(); toast('Fiche vidée'); }
});
document.getElementById('dl-close').addEventListener('click', ()=>{
  document.getElementById('dl').style.display = 'none';
});
document.getElementById('yr').textContent = new Date().getFullYear();
document.getElementById('ver').textContent = MOLDYN_CONFIG.VERSION;

remplirMenus();
initRepartition();
initConfirm();
resetForm();
loadLog();

// Service worker : uniquement sur le web en http(s).
// Dans l'APK Capacitor les fichiers sont déjà embarqués : un cache
// par-dessus n'apporte rien et risquerait de servir une version
// périmée après une mise à jour de l'application.
if('serviceWorker' in navigator && location.protocol.startsWith('http') && !isNativeApp()){
  navigator.serviceWorker.register('./sw.js').catch(()=>{ /* hors ligne indisponible, sans incidence */ });
}

// Vérification des mises à jour, sans bloquer l'affichage
setTimeout(()=>{ checkForUpdate().catch(()=>{}); }, 2500);
