/**
 * Synchronizacja arkusza „Komisja Marketingowa 26/27 – baza firm” z CRM
 * (crm-wspolprace-ssuwr.vercel.app). Działa w obie strony:
 *  - nowe firmy i poprawki z arkusza trafiają do CRM,
 *  - zmiany z CRM (status, dane kontaktowe, uwagi…) wracają do arkusza,
 *  - firmy dodane w CRM dopisują się na końcu właściwej zakładki.
 * Jeśli to samo pole zmieni się w obu miejscach między synchronizacjami, wygrywa CRM
 * (zapis trafia do zakładki „Log CRM”).
 *
 * Menu „CRM” pojawia się w arkuszu po odświeżeniu strony.
 */

const CFG = {
  URL: 'https://hyvbxngqtpdfhkqlxpqa.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5dmJ4bmdxdHBkZmhrcWx4cHFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3ODk3OTEsImV4cCI6MjEwODM2NTc5MX0.3cpOJCUp7KSl3gE3T4H4Qz3bye6m5Unm_erLzzaJkKk',
  SECRET: '31f6937de8646455cd567485cc770dd4454ff58b76ba02e4',
  // przy PIERWSZEJ synchronizacji: czy dopisać do arkusza firmy, które są tylko w CRM
  DOPISZ_FIRMY_Z_CRM: true,
  CO_ILE_MINUT: 5,
  ID_HDR: 'ID CRM',
  SYNC_HDR: 'CRM sync (nie edytuj)',
  LOG: 'Log CRM',
  PODGLAD: 'Podgląd CRM'
};

const SECTORS = ['Gastronomia', 'Rozrywka i kultura', 'Sport', 'Beauty i zdrowie', 'Moda i zakupy', 'Usługi i edukacja', 'Do uzupełnienia'];
const HDR = {
  name: ['nazwa', 'firma'], status: ['status'], category: ['kategoria'], reach: ['zasięg', 'zasieg'], phone: ['telefon'],
  contact: ['e-mail / social', 'e-mail / link do messengera/ig/linkedina', 'adres e-mail/ link do messengera/ig/linkedina'],
  website: ['strona / link', 'strona www', 'strona'], address: ['adres'], collected_by: ['kto zebrał', 'kto zebrał?'], notes: ['uwagi'],
  m1: ['mail nr 1'], m2: ['mail nr 2'], m3: ['mail nr 3']
};
const ST_TXT = { '': '', 'brak statusu': '', 'współpraca': 'G', 'chętni – nie teraz': 'Y', 'chętni - nie teraz': 'Y', 'odmowa': 'R' };
const ST_SHEET = { '': 'Brak statusu', G: 'Współpraca', Y: 'Chętni – nie teraz', R: 'Odmowa' };
const MF = ['name', 'status', 'category', 'reach', 'phone', 'email', 'instagram', 'facebook', 'tiktok', 'linkedin', 'website', 'address', 'collected_by', 'notes', 'sector'];
const CONTACT = ['email', 'instagram', 'facebook', 'tiktok', 'linkedin'];
const LABEL = { name: 'Nazwa', status: 'Status', category: 'Kategoria', reach: 'Zasięg', phone: 'Telefon', email: 'E-mail', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', linkedin: 'LinkedIn', website: 'Strona', address: 'Adres', collected_by: 'Kto zebrał', notes: 'Uwagi', sector: 'Zakładka (sektor)' };

/* ====================== menu ====================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('CRM')
    .addItem('Podgląd synchronizacji (nic nie zmienia)', 'menuPodglad')
    .addItem('Synchronizuj teraz', 'menuSync')
    .addSeparator()
    .addItem('Włącz automatyczną synchronizację', 'menuWlacz')
    .addItem('Wyłącz automatyczną synchronizację', 'menuWylacz')
    .addToUi();
}
function menuPodglad() { const r = runSync(true); SpreadsheetApp.getActive().getSheetByName(CFG.PODGLAD).activate(); SpreadsheetApp.getUi().alert('Podgląd gotowy – zobacz zakładkę „' + CFG.PODGLAD + '”.\n\n' + r); }
function menuSync() { SpreadsheetApp.getUi().alert('Synchronizacja zakończona.\n\n' + runSync(false)); }
function menuWlacz() {
  menuWylacz(true);
  ScriptApp.newTrigger('syncAuto').timeBased().everyMinutes(CFG.CO_ILE_MINUT).create();
  const r = runSync(false);
  SpreadsheetApp.getUi().alert('Automatyczna synchronizacja włączona (co ' + CFG.CO_ILE_MINUT + ' min).\n\nPierwsza synchronizacja:\n' + r);
}
function menuWylacz(quiet) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncAuto').forEach(t => ScriptApp.deleteTrigger(t));
  if (quiet !== true) SpreadsheetApp.getUi().alert('Automatyczna synchronizacja wyłączona.');
}
function syncAuto() {
  try { runSync(false); }
  catch (e) { log_('BŁĄD', String(e && e.stack || e)); }
}

/* ====================== uruchomienie ====================== */
function runSync(preview) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 'Inna synchronizacja właśnie trwa – spróbuj za chwilę.';
  try {
    const ss = SpreadsheetApp.getActive();
    const props = PropertiesService.getScriptProperties();
    const first = props.getProperty('initDone') !== '1';
    const firms = rpc_('sheet_pull', { p_secret: CFG.SECRET });
    const sheets = {}, tabs = [];
    for (const name of SECTORS) {
      const sh = ss.getSheetByName(name); if (!sh) continue;
      if (!preview) ensureColumns_(sh);
      sheets[name] = sh; tabs.push(readTab_(sh, name));
    }
    const plan = planSync(tabs, firms, { addCrmOnly: !first || CFG.DOPISZ_FIRMY_Z_CRM });
    if (preview) { writePreview_(ss, plan, first); return summary(plan); }
    applyPlan_(sheets, tabs, plan);
    props.setProperty('initDone', '1');
    const s = summary(plan);
    if (plan.changed || plan.report.conflicts.length) log_('sync', s, plan.report.conflicts);
    return s;
  } finally { lock.releaseLock(); }
}

