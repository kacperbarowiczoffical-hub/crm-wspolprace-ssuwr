# CRM – Komisja ds. Współprac Zewnętrznych · Samorząd Studentów UWr

Aplikacja webowa do prowadzenia kontaktów z firmami: baza firm, historia kontaktu, kampanie ze ścieżkami (e-mail + social media naraz), zespoły i role, prompty do darmowego AI, import/eksport Excela.

- **Logowanie e-mailem i hasłem.** Administrator dodaje osobę w *Więcej → Zespoły i ludzie → + Dodaj osobę* i przekazuje jej wygenerowane dane logowania; osoba zmienia hasło w profilu. Nie trzeba skrzynki SMTP ani żadnych maili. Przy osobie jest też przycisk *Nowe hasło* (gdy ktoś zapomni).
- Opcjonalnie: logowanie linkiem z maila (wymaga własnego SMTP w Supabase – kroki 5–6 niżej).
- **Wysyłka**: aplikacja przygotowuje spersonalizowaną wiadomość i przenosi ją do Outlooka osoby (Outlook w przeglądarce, Outlook.com albo program pocztowy). Wiadomości na Instagram/Facebook/TikTok/LinkedIn: kopiuj + otwórz profil.
- **Struktura**: administratorzy główni → liderzy zespołów → zespoły (każdy zespół ma sektory i/lub kategorie firm) → członkowie.
- **Prywatność odpowiedzi**: treść odpowiedzi firmy widzi tylko osoba, która ją zapisała. Liderzy i admini widzą, że odpowiedź przyszła, wynik i notatkę.

