'use strict';
/* 🔒 RODO / prywatność: Polityka prywatności, Regulamin, zgoda przy rejestracji, eksport danych (art. 15 i 20),
   usunięcie konta (art. 17), wylogowanie z wyczyszczeniem urządzenia. Treść dokumentów: POLICY_* poniżej. */

// ⚠️ Uzupełnij dane administratora (osoby, która prowadzi aplikację) – wymagane przez RODO (art. 13).
const POLICY_OWNER = { name: '[imię i nazwisko administratora]', email: '[adres e-mail do spraw danych]' };
const POLICY_VERSION = '2026-10-20';
const consentOk = () => S.stats.consentVer === POLICY_VERSION;

const POLICY_HTML = () => `
<h2>Polityka prywatności</h2>
<p class="small muted">Wersja z ${POLICY_VERSION}</p>
<h3>1. Administrator</h3>
<p>Administratorem danych jest ${esc(POLICY_OWNER.name)}, kontakt: <b>${esc(POLICY_OWNER.email)}</b>. W każdej sprawie dotyczącej danych możesz napisać na ten adres.</p>
<h3>2. Bez konta – dane tylko na Twoim urządzeniu</h3>
<p>Bez logowania fiszki, zdjęcia, postępy nauki i ustawienia są zapisywane <b>wyłącznie w pamięci Twojej przeglądarki</b> (IndexedDB, localStorage). Nie wysyłamy ich nigdzie. Aplikacja nie używa plików cookie, reklam ani narzędzi analitycznych (śledzących).</p>
<h3>3. Z kontem w chmurze</h3>
<ul>
  <li><b>E-mail i hasło</b> – do logowania. Hasło jest przechowywane wyłącznie jako skrót (hash) przez dostawcę logowania; nie znamy go. E-maila nie pokazujemy innym użytkownikom.</li>
  <li><b>Fiszki, zdjęcia, postępy, ustawienia</b> – kopia do synchronizacji między Twoimi urządzeniami. Dostęp masz tylko Ty (zabezpieczenia na poziomie bazy danych – Row Level Security).</li>
  <li><b>Profil publiczny dla znajomych</b>: nick, awatar, kod znajomego i statystyki nauki (liczba powtórek, seria, poziom, czas nauki, Elo, naklejki w gablocie). Widzą go osoby, które dodasz do znajomych (albo które dodały Ciebie kodem).</li>
  <li><b>Ranking wszystkich</b> – tylko jeśli sam/a go włączysz (domyślnie wyłączony). Wtedy nick, awatar i statystyki widzą wszyscy zalogowani użytkownicy.</li>
  <li><b>Wiadomości</b> do znajomych (tekst, naklejki, GIF-y, zaproszenia, wspólne talie) – widzą je tylko nadawca i odbiorca.</li>
  <li><b>Bitwy i teleturniej na żywo</b> – nick, awatar i odpowiedzi przesyłane w czasie gry; nie są zapisywane na serwerze (wynik zostaje tylko u graczy).</li>
</ul>
<h3>4. Cel i podstawa prawna</h3>
<p>Świadczenie usługi, o którą prosisz – konto, synchronizacja, znajomi, ranking, czat (art. 6 ust. 1 lit. b RODO). Bezpieczeństwo aplikacji i zapobieganie nadużyciom (art. 6 ust. 1 lit. f). Ranking wszystkich – Twoja decyzja w ustawieniach, którą możesz w każdej chwili cofnąć.</p>
<h3>5. Komu powierzamy dane</h3>
<ul>
  <li><b>Supabase</b> (baza danych i logowanie) – serwery w UE (Frankfurt). Supabase Inc. działa na podstawie umowy powierzenia i standardowych klauzul umownych UE.</li>
  <li><b>GitHub Pages</b> (GitHub Inc., USA) – hosting plików aplikacji; przy pobieraniu strony GitHub technicznie przetwarza Twój adres IP (EU–US Data Privacy Framework).</li>
  <li>Opcjonalna synchronizacja przez <b>GitHub Gist</b> – tylko jeśli sam/a podasz swój token GitHub; dane trafiają wtedy na Twoje własne konto GitHub.</li>
</ul>
<p>Nie sprzedajemy danych i nie używamy ich do reklam ani profilowania.</p>
<h3>6. Jak długo</h3>
<p>Dane konta – do czasu usunięcia konta (możesz to zrobić sam/a w aplikacji: Profil → ⚙️ → Konto → Usuń konto). Wiadomości – do usunięcia przez nadawcę/odbiorcę albo usunięcia konta. Dane na urządzeniu – do ich usunięcia przez Ciebie.</p>
<h3>7. Twoje prawa</h3>
<p>Masz prawo do: dostępu do danych i ich kopii (<b>przycisk „Pobierz moje dane”</b>), sprostowania (zmiana nicku, awatara), usunięcia (<b>„Usuń konto”</b>), ograniczenia przetwarzania, przenoszenia danych (plik JSON), sprzeciwu oraz wycofania zgody na ranking wszystkich. Masz też prawo wnieść skargę do <b>Prezesa Urzędu Ochrony Danych Osobowych</b> (uodo.gov.pl, ul. Stawki 2, 00-193 Warszawa).</p>
<h3>8. Wiek</h3>
<p>Konto mogą założyć osoby, które ukończyły 16 lat. Osoby młodsze – tylko za zgodą rodzica lub opiekuna.</p>
<h3>9. Bezpieczeństwo</h3>
<p>Połączenia są szyfrowane (HTTPS). Dostęp do danych w bazie ograniczają reguły bezpieczeństwa (RLS) – każdy widzi tylko swoje dane i to, co udostępnili mu znajomi. Treści od innych osób są oczyszczane przed wyświetleniem. Używaj silnego hasła, którego nie używasz nigdzie indziej.</p>`;