function rpc_(fn, body) {
  const res = UrlFetchApp.fetch(CFG.URL + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: CFG.KEY, Authorization: 'Bearer ' + CFG.KEY }, payload: JSON.stringify(body)
  });
  if (res.getResponseCode() >= 300) throw new Error('CRM ' + fn + ': ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText());
}

function headerMap_(header) {
  const head = header.map(h => String(h).trim().toLowerCase()), col = {};
  for (const k in HDR) { const i = head.findIndex(h => HDR[k].includes(h)); if (i >= 0) col[k] = i; }
  const idi = header.findIndex(h => String(h).trim() === CFG.ID_HDR), syi = header.findIndex(h => String(h).trim() === CFG.SYNC_HDR);
  return { col, idCol: idi >= 0 ? idi : null, syncCol: syi >= 0 ? syi : null };
}

function readTab_(sh, name) {
  const lastRow = sh.getLastRow(), lastCol = Math.max(sh.getLastColumn(), 1);
  const all = sh.getRange(1, 1, Math.max(lastRow, 1), lastCol).getDisplayValues();
  const header = all[0]; const hm = headerMap_(header);
  return { name, header, rows: all.slice(1), col: hm.col, idCol: hm.idCol, syncCol: hm.syncCol, width: lastCol };
}

function ensureColumns_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const header = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  let hm = headerMap_(header);
  if (hm.idCol === null || hm.syncCol === null) {
    let last = header.length; while (last > 0 && !String(header[last - 1]).trim()) last--;
    const at = last + 1;
    if (sh.getMaxColumns() < at + 1) sh.insertColumnsAfter(sh.getMaxColumns(), at + 1 - sh.getMaxColumns());
    sh.getRange(1, at, 1, 2).setValues([[CFG.ID_HDR, CFG.SYNC_HDR]]);
    sh.hideColumns(at, 2);
    try { sh.getRange(1, at, sh.getMaxRows(), 2).protect().setDescription('Synchronizacja z CRM – nie edytuj').setWarningOnly(true); } catch (e) {}
  }
  // filtr ma obejmować też ukryte kolumny, żeby przy sortowaniu ID jechało razem z wierszem
  try {
    const flt = sh.getFilter(), need = sh.getLastColumn();
    if (flt) {
      const r = flt.getRange();
      if (r.getLastColumn() < need || r.getLastRow() < sh.getMaxRows()) {
        const crit = {};
        for (let c = r.getColumn(); c <= r.getLastColumn(); c++) { const cr = flt.getColumnFilterCriteria(c); if (cr) crit[c] = cr.copy().build(); }
        flt.remove();
        const nf = sh.getRange(1, 1, sh.getMaxRows(), need).createFilter();
        for (const c in crit) nf.setColumnFilterCriteria(Number(c), crit[c]);
      }
    }
  } catch (e) { log_('uwaga', 'Nie udało się poszerzyć filtra w „' + sh.getName() + '”: ' + e); }
}

