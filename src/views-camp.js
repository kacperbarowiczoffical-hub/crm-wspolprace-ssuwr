import { S, V, A, $, esc, fold, todayISO, addDays, fmtDay, emailsIn, igHandle, socialUrl, toast, copyText, STAGES, STAGES_UI, stageGroup, STAGE, CH, SECTORS, VARS, PRESETS,
  isAdmin, isLead, ledTeams, teamMembers, inTeamScope, pname, pfirst, go, refresh, refreshNow, openModal, closeLayer, optList, peopleOpts, stagePill, chTag,
  updateFirm, setTarget, allTpls, tplById, sb, dbErr, pathPrompt, parsePathAnswer } from './core.js';
import { campRow, pathHTML, tState, catsFor, promptModal } from './views-work.js';

/* ================= KAMPANIE ================= */
V.kampanie = {
  html(){ return `<div class="vhead"><div><h1>Kampanie</h1><p class="sub">Projekty mailingowe ze ścieżkami kontaktu. Każdy krok może łączyć kilka kanałów naraz, np. e-mail i Instagram.</p></div>${isLead() ? `<button class="btn pri" data-go="nowa">+ Nowa kampania</button>` : ''}</div><div class="list" id="kList"></div>`; },
  parts:{ kList(){
    const cs = [...S.camps.values()].sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
    if (!cs.length) return `<div class="empty">Nie ma jeszcze kampanii.${isLead() ? ' <a href="#" data-go="nowa">Utwórz pierwszą</a>' : ' Kampanie tworzą liderzy zespołów.'}</div>`;
    const lab = {active:'Aktywne', paused:'Wstrzymane', done:'Zakończone'};
    return ['active','paused','done'].map(st => { const g = cs.filter(c => c.status === st); return g.length ? `<h3>${lab[st]} (${g.length})</h3>` + g.map(campRow).join('') : ''; }).join('');
  } }
};
function canManage(c){ return isAdmin() || c.created_by === S.me.id || (c.team_id && S.teams.get(c.team_id) && S.teams.get(c.team_id).leader_id === S.me.id); }
V.kampania = {
  nav:'kampanie',
  html(){
    const c = S.camps.get(S.arg); if (!c) return `<div class="empty">Nie znaleziono kampanii. <a href="#" data-go="kampanie">Wróć</a></div>`;
    S.ui.kf = S.ui.kf || {who:'', st:''};
    const team = c.team_id && S.teams.get(c.team_id), m = canManage(c);
    return `<div class="vhead"><div><a href="#" data-go="kampanie" class="hint">← Kampanie</a><h1>${esc(c.name)}</h1><p class="sub">${esc(c.goal || '')}</p><p class="hint">${team ? 'Zespół: ' + esc(team.name) + ' · ' : ''}start ${esc(fmtDay(c.start_date))} · utworzył(a) ${esc(pname(c.created_by))}</p></div>
      ${m ? `<div class="row">${c.status === 'active' ? `<button class="btn" data-act="campStatus" data-s="paused">Wstrzymaj</button>` : c.status === 'paused' ? `<button class="btn" data-act="campStatus" data-s="active">Wznów</button>` : ''}${c.status !== 'done' ? `<button class="btn" data-act="campStatus" data-s="done">Zakończ</button>` : `<button class="btn" data-act="campStatus" data-s="active">Otwórz ponownie</button>`}<button class="btn" data-act="campAdd">+ Dodaj firmy</button><button class="btn" data-act="campEdit">Edytuj treści</button></div>` : ''}</div>
      <div class="grid g4" id="kKpi"></div>
      <div class="box"><h3>Ścieżka kontaktu</h3><div id="kSteps" class="steps"></div></div>
      <div class="box"><div class="row between"><h3>Firmy w kampanii</h3><div class="row"><select id="kWho" style="width:auto"></select><select id="kSt" style="width:auto">${optList([['','Wszystkie stany'],['active','W toku'],['waiting','Czeka na odpowiedź'],['replied','Odpowiedzieli'],['stopped','Zamknięte']], S.ui.kf.st)}</select></div></div>
        <div class="tw"><table class="t"><thead><tr><th>Firma</th><th>Prowadzi</th><th>Stan</th><th>Etap firmy</th><th></th></tr></thead><tbody id="kRows"></tbody></table></div></div>`;
  },
  parts:{
    kKpi(){
      const c = S.camps.get(S.arg); if (!c) return '';
      const ts = [...(S.targets.get(c.id) || new Map()).values()], st = s => ts.filter(t => { const f = S.firms.get(t.firm_id); return f && f.stage === s; }).length;
      const rep = ts.filter(t => t.state === 'replied').length, started = ts.filter(t => (t.step||0) > 0 || t.state !== 'active').length;
      return [[ts.length,'firm w kampanii'],[started,'po pierwszym kontakcie'],[`${rep}${started ? ` (${Math.round(rep/started*100)}%)` : ''}`,'odpowiedzi'],[`${st('wspolpraca')} / ${st('odmowa')}`,'współprace / odmowy']].map(([v,l]) => `<div class="box kpi"><b>${v}</b><span>${l}</span></div>`).join('');
    },
    kSteps(){
      const c = S.camps.get(S.arg); if (!c) return ''; const ts = [...(S.targets.get(c.id) || new Map()).values()];
      return (c.steps||[]).map((s,i) => `<div class="step"><div class="row between"><span><span class="stepno">KROK ${i+1} · DZIEŃ ${s.day}</span> <b>${esc(s.label||'')}</b> ${s.channels.map(ch => chTag(ch) + esc(CH[ch].l)).join(' ')}</span><span class="hint">czeka: ${ts.filter(t => t.state === 'active' && (t.step||0) === i).length} · wykonane: ${ts.filter(t => (t.step||0) > i || (t.state !== 'active' && (t.step||0) >= i)).length}</span></div>${s.subject ? `<div class="hint">Temat: ${esc(s.subject)}</div>` : ''}</div>`).join('');
    },
    kRows(){
      const c = S.camps.get(S.arg); if (!c) return ''; const kf = S.ui.kf, m = canManage(c);
      const ts = [...(S.targets.get(c.id) || new Map()).values()].filter(t => (!kf.who || t.assignee === kf.who) && (!kf.st || t.state === kf.st)).sort((a,b) => (a.due||'').localeCompare(b.due||''));
      if (!ts.length) return `<tr><td colspan="5" class="hint">Brak firm dla tych filtrów.</td></tr>`;
      const team = c.team_id && S.teams.get(c.team_id), ids = team ? teamMembers(team) : null;
      return ts.slice(0, 500).map(t => { const f = S.firms.get(t.firm_id); if (!f) return '';
        return `<tr><td><a href="#" data-act="openFirm" data-id="${esc(f.id)}">${esc(f.name)}</a>${pathHTML(c,t)}</td><td>${esc(pname(t.assignee))}</td><td>${esc(tState(t))}</td><td>${stagePill(f)}</td>
          <td>${t.state === 'active' && t.assignee === S.me.id ? `<button class="btn sm pri" data-act="doStep" data-c="${esc(c.id)}" data-f="${esc(f.id)}">Kontakt</button>` : ''}${m ? ` <select class="reassign" data-f="${esc(f.id)}" aria-label="Przypisz" style="width:auto;padding:3px 6px;font-size:12px">${peopleOpts(t.assignee, 'przypisz…', ids)}</select>` : ''}</td></tr>`; }).join('');
    }
  },
  after(){
    const kf = S.ui.kf, w = $('kWho'); if (!w) return;
    w.innerHTML = `<option value="">Wszyscy</option>` + [...new Set([...(S.targets.get(S.arg) || new Map()).values()].map(t => t.assignee).filter(Boolean))].map(id => `<option value="${esc(id)}"${kf.who===id?' selected':''}>${esc(pname(id))}</option>`).join('');
    w.addEventListener('input', () => { kf.who = w.value; refreshNow(); });
    $('kSt').addEventListener('input', () => { kf.st = $('kSt').value; refreshNow(); });
    $('kRows').addEventListener('change', e => { const s = e.target.closest('.reassign'); if (s && s.value) { setTarget(S.arg, s.dataset.f, {assignee:s.value}); updateFirm(s.dataset.f, {owner_id:s.value}); toast('Przypisano – osoba prowadzi całą firmę'); } });
  }
};
A.campStatus = async el => { const { error } = await sb.from('campaigns').update({status:el.dataset.s}).eq('id', S.arg); if (error) return dbErr(error); S.camps.get(S.arg).status = el.dataset.s; go('kampania', S.arg); toast('Zapisano'); };
A.campAdd = () => { S.ui.nc = null; go('nowa', S.arg); };
A.campEdit = () => {
  const c = S.camps.get(S.arg); S.ui.ce = JSON.parse(JSON.stringify(c.steps || []));
  openModal(`<div class="row"><h2>Treści · ${esc(c.name)}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="field"><label class="lbl" for="ceGoal">Co proponujemy ({{cel}})</label><textarea id="ceGoal" rows="3">${esc(c.goal||'')}</textarea></div>
    ${S.ui.ce.map((s,i) => `<div class="step"><span class="stepno">KROK ${i+1} · DZIEŃ ${s.day} · ${s.channels.map(ch => esc(CH[ch].l)).join(' + ')}</span>
      ${s.channels.includes('email') ? `<input type="text" id="ceS${i}" value="${esc(s.subject||'')}" placeholder="Temat"><textarea id="ceB${i}" rows="6" placeholder="Treść maila">${esc(s.body||'')}</textarea>` : ''}
      ${s.channels.some(ch => CH[ch].kind === 'dm') ? `<textarea id="ceD${i}" rows="3" placeholder="Wiadomość w social mediach">${esc(s.dm||'')}</textarea>` : ''}
      ${s.channels.some(ch => CH[ch].kind === 'call') ? `<textarea id="ceP${i}" rows="4" placeholder="Skrypt rozmowy">${esc(s.script||'')}</textarea>` : ''}</div>`).join('')}
    <div class="row"><button class="btn pri" data-act="saveCampEdit">Zapisz</button></div>`);
};
A.saveCampEdit = async () => {
  const steps = S.ui.ce.map((s,i) => Object.assign(s, {subject:$('ceS'+i) ? $('ceS'+i).value : s.subject, body:$('ceB'+i) ? $('ceB'+i).value : s.body, dm:$('ceD'+i) ? $('ceD'+i).value : s.dm, script:$('ceP'+i) ? $('ceP'+i).value : s.script}));
  const { error } = await sb.from('campaigns').update({goal:$('ceGoal').value.trim(), steps}).eq('id', S.arg); if (error) return dbErr(error);
  Object.assign(S.camps.get(S.arg), {goal:$('ceGoal').value.trim(), steps}); closeLayer(); go('kampania', S.arg); toast('Zapisano treści');
};

