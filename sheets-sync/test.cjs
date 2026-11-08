// Test synchronizacji: atrapa arkusza (SpreadsheetApp) + atrapa CRM (sheet_pull/sheet_push).
// Uruchom: node sheets-sync/test.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const code = fs.readFileSync(__dirname + '/Kod.gs', 'utf8');
const ctx = { module: { exports: {} }, console };
vm.createContext(ctx); vm.runInContext(code, ctx);
const K = ctx.module.exports;

/* ---------- atrapa arkusza ---------- */
class Sheet {
  constructor(name, header, rows) { this.name = name; this.data = [header.slice(), ...rows.map(r => r.slice())]; this.maxRows = 1000; this.maxCols = 26; this.hidden = new Set(); }
  getName() { return this.name; }
  getLastRow() { let n = this.data.length; while (n > 0 && this.data[n - 1].every(v => v === '' || v == null)) n--; return n; }
  getLastColumn() { let m = 0; this.data.forEach(r => { for (let c = r.length; c > 0; c--) if (r[c - 1] !== '' && r[c - 1] != null) { m = Math.max(m, c); break; } }); return m; }
  getMaxRows() { return this.maxRows; } getMaxColumns() { return this.maxCols; }
  cell(r, c) { while (this.data.length < r) this.data.push([]); const row = this.data[r - 1]; while (row.length < c) row.push(''); return row; }
  getRange(r, c, nr = 1, nc = 1) {
    const sh = this;
    return {
      getDisplayValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.data[r - 1 + i] || [])[c - 1 + j]; row.push(v == null ? '' : String(v)); } out.push(row); } return out; },
      setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { sh.cell(r + i, c + j)[c - 1 + j] = String(x).replace(/^'/, ''); })); },
      setValue(x) { sh.cell(r, c)[c - 1] = String(x).replace(/^'/, ''); },
      protect() { return { setDescription() { return this; }, setWarningOnly() { return this; } }; },
      createFilter() { return null; }
    };
  }
  insertColumnsAfter(a, n) { this.maxCols += n; } insertRowsAfter(a, n) { this.maxRows += n; }
  hideColumns(c, n) { for (let i = 0; i < n; i++) this.hidden.add(c + i); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  getFilter() { return null; }
}
const HEADER = ['Nazwa', 'Status', 'Kategoria', 'Zasięg', 'Telefon', 'E-mail / social', 'Strona / link', 'Adres', 'Kto zebrał', 'Uwagi', 'Mail nr 1', 'Mail nr 2', 'Mail nr 3', 'Typ (ogólnopolskie)', 'Kto Sprawdził?', 'Aktualne?', 'Poprawione?'];

/* ---------- atrapa CRM ---------- */
let firms = [];
const crm = {
  pull() { return JSON.parse(JSON.stringify(firms)); },
  push({ p_updates, p_inserts, p_links }) {
    for (const u of p_updates) { const f = firms.find(x => x.id === u.id); if (!f || f.deleted) continue; for (const k in u.f) { if (k === 'name' && !u.f[k]) continue; f[k] = u.f[k]; } }
    const inserted = [];
    for (const i of p_inserts) { let id = i.id, n = 2; while (firms.some(f => f.id === id)) id = i.id + '-' + n++; firms.push(Object.assign({ id, deleted: false, linked: true }, i.f)); inserted.push({ tmp: i.tmp, id }); }
    for (const id of p_links) { const f = firms.find(x => x.id === id); if (f) f.linked = true; }
    return { updated: p_updates.length, inserted };
  }
};
const blankFirm = o => Object.assign({ category: '', reach: '', phone: '', email: '', instagram: '', facebook: '', tiktok: '', linkedin: '', website: '', address: '', collected_by: '', notes: '', status: '', stage: 'nowa', deleted: false, linked: false }, o);

let sheets;
function cycle(opts = {}) {
  const tabs = [];
  for (const name of K.SECTORS) { const sh = sheets[name]; if (!sh) continue; K.ensureColumns_(sh); tabs.push(K.readTab_(sh, name)); }
  const plan = K.planSync(tabs, crm.pull(), Object.assign({ addCrmOnly: true }, opts));
  // applyPlan_ z podmienionym rpc_
  ctx.rpc_ = (fn, body) => crm.push(body);
  vm.runInContext('rpc_ = this.rpc_', ctx);
  K.applyPlan_(sheets, tabs, plan);
  return plan;
}
vm.runInContext('var __orig = rpc_;', ctx);
const tab = n => sheets[n];
const row = (n, name) => tab(n).data.find(r => r[0] === name);
const firm = name => firms.find(f => f.name === name);
let ok = 0; const t = (msg, fn) => { fn(); ok++; console.log('✓', msg); };

/* ---------- dane startowe ---------- */
firms = [
  blankFirm({ id: 'coven-tattoo', name: 'Coven Tattoo', sector: 'Beauty i zdrowie', category: 'Tatuaż i piercing', reach: 'Wrocław', phone: '501 009 844', email: 'kontakt@coventattoo.pl', address: 'Kazimierza Wielkiego 27c/3', collected_by: 'Żmigrodzki', notes: 'dali vouchery', status: 'G', stage: 'wspolpraca' }),
  blankFirm({ id: 'vean-tattoo', name: 'Vean tattoo', sector: 'Beauty i zdrowie', phone: '573 569 055', email: 'marketing.veantattoo@gmail.com', instagram: 'https://www.instagram.com/vean_tattoo/', notes: 'x; Kontakt: pisać rano', status: 'G', stage: 'wspolpraca' }),
  blankFirm({ id: 'blackbeard', name: 'Blackbeard', sector: 'Beauty i zdrowie', phone: '', status: 'R', stage: 'odmowa' }),
  blankFirm({ id: 'decathlon', name: 'Decathlon', sector: 'Sport', website: 'https://decathlon.pl', status: '' }),
  blankFirm({ id: 'tylko-w-crm', name: 'Tylko w CRM', sector: 'Sport', phone: '111 222 333' }),
];
sheets = {
  'Beauty i zdrowie': new Sheet('Beauty i zdrowie', HEADER, [
    ['Coven Tattoo', 'Współpraca', 'Tatuaż i piercing', 'Wrocław', '501 009 844', 'kontakt@coventattoo.pl', '', 'Kazimierza Wielkiego 27c/3', 'Żmigrodzki', 'dali vouchery', '', '', '', '', '', 'FALSE', 'FALSE'],
    ['Vean tattoo', 'Współpraca', '', '', '573 569 055', 'marketing.veantattoo@gmail.com\nhttps://www.instagram.com/vean_tattoo/ pisać rano', '', '', '', 'x', '', '', '', '', '', 'FALSE', 'FALSE'],
    ['Blackbeard', '', '', '', '600 600 600', '', '', '', '', '', '', '', '', '', '', 'FALSE', 'FALSE'],
    ['Nowa z arkusza', 'Chętni – nie teraz', 'Fryzjer', 'Wrocław', '700 800 900', 'nowa@firma.pl', '', '', 'Kacper', '', 'mail1', '', '', '', '', 'FALSE', 'FALSE'],
  ]),
  'Sport': new Sheet('Sport', HEADER, [
    ['Decathlon', '', '', 'Polska', '', '', 'https://decathlon.pl/', '', '', '', '', '', '', '', '', 'FALSE', 'FALSE'],
  ]),
  'Gastronomia': new Sheet('Gastronomia', HEADER, [])
};

/* ---------- scenariusze ---------- */
const p1 = cycle();
t('pierwsza synchronizacja łączy po nazwie, dodaje nową firmę z arkusza i dopisuje firmę z CRM', () => {
  assert.equal(p1.report.byName, 4); assert.equal(p1.report.newToCrm.length, 1); assert.equal(p1.report.crmToSheet.length, 1);
  assert.ok(firm('Nowa z arkusza')); assert.equal(firm('Nowa z arkusza').status, 'Y'); assert.equal(firm('Nowa z arkusza').sector, 'Beauty i zdrowie');
  assert.ok(row('Sport', 'Tylko w CRM')); assert.equal(row('Sport', 'Tylko w CRM')[4], '111 222 333');
});
t('start: puste pola uzupełniane w obie strony, status z CRM wygrywa, uwagi z „Kontakt:” nie są różnicą', () => {
  assert.equal(firm('Blackbeard').phone, '600 600 600');        // arkusz → CRM (puste w CRM)
  assert.equal(row('Beauty i zdrowie', 'Blackbeard')[1], 'Odmowa'); // CRM → arkusz (puste w arkuszu)
  assert.equal(row('Sport', 'Decathlon')[6], 'https://decathlon.pl/'); // różnica tylko „/” – bez zmian
  assert.equal(firm('Vean tattoo').notes, 'x; Kontakt: pisać rano');
  assert.equal(p1.report.diffs.length, 0, JSON.stringify(p1.report.diffs));
});
t('wszystkie wiersze mają ID i ukryte kolumny', () => {
  for (const n of ['Beauty i zdrowie', 'Sport']) tab(n).data.slice(1).forEach(r => { assert.ok(r[17], n + ' ' + r[0]); assert.ok(JSON.parse(r[18]).s); });
  assert.ok(tab('Sport').hidden.has(18) && tab('Sport').hidden.has(19));
  assert.equal(row('Beauty i zdrowie', 'Nowa z arkusza')[17], 'nowa-z-arkusza');
});
const p2 = cycle();
t('drugi przebieg bez zmian nic nie robi', () => { assert.equal(p2.changed, false, K.summary(p2)); assert.equal(p2.report.byId, 6); });

row('Beauty i zdrowie', 'Coven Tattoo')[4] = '501 000 000';
row('Beauty i zdrowie', 'Coven Tattoo')[12] = 'Mail 3 wysłany';
firm('Vean tattoo').status = 'Y';
firm('Decathlon').email = 'partner@decathlon.pl';
const p3 = cycle();
t('edycja w arkuszu → CRM; edycja w CRM → arkusz (status i e-mail w kolumnie kontaktu)', () => {
  assert.equal(firm('Coven Tattoo').phone, '501 000 000'); assert.equal(firm('Coven Tattoo').last_mail, 'Mail 3 wysłany');
  assert.equal(row('Beauty i zdrowie', 'Vean tattoo')[1], 'Chętni – nie teraz');
  assert.equal(row('Sport', 'Decathlon')[5], 'partner@decathlon.pl');
  assert.equal(p3.report.conflicts.length, 0);
});
t('po zmianach kolejny przebieg jest stabilny', () => assert.equal(cycle().changed, false));

row('Beauty i zdrowie', 'Vean tattoo')[9] = 'z arkusza';
firm('Vean tattoo').notes = 'z CRM';
const p5 = cycle();
t('konflikt na tym samym polu: wygrywa CRM i trafia do logu', () => {
  assert.equal(row('Beauty i zdrowie', 'Vean tattoo')[9], 'z CRM'); assert.equal(firm('Vean tattoo').notes, 'z CRM'); assert.equal(p5.report.conflicts.length, 1);
});
cycle();

// sortowanie tylko widocznych kolumn A:Q – ukryte ID zostają na starych miejscach
const b = tab('Beauty i zdrowie').data; const body = b.slice(1);
const vis = body.map(r => r.slice(0, 17)).reverse(); body.forEach((r, i) => { for (let c = 0; c < 17; c++) r[c] = vis[i][c]; });
const p6 = cycle();
t('sortowanie części kolumn: wiersze same się wyrównują, nic nie leci do CRM', () => {
  assert.ok(p6.report.realigned >= 2); assert.equal(p6.updates.length, 0, JSON.stringify(p6.updates)); assert.equal(p6.inserts.length, 0);
  b.slice(1).forEach(r => assert.equal(firms.find(f => f.id === r[17]).name, r[0]));
});
t('po wyrównaniu stabilnie', () => assert.equal(cycle().changed, false));

row('Beauty i zdrowie', 'Blackbeard')[0] = 'Blackbeard Barber';
const p7 = cycle();
t('zmiana nazwy w arkuszu to zmiana nazwy w CRM, nie nowa firma', () => { assert.equal(p7.inserts.length, 0); assert.equal(firms.find(f => f.id === 'blackbeard').name, 'Blackbeard Barber'); });

firm('Decathlon').sector = 'Moda i zakupy';
sheets['Moda i zakupy'] = new Sheet('Moda i zakupy', HEADER, []);
cycle();
t('zmiana sektora w CRM przenosi wiersz do innej zakładki', () => {
  assert.ok(!row('Sport', 'Decathlon')); const r = row('Moda i zakupy', 'Decathlon'); assert.ok(r); assert.equal(r[17], 'decathlon'); assert.equal(r[5], 'partner@decathlon.pl');
});
t('po przeniesieniu stabilnie', () => assert.equal(cycle().changed, false));

const s = tab('Sport').data; s.splice(s.findIndex(r => r[0] === 'Tylko w CRM'), 1);
const p9 = cycle();
t('wiersz usunięty z arkusza nie wraca, firma zostaje w CRM', () => { assert.ok(!row('Sport', 'Tylko w CRM')); assert.ok(firm('Tylko w CRM')); assert.equal(p9.report.removed, 1); });

firms.push(blankFirm({ id: 'nowa-w-crm', name: 'Nowa w CRM', sector: 'Gastronomia', email: 'a@b.pl', instagram: '@nowa_crm' }));
cycle();
t('firma dodana w CRM pojawia się w arkuszu (IG jako link)', () => { const r = row('Gastronomia', 'Nowa w CRM'); assert.ok(r); assert.equal(r[5], 'a@b.pl\nhttps://www.instagram.com/nowa_crm/'); });
t('i dalej stabilnie', () => assert.equal(cycle().changed, false));

row('Beauty i zdrowie', 'Coven Tattoo')[1] = '';
cycle();
t('wyczyszczenie statusu w arkuszu czyści status w CRM', () => assert.equal(firm('Coven Tattoo').status, ''));
row('Beauty i zdrowie', 'Coven Tattoo')[1] = 'Współpraca'; cycle(); row('Beauty i zdrowie', 'Coven Tattoo')[1] = 'Brak statusu'; cycle();
t('„Brak statusu” z listy też czyści status; firma z CRM bez statusu dostaje „Brak statusu”', () => { assert.equal(firm('Coven Tattoo').status, ''); assert.equal(row('Gastronomia', 'Nowa w CRM')[1], 'Brak statusu'); assert.equal(cycle().changed, false); });
firm('Coven Tattoo').status = 'G'; cycle(); firm('Coven Tattoo').status = ''; cycle();
t('status wyczyszczony w CRM → „Brak statusu” w arkuszu', () => assert.equal(row('Beauty i zdrowie', 'Coven Tattoo')[1], 'Brak statusu'));

const bz = tab('Beauty i zdrowie').data; const ix = bz.findIndex(r => r[0] === 'Nowa z arkusza');
bz[ix] = bz[ix].map((v, i) => i === 17 || i === 18 ? v : ''); bz[ix][0] = 'Zupełnie inna firma';
const p11 = cycle();
t('nadpisanie wiersza inną firmą tworzy nową firmę zamiast psuć starą', () => { assert.equal(p11.inserts.length, 1); assert.equal(firm('Nowa z arkusza').phone, '700 800 900'); });

console.log('\nWszystkie testy przeszły: ' + ok);