function safeCell_(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }

function applyPlan_(sheets, tabs, plan) {
  const idMap = {};
  if (plan.updates.length || plan.inserts.length || plan.links.length) {
    const r = rpc_('sheet_push', { p_secret: CFG.SECRET, p_updates: plan.updates, p_inserts: plan.inserts.map(i => ({ tmp: i.tmp, id: i.id, f: i.f })), p_links: plan.links });
    (r.inserted || []).forEach(x => idMap[x.tmp] = x.id);
  }
  const realId = id => (String(id).startsWith('tmp:') ? (idMap[id.slice(4)] || '') : id);
  for (const t of tabs) {
    const sh = sheets[t.name];
    for (const w of plan.cellWrites.filter(w => w.tab === t.name)) sh.getRange(w.row + 2, w.col + 1).setValue(safeCell_(w.value));
    const hid = plan.hidden[t.name];
    if (hid && hid.changed && hid.values.length) sh.getRange(2, t.idCol + 1, hid.values.length, 2).setValues(hid.values.map(v => [realId(v[0]), v[1]]));
  }
  for (const t of tabs) {
    const ap = plan.appends.filter(a => a.tab === t.name); if (!ap.length) continue;
    const sh = sheets[t.name];
    let start = t.rows.length; while (start > 0 && !String(t.rows[start - 1][t.col.name] || '').trim()) start--;
    const startRow = start + 2, need = startRow + ap.length - 1;
    if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
    const width = Math.max(t.width, t.syncCol + 1);
    const vals = ap.map(a => { const row = a.values.slice(0, width).map(safeCell_); while (row.length < width) row.push(''); row[t.idCol] = realId(a.id); row[t.syncCol] = a.sync; return row; });
    // nadpisujemy tylko kolumny, które ustawiamy (checkboxy itp. zostają)
    vals.forEach((row, i) => row.forEach((v, c) => { if (v !== '' || c === t.idCol || c === t.syncCol) sh.getRange(startRow + i, c + 1).setValue(v); }));
  }
  for (const t of tabs) {
    const del = plan.deletes.filter(d => d.tab === t.name).map(d => d.row).sort((a, b) => b - a);
    for (const r of del) sheets[t.name].deleteRow(r + 2);
  }
}

function log_(kind, text, conflicts) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.LOG);
  if (!sh) { sh = ss.insertSheet(CFG.LOG); sh.appendRow(['Kiedy', 'Co', 'Szczegóły']); sh.setFrozenRows(1); }
  sh.appendRow([new Date(), kind, String(text).slice(0, 45000)]);
  (conflicts || []).forEach(c => sh.appendRow([new Date(), 'konflikt – wygrał CRM', c.firm + ' · ' + LABEL[c.field] + ': arkusz „' + c.sheet + '” → CRM „' + c.crm + '”']));
  const extra = sh.getLastRow() - 1001; if (extra > 0) sh.deleteRows(2, extra);
}

