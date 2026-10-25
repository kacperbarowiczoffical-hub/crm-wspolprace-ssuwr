import * as XLSX from 'xlsx';
import { S, V, A, $, esc, enc, fold, keyOf, bigrams, dice, pySlug, todayISO, fmtDay, emailsIn, igHandle, socialUrl, cityOf, domainOf, shortUrl, splitContact,
  toast, copyText, STAGE, STAGES, CH, SECTORS, ROLES, ST_SHEET, isAdmin, isLead, myTeams, teamMembers, inTeamScope, pname, avatarHTML, go, refresh, refreshNow,
  openModal, closeLayer, optList, peopleOpts, stagePill, sb, dbErr, prep, rebuildIndex, CFG } from './core.js';
import { catsFor, firmCard, myQueue } from './views-work.js';

/* ================= WIĘCEJ ================= */
V.wiecej = {
  html(){
    const tiles = [
      ['pulpit','Statystyki komisji','Wyniki z ostatnich 30 dni i ostatnie kontakty'],
      ['narzedzia','Szukanie nowych firm','Sprawdź, czy firma jest w bazie, znajdź nowe firmy i maile'],
      ['szablony','Szablony wiadomości','Gotowe maile i wiadomości do social mediów'],
      ['struktura','Zespoły i ludzie', isAdmin() ? 'Dodawaj osoby, twórz zespoły, nadawaj role' : 'Kto jest w jakim zespole'],
      ['profil','Mój profil','Imię, podpis maila, hasło'],
      ...(isAdmin() ? [['ustawienia','Ustawienia','Import firm z Excela, eksport, domeny logowania']] : [])
    ];
    const pend = isAdmin() ? [...S.profiles.values()].filter(p => p.status === 'pending').length : 0;
    return `<div class="vhead"><div><h1>Więcej</h1></div></div>
      <div class="tiles">${tiles.map(([v,t,d]) => `<button class="tile" data-go="${v}"><b>${esc(t)}${v === 'struktura' && pend ? ` <span class="badge">${pend}</span>` : ''}</b><span>${esc(d)}</span></button>`).join('')}</div>
      <button class="btn ghost" data-act="logout">Wyloguj</button>`;
  }
};