const TERMS_HTML = () => `
<h2>Regulamin</h2>
<p class="small muted">Wersja z ${POLICY_VERSION}</p>
<ol>
  <li>Fiszki to bezpłatna aplikacja do nauki. Korzystanie bez konta nie wymaga podawania żadnych danych.</li>
  <li>Konto może założyć osoba, która ukończyła 16 lat (młodsza – za zgodą rodzica/opiekuna). Jedna osoba – jedno konto; nie udostępniaj hasła.</li>
  <li><b>Kryształy, skrzynki, naklejki i GIF-y</b> to wyłącznie wirtualne elementy zabawy. Nie można ich kupić za prawdziwe pieniądze, wymienić na pieniądze ani sprzedać; nie mają wartości pieniężnej. Szanse w skrzynkach są jawne (przycisk „Zawartość i szanse”).</li>
  <li>Zabronione są: obraźliwe, nienawistne lub nielegalne treści (nick, awatar, wiadomości, wspólne talie), nękanie innych, podszywanie się, spam, próby włamania, oszukiwania w rankingu lub obchodzenia zabezpieczeń.</li>
  <li>Za treść fiszek i wiadomości odpowiada ich autor. Nie wrzucaj cudzych materiałów chronionych prawem autorskim bez zgody.</li>
  <li>Konto naruszające regulamin może zostać zablokowane lub usunięte.</li>
  <li>Aplikacja jest dostarczana „tak jak jest”. Dbamy o kopie i bezpieczeństwo, ale rób też własne kopie zapasowe (Ustawienia → Kopia zapasowa).</li>
  <li>Konto możesz w każdej chwili usunąć w aplikacji. Zmiany regulaminu ogłaszamy w aplikacji; przy istotnych zmianach poprosimy o ponowną akceptację.</li>
  <li>Kontakt i reklamacje: ${esc(POLICY_OWNER.email)}. Konsument może skorzystać z polubownych metod rozwiązywania sporów (np. platforma ODR UE).</li>
</ol>`;

ROUTES.privacy = () => ({ tab: 'more', html: `<div class="row nowrap"><button class="iconbtn" data-act="back">‹</button><h1 class="grow">Prywatność</h1></div>
  <div class="card legal">${POLICY_HTML()}</div><div class="card"><button class="block" data-go="#/terms">Regulamin</button></div>` });
