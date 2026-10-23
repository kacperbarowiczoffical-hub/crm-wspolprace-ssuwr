import { createClient } from '@supabase/supabase-js';

/* ================= konfiguracja ================= */
export const CFG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_ANON_KEY,
  org: 'Komisja ds. Współprac Zewnętrznych',
  orgFull: 'Samorząd Studentów Uniwersytetu Wrocławskiego',
  season: '2026/27'
};
export const sb = CFG.url && CFG.key ? createClient(CFG.url, CFG.key, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce'}}) : null;

/* ================= stałe ================= */
export const SECTORS = ['Gastronomia','Rozrywka i kultura','Sport','Beauty i zdrowie','Moda i zakupy','Usługi i edukacja','Do uzupełnienia'];
export const ST_SHEET = {G:'Współpraca', Y:'Chętni – nie teraz', R:'Odmowa', '':'Brak statusu'};
export const STAGES = [
  {id:'nowa', l:'Nowa', c:''}, {id:'kontakt', l:'Do kontaktu', c:'act'}, {id:'wyslano', l:'Wysłano', c:'act'}, {id:'followup', l:'Follow-up', c:'act'},
  {id:'odpowiedz', l:'Odpowiedź', c:'new'}, {id:'rozmowy', l:'Rozmowy', c:'new'},
  {id:'wspolpraca', l:'Współpraca', c:'G', s:'G'}, {id:'pozniej', l:'Chętni – nie teraz', c:'Y', s:'Y'}, {id:'odmowa', l:'Odmowa', c:'R', s:'R'}
];
export const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));
export const CH = {
  email:{l:'E-mail', ico:'@', kind:'email'}, ig:{l:'Instagram', ico:'IG', kind:'dm', field:'instagram'}, fb:{l:'Facebook / Messenger', ico:'FB', kind:'dm', field:'facebook'},
  tiktok:{l:'TikTok', ico:'TT', kind:'dm', field:'tiktok'}, linkedin:{l:'LinkedIn', ico:'in', kind:'dm', field:'linkedin'},
  phone:{l:'Telefon', ico:'☎', kind:'call'}, visit:{l:'Wizyta osobista', ico:'⌂', kind:'call'}
};
export const ACTL = {contact:'Kontakt z firmą', reply:'Firma odpowiedziała', note:'Notatka', phone:'Telefon', meeting:'Spotkanie', visit:'Wizyta', stage:'Zmiana etapu', edit:'Edycja danych', campaign:'Dodano do kampanii', claim:'Przejęcie firmy'};
export const OUTCOMES = [['rozmowy','Rozmawiamy dalej'],['wspolpraca','Współpraca – zgoda'],['pozniej','Chętni, ale nie teraz'],['odmowa','Odmowa']];
export const ROLES = {admin:'Administrator główny', leader:'Lider zespołu', member:'Członek'};