Technologia: statyczna strona (Vite, bez frameworka) + [Supabase](https://supabase.com) (baza Postgres, logowanie, realtime). Hosting: Vercel. Wszystko mieści się w darmowych planach.

---

## Wdrożenie krok po kroku (ok. 30 minut)

### 1. Supabase – baza i logowanie
1. Załóż konto na https://supabase.com i utwórz projekt (**New project**, region: *Central EU (Frankfurt)*, zapisz hasło do bazy).
2. Wejdź w **SQL Editor → New query**, wklej całą zawartość [`supabase/schema.sql`](supabase/schema.sql) i kliknij **Run**.
3. W nowym zapytaniu wklej [`supabase/seed.sql`](supabase/seed.sql) (2350 firm z bazy komisji, e-mail i social media już rozdzielone) i kliknij **Run**.
   Jeśli edytor odmówi przez rozmiar pliku – podziel go na kilka części (każdy blok `insert … ;` jest niezależny) albo zaimportuj firmy później w aplikacji (Ustawienia → Import).
4. **Authentication → Providers → Email**: włączone, *Confirm email* włączone.
5. **Authentication → Email Templates → Magic Link**: wklej treść [`supabase/email-template.html`](supabase/email-template.html) (zawiera kod `{{ .Token }}`, który można wpisać w aplikacji).
6. **Ważne – wysyłka maili z kodami.** Wbudowany serwer pocztowy Supabase wysyła maile tylko do członków Twojego zespołu w Supabase i ma bardzo mały limit. Żeby kody docierały do wszystkich studentów, ustaw własny SMTP:
   **Project Settings → Authentication → SMTP Settings → Enable custom SMTP**. Darmowe opcje: [Resend](https://resend.com) (3000 maili/mies.) albo [Brevo](https://brevo.com) (300 maili/dzień). Wpisz host, port, login i hasło z panelu dostawcy, nadawca np. `crm@twojadomena.pl`.
7. **Project Settings → API**: skopiuj *Project URL* i klucz *anon public* – będą potrzebne w kroku 2.

### 2. Vercel – strona
1. Na https://vercel.com: **Add New → Project → Import** repozytorium `crm-wspolprace-ssuwr`.
2. Framework: *Vite* (wykryje się sam). W **Environment Variables** dodaj:
   - `VITE_SUPABASE_URL` = Project URL z Supabase
   - `VITE_SUPABASE_ANON_KEY` = klucz anon public
3. **Deploy**. Dostaniesz adres typu `https://crm-wspolprace-ssuwr.vercel.app`.
4. Wróć do Supabase → **Authentication → URL Configuration**: *Site URL* = adres z Vercela, a w *Redirect URLs* dodaj ten sam adres.

### 3. Pierwsze uruchomienie
1. Wejdź na adres aplikacji i **zaloguj się jako pierwszy** swoim mailem uczelnianym – zostaniesz administratorem głównym.
2. Uzupełnij profil (imię, funkcja, rodzaj Outlooka, podpis).
3. **Struktura i zespoły → + Nowy zespół**: nazwa, lider, sektory lub kategorie.
4. Wyślij link członkom komisji. Po ich zalogowaniu zaakceptuj ich w zakładce *Struktura* (od razu wybierasz rolę) i dodaj do zespołów.

Klucz `anon` jest publiczny z założenia – dostęp do danych pilnują reguły RLS w bazie (niezalogowani i niezaakceptowani nie widzą niczego).

---

## Jak się pracuje
Cztery zakładki: **Dziś · Firmy · Kampanie · Więcej**.
- **Dziś** – na górze karta „Następna firma”. Klikasz **Zacznij kontakt →** i idziesz krokami: 1) *Otwórz w Outlooku* (mail gotowy, klikasz tylko „Wyślij”), 2) *kopiuj i otwórz profil* w social mediach, 3) ewentualnie telefon. Potem **Gotowe – następna firma →** i aplikacja sama otwiera kolejną. „Pomiń” przeskakuje firmę, „Jutro” przekłada ją o dzień.
- **Odpowiedzieli** – zapisujesz wynik (rozmowy / współpraca / nie teraz / odmowa); treść odpowiedzi widzisz tylko Ty.
- **Firmy** – duża wyszukiwarka, przełącznik *Mój zespół / Moje firmy / Wszystkie* i 6 etapów: Nowa, W kontakcie, Rozmowy, Współpraca, Nie teraz, Odmowa. Pozostałe filtry są schowane pod „Więcej filtrów”.
- **Kampanie** (liderzy i admini) – wystarczy nazwa, cel i zespół. Gotowa ścieżka (mail + Instagram → przypomnienie → telefon) i podział firm ustawiają się same; zmienić je można w zwiniętych sekcjach.
- **Więcej** – statystyki, szukanie nowych firm, szablony, zespoły i ludzie, profil (tu też zmiana hasła), ustawienia.
- **Treść z AI za darmo** – w oknie kontaktu „Zmień kanały · napisz treść z AI”: kopiujesz prompt do Copilota / ChatGPT / Gemini i wklejasz odpowiedź.

## Role
| Rola | Może |
|---|---|
| Administrator główny | wszystko: akceptuje konta, nadaje role, tworzy zespoły, ustawienia, import, usuwa firmy |
| Lider zespołu | tworzy kampanie, przypisuje firmy, zarządza członkami swojego zespołu i jego kategoriami |
| Członek | pracuje na firmach: kontakty, odpowiedzi, notatki, edycja danych, szablony, dodawanie firm |

## Rozwój lokalny
```bash
cp .env.example .env   # wpisz URL i klucz anon
npm install
npm run dev
```

## Pliki
- `src/core.js` – połączenie z Supabase, stan, szablony, prompty
- `src/views-work.js` – pulpit, zadania, kontakt z firmą, firmy, karta firmy
- `src/views-camp.js` – kampanie, kreator, szablony
- `src/views-org.js` – struktura i zespoły, profil, szukanie leadów, ustawienia, import/eksport
- `supabase/schema.sql` – tabele, role, reguły dostępu (RLS), blokada domen
- `supabase/seed.sql` – startowa baza firm
- `scripts/make_seed.py` – generator `seed.sql` z pliku JSON
