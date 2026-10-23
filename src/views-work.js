import { S, V, A, $, esc, enc, fold, keyOf, slug, rid, todayISO, addDays, fmtDay, fmtWhen, dueLabel, emailsIn, igHandle, socialUrl, cityOf, shortUrl,
  toast, copyText, openUrl, STAGES, STAGE, CH, ACTL, OUTCOMES, SECTORS, ROLES, isAdmin, isLead, isActive, myTeams, isMyScope, firmTeams, pname, pfirst, avatarHTML,
  go, refresh, refreshNow, openModal, closeLayer, optList, peopleOpts, stagePill, chTag, updateFirm, insertFirm, logAct, setTarget,
  allTpls, tplById, fillVars, outlookUrl, AI_TOOLS, contactPrompt, parseAiAnswer, sb, dbErr, splitContact } from './core.js';

/* ================= wspólne ================= */
export function myQueue(uid){
  uid = uid === undefined ? S.me.id : uid; const out = [];
  for (const [cid, m] of S.targets){
    const c = S.camps.get(cid); if (!c || c.status !== 'active') continue;
    for (const [fid, t] of m){
      if (t.state !== 'active' || (uid && t.assignee !== uid)) continue;
      const f = S.firms.get(fid); if (!f || f.deleted) continue;
      out.push({c, cid, f, t, step:(c.steps||[])[t.step||0]});
    }
  }
  return out.sort((a,b) => (a.t.due||'').localeCompare(b.t.due||'') || a.f.name.localeCompare(b.f.name,'pl'));
}
V.__badge = () => { const n = S.loaded ? myQueue().filter(x => x.t.due <= todayISO()).length : 0; const b = $('bTodo'); if (b){ b.hidden = !n; b.textContent = n; } };
export function socialLinks(f){
  return ['ig','fb','tiktok','linkedin'].map(ch => { const u = socialUrl(f, ch); return u ? `<a class="soc" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(CH[ch].l)}">${esc(CH[ch].ico)}</a>` : ''; }).join('');
}
export function pathHTML(c, t){
  return `<div class="path">${(c.steps||[]).map((s,i) => {
    const cls = t && (i < (t.step||0) || (t.state !== 'active' && i <= (t.step||0))) ? 'done' : t && i === (t.step||0) && t.state === 'active' ? 'on' : '';
    return `<span class="${cls}">D${s.day} ${s.channels.map(c => esc(CH[c].ico)).join('+')}</span>`; }).join('→')}</div>`;
}
export function tState(t){ return t.state === 'active' ? `krok ${(t.step||0)+1}, termin ${fmtDay(t.due)}` : t.state === 'waiting' ? 'czeka na odpowiedź' : t.state === 'replied' ? 'odpowiedzieli' : 'zamknięta'; }
export function actLine(a, withFirm){
  const f = S.firms.get(a.firm_id), camp = a.campaign_id && S.camps.get(a.campaign_id);
  let what = ACTL[a.type] || a.type;
  if (a.type === 'reply' && a.outcome && STAGE[a.outcome]) what += ' · ' + STAGE[a.outcome].l;
  if (a.type === 'stage' && STAGE[a.to_stage]) what = 'Etap: ' + STAGE[a.to_stage].l;
  let detail = '';
  if ((a.channels||[]).length) detail += `<div>${a.channels.map(c => chTag(c) + esc((CH[c]||{l:c}).l)).join(' ')}</div>`;
  if (a.subject) detail += `<div>${esc(a.subject)}</div>`;
  if (a.summary) detail += `<div class="hint">${esc(a.summary)}</div>`;
  if (a.type === 'reply'){
    const body = S.replies.get(a.id);
    detail += body !== undefined ? `<div class="note">${esc(body)}</div>` : `<div class="hint">Treść odpowiedzi widzi tylko ${esc(pname(a.by))}.</div>`;
    if (a.public_note) detail += `<div class="hint">Notatka: ${esc(a.public_note)}</div>`;
  }
  return `<div class="it">${avatarHTML(a.by)}<div><div><b>${esc(pname(a.by))}</b> · ${esc(what)}${withFirm && f ? ` · <a href="#" data-act="openFirm" data-id="${esc(f.id)}">${esc(f.name)}</a>` : ''}${camp ? ` <span class="hint">(${esc(camp.name)})</span>` : ''}</div>${detail}</div><span class="when">${esc(fmtWhen(a.at))}</span></div>`;
}