/* ================= narzędzia ================= */
export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const enc = encodeURIComponent;
export function fold(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l'); }
export function handleOf(s){
  const m = String(s||'').match(/(?:instagram\.com|facebook\.com|tiktok\.com\/@?)\/?([A-Za-z0-9._-]{2,})/i);
  return m && !/^(p|reel|reels|explore|profile\.php|pages|people|share)$/i.test(m[1]) ? m[1] : null;
}
export function keyOf(s){
  let t = fold(s); const h = handleOf(t); if (h) t = h;
  return t.replace(/https?:\/\/|www\./g,'').replace(/sp\.?\s?z\s?o\.?\s?o\.?|\bs\.?a\.?$|\bs\.?c\.?$|\.pl\b|\.com\b|\bwroclaw\b|\bpolska\b|\bofficial\b|\bpoland\b/g,'').replace(/[^a-z0-9]/g,'');
}
export function bigrams(s){ const b = new Set(); for (let i=0;i<s.length-1;i++) b.add(s.slice(i,i+2)); return b; }
export function dice(a,b){ if(!a.size||!b.size) return 0; let n=0; for (const x of a) if (b.has(x)) n++; return 2*n/(a.size+b.size); }
export function pySlug(name){ let s = String(name).toLowerCase().normalize('NFKD').replace(/[^\x00-\x7f]/g,''); s = s.replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60); return s || 'firma'; }
export function slug(s){ return fold(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || 'x'; }
export function rid(){ return Math.random().toString(36).slice(2,8); }
const pad = n => String(n).padStart(2,'0');
export function todayISO(d){ d = d || new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
export function addDays(iso, n){ const [y,m,d] = iso.split('-').map(Number); return todayISO(new Date(y, m-1, d + n)); }
export function diffDays(a, b){ const p = s => { const [y,m,d] = s.split('-').map(Number); return Date.UTC(y,m-1,d); }; return Math.round((p(b)-p(a))/864e5); }
export function fmtDay(iso){ if (!iso) return ''; const [y,m,d] = String(iso).slice(0,10).split('-'); return `${d}.${m}.${y}`; }
export function fmtWhen(ts){
  if (!ts) return ''; const d = new Date(ts); if (isNaN(d)) return fmtDay(ts);
  const t = todayISO(), day = todayISO(d), hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (day === t) return 'dziś ' + hm; if (day === addDays(t,-1)) return 'wczoraj ' + hm;
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)} ${hm}`;
}
export function dueLabel(iso){
  const n = diffDays(todayISO(), iso);
  if (n < 0) return {t:`zaległe ${-n} ${-n===1?'dzień':'dni'}`, late:true};
  if (n === 0) return {t:'dziś'}; if (n === 1) return {t:'jutro'};
  return {t:`za ${n} dni (${fmtDay(iso)})`};
}
export function emailsIn(s){ return [...new Set((String(s||'').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(x => x.replace(/\.$/,'')))]; }
export function urlsIn(s){ return String(s||'').match(/https?:\/\/[^\s,;]+/g) || []; }
export function igHandle(f){ const h = handleOf(f.instagram); if (h) return h; const m = String(f.instagram||'').trim().match(/^@?([\w.]{2,})$/); return m ? m[1] : null; }
export function socialUrl(f, ch){
  const v = String(f[CH[ch].field] || '').trim(); if (!v) return null;
  if (/^https?:\/\//.test(v)) return v;
  const h = v.replace(/^@/,'');
  if (ch === 'ig') return `https://www.instagram.com/${enc(h)}/`;
  if (ch === 'fb') return `https://www.facebook.com/${enc(h)}`;
  if (ch === 'tiktok') return `https://www.tiktok.com/@${enc(h)}`;
  if (ch === 'linkedin') return `https://www.linkedin.com/company/${enc(h)}`;
  return null;
}
export function domainOf(s){
  const t = String(s||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split(/[\/?#\s]/)[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(t) && !/(instagram|facebook|tiktok|linktr|google|booksy)\./.test(t) ? t : '';
}
export function cityOf(f){ if (f.reach === 'Wrocław') return 'Wrocław'; const m = String(f.address||'').match(/\d{2}-\d{3}\s+([A-ZŁŚŻŹĆ][\wąćęłńóśźż-]+)/); return m ? m[1] : (f.reach === 'Polska' ? '' : 'Wrocław'); }
export function shortUrl(u){ return String(u).replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'').slice(0,40); }
export function toast(t){ const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 3000); }
export async function copyText(t, okMsg){
  try { await navigator.clipboard.writeText(t); toast(okMsg || 'Skopiowano'); return true; }
  catch(e){ toast('Nie udało się skopiować – zaznacz tekst i użyj Ctrl+C'); return false; }
}
export function openUrl(u){ const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }

/* rozdzielenie dawnej kolumny „E-mail / social” */
export function splitContact(k, w){
  const out = {email:[], instagram:'', facebook:'', tiktok:'', linkedin:'', website:'', rest:''};
  for (const e of emailsIn(k)) if (!out.email.some(x => x.toLowerCase() === e.toLowerCase())) out.email.push(e);
  for (let u of urlsIn((k||'') + '\n' + (w||''))){
    u = u.replace(/[.,)]+$/,''); const l = u.toLowerCase();
    if (l.includes('instagram.com')) out.instagram = out.instagram || u;
    else if (/facebook\.com|fb\.com|m\.me\/|messenger\.com/.test(l)) out.facebook = out.facebook || u;
    else if (l.includes('tiktok.com')) out.tiktok = out.tiktok || u;
    else if (l.includes('linkedin.com')) out.linkedin = out.linkedin || u;
    else out.website = out.website || u;
  }
  let rest = String(k||'').replace(/https?:\/\/[^\s,;]+/g,'').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,'').replace(/﻿/g,'').replace(/\s+/g,' ').replace(/^[\s,;|\-:/.+]+|[\s,;|\-:/.+]+$/g,'');
  if (/^(www\.)?[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(rest)) { out.website = out.website || 'https://' + rest; rest = ''; }
  if (/^(brak|nie ma|none|x)$/i.test(rest)) rest = '';
  const m = /^(?:ig:\s*)?@?[\w.]+$/i.test(rest) && rest.match(/^(?:ig:\s*)?@?([\w.]*[_.\d][\w.]*)$/i);
  if (m && !out.instagram) { out.instagram = `https://www.instagram.com/${m[1]}/`; rest = ''; }
  out.rest = rest; out.email = out.email.join(', ');
  return out;
}