/* ================= KREATOR ================= */
function ncState(){
  if (S.ui.nc && S.ui.nc.forCamp === (S.arg || null)) return S.ui.nc;
  const base = S.arg && S.camps.get(S.arg), teams = ledTeams();
  S.ui.nc = {forCamp:S.arg || null, name: base ? base.name : '', goal: base ? base.goal : '', start: todayISO(), perDay:8,
    team: base ? (base.team_id || '') : (teams[0] ? teams[0].id : ''), steps: JSON.parse(JSON.stringify(base ? base.steps : PRESETS.standard.steps)),
    f:{scope:true, sec:'', cat:'', z:'', stages:['nowa','wyslano','pozniej'], need:'any', excl:true, free:true, q:''}, removed:new Set(), people:null, mode:'owner'};
  return S.ui.nc;
}
function ncTeam(){ const n = S.ui.nc; return n.team ? S.teams.get(n.team) : null; }
function ncAudience(){
  const n = S.ui.nc, f = n.f, team = ncTeam();
  const busy = new Set(); if (f.excl) for (const [cid, m] of S.targets){ const c = S.camps.get(cid); if (c && c.status === 'active') for (const [fid, t] of m) if (t.state === 'active' || t.state === 'waiting') busy.add(fid); }
  const inThis = n.forCamp ? new Set((S.targets.get(n.forCamp) || new Map()).keys()) : new Set();
  const q = fold(f.q).trim().split(/\s+/).filter(Boolean);
  return S.list.filter(x => (!f.scope || !team || inTeamScope(x, team)) && (!f.sec || x.sector === f.sec) && (!f.cat || x.category === f.cat) && (!f.z || x.reach === f.z) && f.stages.includes(stageGroup(x.stage))
    && (f.need !== 'email' || emailsIn(x.email).length) && (f.need !== 'social' || x.instagram || x.facebook || x.tiktok) && (f.need !== 'any' || emailsIn(x.email).length || x.instagram || x.facebook || x.phone)
    && (!f.free || !x.owner_id || (team && teamMembers(team).includes(x.owner_id))) && !busy.has(x.id) && !inThis.has(x.id) && !n.removed.has(x.id) && q.every(w => x._t.includes(w)));
}
function ncPeople(){ const n = S.ui.nc, team = ncTeam(); const ids = team ? teamMembers(team) : [S.me.id]; if (!n.people || n.peopleTeam !== n.team) { n.people = new Set(ids); n.peopleTeam = n.team; } return ids; }
V.nowa = {
  nav:'kampanie',
  html(){
    if (!isLead()) return `<div class="empty">Kampanie tworzą liderzy zespołów i administratorzy.</div>`;
    const n = ncState(), adding = !!n.forCamp, teams = ledTeams();
    return `<div class="vhead"><div><a href="#" ${adding ? `data-go="kampania" data-arg="${esc(n.forCamp)}"` : 'data-go="kampanie"'} class="hint">← ${adding ? 'Kampania' : 'Kampanie'}</a><h1>${adding ? 'Dodaj firmy do kampanii' : 'Nowa kampania'}</h1><p class="sub">${adding ? esc(n.name) : 'Cel, ścieżka kontaktu, firmy i ludzie. Każda osoba prowadzi swoje firmy w całości – mailem i w social mediach.'}</p></div></div>
      ${adding ? '' : `<div class="box"><h3>1 · Podstawy</h3><div class="fgrid">
        <div class="field full"><label class="lbl" for="ncName">Nazwa projektu</label><input type="text" id="ncName" value="${esc(n.name)}" placeholder="np. Hear me Out vol. 3 – partnerzy nagród"></div>
        <div class="field full"><label class="lbl" for="ncGoal">Co proponujemy firmie ({{cel}} w wiadomościach)</label><textarea id="ncGoal" rows="3" placeholder="np. Szukamy partnerów nagród do konkursu na wydarzeniu dla studentów. W zamian: logo na plakatach, oznaczenie w relacjach i stoisko na miejscu.">${esc(n.goal)}</textarea></div>
        <div class="field"><label class="lbl" for="ncTeamSel">Zespół</label><select id="ncTeamSel">${isAdmin() ? '<option value="">— bez zespołu (cała komisja) —</option>' : ''}${optList(teams.map(t => [t.id, t.name]), n.team)}</select></div>
      </div></div>
      <div class="box"><h3>2 · Jak kontaktujemy firmy</h3><div id="ncPathSum"></div>
        <details class="more"><summary>Zmień kroki i treści wiadomości</summary>
        <div class="row"><select id="ncPreset" style="width:auto"><option value="">Wczytaj gotową ścieżkę…</option>${optList(Object.entries(PRESETS).map(([k,p]) => [k, p.l]), '')}</select><button class="btn" data-act="ncPrompt">✦ Prompt do AI na treści</button></div>
        <div class="vars">${VARS.map(v => `<code data-act="insVar" data-v="${v}" title="Wstaw w ostatnio edytowane pole">{{${v}}}</code>`).join('')}</div>
        <div class="steps" id="ncSteps"></div><button class="btn" data-act="ncAddStep">+ Dodaj krok</button></details></div>`}
      <div class="box"><h3>${adding ? '1' : '3'} · Firmy</h3>
        <label class="chk"><input type="checkbox" id="naScope" ${n.f.scope ? 'checked' : ''}> tylko kategorie zespołu <span class="hint" id="naScopeInfo"></span></label>
        <details class="more"><summary>Zawęź firmy (sektor, kategoria, etap, kontakt)</summary>
        <div class="filters">
          <div class="field"><label class="lbl" for="naQ">Szukaj</label><input type="search" id="naQ" value="${esc(n.f.q)}" placeholder="nazwa, kategoria, adres…"></div>
          <div class="field"><label class="lbl" for="naSec">Sektor</label><select id="naSec"><option value="">Wszystkie</option>${optList(SECTORS.map(s => [s,s]), n.f.sec)}</select></div>
          <div class="field"><label class="lbl" for="naCat">Kategoria</label><select id="naCat"></select></div>
          <div class="field"><label class="lbl" for="naZ">Zasięg</label><select id="naZ">${optList([['','Wszędzie'],['Wrocław','Wrocław'],['Polska','Ogólnopolskie']], n.f.z)}</select></div>
          <div class="field"><label class="lbl" for="naNeed">Wymagany kontakt</label><select id="naNeed">${optList([['any','jakikolwiek'],['email','ma e-mail'],['social','ma social media'],['','bez wymagań']], n.f.need)}</select></div>
        </div>
        <div class="row" id="naStages">${STAGES_UI.map(s => `<label class="chip"><input type="checkbox" value="${s.id}" ${n.f.stages.includes(s.id) ? 'checked' : ''}> ${esc(s.l)}</label>`).join('')}</div>
        <label class="chk"><input type="checkbox" id="naExcl" ${n.f.excl ? 'checked' : ''}> pomiń firmy w toku w innej aktywnej kampanii</label>
        <label class="chk"><input type="checkbox" id="naFree" ${n.f.free ? 'checked' : ''}> pomiń firmy prowadzone przez osoby spoza zespołu</label>
        </details>
        <div class="row between"><b id="naCount"></b><span class="hint">„×” wyklucza firmę.</span></div>
        <div id="naList" class="list" style="max-height:420px;overflow-y:auto"></div></div>
      <div class="box"><h3>${adding ? '2' : '4'} · Ludzie i tempo</h3>
        <div class="row" id="ncPeople"></div>
        <details class="more"><summary>Tempo i podział firm</summary><div class="fgrid">
          <div class="field"><label class="lbl" for="ncMode">Podział firm</label><select id="ncMode">${optList([['owner','Kto już prowadzi firmę, ten ją dostaje; resztę po równo'],['even','Po równo między wybranych']], n.mode)}</select></div>
          <div class="field"><label class="lbl" for="ncPer">Nowych firm dziennie na osobę</label><input type="number" id="ncPer" min="1" max="100" value="${n.perDay}"></div>
          <div class="field"><label class="lbl" for="ncStart">Start</label><input type="date" id="ncStart" value="${esc(n.start)}"></div>
        </div>
        </details><p class="hint">Każda osoba dostaje kilka nowych firm dziennie i prowadzi każdą z nich w całości (mail + social media).</p></div>
      <div class="row"><button class="btn pri" id="ncBtn" data-act="ncCreate">${adding ? 'Dodaj firmy' : 'Utwórz kampanię'}</button><span class="hint" id="ncProg"></span></div>`;
  },
  parts:{
    ncSteps(){
      const n = S.ui.nc; if (!n || n.forCamp) return '';
      return n.steps.map((s,i) => `<div class="step">
        <div class="row between"><span class="stepno">KROK ${i+1}</span><button class="btn sm ghost danger" data-act="ncDelStep" data-i="${i}">Usuń krok</button></div>
        <div class="fgrid"><div class="field"><label class="lbl">Dzień od startu</label><input type="number" min="0" max="90" value="${s.day}" data-sf="day" data-i="${i}"></div>
        <div class="field"><label class="lbl">Nazwa kroku</label><input type="text" value="${esc(s.label||'')}" data-sf="label" data-i="${i}"></div></div>
        <div class="row">${Object.entries(CH).map(([k,v]) => `<label class="chip"><input type="checkbox" data-ch="${k}" data-i="${i}" ${s.channels.includes(k) ? 'checked' : ''}> ${esc(v.l)}</label>`).join('')}</div>
        ${s.channels.includes('email') ? `<div class="field"><label class="lbl">E-mail – temat</label><input type="text" value="${esc(s.subject||'')}" data-sf="subject" data-i="${i}"></div><div class="field"><label class="lbl">E-mail – treść</label><textarea rows="7" data-sf="body" data-i="${i}">${esc(s.body||'')}</textarea></div>` : ''}
        ${s.channels.some(c => CH[c].kind === 'dm') ? `<div class="field"><label class="lbl">Wiadomość w social mediach</label><textarea rows="3" data-sf="dm" data-i="${i}">${esc(s.dm||'')}</textarea></div>` : ''}
        ${s.channels.some(c => CH[c].kind === 'call') ? `<div class="field"><label class="lbl">Skrypt rozmowy / wizyty</label><textarea rows="5" data-sf="script" data-i="${i}">${esc(s.script||'')}</textarea></div>` : ''}
      </div>`).join('');
    },
    ncPathSum(){ const n = S.ui.nc; if (!n || n.forCamp) return ''; return `<div class="path big">${n.steps.map(st => `<span>Dzień ${st.day}: ${st.channels.map(c => esc(CH[c].l)).join(' + ')}</span>`).join('→')}</div>`; },
    ncPeople(){
      const n = S.ui.nc; if (!n) return ''; const ids = ncPeople();
      return ids.length ? ids.map(id => `<label class="chip"><input type="checkbox" data-person="${esc(id)}" ${n.people.has(id) ? 'checked' : ''}> ${esc(pname(id))}</label>`).join('') : `<span class="hint">W zespole nie ma jeszcze ludzi – dodaj ich w zakładce Struktura.</span>`;
    },
    naList(){
      const rows = ncAudience(), team = ncTeam();
      if ($('naCount')) $('naCount').textContent = `${rows.length} firm`;
      if ($('naScopeInfo')) $('naScopeInfo').textContent = team ? `(${[...(team.sectors||[]), ...(team.categories||[])].join(', ') || 'zespół nie ma jeszcze kategorii'})` : '';
      return rows.length ? rows.slice(0, 150).map(f => `<div class="row between" style="border-bottom:1px solid var(--line);padding:5px 0"><span><b>${esc(f.name)}</b> <span class="hint">${esc(f.category||'')} · ${esc(STAGE[f.stage].l)}${emailsIn(f.email).length ? ' · e-mail' : ''}${igHandle(f) ? ' · IG' : ''}${f.owner_id ? ' · prowadzi ' + esc(pfirst(f.owner_id)) : ''}</span></span><button class="btn sm ghost" data-act="naRemove" data-id="${esc(f.id)}" aria-label="Wyklucz">×</button></div>`).join('') + (rows.length > 150 ? `<p class="hint">…i ${rows.length - 150} więcej</p>` : '') : `<div class="empty">Żadna firma nie pasuje – poluzuj filtry.</div>`;
    }
  },
  after(){
    const n = S.ui.nc; if (!n || !$('naQ')) return;
    const fillCat = () => { $('naCat').innerHTML = `<option value="">Wszystkie</option>` + optList(catsFor($('naSec').value).map(c => [c,c]), n.f.cat); };
    fillCat();
    const upd = () => { Object.assign(n.f, {q:$('naQ').value, sec:$('naSec').value, cat:$('naCat').value, z:$('naZ').value, need:$('naNeed').value, excl:$('naExcl').checked, free:$('naFree').checked, scope:$('naScope').checked, stages:[...document.querySelectorAll('#naStages input:checked')].map(i => i.value)}); $('naList').innerHTML = V.nowa.parts.naList(); };
    ['naQ','naCat','naZ','naNeed','naExcl','naFree','naScope'].forEach(id => $(id).addEventListener('input', upd));
    $('naSec').addEventListener('input', () => { n.f.cat = ''; fillCat(); upd(); });
    $('naStages').addEventListener('change', upd);
    $('ncPeople').addEventListener('change', e => { const c = e.target.closest('[data-person]'); if (c) { if (c.checked) n.people.add(c.dataset.person); else n.people.delete(c.dataset.person); } });
    if ($('ncName')){
      $('ncName').addEventListener('input', e => n.name = e.target.value);
      $('ncGoal').addEventListener('input', e => n.goal = e.target.value);
      $('ncTeamSel').addEventListener('input', e => { n.team = e.target.value; $('ncPeople').innerHTML = V.nowa.parts.ncPeople(); upd(); });
      $('ncPreset').addEventListener('input', e => { const p = PRESETS[e.target.value]; if (!p) return; n.steps = JSON.parse(JSON.stringify(p.steps)); $('ncSteps').innerHTML = V.nowa.parts.ncSteps(); $('ncPathSum').innerHTML = V.nowa.parts.ncPathSum(); e.target.value = ''; });
      const st = $('ncSteps');
      st.addEventListener('input', e => { const el = e.target, i = +el.dataset.i; if (el.dataset.sf) n.steps[i][el.dataset.sf] = el.dataset.sf === 'day' ? Math.max(0, +el.value || 0) : el.value; if (el.dataset.sf === 'day') $('ncPathSum').innerHTML = V.nowa.parts.ncPathSum(); });
      st.addEventListener('change', e => { const el = e.target; if (el.dataset.ch) { const s = n.steps[+el.dataset.i]; s.channels = el.checked ? [...new Set([...s.channels, el.dataset.ch])] : s.channels.filter(c => c !== el.dataset.ch); if (!s.channels.length) s.channels = ['email']; st.innerHTML = V.nowa.parts.ncSteps(); $('ncPathSum').innerHTML = V.nowa.parts.ncPathSum(); } });
      st.addEventListener('focusin', e => { if (e.target.matches('textarea,input[type=text]')) S.ui.lastField = e.target; });
    }
    $('ncMode').addEventListener('input', e => n.mode = e.target.value);
    $('ncPer').addEventListener('input', e => n.perDay = Math.max(1, +e.target.value || 8));
    $('ncStart').addEventListener('input', e => n.start = e.target.value || todayISO());
  }
};
A.insVar = el => { const f = S.ui.lastField; if (!f) { toast('Kliknij najpierw w pole treści'); return; } const v = `{{${el.dataset.v}}}`, s = f.selectionStart ?? f.value.length; f.value = f.value.slice(0,s) + v + f.value.slice(f.selectionEnd ?? s); f.dispatchEvent(new Event('input', {bubbles:true})); f.focus(); };
A.ncAddStep = () => { const n = S.ui.nc, last = n.steps[n.steps.length-1]; n.steps.push({day: last ? last.day + 4 : 0, channels:['email','ig'], label:'Kolejny kontakt', subject:'', body:'', dm:'', script:''}); $('ncSteps').innerHTML = V.nowa.parts.ncSteps(); $('ncPathSum').innerHTML = V.nowa.parts.ncPathSum(); };
A.ncDelStep = el => { const n = S.ui.nc; if (n.steps.length < 2) { toast('Ścieżka musi mieć co najmniej jeden krok'); return; } n.steps.splice(+el.dataset.i, 1); $('ncSteps').innerHTML = V.nowa.parts.ncSteps(); $('ncPathSum').innerHTML = V.nowa.parts.ncPathSum(); };
A.naRemove = el => { S.ui.nc.removed.add(el.dataset.id); $('naList').innerHTML = V.nowa.parts.naList(); };
A.ncPrompt = () => {
  const n = S.ui.nc; if (!n.goal.trim()) { toast('Najpierw opisz, co proponujemy firmie.'); return; }
  const back = () => { closeLayer(); };
  promptModal('Prompt do AI – treści całej ścieżki', pathPrompt(n.name, n.goal, n.steps), 'Wklej tutaj całą odpowiedź AI', ans => {
    const r = parsePathAnswer(ans); let hit = 0;
    r.forEach((x, i) => { const st = n.steps[i]; if (!st || !x) return; if (x.subject) st.subject = x.subject; if (x.body) st.body = x.body; if (x.dm) st.dm = x.dm; if (x.script) st.script = x.script; hit++; });
    closeLayer(); $('ncSteps').innerHTML = V.nowa.parts.ncSteps();
    toast(hit ? `Wstawiono treści do ${hit} kroków – przeczytaj je przed startem` : 'Nie rozpoznałem formatu odpowiedzi – wklej treści ręcznie');
  }, back);
};
A.ncCreate = async el => {
  const n = S.ui.nc, rows = ncAudience(); ncPeople();
  const people = [...n.people].filter(id => S.profiles.has(id));
  if (!n.forCamp && !n.name.trim()) { toast('Nadaj kampanii nazwę.'); return; }
  if (!rows.length) { toast('Wybierz co najmniej jedną firmę.'); return; }
  if (!people.length) { toast('Zaznacz osoby, które będą prowadzić firmy.'); return; }
  el.disabled = true; let cid = n.forCamp;
  if (!cid){
    const steps = n.steps.map(s => ({day:+s.day||0, channels:s.channels, label:s.label||'', subject:s.subject||'', body:s.body||'', dm:s.dm||'', script:s.script||''})).sort((a,b) => a.day - b.day);
    const { data, error } = await sb.from('campaigns').insert({name:n.name.trim(), goal:n.goal.trim(), steps, team_id:n.team || null, start_date:n.start, created_by:S.me.id}).select().single();
    if (error) { el.disabled = false; return dbErr(error, 'campaign'); }
    S.camps.set(data.id, data); cid = data.id;
  }
  const load = Object.fromEntries(people.map(id => [id, 0])); let rr = 0;
  const targets = [], owners = [];
  for (const f of rows){
    let who = n.mode === 'owner' && f.owner_id && people.includes(f.owner_id) ? f.owner_id : null;
    if (!who) { who = people[rr % people.length]; rr++; }
    const day = Math.floor(load[who] / Math.max(1, n.perDay)); load[who]++;
    targets.push({campaign_id:cid, firm_id:f.id, assignee:who, step:0, due:addDays(n.start || todayISO(), day), state:'active'});
    if (f.owner_id !== who) owners.push([f.id, who, f.stage]);
  }
  for (let i = 0; i < targets.length; i += 200){
    const { error } = await sb.from('campaign_targets').upsert(targets.slice(i, i + 200), {onConflict:'campaign_id,firm_id'});
    if (error) { el.disabled = false; return dbErr(error, 'targets'); }
    $('ncProg').textContent = `Zapisuję… ${Math.min(i + 200, targets.length)}/${targets.length}`;
  }
  if (!S.targets.has(cid)) S.targets.set(cid, new Map()); targets.forEach(t => S.targets.get(cid).set(t.firm_id, t));
  const byOwner = {}; owners.forEach(([fid, who, stage]) => { const k = who + '|' + stage; (byOwner[k] = byOwner[k] || []).push(fid); });
  for (const k in byOwner){ const [who, stage] = k.split('|'); const ids = byOwner[k];
    for (let i = 0; i < ids.length; i += 200){ const { error } = await sb.from('firms').update({owner_id:who, stage}).in('id', ids.slice(i, i + 200)); if (error) dbErr(error, 'owners'); }
    ids.forEach(id => { const f = S.firms.get(id); if (f) { f.owner_id = who; f.stage = stage; } }); }
  S.ui.nc = null; toast(`Gotowe – ${rows.length} firm w kampanii`); go('kampania', cid);
};