function writePreview_(ss, plan, first) {
  let sh = ss.getSheetByName(CFG.PODGLAD); if (!sh) sh = ss.insertSheet(CFG.PODGLAD); sh.clear();
  const R = plan.report, out = [];
  const add = (a, b, c, d) => out.push([a || '', b || '', c || '', d || '']);
  add('Podgląd synchronizacji – nic jeszcze nie zostało zmienione', '', '', Utilities.formatDate(new Date(), 'Europe/Warsaw', 'dd.MM.yyyy HH:mm'));
  add(summary(plan)); add();
  if (first) add('To będzie pierwsza synchronizacja: wiersze zostaną połączone z firmami w CRM po nazwie.'); add();
  const sect = (title, rows) => { add(title + ' (' + rows.length + ')'); rows.slice(0, 400).forEach(r => add.apply(null, r)); if (rows.length > 400) add('… i ' + (rows.length - 400) + ' więcej'); add(); };
  sect('Nowe firmy z arkusza → zostaną dodane do CRM', R.newToCrm.map(x => ['', x.name, x.tab]));
  sect('Firmy tylko w CRM → ' + (plan.opts.addCrmOnly ? 'zostaną dopisane do arkusza' : 'NIE zostaną dopisane (DOPISZ_FIRMY_Z_CRM = false)'), R.crmToSheet.map(x => ['', x.name, x.tab]));
  sect('Zmiany z arkusza → CRM', R.toCrm.map(x => ['', x.firm, LABEL[x.field], x.value]));
  sect('Zmiany z CRM → arkusz', R.toSheet.map(x => ['', x.firm, LABEL[x.field], x.value]));
  sect('Różnice, których NIE ruszam (inna wartość w arkuszu i w CRM – popraw ręcznie, jeśli trzeba)', R.diffs.map(x => ['', x.firm, LABEL[x.field], 'arkusz: ' + x.sheet + '  |  CRM: ' + x.crm]));
  sect('Wiersze z ID firmy, której nie ma już w CRM (pomijam)', R.orphans.map(x => ['', x.name, x.tab]));
  sh.getRange(1, 1, out.length, 4).setValues(out);
  sh.setColumnWidth(1, 60); sh.setColumnWidth(2, 320); sh.setColumnWidth(3, 160); sh.setColumnWidth(4, 520);
}