/* ================= stan ================= */
export const S = {
  session:null, me:null, cfg:{allowed_domains:['uwr.edu.pl']},
  profiles:new Map(), teams:new Map(), tm:[], firms:new Map(), list:[], idx:new Map(),
  camps:new Map(), targets:new Map(), acts:[], tpls:new Map(), replies:new Map(),
  view:'pulpit', arg:null, ui:{}, drawer:null, loaded:false
};
export const isAdmin = () => !!S.me && S.me.role === 'admin' && S.me.status === 'active';
export const isLead = () => !!S.me && (S.me.role === 'admin' || S.me.role === 'leader') && S.me.status === 'active';
export const isActive = () => !!S.me && S.me.status === 'active';
export function myTeams(uid){ uid = uid || (S.me && S.me.id); const ids = new Set(S.tm.filter(x => x.user_id === uid).map(x => x.team_id)); for (const [id,t] of S.teams) if (t.leader_id === uid) ids.add(id); return [...ids].map(id => S.teams.get(id)).filter(Boolean); }
export function ledTeams(){ return isAdmin() ? [...S.teams.values()] : [...S.teams.values()].filter(t => t.leader_id === S.me.id); }
export function teamMembers(t){ const ids = new Set(S.tm.filter(x => x.team_id === t.id).map(x => x.user_id)); if (t.leader_id) ids.add(t.leader_id); return [...ids].filter(id => S.profiles.has(id)); }
export function inTeamScope(f, t){ return (t.sectors||[]).includes(f.sector) || (t.categories||[]).includes(f.category); }
export function firmTeams(f){ return [...S.teams.values()].filter(t => inTeamScope(f, t)); }
export function isMyScope(f){ return myTeams().some(t => inTeamScope(f, t)); }
export function pname(uid){ if (!uid) return '—'; const p = S.profiles.get(uid); return (p && (p.full_name || p.email)) || 'ktoś z zespołu'; }
export function pfirst(uid){ return pname(uid).split(/[\s@]/)[0]; }
export function initials(uid){ const n = pname(uid).split(/\s+/); return ((n[0]||'')[0] || '?').toUpperCase() + ((n[1]||'')[0] || '').toUpperCase(); }
export function avatarHTML(uid){ let h = 0; for (const c of String(uid)) h = (h*31 + c.charCodeAt(0)) % 360; return `<span class="av" style="--h:${h}" aria-hidden="true">${esc(initials(uid))}</span>`; }

export function prep(f){ f._k = keyOf(f.name); f._b = bigrams(f._k); f._t = fold([f.name, f.category, f.sector, f.address, f.notes, f.collected_by, f.email, f.instagram, f.facebook, f.website].join(' ')); return f; }
export function rebuildIndex(){
  S.list = [...S.firms.values()].filter(f => !f.deleted);
  S.idx = new Map();
  const add = (k,f) => { if (k && k.length >= 2){ if (!S.idx.has(k)) S.idx.set(k, []); const a = S.idx.get(k); if (!a.includes(f)) a.push(f); } };
  for (const f of S.list){ add(f._k, f); for (const v of [f.instagram, f.facebook, f.tiktok]) { const h = handleOf(v); if (h) add(keyOf(h), f); } }
}