ROUTES.terms = () => ({ tab: 'more', html: `<div class="row nowrap"><button class="iconbtn" data-act="back">‹</button><h1 class="grow">Regulamin</h1></div>
  <div class="card legal">${TERMS_HTML()}</div><div class="card"><button class="block" data-go="#/privacy">Polityka prywatności</button></div>` });

// ---------- zgoda przy rejestracji (wymagana) – wstawiamy pole do formularza konta
const prAcc0 = accountCardHTML;
accountCardHTML = function () {
  let h = prAcc0();
  if (SB && !SB_USER) h = h.replace('<div class="row"><button class="primary grow" data-act="acc-login">',
    `<label class="check small consent"><input type="checkbox" id="acc-consent"> <span>Mam ukończone 16 lat (albo zgodę rodzica) i akceptuję <a href="#/terms">Regulamin</a> oraz <a href="#/privacy">Politykę prywatności</a> <span class="muted">(wymagane do założenia konta)</span></span></label>
    <div class="spacer"></div><div class="row"><button class="primary grow" data-act="acc-login">`);
  if (SB && SB_USER) h = h.replace(/<button class="ghost sm" data-act="cloud-check">/, `<details class="danger-zone"><summary class="small">🔒 Prywatność i dane</summary>
      <p class="small muted">Masz prawo do kopii swoich danych i do usunięcia konta (RODO art. 15, 17, 20).</p>
      <button class="block" data-act="gdpr-export">⬇️ Pobierz moje dane (JSON)</button>
      <button class="block" data-act="acc-logout-wipe" style="margin-top:6px">Wyloguj i usuń dane z tego urządzenia</button>
      <button class="block danger" data-act="gdpr-delete" style="margin-top:6px">🗑️ Usuń konto na zawsze</button>
      <p class="small"><a href="#/privacy">Polityka prywatności</a> · <a href="#/terms">Regulamin</a></p></details>
    <button class="ghost sm" data-act="cloud-check">`);
  return h;
};
const prSignup0 = ACTIONS['acc-signup'];
ACTIONS['acc-signup'] = async (...a) => {
  if (!$('#acc-consent')?.checked) { toast('Zaznacz zgodę na Regulamin i Politykę prywatności', 4000); $('#acc-consent')?.closest('label')?.classList.add('pulse'); return; }
  const p = $('#acc-pass')?.value || '';
  const weak = pwWeak(p, $('#acc-email')?.value || '');
  if (weak) return toast(weak, 4500);
  S.stats.consentVer = POLICY_VERSION; S.stats.consentAt = Date.now(); save();
  return prSignup0(...a);
};
// silne hasło: min. 10 znaków, litery i cyfry, nie z listy najpopularniejszych, nie zawiera e-maila
const PW_COMMON = ['1234567890', 'qwertyuiop', 'password12', 'haslo12345', 'zaq12wsxcde', 'qwerty1234', '1q2w3e4r5t', 'polska1234', 'iloveyou12', 'abcdefgh12'];
function pwWeak(p, email) {
  if (p.length < 10) return 'Hasło musi mieć min. 10 znaków';
  if (!/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(p) || !/\d/.test(p)) return 'Hasło musi zawierać litery i cyfry';
  if (/^(.)\1+$/.test(p) || PW_COMMON.includes(p.toLowerCase())) return 'To hasło jest zbyt popularne – wymyśl inne';
  const user = (email.split('@')[0] || '').toLowerCase();
  if (user.length >= 4 && p.toLowerCase().includes(user)) return 'Hasło nie może zawierać nazwy z e-maila';
  return '';
}

