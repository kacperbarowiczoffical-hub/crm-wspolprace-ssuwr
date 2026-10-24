import './style.css';
import { sb, S, V, A, $, esc, CFG, toast, go, closeLayer, loadAll, subscribeRealtime, refreshChrome, isAdmin } from './core.js';
import './views-work.js';
import './views-camp.js';
import { profileFields, saveProfileFrom } from './views-org.js';

/* ---------- nawigacja i akcje ---------- */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g && !g.closest('form')) { e.preventDefault(); closeLayer(); go(g.dataset.go, g.dataset.arg); return; }
  const a = e.target.closest('[data-act]');
  if (a && A[a.dataset.act]) { if (a.tagName !== 'INPUT') e.preventDefault(); A[a.dataset.act](a, e); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('layer').innerHTML) closeLayer(); });
A.close = () => closeLayer();

/* ---------- ekrany logowania ---------- */
function authScreen(html){
  $('app').hidden = true; $('auth').hidden = false;
  $('auth').innerHTML = `<div class="auth-card"><div class="org-line"><div class="mark" aria-hidden="true"><span>SS<small>UWr</small></span></div><div class="org"><b>CRM ${esc(CFG.org)}</b><span>${esc(CFG.orgFull)} · ${esc(CFG.season)}</span></div></div>${html}</div>`;
}
function domainOk(email){
  const d = email.split('@')[1] || '';
  return (S.cfg.allowed_domains || []).some(x => d === x || d.endsWith('.' + x)) || (S.cfg.allowed_emails || []).some(x => x.toLowerCase() === email);
}
function loginScreen(msg){
  authScreen(`<h1>Zaloguj się</h1><p class="sub">Użyj adresu uczelnianego (${esc((S.cfg.allowed_domains||[]).map(d => '@' + d).join(', '))}). Wyślemy Ci jednorazowy kod i link – bez hasła.</p>
    <form id="fLogin" class="stack"><div class="field"><label class="lbl" for="lEmail">Adres e-mail</label><input type="email" id="lEmail" autocomplete="email" required placeholder="imie.nazwisko@uwr.edu.pl"></div>
    <button class="btn pri" type="submit" id="lBtn">Wyślij kod logowania</button><p class="hint" id="lMsg">${esc(msg || '')}</p></form>`);
  $('fLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('lEmail').value.trim().toLowerCase();
    if (!domainOk(email)) { $('lMsg').textContent = 'To nie jest adres uczelniany. Zaloguj się adresem w domenie ' + (S.cfg.allowed_domains||[]).join(', ') + '.'; return; }
    $('lBtn').disabled = true; $('lMsg').textContent = 'Wysyłam…';
    const { error } = await sb.auth.signInWithOtp({email, options:{shouldCreateUser:true, emailRedirectTo: location.origin + location.pathname}});
    $('lBtn').disabled = false;
    if (error) { $('lMsg').textContent = /database error|uczelnian/i.test(error.message) ? 'Logowanie tylko adresem uczelnianym.' : /rate|seconds/i.test(error.message) ? 'Za dużo prób – odczekaj chwilę i spróbuj ponownie.' : 'Nie udało się wysłać maila: ' + error.message; return; }
    codeScreen(email);
  });
}
function codeScreen(email){
  authScreen(`<h1>Sprawdź skrzynkę</h1><p class="sub">Wysłaliśmy wiadomość na <b>${esc(email)}</b>. Kliknij link w mailu albo wpisz kod z wiadomości.</p>
    <form id="fCode" class="stack"><div class="field"><label class="lbl" for="lCode">Kod z maila</label><input type="text" id="lCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></div>
    <button class="btn pri" type="submit">Zaloguj</button><p class="hint" id="cMsg">Mail nie dotarł? Sprawdź folder „Wiadomości-śmieci” albo <a href="#" id="cBack">wyślij ponownie</a>.</p></form>`);
  $('cBack').addEventListener('click', e => { e.preventDefault(); loginScreen(); });
  $('fCode').addEventListener('submit', async e => {
    e.preventDefault();
    const { error } = await sb.auth.verifyOtp({email, token:$('lCode').value.trim(), type:'email'});
    if (error) { $('cMsg').textContent = 'Kod jest nieprawidłowy albo wygasł. Wyślij nowy.'; return; }
    location.reload();
  });
}
function pendingScreen(){
  authScreen(`<h1>Konto czeka na akceptację</h1><p class="sub">Zalogowano jako <b>${esc(S.me.email)}</b>. Administrator komisji musi zatwierdzić Twoje konto. Uzupełnij profil, żeby wiedział, kim jesteś – po akceptacji strona sama się odświeży.</p>
    ${profileFields(S.me)}<div class="row"><button class="btn pri" id="pendSave">Zapisz profil</button><button class="btn" id="pendOut">Wyloguj</button></div>`);
  $('pendSave').addEventListener('click', async () => { if (await saveProfileFrom()) toast('Zapisano – poczekaj na akceptację'); });
  $('pendOut').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
  sb.channel('me').on('postgres_changes', {event:'UPDATE', schema:'public', table:'profiles', filter:`id=eq.${S.me.id}`}, p => { if (p.new.status !== 'pending') location.reload(); }).subscribe();
  setInterval(async () => { const { data } = await sb.from('profiles').select('status').eq('id', S.me.id).single(); if (data && data.status !== 'pending') location.reload(); }, 30000);
}

/* ---------- start ---------- */
async function boot(){
  if (!sb) { authScreen(`<h1>Brak konfiguracji</h1><p class="sub">Ustaw zmienne VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY (instrukcja w README).</p>`); return; }
  const cfg = await sb.from('app_config').select('*').eq('id', 1).maybeSingle();
  if (cfg.data) S.cfg = cfg.data;
  const { data:{ session } } = await sb.auth.getSession();
  sb.auth.onAuthStateChange((ev, s) => { if (ev === 'SIGNED_IN' && !S.session && s) location.reload(); if (ev === 'SIGNED_OUT') location.reload(); });
  if (!session) return loginScreen();
  S.session = session;
  const { data:me, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (error || !me) { authScreen(`<h1>Nie udało się wczytać konta</h1><p class="sub">Spróbuj odświeżyć stronę. Jeśli problem wraca, napisz do administratora komisji.</p><button class="btn" onclick="location.reload()">Odśwież</button>`); return; }
  S.me = me;
  if (me.status === 'blocked') { authScreen(`<h1>Brak dostępu</h1><p class="sub">Twoje konto (${esc(me.email)}) nie ma dostępu do CRM. Skontaktuj się z administratorem komisji.</p><button class="btn" id="bOut">Wyloguj</button>`); $('bOut').onclick = async () => { await sb.auth.signOut(); location.reload(); }; return; }
  if (me.status === 'pending') return pendingScreen();
  $('auth').hidden = true; $('app').hidden = false;
  $('main').innerHTML = `<div class="empty">Wczytuję bazę…</div>`;
  if (isAdmin()) document.querySelectorAll('[data-admin]').forEach(el => el.hidden = false);
  refreshChrome();
  try { await loadAll(); }
  catch(e){ $('main').innerHTML = `<div class="empty">Nie udało się wczytać danych. Odśwież stronę.</div>`; console.error(e); return; }
  subscribeRealtime();
  const [view, arg] = location.hash.replace(/^#/, '').split('/');
  let start = view; if (!start) { try { start = localStorage.getItem('crm-view'); } catch(e){} }
  go(V[start] ? start : 'pulpit', arg ? decodeURIComponent(arg) : undefined);
  if (!S.me.full_name) { toast('Uzupełnij swój profil'); go('profil'); }
}
boot();