/* ================= STRUKTURA: administratorzy → liderzy → zespoły ================= */
V.struktura = {
  nav:'wiecej',
  html(){
    return `<div class="vhead"><div><h1>Struktura komisji</h1><p class="sub">Administratorzy główni zarządzają całą komisją. Liderzy prowadzą zespoły, a każdy zespół odpowiada za jedną lub kilka kategorii firm.</p></div>${isAdmin() ? `<div class="row"><button class="btn pri" data-act="userNew">+ Dodaj osobę</button><button class="btn" data-act="teamNew">+ Nowy zespół</button></div>` : ''}</div>
      <div id="sPending"></div>
      <div class="box"><h3>Administratorzy główni</h3><div class="row" id="sAdmins"></div></div>
      <div class="grid g2" id="sTeams"></div>
      <div class="box"><h3>Wszyscy członkowie</h3><div class="tw"><table class="t"><thead><tr><th>Osoba</th><th>Rola</th><th>Zespoły</th><th>Prowadzi firm</th><th>Zadania dziś</th><th>Kontakty (30 dni)</th><th>Współprace</th>${isAdmin() ? '<th></th>' : ''}</tr></thead><tbody id="sPeople"></tbody></table></div></div>`;
  },
  parts:{
    sPending(){
      if (!isAdmin()) return '';
      const p = [...S.profiles.values()].filter(x => x.status === 'pending');
      if (!p.length) return '';
      return `<div class="box" style="border-color:var(--gold)"><h3>Czekają na akceptację (${p.length})</h3>${p.map(x => `<div class="row between" style="padding:6px 0;border-bottom:1px solid var(--line)"><span>${avatarHTML(x.id)} <b>${esc(x.full_name || '(bez imienia)')}</b> <span class="hint">${esc(x.email)}${x.fn ? ' · ' + esc(x.fn) : ''}</span></span>
        <span class="row"><select data-role-for="${esc(x.id)}" style="width:auto">${optList(Object.entries(ROLES), 'member')}</select><button class="btn sm pri" data-act="approve" data-id="${esc(x.id)}">Akceptuj</button><button class="btn sm danger" data-act="block" data-id="${esc(x.id)}">Odrzuć</button></span></div>`).join('')}</div>`;
    },
    sAdmins(){ const a = [...S.profiles.values()].filter(x => x.role === 'admin' && x.status === 'active'); return a.map(x => `<span class="chip">${avatarHTML(x.id)} ${esc(x.full_name || x.email)}</span>`).join('') || '<span class="hint">—</span>'; },
    sTeams(){
      const ts = [...S.teams.values()].sort((a,b) => a.name.localeCompare(b.name,'pl'));
      if (!ts.length) return `<div class="empty">Nie ma jeszcze zespołów.${isAdmin() ? ' Utwórz pierwszy zespół i przypisz mu kategorie.' : ''}</div>`;
      return ts.map(t => {
        const mem = teamMembers(t), scope = S.list.filter(f => inTeamScope(f, t));
        const canEdit = isAdmin() || t.leader_id === S.me.id;
        return `<div class="box"><div class="row between"><h2>${esc(t.name)}</h2>${canEdit ? `<button class="btn sm" data-act="teamEdit" data-id="${esc(t.id)}">Edytuj</button>` : ''}</div>
          <div>Lider: <b>${esc(t.leader_id ? pname(t.leader_id) : 'brak')}</b></div>
          <div class="row">${(t.sectors||[]).map(s => `<span class="pill s-act">${esc(s)} (cały sektor)</span>`).join('')}${(t.categories||[]).map(c => `<span class="pill s-">${esc(c)}</span>`).join('') || (!(t.sectors||[]).length ? '<span class="hint">Brak kategorii</span>' : '')}</div>
          <div class="meta"><span>${scope.length} firm</span><span>w toku: ${scope.filter(f => ['kontakt','wyslano','followup','odpowiedz','rozmowy'].includes(f.stage)).length}</span><span>współprace: ${scope.filter(f => f.stage === 'wspolpraca').length}</span></div>
          <div class="lbl">Członkowie (${mem.length})</div>
          <div class="row">${mem.map(id => `<span class="chip">${avatarHTML(id)} ${esc(pname(id))}${id === t.leader_id ? ' · lider' : ''}${canEdit && id !== t.leader_id ? ` <button class="x sm" data-act="tmDel" data-t="${esc(t.id)}" data-u="${esc(id)}" aria-label="Usuń z zespołu">×</button>` : ''}</span>`).join('') || '<span class="hint">Brak członków</span>'}</div>
          ${canEdit ? `<div class="row"><select id="tmAdd-${esc(t.id)}" style="width:auto">${peopleOpts('', 'Dodaj osobę…', [...S.profiles.keys()].filter(id => !mem.includes(id)))}</select><button class="btn sm" data-act="tmAdd" data-t="${esc(t.id)}">Dodaj</button></div>` : ''}
          <a href="#" class="hint" data-act="teamFirms" data-id="${esc(t.id)}">Pokaż firmy zespołu →</a></div>`;
      }).join('');
    },
    sPeople(){
      const since = new Date(Date.now() - 30*864e5).toISOString(), t = todayISO(), q = myQueue(null);
      return [...S.profiles.values()].filter(p => p.status === 'active').sort((a,b) => (a.full_name||a.email).localeCompare(b.full_name||b.email,'pl')).map(p => {
        const teams = myTeams(p.id).map(x => x.name).join(', ');
        return `<tr><td><span class="row" style="flex-wrap:nowrap">${avatarHTML(p.id)}<span><b>${esc(p.full_name || '—')}</b><br><span class="hint">${esc(p.email)}</span></span></span></td><td>${esc(ROLES[p.role])}${p.fn ? `<div class="hint">${esc(p.fn)}</div>` : ''}</td><td>${esc(teams || '—')}</td>
          <td>${S.list.filter(f => f.owner_id === p.id).length}</td><td>${q.filter(x => x.t.assignee === p.id && x.t.due <= t).length}</td><td>${S.acts.filter(a => a.by === p.id && a.type === 'contact' && a.at >= since).length}</td><td>${S.list.filter(f => f.owner_id === p.id && f.stage === 'wspolpraca').length}</td>
          ${isAdmin() ? `<td style="white-space:nowrap">${p.id !== S.me.id ? `<select data-role-set="${esc(p.id)}" style="width:auto;padding:3px 6px;font-size:12px">${optList(Object.entries(ROLES), p.role)}</select> <button class="btn sm ghost" data-act="userPass" data-id="${esc(p.id)}">Nowe hasło</button> <button class="btn sm ghost danger" data-act="block" data-id="${esc(p.id)}">Zablokuj</button>` : ''}</td>` : ''}</tr>`;
      }).join('');
    }
  },
  after(){
    $('main').addEventListener('change', async e => {
      const s = e.target.closest('[data-role-set]'); if (!s) return;
      const { error } = await sb.from('profiles').update({role:s.value}).eq('id', s.dataset.roleSet); if (error) return dbErr(error);
      S.profiles.get(s.dataset.roleSet).role = s.value; toast('Zmieniono rolę'); refreshNow();
    });
  }
};
A.approve = async el => {
  const id = el.dataset.id, role = (document.querySelector(`[data-role-for="${id}"]`) || {}).value || 'member';
  const { error } = await sb.from('profiles').update({status:'active', role}).eq('id', id); if (error) return dbErr(error);
  Object.assign(S.profiles.get(id), {status:'active', role}); toast('Zaakceptowano'); refreshNow();
};
A.block = async el => { const { error } = await sb.from('profiles').update({status:'blocked'}).eq('id', el.dataset.id); if (error) return dbErr(error); S.profiles.get(el.dataset.id).status = 'blocked'; toast('Zablokowano dostęp'); refreshNow(); };
A.tmAdd = async el => { const t = el.dataset.t, u = $('tmAdd-' + t).value; if (!u) return; const { error } = await sb.from('team_members').insert({team_id:t, user_id:u}); if (error) return dbErr(error); S.tm.push({team_id:t, user_id:u}); refreshNow(); toast('Dodano do zespołu'); };
A.tmDel = async el => { const { error } = await sb.from('team_members').delete().eq('team_id', el.dataset.t).eq('user_id', el.dataset.u); if (error) return dbErr(error); S.tm = S.tm.filter(x => !(x.team_id === el.dataset.t && x.user_id === el.dataset.u)); refreshNow(); };
/* konta zakładane przez admina – bez maili */
function genPass(){ const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; const r = crypto.getRandomValues(new Uint32Array(10)); return 'Ss-' + [...r].map(x => a[x % a.length]).join(''); }
function credsBox(email, pass){
  const txt = `Konto w CRM Komisji ds. Współprac Zewnętrznych:\n${location.origin}\nLogin: ${email}\nHasło: ${pass}\nPo zalogowaniu zmień hasło w: Więcej → Mój profil.`;
  S.ui.creds = txt;
  return `<div class="box" style="border-color:var(--gold)"><b>Przekaż tej osobie dane logowania:</b><pre style="white-space:pre-wrap;margin:8px 0">${esc(txt)}</pre><button class="btn pri" data-act="copyCreds">Kopiuj dane logowania</button></div>`;
}
A.copyCreds = () => { copyText(S.ui.creds || ''); toast('Skopiowano – wyślij to tej osobie (np. na Messengerze)'); };
A.userNew = () => {
  openModal(`<div class="row"><h2>Dodaj osobę</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <p class="hint">Konto działa od razu, bez maili. Dostaniesz dane logowania do przekazania.</p>
    <div class="fgrid"><div class="field"><label class="lbl" for="unEmail">E-mail</label><input type="email" id="unEmail" placeholder="imie.nazwisko@uwr.edu.pl"></div>
    <div class="field"><label class="lbl" for="unName">Imię i nazwisko</label><input type="text" id="unName"></div>
    <div class="field"><label class="lbl" for="unRole">Rola</label><select id="unRole">${optList(Object.entries(ROLES), 'member')}</select></div>
    <div class="field"><label class="lbl" for="unPass">Hasło startowe</label><input type="text" id="unPass" value="${genPass()}"></div></div>
    <div class="row"><button class="btn pri" id="unBtn" data-act="userSave">Utwórz konto</button></div><div id="unOut"></div>`);
};
A.userSave = async () => {
  const email = $('unEmail').value.trim().toLowerCase(), pass = $('unPass').value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Wpisz poprawny e-mail');
  $('unBtn').disabled = true;
  const { data:uid, error } = await sb.rpc('admin_add_user', {p_email:email, p_password:pass, p_name:$('unName').value.trim(), p_role:$('unRole').value});
  $('unBtn').disabled = false;
  if (error) return toast(error.message);
  const { data:prof } = await sb.from('profiles').select('*').eq('id', uid).single();
  if (prof) S.profiles.set(prof.id, prof);
  $('unOut').innerHTML = credsBox(email, pass); $('unBtn').hidden = true; refreshNow();
};
A.userPass = async el => {
  const p = S.profiles.get(el.dataset.id), pass = genPass();
  if (!confirm(`Ustawić nowe hasło dla ${p.full_name || p.email}? Stare przestanie działać.`)) return;
  const { error } = await sb.rpc('admin_set_password', {p_user:p.id, p_password:pass});
  if (error) return toast(error.message);
  openModal(`<div class="row"><h2>Nowe hasło</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>${credsBox(p.email, pass)}`);
};
A.teamFirms = el => { S.ui.ff = {limit:60, team:el.dataset.id}; go('firmy'); };
A.teamNew = () => teamForm(null);
A.teamEdit = el => teamForm(S.teams.get(el.dataset.id));
function teamForm(t){
  S.ui.tef = t ? t.id : null; t = t || {name:'', sectors:[], categories:[], leader_id:''};
  const cats = catsFor('');
  openModal(`<div class="row"><h2>${S.ui.tef ? 'Edytuj zespół' : 'Nowy zespół'}</h2><button class="x" data-act="close" aria-label="Zamknij">×</button></div>
    <div class="fgrid"><div class="field"><label class="lbl" for="teName">Nazwa zespołu</label><input type="text" id="teName" value="${esc(t.name)}" placeholder="np. Zespół Gastro"></div>
    <div class="field"><label class="lbl" for="teLead">Lider</label>${isAdmin() ? `<select id="teLead">${peopleOpts(t.leader_id, '— brak —')}</select>` : `<input type="text" value="${esc(pname(t.leader_id))}" disabled>`}</div></div>
    <div class="lbl">Całe sektory</div><div class="row" id="teSec">${SECTORS.map(s => `<label class="chip"><input type="checkbox" value="${esc(s)}" ${(t.sectors||[]).includes(s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div>
    <div class="lbl">Albo pojedyncze kategorie</div><input type="search" id="teCatQ" placeholder="filtruj kategorie…">
    <div class="row" id="teCat" style="max-height:260px;overflow-y:auto">${cats.map(c => `<label class="chip" data-c="${esc(fold(c))}"><input type="checkbox" value="${esc(c)}" ${(t.categories||[]).includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div>
    <div class="row"><button class="btn pri" data-act="teamSave">Zapisz</button>${S.ui.tef && isAdmin() ? `<button class="btn danger" style="margin-left:auto" data-act="teamDel">Usuń zespół</button>` : ''}</div>`, () => {
    $('teCatQ').addEventListener('input', e => { const q = fold(e.target.value); document.querySelectorAll('#teCat [data-c]').forEach(l => l.hidden = q && !l.dataset.c.includes(q)); });
  });
}
A.teamSave = async () => {
  const body = {name:$('teName').value.trim() || 'Zespół', sectors:[...document.querySelectorAll('#teSec input:checked')].map(i => i.value), categories:[...document.querySelectorAll('#teCat input:checked')].map(i => i.value)};
  if ($('teLead')) body.leader_id = $('teLead').value || null;
  const q = S.ui.tef ? sb.from('teams').update(body).eq('id', S.ui.tef).select().single() : sb.from('teams').insert(body).select().single();
  const { data, error } = await q; if (error) return dbErr(error);
  S.teams.set(data.id, data);
  if (data.leader_id) { const l = S.profiles.get(data.leader_id); if (l && l.role === 'member') { await sb.from('profiles').update({role:'leader'}).eq('id', l.id); l.role = 'leader'; } }
  closeLayer(); refreshNow(); toast('Zapisano zespół');
};
A.teamDel = async () => { const { error } = await sb.from('teams').delete().eq('id', S.ui.tef); if (error) return dbErr(error); S.teams.delete(S.ui.tef); closeLayer(); refreshNow(); toast('Usunięto zespół'); };

/* ================= PROFIL ================= */
V.profil = {
  nav:'wiecej',
  html(){
    const m = S.me;
    return `<div class="vhead"><div><h1>Mój profil</h1><p class="sub">Dane do podpisu i do przenoszenia wiadomości do Outlooka. Rola: <b>${esc(ROLES[m.role])}</b>${myTeams().length ? ' · zespoły: ' + esc(myTeams().map(t => t.name).join(', ')) : ''}.</p></div><button class="btn" data-act="logout">Wyloguj</button></div>
      <div class="box">${profileFields(m)}<div class="row"><button class="btn pri" data-act="saveProfile">Zapisz profil</button></div></div>
      <div class="box"><h3>Hasło</h3><p class="hint">Zmień hasło startowe od administratora na własne – co najmniej 8 znaków.</p>
        <div class="fgrid"><div class="field"><label class="lbl" for="pNew">Nowe hasło</label><input type="password" id="pNew" autocomplete="new-password"></div>
        <div class="field"><label class="lbl" for="pNew2">Powtórz hasło</label><input type="password" id="pNew2" autocomplete="new-password"></div></div>
        <div class="row"><button class="btn" data-act="setPassword">Zapisz hasło</button></div></div>`;
  }
};
A.setPassword = async () => {
  const a = $('pNew').value, b = $('pNew2').value;
  if (a.length < 8) return toast('Hasło musi mieć co najmniej 8 znaków.');
  if (a !== b) return toast('Hasła się różnią.');
  const { error } = await sb.auth.updateUser({password:a});
  if (error) return toast('Nie udało się zmienić hasła: ' + error.message);
  $('pNew').value = ''; $('pNew2').value = ''; toast('Zapisano nowe hasło');
};
export function profileFields(m){
  return `<div class="fgrid">
    <div class="field"><label class="lbl" for="pName">Imię i nazwisko</label><input type="text" id="pName" value="${esc(m.full_name||'')}" autocomplete="name"></div>
    <div class="field"><label class="lbl" for="pFn">Funkcja w komisji</label><input type="text" id="pFn" value="${esc(m.fn||'')}" placeholder="np. Koordynatorka ds. partnerów"></div>
    <div class="field"><label class="lbl">Adres uczelniany</label><input type="text" value="${esc(m.email)}" disabled></div>
    <div class="field"><label class="lbl" for="pOl">Gdzie piszesz maile</label><select id="pOl">${optList([['web','Outlook w przeglądarce (konto uczelniane)'],['live','Outlook.com (konto prywatne)'],['app','Program pocztowy na komputerze (Outlook, Poczta)']], m.outlook_kind || 'web')}</select></div>
    <div class="field"><label class="lbl" for="pTel">Telefon do podpisu (opcjonalnie)</label><input type="text" id="pTel" value="${esc(m.phone||'')}"></div>
    <div class="field"><label class="lbl" for="pIg">Instagram, z którego piszesz (opcjonalnie)</label><input type="text" id="pIg" value="${esc(m.instagram||'')}" placeholder="bez @"></div>
    <div class="field full"><label class="lbl" for="pSig">Podpis maila (puste = zrobimy z danych powyżej)</label><textarea id="pSig" rows="5">${esc(m.signature||'')}</textarea></div></div>`;
}
export async function saveProfileFrom(){
  const body = {full_name:$('pName').value.trim(), fn:$('pFn').value.trim(), outlook_kind:$('pOl').value, phone:$('pTel').value.trim(), instagram:$('pIg').value.trim().replace(/^@/,''), signature:$('pSig').value.trim()};
  if (!body.full_name) { toast('Wpisz imię i nazwisko.'); return false; }
  const { error } = await sb.from('profiles').update(body).eq('id', S.me.id); if (error) { dbErr(error); return false; }
  Object.assign(S.me, body); if (S.profiles.has(S.me.id)) Object.assign(S.profiles.get(S.me.id), body); return true;
}
A.saveProfile = async () => { if (await saveProfileFrom()) { toast('Zapisano profil'); refreshNow(); } };
A.logout = async () => { await sb.auth.signOut(); location.hash = ''; location.reload(); };

/* ================= SZUKANIE LEADÓW ================= */
const TERMS = {
  'Restauracje':['restauracja','sushi','ramen','pierogarnia'], 'Kawiarnie i słodkie':['kawiarnia','cukiernia','lodziarnia','bubble tea'], 'Bary, puby i kluby':['pub','bar koktajlowy','klub muzyczny','winiarnia'],
  'Fast food i street food':['burger','pizzeria','kebab','food truck'], 'Produkty spożywcze i napoje':['lokalny producent żywności','palarnia kawy','browar rzemieślniczy'], 'Atrakcje i integracje':['escape room','kręgielnia','park trampolin','paintball','bilard'],
  'Kultura i warsztaty':['warsztaty ceramiczne','teatr','kino studyjne','galeria sztuki'], 'Siłownie i fitness':['siłownia','studio jogi','pilates','szkoła tańca'], 'Obiekty i kluby sportowe':['ścianka wspinaczkowa','klub bokserski','korty squash'],
  'Fryzjer i barber':['barber shop','fryzjer'], 'Salony kosmetyczne i spa':['salon kosmetyczny','paznokcie','spa'], 'Tatuaż i piercing':['studio tatuażu','piercing'], 'Odzież i obuwie':['butik odzieżowy','polska marka odzieżowa','second hand'],
  'Biżuteria i akcesoria':['biżuteria handmade','optyk'], 'Merch, dom i prezenty':['sklep z prezentami','kwiaciarnia','świece sojowe'], 'Edukacja i kursy':['szkoła językowa','kursy programowania','szkoła jazdy'],
  'Foto, druk i eventy':['fotograf','drukarnia','fotobudka'], 'Transport, podróże i noclegi':['hostel','biuro podróży']
};
const GQ = q => 'https://www.google.com/search?q=' + enc(q);
const LNK = (h, t, s) => `<a href="${esc(h)}" target="_blank" rel="noopener"><b>${esc(t)}</b><small>${esc(s)}</small></a>`;
const tagOf = s => fold(s).replace(/[^a-z0-9]/g,'');
V.narzedzia = {
  nav:'wiecej',
  html(){
    const t = S.ui.nt = S.ui.nt || 'check';
    return `<div class="vhead"><div><h1>Szukanie leadów</h1><p class="sub">Sprawdź, czy firma jest już w bazie, znajdź nowe firmy i ich kontakty.</p></div></div>
      <div class="subtabs">${[['check','Sprawdź nowe firmy'],['find','Szukaj firm'],['mail','Szukaj maila'],['guide','Poradnik']].map(([k,l]) => `<button data-act="ntab" data-k="${k}" aria-selected="${t===k}">${l}</button>`).join('')}</div>
      ${t === 'check' ? `<div class="box"><label class="lbl" for="ckIn">Wklej firmy (jedna w linii)</label><textarea id="ckIn" class="mono" rows="7" placeholder="nazwa z Google Maps, link do Instagrama albo kolumna z Excela">${esc(S.ui.ckText||'')}</textarea>
        <div class="row"><button class="btn pri" data-act="ckRun">Sprawdź w bazie</button><button class="btn" data-act="ckCopy">Kopiuj nowe firmy</button></div></div><div class="list" id="ckRes"></div>` : ''}
      ${t === 'find' ? `<div class="box"><div class="fgrid" style="grid-template-columns:1.4fr 1.4fr 1fr"><div class="field"><label class="lbl" for="gCat">Kategoria</label><select id="gCat">${optList(Object.keys(TERMS).map(c => [c,c]), S.ui.gCat)}</select></div>
        <div class="field"><label class="lbl" for="gQ">Albo własne hasło</label><input type="text" id="gQ" value="${esc(S.ui.gQ||'')}"></div><div class="field"><label class="lbl" for="gCity">Miasto</label><input type="text" id="gCity" value="${esc(S.ui.gCity||'Wrocław')}"></div></div><div id="gCov" class="row"></div></div><div class="box" id="gLinks"></div>` : ''}
      ${t === 'mail' ? `<div class="box"><div class="fgrid" style="grid-template-columns:1.3fr 1.3fr 1fr"><div class="field"><label class="lbl" for="mName">Nazwa firmy</label><input type="text" id="mName" value="${esc(S.ui.mName||'')}"></div>
        <div class="field"><label class="lbl" for="mSite">Strona www</label><input type="text" id="mSite" value="${esc(S.ui.mSite||'')}" placeholder="np. firma.pl"></div><div class="field"><label class="lbl" for="mCity">Miasto</label><input type="text" id="mCity" value="${esc(S.ui.mCity||'Wrocław')}"></div></div><p class="hint" id="mInBase"></p></div>
        <div class="box"><h3>Otwórz wyszukiwanie</h3><div class="links" id="mLinks"></div></div><div class="box" id="mGuessBox"><h3>Typowe adresy do sprawdzenia</h3><p class="hint">To wzory, nie znalezione maile – sprawdź je przed wysłaniem.</p><div class="guess" id="mGuess"></div></div>` : ''}
      ${t === 'guide' ? guideHTML() : ''}`;
  },
  after(){
    const t = S.ui.nt;
    if (t === 'check') { if (S.ui.ckText) A.ckRun(); else $('ckRes').innerHTML = `<div class="empty">Wklej nazwy firm i kliknij „Sprawdź w bazie”.</div>`; }
    if (t === 'find') { ['gCat','gQ','gCity'].forEach(id => $(id).addEventListener('input', findRender)); findRender(); }
    if (t === 'mail') { ['mName','mSite','mCity'].forEach(id => $(id).addEventListener('input', mailRender)); mailRender(); }
  }
};
A.ntab = el => { S.ui.nt = el.dataset.k; go('narzedzia'); };
A.ckRun = () => {
  const text = $('ckIn').value; S.ui.ckText = text; const seen = new Set(), lines = [];
  text.split(/\r?\n/).forEach(l => { const x = l.split('\t')[0].replace(/^\s*(?:[-•*]|\d+[.)])\s*/,'').trim(); if (!x) return; const k = keyOf(x); if (k.length < 2 || seen.has(k)) return; seen.add(k); lines.push({raw:x, k}); });
  const r = S.ui.ckRes = lines.map(({raw,k}) => { const hit = S.idx.get(k); if (hit) return {raw, kind:'in', recs:hit};
    const b = bigrams(k), c = []; for (const f of S.list){ const sc = (k.length >= 5 && f._k.length >= 5 && (f._k.includes(k) || k.includes(f._k))) ? .9 : dice(b, f._b); if (sc >= .72) c.push([sc,f]); }
    c.sort((a,b) => b[0]-a[0]); return c.length ? {raw, kind:'maybe', recs:c.slice(0,3).map(x => x[1])} : {raw, kind:'new', recs:[]}; });
  const n = k => r.filter(x => x.kind === k).length, add = raw => `<button class="btn sm" data-act="newFirm" data-name="${esc(raw)}">+ Dodaj do bazy</button>`;
  $('ckRes').innerHTML = !r.length ? `<div class="empty">Brak nazw.</div>` : `<div class="row"><span class="pill s-new">Nowe: ${n('new')}</span><span class="pill s-Y">Podobna nazwa: ${n('maybe')}</span><span class="pill s-">Już w bazie: ${n('in')}</span></div>` +
    [...r].sort((a,b) => ({new:0,maybe:1,in:2}[a.kind]) - ({new:0,maybe:1,in:2}[b.kind])).map(x => x.kind === 'new' ? `<div class="card b-new"><div class="top"><span class="name">${esc(x.raw)}</span><span class="row"><span class="pill s-new">Nowa</span>${add(x.raw)}</span></div></div>`
      : x.kind === 'in' ? x.recs.map(f => firmCard(f, `<div class="hint">wpisane: ${esc(x.raw)}</div>`)).join('')
      : `<div class="card b-Y"><div class="top"><span class="name">${esc(x.raw)}</span><span class="row"><span class="pill s-Y">Podobna nazwa</span>${add(x.raw)}</span></div>${x.recs.map(f => `<div><a href="#" data-act="openFirm" data-id="${esc(f.id)}">${esc(f.name)}</a> ${stagePill(f)} <span class="hint">${esc(f.category||'')}${f.owner_id ? ' · prowadzi ' + esc(pname(f.owner_id)) : ''}</span></div>`).join('')}</div>`).join('');
};
A.ckCopy = () => { const r = (S.ui.ckRes || []).filter(x => x.kind === 'new').map(x => x.raw); if (!r.length) return toast('Brak nowych firm'); copyText(r.join('\n'), `Skopiowano ${r.length} nowych firm`); };
function findRender(){
  const cat = $('gCat').value, own = $('gQ').value.trim(), city = $('gCity').value.trim() || 'Wrocław', cf = fold(city);
  Object.assign(S.ui, {gCat:cat, gQ:own, gCity:city});
  const inCity = S.list.filter(f => f.category === cat && (cf === 'wroclaw' ? f.reach === 'Wrocław' : fold(f.address).includes(cf))), c = s => inCity.filter(f => f.stage === s).length;
  $('gCov').innerHTML = own ? '' : `<span class="hint">W bazie (${esc(city)}):</span><span class="pill s-">${inCity.length}</span><span class="pill s-G">współpraca ${c('wspolpraca')}</span><span class="pill s-Y">nie teraz ${c('pozniej')}</span><span class="pill s-R">odmowa ${c('odmowa')}</span>`;
  const terms = own ? [own] : TERMS[cat];
  const groups = [['Mapy', terms.map(t => LNK(`https://www.google.com/maps/search/${enc(t + ' ' + city)}`, t, 'Google Maps'))],
    ['Social media', terms.flatMap(t => [LNK(`https://www.instagram.com/explore/tags/${enc(tagOf(t) + tagOf(city))}/`, '#' + tagOf(t) + tagOf(city), 'Instagram'), LNK(GQ(`site:instagram.com ${t} ${city}`), t, 'profile na Instagramie'), LNK(`https://www.facebook.com/search/pages/?q=${enc(t + ' ' + city)}`, t, 'Facebook'), LNK(`https://www.tiktok.com/search?q=${enc(t + ' ' + city)}`, t, 'TikTok')])],
    ['Katalogi', terms.flatMap(t => [LNK(GQ(`site:panoramafirm.pl ${t} ${city}`), t, 'Panorama Firm'), LNK(GQ(`site:pkt.pl ${t} ${city}`), t, 'pkt.pl')])],
    ['Inne pomysły', [LNK(GQ(`${terms[0]} ${city} nowe otwarcie`), 'Nowe otwarcia', 'świeże lokale chętniej robią barter'), LNK(GQ(`ranking ${terms[0]} ${city}`), 'Rankingi', '„top 10 w mieście”'), LNK(GQ(`${terms[0]} ${city} współpraca barter studenci`), 'Kto robi barter', 'firmy otwarte na współpracę')]]];
  $('gLinks').innerHTML = groups.map(([h, ls]) => `<div><div class="lbl" style="margin:6px 0">${esc(h)}</div><div class="links">${ls.join('')}</div></div>`).join('');
}
A.mailFinder = el => { const f = S.firms.get(el.dataset.f); closeLayer(); Object.assign(S.ui, {nt:'mail', mName:f.name, mSite:domainOf(f.website || ''), mCity:cityOf(f) || 'Wrocław'}); go('narzedzia'); };
function mailRender(){
  const name = $('mName').value.trim(), site = $('mSite').value.trim(), city = $('mCity').value.trim() || 'Wrocław', dom = domainOf(site);
  Object.assign(S.ui, {mName:name, mSite:site, mCity:city});
  const hit = name ? S.idx.get(keyOf(name)) : null;
  $('mInBase').innerHTML = hit ? `W bazie: <a href="#" data-act="openFirm" data-id="${esc(hit[0].id)}">${esc(hit[0].name)}</a> – ${hit[0].email ? 'e-mail: ' + esc(hit[0].email) : 'bez maila'}. <button class="btn sm" data-act="editFirm" data-f="${esc(hit[0].id)}">Dopisz kontakt</button>` : (name ? 'Tej firmy nie ma w bazie.' : 'Wpisz nazwę firmy.');
  if (!name && !dom) { $('mLinks').innerHTML = ''; $('mGuessBox').hidden = true; return; }
  const q = name ? `"${name}"` : '', ls = [];
  if (dom) ls.push(LNK(GQ(`"@${dom}"`), `"@${dom}"`, 'adresy z domeny w sieci'), LNK(GQ(`site:${dom} kontakt OR e-mail`), 'Strona: kontakt', dom), LNK(GQ(`site:${dom} polityka prywatności OR regulamin`), 'Polityka prywatności', 'zwykle jest tam mail'), LNK('https://' + dom, dom, 'Ctrl+F „@”'), LNK('https://hunter.io/search/' + enc(dom), 'Hunter.io', 'maile z domeny'));
  if (name) ls.push(LNK(GQ(`${q} ${city} e-mail OR kontakt`), 'Nazwa + e-mail', 'Google'), LNK(GQ(`site:instagram.com ${q}`), 'Instagram', 'przycisk „E-mail” w aplikacji'), LNK(`https://www.facebook.com/search/pages/?q=${enc(name)}`, 'Facebook', 'Informacje → kontakt'), LNK(`https://www.google.com/maps/search/${enc(name + ' ' + city)}`, 'Wizytówka Google', 'strona i telefon'), LNK(GQ(`site:panoramafirm.pl OR site:pkt.pl ${q}`), 'Katalogi firm', 'Panorama Firm, pkt.pl'), LNK(GQ(`site:linkedin.com/in ${q} marketing`), 'Osoba od marketingu', 'LinkedIn'));
  $('mLinks').innerHTML = ls.join('');
  $('mGuessBox').hidden = !dom;
  if (dom) $('mGuess').innerHTML = ['kontakt','biuro','info','hello','marketing','wspolpraca','pr'].map(p => { const a = `${p}@${dom}`; return `<span>${esc(a)} <a href="${esc(GQ('"' + a + '"'))}" target="_blank" rel="noopener">szukaj</a></span>`; }).join('');
}
function guideHTML(){
  return `<div class="box guide"><ol>
    <li><b>Strona firmy: Kontakt, stopka, „O nas”, „Współpraca”.</b></li>
    <li><b>Polityka prywatności i regulamin</b> – zwykle jest tam mail administratora danych.</li>
    <li><b>Ctrl+F „@”</b> na stronie, a w źródle strony (Ctrl+U) szukaj „mailto:”.</li>
    <li><b>Google:</b> <code>"@domena.pl"</code> i <code>site:domena.pl kontakt</code>.</li>
    <li><b>Instagram</b> – w aplikacji profile firmowe mają przycisk „E-mail”.</li>
    <li><b>Facebook</b> – „Informacje” → „Informacje kontaktowe i podstawowe”.</li>
    <li><b>Katalogi:</b> Panorama Firm, pkt.pl, CEIDG, rejestr.io (zarząd spółki → LinkedIn).</li>
    <li><b>Hunter.io / Snov.io</b> – po domenie pokażą znane adresy (darmowy limit).</li>
    <li><b>Brak maila?</b> Napisz w social mediach albo zadzwoń – w CRM to jeden kontakt z firmą.</li>
  </ol><p class="hint">Najlepsze adresy: marketing@, wspolpraca@, pr@ albo imienny adres osoby od marketingu.</p></div>`;
}

/* ================= USTAWIENIA (admin): import i domeny ================= */
V.ustawienia = {
  nav:'wiecej',
  html(){
    if (!isAdmin()) return `<div class="empty">Tylko dla administratorów głównych.</div>`;
    return `<div class="vhead"><div><h1>Ustawienia</h1><p class="sub">Import firm z arkusza i dozwolone domeny logowania.</p></div></div>
      <div class="box"><h3>Dozwolone domeny e-mail</h3><p class="hint">Zalogować się może tylko adres z tych domen (i ich subdomen, np. student.uwr.edu.pl). Każde nowe konto czeka na akceptację admina.</p>
        <input type="text" id="cfgDom" value="${esc((S.cfg.allowed_domains||[]).join(', '))}"><div class="row"><button class="btn" data-act="saveDomains">Zapisz domeny</button></div></div>
      <div class="box"><h3>Import firm z pliku Excel</h3><p class="hint">W Google Sheets wybierz Plik → Pobierz → Microsoft Excel (.xlsx) i wgraj plik tutaj. Zakładki traktuję jako sektory. Obsługuję starą kolumnę „E-mail / social” (rozdzielę ją na e-mail i social media) oraz nowe, osobne kolumny.</p>
        <input type="file" id="impFile" accept=".xlsx,.xls,.csv">
        <label class="chk"><input type="checkbox" id="impUpd"> uzupełnij puste pola istniejących firm</label>
        <div class="row"><button class="btn pri" data-act="runImport">Importuj</button><span class="hint" id="impMsg"></span></div></div>
      <div class="box"><h3>Eksport</h3><div class="row"><button class="btn" data-act="exportXlsx">Pobierz całą bazę (.xlsx)</button></div></div>`;
  }
};
A.saveDomains = async () => {
  const d = $('cfgDom').value.split(/[,;\s]+/).map(x => x.trim().toLowerCase().replace(/^@/,'')).filter(Boolean);
  if (!d.length) return toast('Podaj co najmniej jedną domenę');
  const { error } = await sb.from('app_config').update({allowed_domains:d}).eq('id', 1); if (error) return dbErr(error);
  S.cfg.allowed_domains = d; toast('Zapisano domeny');
};
const HDR = {name:['nazwa','firma'], status:['status'], category:['kategoria'], reach:['zasięg','zasieg'], phone:['telefon'], contact:['e-mail / social','e-mail / link do messengera/ig/linkedina','adres e-mail/ link do messengera/ig/linkedina'],
  email:['e-mail','email'], instagram:['instagram'], facebook:['facebook'], tiktok:['tiktok'], linkedin:['linkedin'], website:['strona / link','strona www','strona'], address:['adres'], collected_by:['kto zebrał','kto zebrał?'], notes:['uwagi'], m1:['mail nr 1'], m2:['mail nr 2'], m3:['mail nr 3']};
const ST_TXT = {'współpraca':'G','chętni – nie teraz':'Y','chętni - nie teraz':'Y','odmowa':'R'};
A.runImport = async () => {
  const file = $('impFile').files[0]; if (!file) return toast('Wybierz plik');
  $('impMsg').textContent = 'Czytam plik…';
  const wb = XLSX.read(await file.arrayBuffer(), {type:'array', cellDates:false});
  const rows = [];
  for (const sh of wb.SheetNames){
    if (/^start$/i.test(sh)) continue;
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sh], {header:1, defval:'', raw:false});
    if (!data.length) continue;
    const head = data[0].map(h => String(h).trim().toLowerCase()); const col = {};
    for (const k in HDR) { const i = head.findIndex(h => HDR[k].includes(h)); if (i >= 0) col[k] = i; }
    if (col.name === undefined) continue;
    const sector = SECTORS.includes(sh) ? sh : (SECTORS.find(s => fold(s) === fold(sh)) || 'Do uzupełnienia');
    for (const r of data.slice(1)){
      const g = k => col[k] !== undefined ? String(r[col[k]] ?? '').trim() : '';
      const name = g('name'); if (!name) continue;
      const sc = splitContact(g('contact'), g('website'));
      const st = ST_TXT[g('status').toLowerCase()] || '';
      const mails = [g('m1'), g('m2'), g('m3')].filter(Boolean);
      rows.push({name, sector, category:g('category'), reach:g('reach'), phone:g('phone'), email:g('email') || sc.email, instagram:g('instagram') || sc.instagram, facebook:g('facebook') || sc.facebook, tiktok:g('tiktok') || sc.tiktok, linkedin:g('linkedin') || sc.linkedin,
        website: (g('website') && !/instagram|facebook|tiktok/i.test(g('website')) ? g('website') : '') || sc.website, address:g('address'), collected_by:g('collected_by'), notes:[g('notes'), sc.rest ? 'Kontakt: ' + sc.rest : ''].filter(Boolean).join('; '), last_mail:mails[mails.length-1] || '', status:st, stage:st === 'G' ? 'wspolpraca' : st === 'Y' ? 'pozniej' : st === 'R' ? 'odmowa' : 'nowa'});
    }
  }
  if (!rows.length) { $('impMsg').textContent = 'Nie znalazłem firm – sprawdź, czy pierwsza kolumna to „Nazwa”.'; return; }
  const ids = new Set(S.firms.keys()), byKey = new Map(S.list.map(f => [f._k, f]));
  const seen = new Set(); const fresh = [], updates = [];
  for (const r of rows){
    const ex = byKey.get(keyOf(r.name));
    if (ex){ if ($('impUpd').checked){ const p = {}; for (const k of ['category','reach','phone','email','instagram','facebook','tiktok','linkedin','website','address','notes']) if (!ex[k] && r[k]) p[k] = r[k]; if (Object.keys(p).length) updates.push([ex.id, p]); } continue; }
    let id = pySlug(r.name), b = id, i = 2; while (ids.has(id) || seen.has(id)) id = `${b}-${i++}`; seen.add(id);
    fresh.push(Object.assign({id}, r));
  }
  $('impMsg').textContent = `Nowe: ${fresh.length}, do uzupełnienia: ${updates.length}. Zapisuję…`;
  for (let i = 0; i < fresh.length; i += 300){ const { error } = await sb.from('firms').insert(fresh.slice(i, i + 300)); if (error) { dbErr(error, 'import'); $('impMsg').textContent = 'Błąd importu.'; return; } }
  for (const [id, p] of updates){ await sb.from('firms').update(p).eq('id', id); }
  fresh.forEach(r => S.firms.set(r.id, prep(Object.assign({owner_id:null, last_contact:null, deleted:false}, r)))); updates.forEach(([id,p]) => { const f = S.firms.get(id); Object.assign(f, p); prep(f); });
  rebuildIndex(); refresh();
  $('impMsg').textContent = `Gotowe: dodano ${fresh.length} nowych firm, uzupełniono ${updates.length}. Pominięto ${rows.length - fresh.length - updates.length} istniejących.`;
};

/* ================= EKSPORT ================= */
A.exportXlsx = () => {
  const head = ['Nazwa','Status','Etap','Prowadzi','Sektor','Kategoria','Zasięg','E-mail','Instagram','Facebook','TikTok','LinkedIn','Strona www','Telefon','Adres','Kto zebrał','Uwagi','Ostatni kontakt'];
  const row = f => [f.name, ST_SHEET[f.status||''], (STAGE[f.stage]||{}).l || '', f.owner_id ? pname(f.owner_id) : '', f.sector, f.category, f.reach, f.email, f.instagram, f.facebook, f.tiktok, f.linkedin, f.website, f.phone, f.address, f.collected_by, f.notes, f.last_contact ? fmtDay(f.last_contact) : ''];
  const mk = rs => { const ws = XLSX.utils.aoa_to_sheet([head, ...rs.map(row)]); ws['!cols'] = [30,16,16,18,18,22,11,30,28,28,20,20,26,15,30,16,40,12].map(w => ({wch:w})); ws['!autofilter'] = {ref:`A1:R${rs.length+1}`}; return ws; };
  const wb = XLSX.utils.book_new(), sorted = [...S.list].sort((a,b) => a.name.localeCompare(b.name,'pl'));
  XLSX.utils.book_append_sheet(wb, mk(sorted), 'Wszystkie');
  for (const s of SECTORS){ const r = sorted.filter(f => f.sector === s); if (r.length) XLSX.utils.book_append_sheet(wb, mk(r), s.slice(0,31)); }
  XLSX.writeFile(wb, `CRM_Komisja_Wspolprac_Zewnetrznych_${todayISO()}.xlsx`);
};