// ---------- eksport danych (art. 15 / 20)
async function gdprExport() {
  const out = { app: 'Fiszki', exported: new Date().toISOString(), policy: POLICY_VERSION, local: JSON.parse(JSON.stringify(S)) };
  if (out.local.settings?.sync) out.local.settings.sync = { ...out.local.settings.sync, token: out.local.settings.sync.token ? '[ukryty]' : '' };
  if (cloudOn()) {
    const me = SB_USER.id;
    const [p, f, m] = await Promise.all([
      SB.from('profiles').select('*').eq('id', me).maybeSingle(),
      SB.from('friends').select('*').or(`user_id.eq.${me},friend_id.eq.${me}`),
      SB.from('messages').select('*').or(`from_id.eq.${me},to_id.eq.${me}`),
    ]);
    out.account = { id: me, email: SB_USER.email, created_at: SB_USER.created_at, profile: p.data, friends: f.data, messages: m.data };
  }
  download(`fiszki-moje-dane-${dayKey(Date.now())}.json`, JSON.stringify(out, null, 1), 'application/json');
  toast('Pobrano plik z Twoimi danymi ✓');
}
// czyszczenie urządzenia (wspólny komputer itp.)
async function wipeDevice() {
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ }
  try { await new Promise(r => { const q = indexedDB.deleteDatabase('fiszki'); q.onsuccess = q.onerror = q.onblocked = r; }); } catch { /* */ }
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch { /* */ }
}
// ---------- usunięcie konta (art. 17)
async function gdprDelete() {
  if (!cloudOn()) return;
  if (!confirm('Usunąć konto NA ZAWSZE? Znikną: profil, fiszki w chmurze, zdjęcia, znajomi i wiadomości. Tej operacji nie da się cofnąć.')) return;
  const word = prompt('Aby potwierdzić, wpisz: USUŃ'); if ((word || '').trim().toUpperCase() !== 'USUŃ') return toast('Anulowano');
  const me = SB_USER.id;
  toast('Usuwam konto…', 6000);
  let full = false;
  const r = await SB.rpc('delete_my_account');
  if (!r.error) full = true;
  else {   // baza bez funkcji – usuwamy przynajmniej wszystkie dane (konto logowania usunie administrator)
    for (const [t, q] of [['messages', `from_id.eq.${me},to_id.eq.${me}`], ['friends', `user_id.eq.${me},friend_id.eq.${me}`]]) await SB.from(t).delete().or(q);
    await SB.from('user_images').delete().eq('user_id', me);
    await SB.from('user_data').delete().eq('user_id', me);
    await SB.from('profiles').delete().eq('id', me);
  }
  const wipe = confirm('Konto usunięte. Usunąć też fiszki z tego urządzenia?\n\nOK – usuń wszystko · Anuluj – zostaw fiszki tylko tutaj (bez konta)');
  try { await SB.auth.signOut(); } catch { /* */ }
  SB_USER = null; SB_PROFILE = null; CLOUD_FRIENDS = [];
  if (wipe) { await wipeDevice(); location.replace(location.pathname); return; }
  render();
  alert(full ? 'Konto zostało usunięte.' : `Dane konta zostały usunięte. Aby usunąć też login (e-mail), napisz do administratora: ${POLICY_OWNER.email}`);
}
Object.assign(ACTIONS, {
  'gdpr-export': () => gdprExport().catch(e => toast('Błąd: ' + (e.message || e), 4000)),
  'gdpr-delete': () => gdprDelete().catch(e => toast('Błąd: ' + (e.message || e), 5000)),
  'acc-logout-wipe': async () => {
    if (!confirm('Wylogować i usunąć wszystkie fiszki i ustawienia z tego urządzenia? (Kopia zostaje na koncie w chmurze.)')) return;
    try { await cloudSync(false); } catch { /* */ }
    try { await SB.auth.signOut(); } catch { /* */ }
    await wipeDevice(); location.replace(location.pathname);
  },
  back: () => history.length > 1 ? history.back() : go('#/more'),
});
// linki w Ustawieniach
const prMore0 = viewMore;
viewMore = function () { return prMore0() + `<div class="card small center legal-links"><a href="#/privacy">🔒 Polityka prywatności</a> · <a href="#/terms">Regulamin</a><br><span class="muted">Bez reklam, bez śledzenia, bez plików cookie.</span></div>`; };