/* ================= PULPIT ================= */
V.pulpit = {
  html(){
    return `<div class="vhead"><div><h1>Cześć, ${esc(pfirst(S.me.id))}!</h1><p class="sub">Twoje zadania, kampanie Twoich zespołów i ostatnie kontakty komisji.</p></div>
      <div class="row"><button class="btn" data-go="zadania">Moje zadania</button>${isLead() ? `<button class="btn pri" data-go="nowa">+ Nowa kampania</button>` : ''}</div></div>
      <div class="grid g4" id="pKpi"></div>
      <div class="grid g2">
        <div class="box"><div class="row between"><h3>Aktywne kampanie</h3><a href="#" data-go="kampanie">wszystkie</a></div><div id="pCamps" class="list"></div></div>
        <div class="box"><h3>Komisja – ostatnie 30 dni</h3><div class="grid g2" id="pTeam"></div><h3>Ostatnie kontakty</h3><div class="feed" id="pFeed"></div></div>
      </div>`;
  },
  parts:{
    pKpi(){
      const q = myQueue(), t = todayISO(), since = new Date(Date.now() - 30*864e5).toISOString();
      return [[q.filter(x => x.t.due === t).length,'zadań na dziś'],[q.filter(x => x.t.due < t).length,'zaległych'],[S.list.filter(f => f.owner_id === S.me.id).length,'firm, które prowadzę'],[S.acts.filter(a => a.type === 'reply' && a.by === S.me.id && a.at >= since).length,'moich odpowiedzi (30 dni)']]
        .map(([v,l]) => `<div class="box kpi"><b>${v}</b><span>${l}</span></div>`).join('');
    },
    pTeam(){
      const since = new Date(Date.now() - 30*864e5).toISOString(), a = S.acts.filter(x => x.at >= since);
      const contacts = a.filter(x => x.type === 'contact');
      return [[contacts.length,'kontaktów z firmami'],[contacts.reduce((n,x) => n + (x.channels||[]).filter(c => c === 'email').length, 0),'wysłanych maili'],[a.filter(x => x.type === 'reply').length,'odpowiedzi'],[a.filter(x => (x.type === 'reply' && x.outcome === 'wspolpraca') || (x.type === 'stage' && x.to_stage === 'wspolpraca')).length,'nowych współprac']]
        .map(([v,l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
    },
    pCamps(){
      const mine = new Set(myTeams().map(t => t.id));
      const cs = [...S.camps.values()].filter(c => c.status === 'active').sort((a,b) => (mine.has(b.team_id) ? 1 : 0) - (mine.has(a.team_id) ? 1 : 0));
      return cs.length ? cs.slice(0, 8).map(campRow).join('') : `<div class="empty">Brak aktywnych kampanii.${isLead() ? ' <a href="#" data-go="nowa">Utwórz pierwszą</a>' : ''}</div>`;
    },
    pFeed(){ const a = S.acts.slice(0, 14); return a.length ? a.map(x => actLine(x, true)).join('') : `<div class="hint">Tu pojawią się kontakty z firmami i odpowiedzi.</div>`; }
  }
};
export function campRow(c){
  const ts = [...(S.targets.get(c.id) || new Map()).values()], n = ts.length || 1, cnt = st => ts.filter(t => t.state === st).length;
  const won = ts.filter(t => { const f = S.firms.get(t.firm_id); return f && f.stage === 'wspolpraca'; }).length;
  const started = ts.filter(t => (t.step||0) > 0 || t.state !== 'active').length;
  const mineToday = ts.filter(t => t.assignee === S.me.id && t.state === 'active' && t.due <= todayISO()).length;
  const team = c.team_id && S.teams.get(c.team_id);
  return `<div class="card click b-act" data-go="kampania" data-arg="${esc(c.id)}">
    <div class="top"><span class="name">${esc(c.name)}</span><span class="row">${mineToday ? `<span class="pill s-act">${mineToday} dla Ciebie dziś</span>` : ''}<span class="hint">${team ? esc(team.name) + ' · ' : ''}${ts.length} firm</span></span></div>
    <div class="progress">${[['replied','var(--new)'],['waiting','var(--warn)'],['active','var(--accent)'],['stopped','var(--none)']].map(([s,col]) => `<i style="width:${cnt(s)/n*100}%;background:${col}"></i>`).join('')}</div>
    <div class="meta"><span>w kontakcie: ${started}</span><span>czeka na odpowiedź: ${cnt('waiting')}</span><span>odpowiedzi: ${cnt('replied')}</span><span>współprace: ${won}</span></div></div>`;
}

/* ================= DO ZROBIENIA ================= */
V.zadania = {
  html(){ S.ui.qtab = S.ui.qtab || 'today';
    return `<div class="vhead"><div><h1>Do zrobienia</h1><p class="sub">Firmy, które prowadzisz w kampaniach. Każdy krok to kontakt z całą firmą: mail i social media naraz.</p></div></div>
      <div class="subtabs" id="qTabs"></div><div class="list" id="qList"></div>`; },
  parts:{
    qTabs(){
      const q = myQueue(), t = todayISO(), wk = addDays(t, 7);
      const c = {today:q.filter(x => x.t.due <= t).length, week:q.filter(x => x.t.due > t && x.t.due <= wk).length, wait:waiting().length, mine:S.list.filter(f => f.owner_id === S.me.id).length};
      return [['today','Dziś i zaległe'],['week','Najbliższe 7 dni'],['wait','Czekam na odpowiedź'],['mine','Moje firmy']].map(([k,l]) => `<button data-act="qtab" data-k="${k}" aria-selected="${S.ui.qtab===k}">${l} · ${c[k]}</button>`).join('');
    },
    qList(){
      const t = todayISO(), wk = addDays(t, 7), tab = S.ui.qtab;
      if (tab === 'mine'){ const f = S.list.filter(x => x.owner_id === S.me.id).sort((a,b) => (a.last_contact||'').localeCompare(b.last_contact||'')); return f.length ? f.map(x => firmCard(x)).join('') : `<div class="empty">Nie prowadzisz jeszcze żadnej firmy. Przejmij firmę w jej karcie albo dostaniesz ją w kampanii.</div>`; }
      if (tab === 'wait'){ const w = waiting(); return w.length ? w.map(x => queueCard(x, true)).join('') : `<div class="empty">Nie czekasz na żadne odpowiedzi.</div>`; }
      const q = myQueue().filter(x => tab === 'today' ? x.t.due <= t : (x.t.due > t && x.t.due <= wk));
      return q.length ? q.map(x => queueCard(x)).join('') : `<div class="empty">${tab === 'today' ? 'Na dziś wszystko zrobione.' : 'Nic zaplanowanego na najbliższy tydzień.'}</div>`;
    }
  }
};
A.qtab = el => { S.ui.qtab = el.dataset.k; refreshNow(); };
function waiting(){ const out = []; for (const [cid, m] of S.targets){ const c = S.camps.get(cid); if (!c) continue; for (const [fid, t] of m) if (t.state === 'waiting' && t.assignee === S.me.id){ const f = S.firms.get(fid); if (f) out.push({c, cid, f, t, step:null}); } } return out.sort((a,b) => (a.t.last||'').localeCompare(b.t.last||'')); }
function queueCard(x, isWaiting){
  const {c, cid, f, t, step} = x, d = isWaiting ? {t:`ostatni kontakt ${fmtDay(t.last)}`} : dueLabel(t.due);
  return `<div class="card ${d.late ? 'b-late' : 'b-act'}">
    <div class="top"><span class="name"><a href="#" data-act="openFirm" data-id="${esc(f.id)}">${esc(f.name)}</a></span><span class="pill ${d.late ? 's-R' : 's-act'}">${esc(d.t)}</span></div>
    <div class="meta"><span>${esc(c.name)}</span>${step ? `<span>Krok ${(t.step||0)+1}/${c.steps.length}: ${esc(step.label||'')} · ${step.channels.map(ch => esc(CH[ch].l)).join(' + ')}</span>` : `<span>Ścieżka zakończona – czekasz na odpowiedź</span>`}</div>
    ${contactLine(f)}${pathHTML(c, t)}
    <div class="row">${step ? `<button class="btn pri sm" data-act="doStep" data-c="${esc(cid)}" data-f="${esc(f.id)}">Kontakt z firmą</button>` : ''}<button class="btn sm" data-act="reply" data-f="${esc(f.id)}" data-c="${esc(cid)}">Odpowiedzieli</button>
      ${step ? `<button class="btn sm ghost" data-act="skipStep" data-c="${esc(cid)}" data-f="${esc(f.id)}">Pomiń krok</button><button class="btn sm ghost" data-act="postpone" data-c="${esc(cid)}" data-f="${esc(f.id)}">Przełóż o 2 dni</button>` : `<button class="btn sm ghost" data-act="stopTarget" data-c="${esc(cid)}" data-f="${esc(f.id)}">Zamknij bez odpowiedzi</button>`}</div></div>`;
}
export function contactLine(f){
  const em = emailsIn(f.email);
  return `<div class="cline"><span class="cl-mail">${em.length ? em.map(esc).join(', ') : '<span class="hint">brak maila</span>'}</span><span class="cl-soc">${socialLinks(f) || '<span class="hint">brak social mediów</span>'}</span>${f.phone ? `<span>☎ ${esc(f.phone)}</span>` : ''}</div>`;
}
function advance(cid, fid){
  const c = S.camps.get(cid), t = S.targets.get(cid).get(fid), i = t.step || 0, st = c.steps || [];
  if (i + 1 < st.length) return setTarget(cid, fid, {step:i+1, due:addDays(todayISO(), Math.max(1, (st[i+1].day||0) - (st[i].day||0))), last:todayISO()});
  return setTarget(cid, fid, {state:'waiting', last:todayISO()});
}
A.skipStep = el => { advance(el.dataset.c, el.dataset.f); toast('Pominięto krok'); };
A.postpone = el => { setTarget(el.dataset.c, el.dataset.f, {due:addDays(todayISO(), 2)}); toast('Przełożono o 2 dni'); };
A.stopTarget = el => { setTarget(el.dataset.c, el.dataset.f, {state:'stopped'}); toast('Zamknięto'); };
A.doStep = el => { const c = S.camps.get(el.dataset.c), t = S.targets.get(el.dataset.c).get(el.dataset.f); openContact({firm:el.dataset.f, camp:el.dataset.c, stepIdx:t.step||0, step:c.steps[t.step||0]}); };

/* ================= KONTAKT Z FIRMĄ (mail + social naraz) ================= */
export function openContact(o){
  const f = S.firms.get(o.firm); if (!f) return;
  const camp = o.camp ? S.camps.get(o.camp) : null;
  let step = o.step;
  if (!step){
    const chans = []; if (emailsIn(f.email).length) chans.push('email'); for (const ch of ['ig','fb','tiktok']) if (socialUrl(f, ch)) chans.push(ch);
    if (!chans.length) chans.push(f.phone ? 'phone' : 'email');
    const tf = tplById('b-first'), td = tplById('b-dm'), tp = tplById('b-phone');
    step = {day:0, channels:chans, label:'Kontakt poza kampanią', subject:tf.subject, body:tf.body, dm:td.body, script:tp.body};
  }
  S.ui.ct = {firm:f.id, camp:o.camp || null, stepIdx:o.stepIdx, channels:[...step.channels]};
  const has = ch => step.channels.includes(ch);
  const dmChans = step.channels.filter(ch => CH[ch].kind === 'dm');
  const callChans = step.channels.filter(ch => CH[ch].kind === 'call');
  openModal(`<div class="row"><h2>Kontakt z firmą · ${esc(f.name)}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="hint">${camp ? `${esc(camp.name)} · krok ${(o.stepIdx||0)+1} z ${camp.steps.length}: ${esc(step.label||'')}` : 'Kontakt poza kampanią'} · Prowadzisz kontakt z całą firmą – wyślij wiadomości we wszystkich zaznaczonych kanałach.</div>
    <div class="row" id="ctChans">${Object.entries(CH).map(([k,v]) => `<label class="chip"><input type="checkbox" value="${k}" ${has(k)?'checked':''}> ${esc(v.l)}</label>`).join('')}</div>
    <div class="row"><button class="btn" data-act="aiPrompt">✦ Prompt do AI (za darmo)</button><span class="hint">Skopiuj gotowy prompt do Copilota lub ChatGPT i wklej odpowiedź – uzupełni pola poniżej.</span></div>
    <section class="cbox" data-sec="email" ${has('email') ? '' : 'hidden'}><h3>${chTag('email')}E-mail</h3>
      <div class="field"><label class="lbl" for="ctTo">Do</label><input type="text" id="ctTo" value="${esc(emailsIn(f.email).join(', '))}" placeholder="adres e-mail firmy"></div>
      <div class="field"><label class="lbl" for="ctSubj">Temat</label><input type="text" id="ctSubj" value="${esc(fillVars(step.subject, f, camp))}"></div>
      <div class="field"><label class="lbl" for="ctBody">Treść</label><textarea id="ctBody" rows="10">${esc(fillVars(step.body, f, camp))}</textarea></div>
      <div class="row"><button class="btn gold" data-act="toOutlook">${S.me.outlook_kind === 'app' ? 'Otwórz w programie pocztowym' : 'Przenieś do Outlooka'}</button><button class="btn" data-act="copyMail">Kopiuj</button><span class="hint">Mail wyjdzie z Twojej skrzynki${S.me.email ? ' (' + esc(S.me.email) + ')' : ''}.</span></div>
    </section>
    <section class="cbox" data-sec="dm" ${dmChans.length ? '' : 'hidden'}><h3>${chTag('ig')}Wiadomość w social mediach</h3>
      <textarea id="ctDm" rows="5">${esc(fillVars(step.dm, f, camp))}</textarea>
      <div class="row" id="ctDmBtns"></div>
    </section>
    <section class="cbox" data-sec="call" ${callChans.length ? '' : 'hidden'}><h3>${chTag('phone')}Telefon / wizyta</h3>
      <div>Numer: <b style="user-select:all">${esc(f.phone || 'brak w bazie')}</b>${f.address ? ` · ${esc(f.address)}` : ''}</div>
      <textarea id="ctScript" rows="6">${esc(fillVars(step.script, f, camp))}</textarea>
      <div class="field"><label class="lbl" for="ctCall">Co ustaliliście (zapisze się w historii)</label><input type="text" id="ctCall" placeholder="np. prosi o maila do piątku, nie odebrali"></div>
    </section>
    <div class="box" style="background:var(--surface-2)"><div class="lbl">Zaznacz, co faktycznie wysłano / zrobiono</div><div class="row" id="ctDone"></div>
      <div class="row between"><button class="btn pri" data-act="saveContact">Zapisz kontakt</button><span class="hint">${camp ? 'Następny krok zaplanuje się automatycznie.' : 'Zapisze się w historii firmy.'}${!f.owner_id ? ' Przejmiesz tę firmę.' : ''}</span></div></div>`, () => {
    $('ctChans').addEventListener('change', contactChrome);
    contactChrome();
  });
}
function contactChrome(){
  const st = S.ui.ct, f = S.firms.get(st.firm);
  st.channels = [...document.querySelectorAll('#ctChans input:checked')].map(i => i.value);
  const dm = st.channels.filter(c => CH[c].kind === 'dm'), call = st.channels.filter(c => CH[c].kind === 'call');
  document.querySelector('[data-sec="email"]').hidden = !st.channels.includes('email');
  document.querySelector('[data-sec="dm"]').hidden = !dm.length;
  document.querySelector('[data-sec="call"]').hidden = !call.length;
  $('ctDmBtns').innerHTML = dm.map(ch => { const u = socialUrl(f, ch);
    const find = ch === 'ig' ? `https://www.google.com/search?q=${enc('site:instagram.com "' + f.name + '"')}` : ch === 'fb' ? `https://www.facebook.com/search/pages/?q=${enc(f.name)}` : ch === 'tiktok' ? `https://www.tiktok.com/search/user?q=${enc(f.name)}` : `https://www.google.com/search?q=${enc('site:linkedin.com ' + f.name)}`;
    return `<button class="btn" data-act="dmGo" data-u="${esc(u || find)}">${u ? 'Kopiuj i otwórz ' + esc(CH[ch].l) : 'Znajdź profil: ' + esc(CH[ch].l)}</button>`; }).join('') + `<button class="btn" data-act="copyDm">Kopiuj</button>`;
  const prev = new Set([...document.querySelectorAll('#ctDone input:checked')].map(i => i.value));
  $('ctDone').innerHTML = st.channels.map(ch => `<label class="chip"><input type="checkbox" value="${ch}" ${prev.has(ch) || st.touched && st.touched.has(ch) ? 'checked' : ''}> ${esc(CH[ch].l)}</label>`).join('') || '<span class="hint">Wybierz kanały powyżej.</span>';
}
function markTouched(ch){ const st = S.ui.ct; st.touched = st.touched || new Set(); st.touched.add(ch); const i = document.querySelector(`#ctDone input[value="${ch}"]`); if (i) i.checked = true; }
A.toOutlook = () => {
  const to = $('ctTo').value.split(/[,;\s]+/).filter(Boolean).join(';');
  if (!to) { toast('Brak adresu e-mail – wpisz go albo użyj „Szukaj maila” w karcie firmy.'); return; }
  openUrl(outlookUrl(to, $('ctSubj').value, $('ctBody').value)); markTouched('email');
  toast('Otwieram Outlooka – po wysłaniu zapisz kontakt');
};
A.copyMail = () => { copyText('Temat: ' + $('ctSubj').value + '\n\n' + $('ctBody').value, 'Skopiowano maila'); };
A.copyDm = () => { copyText($('ctDm').value, 'Skopiowano wiadomość'); };
A.dmGo = async el => { await copyText($('ctDm').value, 'Skopiowano – wklej w wiadomości'); openUrl(el.dataset.u); const st = S.ui.ct; st.channels.filter(c => CH[c].kind === 'dm').slice(0,1).forEach(markTouched); };
A.aiPrompt = () => {
  const st = S.ui.ct, f = S.firms.get(st.firm), camp = st.camp ? S.camps.get(st.camp) : null, step = camp ? camp.steps[st.stepIdx||0] : null;
  const dm = st.channels.filter(c => CH[c].kind === 'dm');
  const parts = {email: st.channels.includes('email'), subject: $('ctSubj').value, body: $('ctBody').value, dm: dm.length ? $('ctDm').value : '', dmLabel: dm.map(c => CH[c].l).join(' / '), script: st.channels.some(c => CH[c].kind === 'call') ? $('ctScript').value : ''};
  const prompt = contactPrompt(f, camp, step, parts);
  const saved = {subj:$('ctSubj').value, body:$('ctBody').value, dm:$('ctDm').value, script:$('ctScript').value, to:$('ctTo').value, chans:st.channels, call:$('ctCall').value};
  promptModal('Prompt do darmowego AI', prompt, 'Wklej tutaj całą odpowiedź AI', ans => {
    const r = parseAiAnswer(ans);
    openContact({firm:st.firm, camp:st.camp, stepIdx:st.stepIdx, step:{day:0, label: step ? step.label : 'Kontakt poza kampanią', channels:saved.chans, subject: r.subject || saved.subj, body: r.body || saved.body, dm: r.dm || saved.dm, script: r.script || saved.script}});
    $('ctTo').value = saved.to; $('ctCall').value = saved.call;
    toast(r.body || r.dm || r.script ? 'Wstawiono treści z AI – przeczytaj je przed wysłaniem' : 'Nie rozpoznałem formatu – wklej treści ręcznie');
  }, () => openContact({firm:st.firm, camp:st.camp, stepIdx:st.stepIdx, step:{day:0, label: step ? step.label : '', channels:saved.chans, subject:saved.subj, body:saved.body, dm:saved.dm, script:saved.script}}));
};
export function promptModal(title, prompt, pasteLabel, onApply, onBack){
  S.ui.pm = {prompt, onApply, onBack};
  openModal(`<div class="row"><h2>${esc(title)}</h2><button class="x" data-act="pmBack" aria-label="Wróć">×</button></div>
    <ol class="steps-ol"><li>Skopiuj prompt.</li><li>Otwórz darmowe AI i wklej go.</li><li>Skopiuj odpowiedź i wklej ją w pole na dole.</li></ol>
    <textarea id="pmText" class="mono" rows="12" readonly>${esc(prompt)}</textarea>
    <div class="row"><button class="btn gold" data-act="pmCopy">Kopiuj prompt</button>${AI_TOOLS.map(([u,l,s]) => `<a class="btn" href="${u}" target="_blank" rel="noopener" title="${esc(s)}">${esc(l)}</a>`).join('')}</div>
    <p class="hint">Microsoft Copilot jest bezpłatny dla kont uczelnianych – zaloguj się adresem UWr.</p>
    <div class="field"><label class="lbl" for="pmAns">${esc(pasteLabel)}</label><textarea id="pmAns" rows="8"></textarea></div>
    <div class="row"><button class="btn pri" data-act="pmApply">Wstaw do wiadomości</button><button class="btn" data-act="pmBack">Wróć bez zmian</button></div>`);
}
A.pmCopy = () => copyText(S.ui.pm.prompt, 'Skopiowano prompt – wklej go w AI');
A.pmApply = () => { const a = $('pmAns').value.trim(); if (!a) { toast('Wklej odpowiedź AI'); return; } S.ui.pm.onApply(a); };
A.pmBack = () => { if (S.ui.pm && S.ui.pm.onBack) S.ui.pm.onBack(); else closeLayer(); };
A.saveContact = async () => {
  const st = S.ui.ct, f = S.firms.get(st.firm);
  const done = [...document.querySelectorAll('#ctDone input:checked')].map(i => i.value);
  if (!done.length) { toast('Zaznacz, co zostało wysłane lub zrobione.'); return; }
  const sum = [done.includes('email') ? '' : '', done.some(c => CH[c].kind === 'dm') ? 'DM: ' + $('ctDm').value.replace(/\s+/g,' ').slice(0,120) : '', $('ctCall').value.trim() ? 'Ustalenia: ' + $('ctCall').value.trim() : ''].filter(Boolean).join(' · ');
  const a = await logAct({type:'contact', firm_id:f.id, channels:done, campaign_id:st.camp || undefined, step: st.camp ? (st.stepIdx||0) : undefined, subject: done.includes('email') ? $('ctSubj').value : undefined, summary: sum || undefined});
  if (!a) return;
  const next = ['nowa','kontakt'].includes(f.stage) ? 'wyslano' : f.stage === 'wyslano' ? 'followup' : f.stage;
  const patch = {stage:next, last_contact:todayISO()}; if (!f.owner_id) patch.owner_id = S.me.id;
  await updateFirm(f.id, patch);
  if (st.camp) await advance(st.camp, f.id);
  closeLayer(); toast('Zapisano kontakt');
};

/* ================= ODPOWIEDŹ ================= */
A.reply = el => {
  const f = S.firms.get(el.dataset.f); if (!f) return; S.ui.rep = {firm:f.id, camp:el.dataset.c || ''};
  openModal(`<div class="row"><h2>Odpowiedź od ${esc(f.name)}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="fgrid"><div class="field"><label class="lbl" for="rCh">Gdzie odpowiedzieli</label><select id="rCh">${optList(Object.entries(CH).map(([k,v]) => [k, v.l]), 'email')}</select></div>
    <div class="field"><label class="lbl" for="rOut">Wynik</label><select id="rOut">${optList(OUTCOMES, 'rozmowy')}</select></div>
    <div class="field full"><label class="lbl" for="rText">Treść odpowiedzi (widzisz ją tylko Ty)</label><textarea id="rText" rows="7" placeholder="Wklej odpowiedź firmy albo opisz, co napisali"></textarea></div>
    <div class="field full"><label class="lbl" for="rPub">Notatka dla zespołu (opcjonalnie)</label><input type="text" id="rPub" placeholder="np. chcą rozmawiać po 15 listopada"></div></div>
    <p class="hint">Liderzy i administratorzy zobaczą tylko, że firma odpowiedziała, wynik i notatkę. Ścieżki kontaktu tej firmy zatrzymają się.</p>
    <div class="row"><button class="btn pri" data-act="saveReply">Zapisz odpowiedź</button><button class="btn" data-act="close">Anuluj</button></div>`);
};
A.saveReply = async () => {
  const r = S.ui.rep, f = S.firms.get(r.firm), out = $('rOut').value, text = $('rText').value.trim(), pub = $('rPub').value.trim();
  const a = await logAct({type:'reply', firm_id:f.id, channels:[$('rCh').value], campaign_id:r.camp || undefined, outcome:out, public_note:pub || undefined});
  if (!a) return;
  if (text){ const { error } = await sb.from('reply_contents').insert({activity_id:a.id, author:S.me.id, body:text}); if (error) dbErr(error, 'reply'); else S.replies.set(a.id, text); }
  const patch = {stage:out, last_contact:todayISO()}; if (!f.owner_id) patch.owner_id = S.me.id;
  await updateFirm(f.id, patch);
  for (const [cid, m] of S.targets){ const t = m.get(f.id); if (t && (t.state === 'active' || t.state === 'waiting')) await setTarget(cid, f.id, {state:'replied', last:todayISO(), outcome:out}); }
  closeLayer(); toast('Zapisano odpowiedź');
};

/* ================= FIRMY ================= */
export function catsFor(sec){ return [...new Set(S.list.filter(f => !sec || f.sector === sec).map(f => f.category).filter(Boolean))].sort((a,b) => a.localeCompare(b,'pl')); }
export function firmFilter(o){
  const q = fold(o.q || '').trim().split(/\s+/).filter(Boolean), team = o.team && S.teams.get(o.team);
  return S.list.filter(f => (!o.sec || f.sector === o.sec) && (!o.cat || f.category === o.cat) && (!o.stage || f.stage === o.stage) && (!o.z || f.reach === o.z)
    && (!o.own || (o.own === 'me' ? f.owner_id === S.me.id : o.own === 'none' ? !f.owner_id : f.owner_id === o.own))
    && (!o.has || (o.has === 'email' ? emailsIn(f.email).length : o.has === 'social' ? !!(f.instagram || f.facebook || f.tiktok) : o.has === 'none' ? !(f.email || f.instagram || f.facebook || f.tiktok || f.phone) : true))
    && (!o.team || (o.team === 'mine' ? isMyScope(f) : team && ((team.sectors||[]).includes(f.sector) || (team.categories||[]).includes(f.category))))
    && q.every(w => f._t.includes(w)));
}
export function firmCard(f, extra){
  return `<div class="card click b-${(STAGE[f.stage]||{}).c || ''}" data-act="openFirm" data-id="${esc(f.id)}">
    <div class="top"><span class="name">${esc(f.name)}</span><span class="row">${f.owner_id ? `<span class="hint">prowadzi: ${esc(pfirst(f.owner_id))}</span>` : ''}${stagePill(f)}</span></div>
    <div class="meta"><span>${esc(f.sector)} › ${esc(f.category||'—')}</span>${f.reach ? `<span>${esc(f.reach)}</span>` : ''}${f.last_contact ? `<span>ostatni kontakt: ${esc(fmtDay(f.last_contact))}</span>` : ''}</div>${contactLine(f)}${extra || ''}</div>`;
}
V.firmy = {
  html(){
    const u = S.ui.ff = S.ui.ff || {limit:60, team: myTeams().length ? 'mine' : ''};
    return `<div class="vhead"><div><h1>Firmy</h1><p class="sub">Cała baza komisji. E-mail i social media w osobnych kolumnach. Kliknij firmę, żeby zobaczyć historię kontaktu.</p></div>
      <div class="row"><button class="btn" data-act="exportXlsx">Pobierz Excel</button><button class="btn pri" data-act="newFirm">+ Dodaj firmę</button></div></div>
      <div class="box"><div class="filters">
        <div class="field"><label class="lbl" for="fQ">Szukaj</label><input type="search" id="fQ" value="${esc(u.q||'')}" placeholder="nazwa, adres, uwagi…"></div>
        <div class="field"><label class="lbl" for="fTeam">Zespół</label><select id="fTeam">${optList([['','Cała baza'],['mine','Kategorie moich zespołów'], ...[...S.teams.values()].map(t => [t.id, t.name])], u.team)}</select></div>
        <div class="field"><label class="lbl" for="fSec">Sektor</label><select id="fSec"><option value="">Wszystkie</option>${optList(SECTORS.map(s => [s,s]), u.sec)}</select></div>
        <div class="field"><label class="lbl" for="fCat">Kategoria</label><select id="fCat"></select></div>
        <div class="field"><label class="lbl" for="fOwn">Prowadzi</label><select id="fOwn"></select></div>
        <div class="field"><label class="lbl" for="fHas">Kontakt</label><select id="fHas">${optList([['','Dowolny'],['email','Ma e-mail'],['social','Ma social media'],['none','Brak kontaktu']], u.has)}</select></div>
      </div><div class="stagebar" id="fStages"></div></div>
      <div class="row between"><span class="hint" id="fCount"></span></div>
      <div class="tw box" style="padding:0"><table class="t firms"><thead><tr><th>Firma</th><th>Etap</th><th>E-mail</th><th>Social media</th><th>Telefon</th><th>Prowadzi</th><th>Ostatni kontakt</th></tr></thead><tbody id="fRows"></tbody></table></div>
      <button class="btn" id="fMore" data-act="fMore" hidden>Pokaż więcej</button>`;
  },
  parts:{
    fStages(){ const u = S.ui.ff, base = firmFilter(Object.assign({}, u, {stage:''})), c = {}; base.forEach(f => c[f.stage] = (c[f.stage]||0) + 1);
      return `<button data-act="fStage" data-k="" aria-pressed="${!u.stage}">Wszystkie · ${base.length}</button>` + STAGES.map(s => `<button data-act="fStage" data-k="${s.id}" aria-pressed="${u.stage===s.id}">${esc(s.l)} · ${c[s.id]||0}</button>`).join(''); },
    fRows(){
      const u = S.ui.ff, rows = firmFilter(u).sort((a,b) => (b.last_contact||'').localeCompare(a.last_contact||'') || a.name.localeCompare(b.name,'pl'));
      if ($('fCount')) $('fCount').textContent = `${rows.length.toLocaleString('pl-PL')} firm`;
      if ($('fMore')) $('fMore').hidden = rows.length <= u.limit;
      if (!rows.length) return `<tr><td colspan="7" class="hint" style="padding:20px">Nic nie pasuje do filtrów.</td></tr>`;
      return rows.slice(0, u.limit).map(f => { const em = emailsIn(f.email);
        return `<tr class="click" data-act="openFirm" data-id="${esc(f.id)}"><td><b>${esc(f.name)}</b><div class="hint">${esc(f.category||f.sector)}${f.reach ? ' · ' + esc(f.reach) : ''}</div></td><td>${stagePill(f)}</td>
          <td class="wrap">${em.length ? em.map(esc).join('<br>') : '<span class="hint">—</span>'}</td><td class="soc-cell">${socialLinks(f) || '<span class="hint">—</span>'}</td><td>${esc(f.phone||'')}</td>
          <td>${f.owner_id ? esc(pname(f.owner_id)) : '<span class="hint">—</span>'}</td><td>${f.last_contact ? esc(fmtDay(f.last_contact)) : ''}</td></tr>`; }).join('');
    }
  },
  after(){
    const u = S.ui.ff;
    const fillCat = () => { $('fCat').innerHTML = `<option value="">Wszystkie</option>` + optList(catsFor($('fSec').value).map(c => [c,c]), u.cat); };
    $('fOwn').innerHTML = optList([['','Wszyscy'],['me','Ja'],['none','Nikt (wolne firmy)']], u.own) + [...S.profiles.values()].filter(p => p.status === 'active').map(p => `<option value="${esc(p.id)}"${u.own===p.id?' selected':''}>${esc(p.full_name||p.email)}</option>`).join('');
    fillCat();
    const upd = () => { Object.assign(u, {q:$('fQ').value, team:$('fTeam').value, sec:$('fSec').value, cat:$('fCat').value, own:$('fOwn').value, has:$('fHas').value, limit:60}); refreshNow(); };
    ['fQ','fTeam','fCat','fOwn','fHas'].forEach(id => $(id).addEventListener('input', upd));
    $('fSec').addEventListener('input', () => { u.cat = ''; fillCat(); upd(); });
  }
};
A.fStage = el => { S.ui.ff.stage = el.dataset.k; S.ui.ff.limit = 60; refreshNow(); };
A.fMore = () => { S.ui.ff.limit += 60; refreshNow(); };

/* ================= KARTA FIRMY ================= */
A.openFirm = (el, ev) => { if (ev && ev.target.closest('a.soc')) return; openFirm(el.dataset.id); };
export function openFirm(id){
  const f = S.firms.get(id); if (!f) return;
  S.drawer = id; S.ui.firmActs = null;
  $('layer').innerHTML = `<div class="scrim" data-act="close"></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Karta firmy"><div id="dBody"></div>
    <div class="box"><div class="row between"><h3>Historia kontaktu</h3><button class="btn sm" data-act="note" data-f="${esc(id)}">+ Notatka / telefon / spotkanie</button></div><div class="feed" id="dTimeline"></div></div></aside>`;
  V.__drawer();
  sb.from('activities').select('*').eq('firm_id', id).order('at', {ascending:false}).limit(300).then(({data}) => { if (data && S.drawer === id) { S.ui.firmActs = data; V.__drawer(); } });
}
V.__drawer = () => {
  const id = S.drawer, f = S.firms.get(id); if (!f || !$('dBody')) return;
  const teams = firmTeams(f), em = emailsIn(f.email);
  const canTake = !f.owner_id || f.owner_id === S.me.id || isLead();
  const cs = []; for (const [cid, m] of S.targets){ const t = m.get(id), c = S.camps.get(cid); if (t && c) cs.push([cid, c, t]); }
  $('dBody').innerHTML = `<div class="row"><div style="min-width:0"><h2>${esc(f.name)}</h2><div class="meta" style="margin-top:4px"><span>${esc(f.sector)} › ${esc(f.category||'—')}</span>${f.reach ? `<span>${esc(f.reach)}</span>` : ''}${teams.length ? `<span>zespół: ${teams.map(t => esc(t.name)).join(', ')}</span>` : ''}</div></div><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="box"><div class="row between"><div>${f.owner_id ? `Firmę prowadzi <b>${esc(pname(f.owner_id))}</b>` : '<span class="hint">Nikt jeszcze nie prowadzi tej firmy.</span>'}${f.last_contact ? `<div class="hint">Ostatni kontakt: ${esc(fmtDay(f.last_contact))}</div>` : ''}</div>
      <div class="row">${f.owner_id !== S.me.id && canTake ? `<button class="btn gold sm" data-act="claim" data-f="${esc(id)}">${f.owner_id ? 'Przejmij firmę' : 'Biorę tę firmę'}</button>` : ''}${f.owner_id === S.me.id ? `<button class="btn sm ghost" data-act="release" data-f="${esc(id)}">Oddaj firmę</button>` : ''}</div></div>
      <div class="row"><button class="btn pri sm" data-act="contactFirm" data-f="${esc(id)}">Kontakt z firmą</button><button class="btn sm" data-act="reply" data-f="${esc(id)}">Odpowiedzieli</button>${isLead() || f.owner_id === S.me.id ? `<button class="btn sm" data-act="toCamp" data-f="${esc(id)}">Dodaj do kampanii</button>` : ''}<button class="btn sm ghost" data-act="mailFinder" data-f="${esc(id)}">Szukaj maila</button><button class="btn sm ghost" data-act="editFirm" data-f="${esc(id)}">Edytuj dane</button></div>
      <div class="fgrid"><div class="field"><label class="lbl" for="dStage">Etap rozmów</label><select id="dStage">${optList(STAGES.map(s => [s.id, s.l]), f.stage)}</select></div>
      ${isLead() ? `<div class="field"><label class="lbl" for="dOwner">Prowadzi (przypisz)</label><select id="dOwner">${peopleOpts(f.owner_id, '— nikt —')}</select></div>` : ''}</div></div>
    <div class="grid g2">
      <div class="box"><h3>E-mail i telefon</h3>${em.length ? em.map(e => `<div style="user-select:all">${esc(e)}</div>`).join('') : '<div class="hint">Brak maila – użyj „Szukaj maila”.</div>'}${f.phone ? `<div>☎ <span style="user-select:all">${esc(f.phone)}</span></div>` : ''}${f.website ? `<div><a href="${esc(f.website)}" target="_blank" rel="noopener">${esc(shortUrl(f.website))}</a></div>` : ''}${f.last_mail ? `<div class="hint">Ostatni mail wg arkusza: ${esc(f.last_mail)}</div>` : ''}</div>
      <div class="box"><h3>Social media</h3>${['ig','fb','tiktok','linkedin'].map(ch => { const u = socialUrl(f, ch); return u ? `<div>${chTag(ch)}<a href="${esc(u)}" target="_blank" rel="noopener">${esc(shortUrl(u))}</a></div>` : ''; }).join('') || '<div class="hint">Brak social mediów w bazie.</div>'}</div>
    </div>
    ${f.address || f.notes || f.collected_by ? `<div class="box">${f.address ? `<div>${esc(f.address)}</div>` : ''}${f.collected_by ? `<div class="hint">Zebrał(a): ${esc(f.collected_by)}</div>` : ''}${f.notes ? `<div class="note">${esc(f.notes)}</div>` : ''}</div>` : ''}
    ${cs.length ? `<div class="box"><h3>Kampanie</h3>${cs.map(([cid,c,t]) => `<div class="row between"><div><a href="#" data-go="kampania" data-arg="${esc(cid)}">${esc(c.name)}</a> <span class="hint">· ${esc(pname(t.assignee))} · ${esc(tState(t))}</span>${pathHTML(c,t)}</div>${t.state === 'active' && t.assignee === S.me.id ? `<button class="btn sm pri" data-act="doStep" data-c="${esc(cid)}" data-f="${esc(id)}">Kontakt z firmą</button>` : ''}</div>`).join('')}</div>` : ''}`;
  $('dStage').onchange = async e => { const to = e.target.value; if (await updateFirm(id, {stage:to})) { logAct({type:'stage', firm_id:id, to_stage:to}); toast('Zmieniono etap'); } };
  if ($('dOwner')) $('dOwner').onchange = async e => { if (await updateFirm(id, {owner_id:e.target.value || null})) { logAct({type:'claim', firm_id:id, summary: e.target.value ? 'Przypisano: ' + pname(e.target.value) : 'Firma bez opiekuna'}); toast('Zapisano'); } };
  const live = S.acts.filter(a => a.firm_id === id), seen = new Set(live.map(a => a.id));
  const all = live.concat((S.ui.firmActs || []).filter(a => !seen.has(a.id))).sort((a,b) => (b.at||'').localeCompare(a.at||''));
  $('dTimeline').innerHTML = all.length ? all.map(a => actLine(a)).join('') : `<div class="hint">Nie było jeszcze kontaktu z tą firmą.</div>`;
};
A.contactFirm = el => openContact({firm:el.dataset.f});
A.claim = async el => { const id = el.dataset.f; if (await updateFirm(id, {owner_id:S.me.id})) { logAct({type:'claim', firm_id:id, summary:'Przejął(-ęła) kontakt z firmą'}); toast('Prowadzisz teraz tę firmę'); } };
A.release = async el => { if (await updateFirm(el.dataset.f, {owner_id:null})) toast('Oddano firmę'); };
A.note = el => {
  const f = S.firms.get(el.dataset.f); S.ui.la = f.id;
  openModal(`<div class="row"><h2>Zapisz w historii · ${esc(f.name)}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="fgrid"><div class="field"><label class="lbl" for="laType">Rodzaj</label><select id="laType">${optList([['note','Notatka'],['phone','Telefon'],['meeting','Spotkanie'],['visit','Wizyta']], 'note')}</select></div>
    <div class="field"><label class="lbl" for="laStage">Zmień etap (opcjonalnie)</label><select id="laStage"><option value="">bez zmian</option>${optList(STAGES.map(s => [s.id, s.l]), '')}</select></div>
    <div class="field full"><label class="lbl" for="laText">Co się wydarzyło (widzi cały zespół)</label><textarea id="laText" rows="5"></textarea></div></div>
    <div class="row"><button class="btn pri" data-act="saveNote">Zapisz</button><button class="btn" data-act="close">Anuluj</button></div>`);
};
A.saveNote = async () => {
  const id = S.ui.la, f = S.firms.get(id), type = $('laType').value, text = $('laText').value.trim(), st = $('laStage').value;
  if (!text && !st) { toast('Opisz krótko, co się wydarzyło.'); return; }
  await logAct({type, firm_id:id, summary:text || undefined, to_stage:st || undefined, channels: type === 'phone' ? ['phone'] : type === 'visit' ? ['visit'] : []});
  const patch = {last_contact:todayISO()}; if (st) patch.stage = st; if (!f.owner_id) patch.owner_id = S.me.id;
  await updateFirm(id, patch); closeLayer(); openFirm(id); toast('Zapisano');
};
A.toCamp = el => {
  const f = S.firms.get(el.dataset.f); S.ui.tc = f.id;
  const cs = [...S.camps.values()].filter(c => c.status === 'active');
  if (!cs.length) { toast('Brak aktywnych kampanii.'); return; }
  openModal(`<div class="row"><h2>Dodaj do kampanii · ${esc(f.name)}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="fgrid"><div class="field"><label class="lbl" for="tcCamp">Kampania</label><select id="tcCamp">${optList(cs.map(c => [c.id, c.name]), cs[0].id)}</select></div>
    <div class="field"><label class="lbl" for="tcWho">Kto prowadzi</label>${isLead() ? `<select id="tcWho">${peopleOpts(f.owner_id || S.me.id, '— wybierz —')}</select>` : `<input type="text" id="tcWho" value="${esc(pname(S.me.id))}" disabled>`}</div></div>
    <div class="row"><button class="btn pri" data-act="saveToCamp">Dodaj – pierwszy krok na dziś</button></div>`);
};
A.saveToCamp = async () => {
  const cid = $('tcCamp').value, who = (isLead() && $('tcWho').value) || S.me.id, fid = S.ui.tc;
  if (await setTarget(cid, fid, {assignee:who, step:0, due:todayISO(), state:'active'})) {
    await logAct({type:'campaign', firm_id:fid, campaign_id:cid});
    if (!S.firms.get(fid).owner_id) await updateFirm(fid, {owner_id:who});
    closeLayer(); openFirm(fid); toast('Dodano do kampanii');
  }
};

/* ---------- edycja / dodanie firmy ---------- */
const EF = [['name','Nazwa','full'],['sector','Sektor',''],['category','Kategoria',''],['reach','Zasięg',''],['phone','Telefon',''],['email','E-mail (kilka po przecinku)','full'],
  ['instagram','Instagram (link lub @nazwa)',''],['facebook','Facebook (link)',''],['tiktok','TikTok',''],['linkedin','LinkedIn',''],['website','Strona www','full'],['address','Adres','full'],['collected_by','Kto zebrał',''],['last_mail','Ostatni mail (data)',''],['notes','Uwagi','full']];
export function firmForm(f, isNew){
  S.ui.ef = {id: f && f.id, isNew, dupOk:false};
  f = f || {sector:'Do uzupełnienia', reach:'Wrocław', collected_by: S.me.full_name || ''};
  openModal(`<div class="row"><h2>${isNew ? 'Dodaj firmę' : 'Edytuj dane firmy'}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="fgrid">${EF.map(([k,l,cls]) => {
      let input;
      if (k === 'sector') input = `<select id="ef_sector">${optList(SECTORS.map(s => [s,s]), f.sector)}</select>`;
      else if (k === 'reach') input = `<select id="ef_reach">${optList([['Wrocław','Wrocław'],['Polska','Ogólnopolskie'],['','Nie wiadomo']], f.reach||'')}</select>`;
      else if (k === 'notes') input = `<textarea id="ef_notes" rows="3">${esc(f.notes||'')}</textarea>`;
      else if (k === 'category') input = `<input type="text" id="ef_category" list="efCats" value="${esc(f.category||'')}"><datalist id="efCats">${catsFor('').map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
      else input = `<input type="text" id="ef_${k}" value="${esc(f[k]||'')}">`;
      return `<div class="field ${cls}"><label class="lbl" for="ef_${k}">${l}</label>${input}</div>`; }).join('')}</div>
    <div id="efErr" class="hint"></div>
    <div id="efDel" class="confirm" hidden><span>Usunąć firmę z bazy?</span><button class="btn" data-act="efDelYes">Tak, usuń</button><button class="btn" data-act="efDelNo">Anuluj</button></div>
    <div class="row"><button class="btn pri" data-act="saveFirmForm">Zapisz</button><button class="btn" data-act="close">Anuluj</button>${!isNew && isLead() ? `<button class="btn danger" style="margin-left:auto" data-act="efDel">Usuń</button>` : ''}</div>`);
}
A.newFirm = el => firmForm(el && el.dataset.name ? {name:el.dataset.name, sector:'Do uzupełnienia', reach:'Wrocław', collected_by:S.me.full_name || ''} : null, true);
A.editFirm = el => firmForm(S.firms.get(el.dataset.f), false);
A.saveFirmForm = async () => {
  const body = {}; EF.forEach(([k]) => body[k] = ($('ef_' + k).value || '').trim());
  if (!body.name) { $('efErr').textContent = 'Wpisz nazwę firmy.'; return; }
  const st = S.ui.ef;
  if (st.isNew){
    const dup = S.idx.get(keyOf(body.name));
    if (dup && !st.dupOk) { $('efErr').textContent = `„${dup[0].name}” już jest w bazie. Kliknij „Zapisz” jeszcze raz, żeby i tak dodać.`; st.dupOk = true; return; }
    body.id = 'n-' + slug(body.name) + '-' + rid(); body.owner_id = S.me.id;
    const row = await insertFirm(body); if (!row) return;
    logAct({type:'note', firm_id:row.id, summary:'Dodano firmę do bazy'}); closeLayer(); openFirm(row.id); toast('Dodano firmę');
  } else {
    if (await updateFirm(st.id, body)) { logAct({type:'edit', firm_id:st.id, summary:'Zaktualizowano dane'}); closeLayer(); openFirm(st.id); toast('Zapisano'); }
  }
};
A.efDel = () => { $('efDel').hidden = false; };
A.efDelNo = () => { $('efDel').hidden = true; };
A.efDelYes = async () => { if (await updateFirm(S.ui.ef.id, {deleted:true})) { closeLayer(); toast('Usunięto z bazy'); } };