/* ================= SZABLONY ================= */
V.szablony = {
  nav:'wiecej',
  html(){ return `<div class="vhead"><div><h1>Szablony</h1><p class="sub">Gotowe treści maili, wiadomości w social mediach i rozmów. Zmienne w {{nawiasach}} podstawiają się same.</p></div><button class="btn pri" data-act="tplNew">+ Nowy szablon</button></div>
    <div class="vars">${VARS.map(v => `<code>{{${v}}}</code>`).join('')}</div><div class="list" id="tList"></div>`; },
  parts:{ tList(){
    const L = {email:'E-mail', dm:'Social media', call:'Telefon / wizyta'};
    return allTpls().map(t => `<div class="card"><div class="top"><span class="name"><span class="chan">${esc(L[t.channel] || t.channel)}</span>${esc(t.name)}</span><span class="row">${t.builtin ? '<span class="pill s-">wbudowany</span>' : `<span class="hint">${esc(pfirst(t.created_by))}</span>`}
      ${t.builtin ? `<button class="btn sm" data-act="tplEdit" data-id="${esc(t.id)}" data-copy="1">Duplikuj</button>` : (t.created_by === S.me.id || isAdmin() ? `<button class="btn sm" data-act="tplEdit" data-id="${esc(t.id)}">Edytuj</button>` : '')}<button class="btn sm ghost" data-act="tplCopy" data-id="${esc(t.id)}">Kopiuj</button></span></div>
      ${t.subject ? `<div class="hint">Temat: ${esc(t.subject)}</div>` : ''}<div class="note">${esc(t.body.slice(0, 480))}${t.body.length > 480 ? '…' : ''}</div></div>`).join('');
  } }
};
A.tplCopy = el => { const t = tplById(el.dataset.id); copyText((t.subject ? 'Temat: ' + t.subject + '\n\n' : '') + t.body); };
A.tplNew = () => tplForm({channel:'email', name:'', subject:'', body:''}, null);
A.tplEdit = el => { const t = tplById(el.dataset.id); tplForm(el.dataset.copy ? Object.assign({}, t, {name:t.name + ' (kopia)'}) : t, el.dataset.copy ? null : t.id); };
function tplForm(t, id){
  S.ui.tf = id;
  openModal(`<div class="row"><h2>${id ? 'Edytuj szablon' : 'Nowy szablon'}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="fgrid"><div class="field"><label class="lbl" for="tfName">Nazwa</label><input type="text" id="tfName" value="${esc(t.name)}"></div>
    <div class="field"><label class="lbl" for="tfCh">Rodzaj</label><select id="tfCh">${optList([['email','E-mail'],['dm','Social media'],['call','Telefon / wizyta']], t.channel)}</select></div>
    <div class="field full"><label class="lbl" for="tfSubj">Temat (e-mail)</label><input type="text" id="tfSubj" value="${esc(t.subject||'')}"></div>
    <div class="field full"><label class="lbl" for="tfBody">Treść</label><textarea id="tfBody" rows="12">${esc(t.body||'')}</textarea></div></div>
    <div class="row"><button class="btn pri" data-act="tplSave">Zapisz</button>${id ? `<button class="btn danger" data-act="tplDel" style="margin-left:auto">Usuń</button>` : ''}</div>`);
}
A.tplSave = async () => {
  const body = {name:$('tfName').value.trim() || 'Bez nazwy', channel:$('tfCh').value, subject:$('tfSubj').value, body:$('tfBody').value};
  const q = S.ui.tf ? sb.from('templates').update(body).eq('id', S.ui.tf).select().single() : sb.from('templates').insert(body).select().single();
  const { data, error } = await q; if (error) return dbErr(error);
  S.tpls.set(data.id, data); closeLayer(); refreshNow(); toast('Zapisano szablon');
};
A.tplDel = async () => { const { error } = await sb.from('templates').delete().eq('id', S.ui.tf); if (error) return dbErr(error); S.tpls.delete(S.ui.tf); closeLayer(); refreshNow(); toast('Usunięto'); };