/* ================= render ================= */
export const V = {}; export const A = {};
let rq = 0;
export function refresh(){ if (rq) return; rq = requestAnimationFrame(() => { rq = 0; refreshNow(); }); }
export function refreshNow(){
  const v = V[S.view];
  if (v && v.parts) for (const id in v.parts){ const el = $(id); if (el) el.innerHTML = v.parts[id](); }
  if (S.drawer && V.__drawer) V.__drawer();
  refreshChrome();
}
export function go(view, arg){
  if (!V[view]) view = 'pulpit';
  S.view = view; S.arg = arg === undefined ? null : arg;
  const v = V[view];
  $('main').innerHTML = v.html();
  if (v.parts) for (const id in v.parts){ const el = $(id); if (el) el.innerHTML = v.parts[id](); }
  if (v.after) v.after();
  const navKey = v.nav || view;
  document.querySelectorAll('#rail [data-go]').forEach(b => { if (b.dataset.go === navKey) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
  refreshChrome();
  try { localStorage.setItem('crm-view', ['kampania','nowa'].includes(view) ? 'pulpit' : view); } catch(e){}
  const h = '#' + view + (S.arg ? '/' + S.arg : ''); if (location.hash !== h) history.replaceState(null, '', h);
  window.scrollTo({top:0});
}
export function refreshChrome(){
  if (!S.me) return;
  $('whoName').textContent = S.me.full_name || S.me.email;
  $('whoRole').textContent = ROLES[S.me.role] || '';
  $('whoAv').innerHTML = avatarHTML(S.me.id);
  if (V.__badge) V.__badge();
}
export function openModal(html, onMount){
  $('layer').innerHTML = `<div class="modal" id="modal"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $('modal').addEventListener('mousedown', ev => { if (ev.target.id === 'modal') closeLayer(); });
  if (onMount) onMount();
  const first = $('layer').querySelector('input:not([type=checkbox]),select,textarea'); if (first) first.focus();
}
export function closeLayer(){ $('layer').innerHTML = ''; S.drawer = null; }
export function optList(pairs, sel){ return pairs.map(([v,l]) => `<option value="${esc(v)}"${String(v)===String(sel ?? '')?' selected':''}>${esc(l)}</option>`).join(''); }
export function peopleOpts(sel, emptyLabel, ids){
  const list = (ids || [...S.profiles.keys()]).map(id => S.profiles.get(id)).filter(p => p && p.status === 'active').sort((a,b) => (a.full_name||a.email).localeCompare(b.full_name||b.email,'pl'));
  return `<option value="">${esc(emptyLabel || '— nikt —')}</option>` + list.map(p => `<option value="${esc(p.id)}"${p.id===sel?' selected':''}>${esc(p.full_name || p.email)}</option>`).join('');
}
export function stagePill(f){ const s = STAGE[f.stage] || STAGE.nowa; return `<span class="pill s-${s.c}">${esc(s.l)}</span>`; }
export function chTag(ch){ return `<span class="chan">${esc((CH[ch]||{ico:'·'}).ico)}</span>`; }

/* ================= zapis ================= */
export function dbErr(error, what){
  console.warn(what, error);
  const m = String(error && (error.message || error.code) || '');
  if (/row-level security|permission|42501/i.test(m)) toast('Nie masz uprawnień do tej operacji.');
  else if (/JWT|session/i.test(m)) toast('Sesja wygasła – zaloguj się ponownie.');
  else toast('Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.');
}
export async function updateFirm(id, patch){
  const f = S.firms.get(id); if (!f) return false;
  const prev = Object.assign({}, f);
  Object.assign(f, patch); if (patch.stage && STAGE[patch.stage].s) f.status = STAGE[patch.stage].s;
  prep(f); rebuildIndex(); refresh();
  const { error } = await sb.from('firms').update(patch).eq('id', id);
  if (error){ Object.assign(f, prev); prep(f); rebuildIndex(); refresh(); dbErr(error, 'firm'); return false; }
  return true;
}
export async function insertFirm(row){
  const { data, error } = await sb.from('firms').insert(row).select().single();
  if (error){ dbErr(error, 'insert firm'); return null; }
  S.firms.set(data.id, prep(data)); rebuildIndex(); refresh(); return data;
}
export async function logAct(row){
  const body = Object.assign({by:S.me.id}, row); Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
  const { data, error } = await sb.from('activities').insert(body).select().single();
  if (error){ dbErr(error, 'activity'); return null; }
  if (!S.acts.some(a => a.id === data.id)) S.acts.unshift(data);
  refresh(); return data;
}
export async function setTarget(cid, fid, patch){
  if (!S.targets.has(cid)) S.targets.set(cid, new Map());
  const m = S.targets.get(cid); const cur = Object.assign({campaign_id:cid, firm_id:fid}, m.get(fid) || {}, patch);
  m.set(fid, cur); refresh();
  const { error } = await sb.from('campaign_targets').upsert(cur, {onConflict:'campaign_id,firm_id'});
  if (error){ dbErr(error, 'target'); return false; }
  return true;
}

/* ================= wczytanie + realtime ================= */
async function fetchAll(table, order){
  let out = [], from = 0;
  for (;;){
    let q = sb.from(table).select('*'); if (order) q = q.order(order[0], {ascending: order[1] !== 'desc'});
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    out = out.concat(data); if (data.length < 1000) break; from += 1000;
  }
  return out;
}
export async function loadAll(){
  const [profiles, teams, tm, firms, camps, targets, tpls, replies, acts] = await Promise.all([
    fetchAll('profiles'), fetchAll('teams'), fetchAll('team_members'), fetchAll('firms', ['name','asc']), fetchAll('campaigns'),
    fetchAll('campaign_targets'), fetchAll('templates'), fetchAll('reply_contents'),
    sb.from('activities').select('*').order('at', {ascending:false}).limit(1500).then(r => { if (r.error) throw r.error; return r.data; })
  ]);
  S.profiles = new Map(profiles.map(p => [p.id, p]));
  S.me = S.profiles.get(S.me.id) || S.me;
  S.teams = new Map(teams.map(t => [t.id, t])); S.tm = tm;
  S.firms = new Map(firms.map(f => [f.id, prep(f)])); rebuildIndex();
  S.camps = new Map(camps.map(c => [c.id, c]));
  S.targets = new Map(); for (const t of targets){ if (!S.targets.has(t.campaign_id)) S.targets.set(t.campaign_id, new Map()); S.targets.get(t.campaign_id).set(t.firm_id, t); }
  S.tpls = new Map(tpls.map(t => [t.id, t]));
  S.replies = new Map(replies.map(r => [r.activity_id, r.body]));
  S.acts = acts; S.loaded = true;
}
export function subscribeRealtime(){
  sb.channel('crm-all').on('postgres_changes', {event:'*', schema:'public'}, p => {
    const row = p.new && Object.keys(p.new).length ? p.new : null, old = p.old || {};
    switch (p.table){
      case 'firms': if (row) S.firms.set(row.id, prep(row)); else S.firms.delete(old.id); rebuildIndex(); break;
      case 'profiles': if (row) { S.profiles.set(row.id, row); if (row.id === S.me.id) { const was = S.me.status; S.me = row; if (was !== row.status) location.reload(); } } else S.profiles.delete(old.id); break;
      case 'teams': if (row) S.teams.set(row.id, row); else S.teams.delete(old.id); break;
      case 'team_members': if (p.eventType === 'DELETE') S.tm = S.tm.filter(x => !(x.team_id === old.team_id && x.user_id === old.user_id)); else if (!S.tm.some(x => x.team_id === row.team_id && x.user_id === row.user_id)) S.tm.push(row); break;
      case 'campaigns': if (row) S.camps.set(row.id, row); else { S.camps.delete(old.id); S.targets.delete(old.id); } break;
      case 'campaign_targets': if (row) { if (!S.targets.has(row.campaign_id)) S.targets.set(row.campaign_id, new Map()); S.targets.get(row.campaign_id).set(row.firm_id, row); } else if (old.campaign_id && S.targets.has(old.campaign_id)) S.targets.get(old.campaign_id).delete(old.firm_id); break;
      case 'activities': if (row) { const i = S.acts.findIndex(a => a.id === row.id); if (i >= 0) S.acts[i] = row; else S.acts.unshift(row); } else S.acts = S.acts.filter(a => a.id !== old.id); break;
      case 'templates': if (row) S.tpls.set(row.id, row); else S.tpls.delete(old.id); break;
    }
    refresh();
  }).subscribe();
}

/* ================= szablony i zmienne ================= */
export const BUILTIN_TPL = [
  {id:'b-first', builtin:true, channel:'email', name:'Pierwszy kontakt – propozycja współpracy', subject:'Współpraca z Samorządem Studentów UWr – {{kampania}}',
   body:'Dzień dobry,\n\nnazywam się {{imie}} {{nazwisko}} i działam w Komisji ds. Współprac Zewnętrznych Samorządu Studentów Uniwersytetu Wrocławskiego. Piszę, bo przy planowaniu projektu „{{kampania}}” od razu pomyśleliśmy o {{firma}}.\n\n{{cel}}\n\nDocieramy do studentów UWr przez nasze media społecznościowe, wydarzenia i kanały uczelniane. Chętnie opowiem, jak mogłaby wyglądać współpraca. Czy znajdą Państwo 10 minut na krótką rozmowę w tym lub przyszłym tygodniu?\n\n{{podpis}}'},
  {id:'b-follow', builtin:true, channel:'email', name:'Follow-up po kilku dniach', subject:'Re: Współpraca z Samorządem Studentów UWr – {{kampania}}',
   body:'Dzień dobry,\n\nwracam do mojej wiadomości sprzed kilku dni w sprawie projektu „{{kampania}}”. Wiem, że skrzynka potrafi być pełna, więc krótko: bardzo chcielibyśmy zrobić to razem z {{firma}}.\n\nJeśli to dobry moment, podeślę szczegóły albo zadzwonię. A jeśli nie – też proszę dać znać, nie będę więcej zawracać głowy.\n\n{{podpis}}'},
  {id:'b-later', builtin:true, channel:'email', name:'Powrót po „nie teraz”', subject:'Wracamy z propozycją – Samorząd Studentów UWr',
   body:'Dzień dobry,\n\njakiś czas temu rozmawialiśmy o współpracy i dali Państwo znać, że to nie był najlepszy moment. Wracam z nowym projektem – „{{kampania}}”.\n\n{{cel}}\n\nCzy tym razem moglibyśmy porozmawiać? Dopasujemy formę do Państwa możliwości.\n\n{{podpis}}'},
  {id:'b-thanks', builtin:true, channel:'email', name:'Podziękowanie po współpracy', subject:'Dziękujemy za współpracę przy „{{kampania}}”',
   body:'Dzień dobry,\n\nbardzo dziękujemy za współpracę przy projekcie „{{kampania}}”. Dzięki {{firma}} mogliśmy zrobić coś naprawdę fajnego dla studentów UWr.\n\nW najbliższych dniach podeślemy krótkie podsumowanie i zdjęcia. Będzie nam miło współpracować także przy kolejnych projektach.\n\n{{podpis}}'},
  {id:'b-dm', builtin:true, channel:'dm', name:'Social media – pierwsza wiadomość', subject:'',
   body:'Hej! Tu {{imie}} z Komisji ds. Współprac Zewnętrznych Samorządu Studentów UWr 👋 Przygotowujemy „{{kampania}}” i bardzo chcielibyśmy zrobić to razem z {{firma}}. Wysłałem/am też szczegóły mailem – mogę podesłać je tutaj?'},
  {id:'b-dm2', builtin:true, channel:'dm', name:'Social media – przypomnienie', subject:'',
   body:'Hej, przypominam się w sprawie „{{kampania}}” 🙂 Daj znać, czy temat jest dla Was ciekawy – chętnie dopasujemy formę współpracy.'},
  {id:'b-phone', builtin:true, channel:'call', name:'Telefon – skrypt rozmowy', subject:'',
   body:'Dzień dobry, {{imie}} {{nazwisko}}, Samorząd Studentów Uniwersytetu Wrocławskiego.\nDzwonię w sprawie współpracy przy projekcie „{{kampania}}”. Czy rozmawiam z osobą, która zajmuje się marketingiem lub współpracami?\n\n→ Krótko: {{cel}}\n→ Zapytaj o najlepszy adres e-mail i osobę kontaktową.\n→ Ustal, kiedy wysłać szczegóły i kiedy się odezwać.\n\nNa koniec: podziękuj i potwierdź, że szczegóły przyjdą mailem dziś.'}
];
export function allTpls(){ return [...BUILTIN_TPL, ...[...S.tpls.values()]]; }
export function tplById(id){ return allTpls().find(t => t.id === id); }
const T = id => BUILTIN_TPL.find(t => t.id === id);
export const PRESETS = {
  standard:{l:'E-mail + Instagram → przypomnienie → telefon', steps:[
    {day:0, channels:['email','ig'], label:'Pierwszy kontakt', subject:T('b-first').subject, body:T('b-first').body, dm:T('b-dm').body, script:''},
    {day:4, channels:['email','ig'], label:'Przypomnienie', subject:T('b-follow').subject, body:T('b-follow').body, dm:T('b-dm2').body, script:''},
    {day:9, channels:['phone'], label:'Telefon', subject:'', body:'', dm:'', script:T('b-phone').body}]},
  social:{l:'Social media + e-mail → przypomnienie', steps:[
    {day:0, channels:['ig','fb','email'], label:'Pierwszy kontakt', subject:T('b-first').subject, body:T('b-first').body, dm:T('b-dm').body, script:''},
    {day:5, channels:['ig','email'], label:'Przypomnienie', subject:T('b-follow').subject, body:T('b-follow').body, dm:T('b-dm2').body, script:''}]},
  later:{l:'Powrót do „chętni, ale nie teraz”', steps:[
    {day:0, channels:['email','ig'], label:'Powrót z propozycją', subject:T('b-later').subject, body:T('b-later').body, dm:T('b-dm').body, script:''},
    {day:6, channels:['email'], label:'Przypomnienie', subject:T('b-follow').subject, body:T('b-follow').body, dm:'', script:''}]}
};
export const VARS = ['firma','kategoria','miasto','kampania','cel','imie','nazwisko','funkcja','telefon','podpis'];
export function signature(p){ p = p || S.me || {}; return p.signature || [p.full_name, (p.fn ? p.fn + ', ' : '') + CFG.org, CFG.orgFull, p.phone, p.email].filter(Boolean).join('\n'); }
export function fillVars(text, f, camp, p){
  p = p || S.me || {};
  const [imie, ...rest] = String(p.full_name || '').trim().split(/\s+/);
  const map = {firma: f ? f.name : '', kategoria: f ? String(f.category||'').toLowerCase() : '', miasto: f ? cityOf(f) : '', kampania: camp ? camp.name : '', cel: camp ? (camp.goal||'') : '',
    imie: imie || '', nazwisko: rest.join(' '), funkcja: p.fn || '', telefon: p.phone || '', podpis: signature(p)};
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k) => map[k] !== undefined ? map[k] : all);
}
export function outlookUrl(to, subject, body){
  const kind = (S.me && S.me.outlook_kind) || 'web';
  if (kind === 'app') return `mailto:${to.split(/[;,]/).map(s => s.trim()).filter(Boolean).join(',')}?subject=${enc(subject)}&body=${enc(body)}`;
  const base = kind === 'live' ? 'https://outlook.live.com/mail/0/deeplink/compose' : 'https://outlook.office.com/mail/deeplink/compose';
  return `${base}?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`;
}

/* ================= prompty do darmowego AI ================= */
export const AI_TOOLS = [
  ['https://copilot.microsoft.com/', 'Microsoft Copilot', 'za darmo, zaloguj się kontem uczelnianym'],
  ['https://chatgpt.com/', 'ChatGPT', 'darmowa wersja'],
  ['https://gemini.google.com/app', 'Google Gemini', 'darmowa wersja']
];
export function firmBrief(f){
  return [`Nazwa: ${f.name}`, `Branża: ${f.sector || ''}${f.category ? ' / ' + f.category : ''}`, `Miasto: ${cityOf(f) || 'brak danych'}`,
    f.website ? `Strona: ${f.website}` : '', igHandle(f) ? `Instagram: @${igHandle(f)}` : '', f.notes ? `Uwagi z naszej bazy: ${f.notes}` : ''].filter(Boolean).join('\n');
}
export function contactPrompt(f, camp, step, parts){
  const p = S.me || {};
  const want = [];
  if (parts.email) want.push(`E-MAIL – forma „Państwo”, maksymalnie 140 słów, zakończ podpisem bez zmian.\nWersja bazowa:\nTemat: ${parts.subject}\n${parts.body}`);
  if (parts.dm) want.push(`WIADOMOŚĆ NA ${parts.dmLabel.toUpperCase()} – luźniej, maksymalnie 60 słów, bez podpisu, nawiązuje do tego, że wysłaliśmy też maila.\nWersja bazowa:\n${parts.dm}`);
  if (parts.script) want.push(`SKRYPT ROZMOWY TELEFONICZNEJ – krótkie punkty.\nWersja bazowa:\n${parts.script}`);
  return `Jesteś członkiem Komisji ds. Współprac Zewnętrznych Samorządu Studentów Uniwersytetu Wrocławskiego. Pomóż mi napisać spersonalizowane wiadomości do firmy, z którą chcemy nawiązać współpracę (barter, sponsoring, zniżki dla studentów).

FIRMA
${firmBrief(f)}

PROJEKT
${camp ? `Nazwa: ${camp.name}\nCo proponujemy: ${camp.goal || '—'}` : 'Ogólna propozycja współpracy z Samorządem Studentów UWr.'}${step ? `\nEtap kontaktu: ${step.label || ''} (dzień ${step.day} ścieżki)` : ''}

NADAWCA
${p.full_name || ''}${p.fn ? ', ' + p.fn : ''}

CO PRZYGOTOWAĆ
${want.join('\n\n')}

ZASADY
- Pisz po polsku, naturalnie i konkretnie, bez przesadnych komplementów.
- Nawiąż do branży albo charakteru firmy tylko na podstawie danych powyżej. Nie wymyślaj faktów o firmie, liczb ani zasięgów.
- Zachowaj sens propozycji i prośbę o odpowiedź.

FORMAT ODPOWIEDZI – dokładnie tak, bez dodatkowych komentarzy:
${parts.email ? 'TEMAT: ...\nE-MAIL:\n...\n' : ''}${parts.dm ? 'DM:\n...\n' : ''}${parts.script ? 'TELEFON:\n...\n' : ''}`;
}
export function parseAiAnswer(text){
  const out = {}; const t = String(text || '').replace(/\r/g,'');
  const re = /^\s*\**\s*(TEMAT|E-?MAIL|DM|TELEFON)\s*\**\s*:\s*/gim; const marks = [];
  let m; while ((m = re.exec(t))) marks.push({k:m[1].toUpperCase().replace('-',''), i:m.index, j:re.lastIndex});
  marks.forEach((mk, n) => { const v = t.slice(mk.j, n + 1 < marks.length ? marks[n+1].i : t.length).trim(); out[mk.k] = v; });
  return {subject: out.TEMAT ? out.TEMAT.split('\n')[0].trim() : undefined, body: out.EMAIL, dm: out.DM, script: out.TELEFON};
}
export function pathPrompt(name, goal, steps){
  return `Piszę wiadomości dla Komisji ds. Współprac Zewnętrznych Samorządu Studentów Uniwersytetu Wrocławskiego, która szuka partnerów (barter, sponsoring, zniżki dla studentów).

PROJEKT: ${name || 'projekt studencki'}
CO PROPONUJEMY FIRMOM: ${goal || '—'}

ŚCIEŻKA KONTAKTU (kroki po kolei):
${steps.map((s,i) => `Krok ${i+1}, dzień ${s.day}: ${s.label || ''} – kanały: ${s.channels.map(c => CH[c].l).join(' + ')}`).join('\n')}

Napisz treści dla każdego kroku jako szablony. Używaj zmiennych dokładnie w tej formie: {{firma}}, {{kategoria}}, {{imie}}, {{nazwisko}}, {{kampania}}, {{cel}}, {{podpis}}.
- E-mail: forma „Państwo”, do 130 słów, kończ {{podpis}}; każdy kolejny krótszy i nawiązuje do poprzedniego.
- DM (Instagram / Facebook / TikTok / LinkedIn): luźniej, do 50 słów, bez podpisu.
- Telefon / wizyta: krótki skrypt w punktach.
Nie wymyślaj liczb ani zasięgów, których nie ma w opisie projektu. Pisz tylko te części, które pasują do kanałów danego kroku.

FORMAT ODPOWIEDZI – dokładnie tak:
=== KROK 1 ===
TEMAT: ...
E-MAIL:
...
DM:
...
TELEFON:
...
=== KROK 2 ===
(i tak dalej)`;
}
export function parsePathAnswer(text){
  const parts = String(text || '').split(/^\s*=+\s*KROK\s*(\d+)\s*=+\s*$/gim);
  const out = [];
  for (let i = 1; i < parts.length; i += 2) out[+parts[i] - 1] = parseAiAnswer(parts[i+1]);
  return out;
}