/* ====================== logika (bez Google API – testowalna) ====================== */
function fold(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l'); }
function handleOf(s) {
  const m = String(s || '').match(/(?:instagram\.com|facebook\.com|tiktok\.com\/@?)\/?([A-Za-z0-9._-]{2,})/i);
  return m && !/^(p|reel|reels|explore|profile\.php|pages|people|share)$/i.test(m[1]) ? m[1] : null;
}
function keyOf(s) {
  let t = fold(s); const h = handleOf(t); if (h) t = h;
  return t.replace(/https?:\/\/|www\./g, '').replace(/sp\.?\s?z\s?o\.?\s?o\.?|\bs\.?a\.?$|\bs\.?c\.?$|\.pl\b|\.com\b|\bwroclaw\b|\bpolska\b|\bofficial\b|\bpoland\b/g, '').replace(/[^a-z0-9]/g, '');
}
function bigrams(s) { const b = new Set(); for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2)); return b; }
function dice(a, b) { a = bigrams(a); b = bigrams(b); if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return 2 * n / (a.size + b.size); }
function pySlug(name) { let s = String(name).toLowerCase().normalize('NFKD').replace(/[^\x00-\x7f]/g, ''); s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); return s || 'firma'; }
function emailsIn(s) { return [...new Set((String(s || '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || []).map(x => x.replace(/\.$/, '')))]; }
function urlsIn(s) { return String(s || '').match(/https?:\/\/[^\s,;]+/g) || []; }
function splitContact(k, w) {
  const out = { email: [], instagram: '', facebook: '', tiktok: '', linkedin: '', website: '', rest: '' };
  for (const e of emailsIn(k)) if (!out.email.some(x => x.toLowerCase() === e.toLowerCase())) out.email.push(e);
  for (let u of urlsIn((k || '') + '\n' + (w || ''))) {
    u = u.replace(/[.,)]+$/, ''); const l = u.toLowerCase();
    if (l.includes('instagram.com')) out.instagram = out.instagram || u;
    else if (/facebook\.com|fb\.com|m\.me\/|messenger\.com/.test(l)) out.facebook = out.facebook || u;
    else if (l.includes('tiktok.com')) out.tiktok = out.tiktok || u;
    else if (l.includes('linkedin.com')) out.linkedin = out.linkedin || u;
    else out.website = out.website || u;
  }
  let rest = String(k || '').replace(/https?:\/\/[^\s,;]+/g, '').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '').replace(/﻿/g, '').replace(/\s+/g, ' ').replace(/^[\s,;|\-:/.+]+|[\s,;|\-:/.+]+$/g, '');
  if (/^(www\.)?[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(rest)) { out.website = out.website || 'https://' + rest; rest = ''; }
  if (/^(brak|nie ma|none|x)$/i.test(rest)) rest = '';
  const m = /^(?:ig:\s*)?@?[\w.]+$/i.test(rest) && rest.match(/^(?:ig:\s*)?@?([\w.]*[_.\d][\w.]*)$/i);
  if (m && !out.instagram) { out.instagram = 'https://www.instagram.com/' + m[1] + '/'; rest = ''; }
  out.rest = rest; out.email = out.email.join(', ');
  return out;
}
function socialUrl(k, v) {
  v = String(v || '').trim(); if (!v || /^https?:\/\//i.test(v) || k === 'email') return v;
  const h = v.replace(/^@/, '');
  if (k === 'instagram') return 'https://www.instagram.com/' + h + '/';
  if (k === 'facebook') return 'https://www.facebook.com/' + h;
  if (k === 'tiktok') return 'https://www.tiktok.com/@' + h;
  if (k === 'linkedin') return 'https://www.linkedin.com/company/' + h;
  return v;
}

function sheetModel(row, col, sector) {
  const g = k => col[k] !== undefined ? String(row[col[k]] == null ? '' : row[col[k]]).trim() : '';
  const sc = splitContact(g('contact'), g('website')), w = g('website'), st = g('status'), code = ST_TXT[st.toLowerCase()];
  const mails = [g('m1'), g('m2'), g('m3')].filter(Boolean);
  return {
    name: g('name'), status: code !== undefined ? code : '?' + st, category: g('category'), reach: g('reach'), phone: g('phone'),
    email: sc.email, instagram: sc.instagram, facebook: sc.facebook, tiktok: sc.tiktok, linkedin: sc.linkedin,
    website: (w && !/instagram|facebook|tiktok/i.test(w) ? w : '') || sc.website,
    address: g('address'), collected_by: g('collected_by'), notes: g('notes'), sector,
    _rest: sc.rest, _mail: mails[mails.length - 1] || ''
  };
}
function crmModel(f) { const o = {}; MF.forEach(k => o[k] = String(f[k] == null ? '' : f[k]).trim()); return o; }
function pick(m) { const o = {}; MF.forEach(k => o[k] = m[k]); return o; }

const norm = {
  name: v => keyOf(v), phone: v => String(v).replace(/\D/g, '').replace(/^48(?=\d{9}$)/, ''),
  website: v => String(v).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''),
  email: v => String(v).toLowerCase().split(/[,;\s]+/).filter(Boolean).sort().join(','),
  instagram: v => (handleOf(v) || String(v).replace(/^@/, '')).toLowerCase(), facebook: v => (handleOf(v) || String(v)).toLowerCase(),
  tiktok: v => (handleOf(v) || String(v).replace(/^@/, '')).toLowerCase()
};
function same(k, a, b, rest) {
  if (a === b) return true;
  const n = norm[k] || (v => String(v).replace(/\s+/g, ' ').trim().toLowerCase());
  if (n(a) === n(b)) return true;
  if (k === 'notes' && rest && String(b).trim() === [String(a).trim(), 'Kontakt: ' + rest].filter(Boolean).join('; ')) return true;
  return false;
}
const isEmpty = v => !String(v || '').trim();
function pushable(k, v) {
  if (k === 'status') return !String(v).startsWith('?');
  if (k === 'name') return !isEmpty(v);
  if (k === 'sector') return SECTORS.includes(v);
  return true;
}

/** snap = {s, c, m} albo null (pierwsze połączenie). Zwraca, co wysłać do CRM i co wpisać w arkusz. */
function reconcile(snap, s, c, firmName) {
  const push = {}, write = {}, conflicts = [], diffs = [];
  for (const k of MF) {
    const sv = s[k], cv = c[k];
    if (snap) {
      const sCh = sv !== snap.s[k], cCh = cv !== snap.c[k];
      if (sCh && cCh) { if (!same(k, sv, cv)) { write[k] = cv; conflicts.push({ firm: firmName, field: k, sheet: sv, crm: cv }); } }
      else if (sCh) { if (pushable(k, sv) && !same(k, sv, cv)) push[k] = sv; }
      else if (cCh) { if (!same(k, sv, cv)) write[k] = cv; }
    } else {
      if (same(k, sv, cv, s._rest)) continue;
      const se = isEmpty(sv) || String(sv).startsWith('?'), ce = isEmpty(cv);
      if (k === 'sector') { diffs.push({ firm: firmName, field: k, sheet: sv, crm: cv }); continue; }
      if (se && !ce && !String(sv).startsWith('?')) write[k] = cv;
      else if (ce && !se) { if (pushable(k, sv)) push[k] = sv; }
      else if (k === 'status') write[k] = cv;
      else diffs.push({ firm: firmName, field: k, sheet: sv, crm: cv });
    }
  }
  if (snap && s._mail !== snap.m && s._mail) push.last_mail = s._mail;
  return { push, write, conflicts, diffs };
}

/** wpisuje zmiany do kopii wiersza; zwraca nowy wiersz */
function applyWrites(row, col, s, write) {
  row = row.slice();
  const put = (k, v) => { if (col[k] !== undefined) { while (row.length <= col[k]) row.push(''); row[col[k]] = v; } };
  for (const k of ['name', 'category', 'reach', 'phone', 'address', 'collected_by', 'notes']) if (k in write) put(k, write[k]);
  if ('status' in write) put('status', ST_SHEET[write.status] !== undefined ? ST_SHEET[write.status] : write.status);
  if ('website' in write) put('website', write.website);
  if (CONTACT.some(k => k in write)) {
    const lines = CONTACT.map(k => socialUrl(k, k in write ? write[k] : s[k])).filter(Boolean);
    if (s._rest) lines.push(s._rest);
    put('contact', lines.join('\n'));
  }
  return row;
}

function rowFromFirm(f, col, width) {
  const row = new Array(width).fill('');
  const s0 = { _rest: '' }; CONTACT.forEach(k => s0[k] = '');
  const w = { status: f.status || '' }; MF.forEach(k => { if (k !== 'sector' && f[k]) w[k] = f[k]; });
  return applyWrites(row, col, s0, w);
}

function parseSnap(v) { if (!v) return null; try { const o = JSON.parse(v); return o && o.s && o.c ? o : null; } catch (e) { return null; } }

function planSync(tabs, firms, opts) {
  opts = opts || {};
  const byId = new Map(firms.map(f => [f.id, f]));
  const plan = { opts, updates: [], inserts: [], links: [], cellWrites: [], hidden: {}, appends: [], deletes: [], changed: false,
    report: { byId: 0, byName: 0, realigned: 0, newToCrm: [], crmToSheet: [], removed: 0, toCrm: [], toSheet: [], conflicts: [], diffs: [], orphans: [] } };
  const R = plan.report, claimed = new Set(), upd = new Map(), usedIds = new Set(firms.map(f => f.id));
  const tabByName = {}; tabs.forEach(t => tabByName[t.name] = t);
  const addPush = (id, firmName, push) => {
    if (!Object.keys(push).length) return;
    const u = upd.get(id) || {}; Object.assign(u, push); upd.set(id, u);
    for (const k in push) R.toCrm.push({ firm: firmName, field: k, value: push[k] });
  };
  const pending = []; // wiersze bez powiązania

  for (const t of tabs) {
    const hid = t.rows.map(r => [t.idCol !== null ? String(r[t.idCol] || '') : '', t.syncCol !== null ? String(r[t.syncCol] || '') : '']);
    const out = hid.map(h => h.slice());
    plan.hidden[t.name] = { values: out, changed: false, orig: hid };
    const pairs = hid.map(h => ({ id: h[0].trim(), snap: parseSnap(h[1]), used: false }));
    const names = t.rows.map(r => String(r[t.col.name] == null ? '' : r[t.col.name]).trim());
    const keys = names.map(keyOf);
    const presentKeys = new Set(keys.filter(Boolean));
    const assign = new Array(t.rows.length).fill(null);
    // 1) własna para pasuje nazwą
    names.forEach((n, i) => { const p = pairs[i]; if (n && p.id && p.snap && keyOf(p.snap.s.name) === keys[i]) { assign[i] = p; p.used = true; } });
    // 2) wiersz przesunięty (np. sortowanie tylko części kolumn) – szukamy pary po nazwie
    const byKey = new Map(); pairs.forEach((p, i) => { if (p.id && p.snap && !p.used) { const k = keyOf(p.snap.s.name); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); } });
    names.forEach((n, i) => { if (!n || assign[i]) return; const c = (byKey.get(keys[i]) || []).find(p => !p.used); if (c) { assign[i] = c; c.used = true; R.realigned++; } });
    // 3) zmiana nazwy – własna para, jeśli jej stara nazwa nie występuje gdzie indziej
    names.forEach((n, i) => {
      const p = pairs[i]; if (!n || assign[i] || !p.id || !p.snap || p.used) return;
      const oldKey = keyOf(p.snap.s.name); if (presentKeys.has(oldKey)) return;
      const s = sheetModel(t.rows[i], t.col, t.name);
      const sameish = ['phone', 'address', 'email', 'instagram', 'website', 'category'].filter(k => s[k] && s[k] === p.snap.s[k]).length;
      if (dice(keys[i], oldKey) >= 0.5 || sameish >= 2) { assign[i] = p; p.used = true; }
    });

    names.forEach((n, i) => {
      if (!n) { if (out[i][0] || out[i][1]) { out[i] = ['', '']; } return; }
      const p = assign[i];
      if (!p || claimed.has(p.id)) { out[i] = ['', '']; pending.push({ t, i }); return; }
      const f = byId.get(p.id);
      if (!f || f.deleted) { out[i] = [p.id, JSON.stringify(p.snap)]; R.orphans.push({ name: n, tab: t.name }); return; }
      claimed.add(p.id); R.byId++;
      processRow(t, i, f, p.snap);
    });
  }

  // wiersze bez ID: łączymy z firmami z CRM po nazwie (najpierw w tym samym sektorze)
  const crmByKey = new Map();
  firms.forEach(f => { if (f.deleted) return; const k = keyOf(f.name); if (!crmByKey.has(k)) crmByKey.set(k, []); crmByKey.get(k).push(f); });
  for (const { t, i } of pending) {
    const name = String(t.rows[i][t.col.name]).trim(), k = keyOf(name);
    const cands = (crmByKey.get(k) || []).filter(f => !claimed.has(f.id));
    const f = k ? (cands.find(f => f.sector === t.name) || cands[0]) : null;
    if (f) { claimed.add(f.id); R.byName++; plan.links.push(f.id); processRow(t, i, f, null); continue; }
    // nowa firma do CRM
    const s = sheetModel(t.rows[i], t.col, t.name);
    let id = pySlug(name), b = id, n = 2; while (usedIds.has(id)) id = b + '-' + n++; usedIds.add(id);
    const tmp = 't' + plan.inserts.length;
    const fld = pick(s); fld.status = String(fld.status).startsWith('?') ? '' : fld.status; fld.last_mail = s._mail;
    plan.inserts.push({ tmp, id, f: fld });
    const c = Object.assign(pick(s), { status: fld.status });
    plan.hidden[t.name].values[i] = ['tmp:' + tmp, JSON.stringify({ s: pick(s), c, m: s._mail })];
    R.newToCrm.push({ name, tab: t.name });
  }

  // firmy tylko w CRM
  for (const f of firms) {
    if (f.deleted || claimed.has(f.id)) continue;
    if (f.linked) { R.removed++; continue; }
    if (!opts.addCrmOnly) { plan.links.push(f.id); continue; }
    const tab = tabByName[f.sector] || tabByName['Do uzupełnienia'] || tabs[0]; if (!tab) continue;
    appendFirm(tab, f);
    plan.links.push(f.id); R.crmToSheet.push({ name: f.name, tab: tab.name });
  }

  plan.updates = [...upd.entries()].map(([id, f]) => ({ id, f }));
  for (const name in plan.hidden) { const h = plan.hidden[name]; h.changed = h.values.some((v, i) => v[0] !== h.orig[i][0] || v[1] !== h.orig[i][1]); }
  plan.changed = plan.updates.length > 0 || plan.inserts.length > 0 || plan.cellWrites.length > 0 || plan.appends.length > 0 || plan.deletes.length > 0;
  return plan;

  function appendFirm(tab, f) {
    const width = Math.max(tab.width || tab.header.length, (tab.syncCol !== null ? tab.syncCol : tab.header.length + 1) + 1);
    const row = rowFromFirm(f, tab.col, width);
    const s = sheetModel(row, tab.col, tab.name);
    plan.appends.push({ tab: tab.name, values: row, id: f.id, sync: JSON.stringify({ s: pick(s), c: crmModel(f), m: '' }) });
  }

  function processRow(t, i, f, snap) {
    const s = sheetModel(t.rows[i], t.col, t.name), c = crmModel(f), name = s.name;
    const r = reconcile(snap, s, c, name);
    R.conflicts.push(...r.conflicts); R.diffs.push(...r.diffs);
    addPush(f.id, name, r.push);
    const c2 = Object.assign({}, c); for (const k in r.push) if (k in c2) c2[k] = r.push[k];
    const write = Object.assign({}, r.write); const moveTo = write.sector; delete write.sector;
    for (const k in write) R.toSheet.push({ firm: name, field: k, value: write[k] });
    const newRow = applyWrites(t.rows[i], t.col, s, write);
    if (moveTo && tabByName[moveTo] && moveTo !== t.name) {
      const tt = tabByName[moveTo], width = Math.max(tt.width || tt.header.length, (tt.syncCol !== null ? tt.syncCol : tt.header.length + 1) + 1);
      const row2 = new Array(width).fill('');
      t.header.forEach((h, ci) => { const ti = tt.header.findIndex(x => String(x).trim().toLowerCase() === String(h).trim().toLowerCase()); if (ti >= 0 && ci !== t.idCol && ci !== t.syncCol) row2[ti] = newRow[ci] == null ? '' : newRow[ci]; });
      const s2 = sheetModel(row2, tt.col, tt.name);
      plan.appends.push({ tab: tt.name, values: row2, id: f.id, sync: JSON.stringify({ s: pick(s2), c: c2, m: s._mail }) });
      plan.deletes.push({ tab: t.name, row: i });
      R.toSheet.push({ firm: name, field: 'sector', value: moveTo });
      return;
    }
    if (moveTo) c2.sector = c.sector; // brak zakładki – zostaje
    t.header.forEach((h, ci) => { if (ci === t.idCol || ci === t.syncCol) return; const a = t.rows[i][ci] == null ? '' : String(t.rows[i][ci]), b = newRow[ci] == null ? '' : String(newRow[ci]); if (a !== b) plan.cellWrites.push({ tab: t.name, row: i, col: ci, value: b }); });
    const s2 = sheetModel(newRow, t.col, t.name);
    plan.hidden[t.name].values[i] = [f.id, JSON.stringify({ s: pick(s2), c: c2, m: s._mail })];
  }
}

function summary(plan) {
  const R = plan.report;
  return [
    'Połączone wiersze: ' + (R.byId + R.byName) + (R.byName ? ' (nowo połączone po nazwie: ' + R.byName + ')' : ''),
    'Nowe firmy z arkusza → CRM: ' + R.newToCrm.length,
    'Firmy z CRM dopisane do arkusza: ' + R.crmToSheet.length,
    'Pola zmienione w CRM: ' + R.toCrm.length + ' · komórki zmienione w arkuszu: ' + R.toSheet.length,
    (R.conflicts.length ? 'Konflikty (wygrał CRM): ' + R.conflicts.length : ''),
    (R.diffs.length ? 'Różnice do ręcznego sprawdzenia: ' + R.diffs.length : ''),
    (R.removed ? 'Firmy usunięte z arkusza (zostają w CRM): ' + R.removed : ''),
    (R.orphans.length ? 'Wiersze z firmą usuniętą w CRM: ' + R.orphans.length : '')
  ].filter(Boolean).join('\n');
}

if (typeof module !== 'undefined') module.exports = { planSync, sheetModel, crmModel, reconcile, applyWrites, keyOf, splitContact, summary, applyPlan_, readTab_, ensureColumns_, CFG, SECTORS };
