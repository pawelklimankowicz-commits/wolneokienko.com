# Zasady pracy w repozytorium Wolne Okienko

## Czym jest projekt

Aplikacja, w której klientka wysyła zapytanie („hybryda dziś po 16, Jeżyce, do 150 zł”),
a salony w okolicy, które mają wolny czas, odpowiadają ofertą na żywo. Decyzje
właściciela: `docs/DECYZJE.md`. Czytaj je przed zmianą logiki prowizji, zadatku
albo katalogu usług.

## Stos

React + Vite + TypeScript. Baza: **Neon** (Postgres + PostGIS, Frankfurt) — wybrana dla
niskich kosztów. Docelowo Cloudflare (hosting, funkcje API, pliki) i Capacitor dla iOS
i Androida. Domena: wolneokienko.com.

Baza z terminala (klucz `NEON_API_KEY` w `.env.local`, poza gitem):

```bash
npm run db:utworz    # projekt „wolne-okienko” we Frankfurcie, zapisuje DATABASE_URL
npm run db:migrate   # wykonuje nowe pliki z baza/migrations
npm run db:katalog   # wgrywa katalog usług z src/domain/katalog-uslug.ts
npm run db:status
```

## Logika domenowa

`src/domain/` to czyste moduły bez bazy i bez sieci — wszystkie reguły pieniędzy
i dopasowania są tutaj i mają testy:

- `prowizja.ts` — 20% + VAT od każdej wizyty, promocja startowa;
- `wynik-wizyty.ts` — czy wizyta się odbyła, na podstawie zgłoszeń salonu i klientki;
- `rozliczenie.ts` — rozliczenie rezerwacji (faza 1 bez zadatku, zadatek gotowy na później);
- `fale.ts` — rozsyłanie zapytań falami, rosnący promień;
- `katalog-uslug.ts` — 8 branż, 47 kategorii, 120 usług; wyszukiwanie po synonimach (wygrywa najdłuższe trafienie);
  zasady dla zabiegów iniekcyjnych;
- `nieobecnosci.ts` — blokada klientki po nieobecnościach;
- `rejestracja-salonu.ts` — reguły danych firmy i cennika.

Kwoty zawsze w groszach (liczby całkowite).

## Serwer (`src/serwer/`)

Kod po stronie serwera, pisany na Web Crypto i `fetch`, żeby bez zmian poszedł
do Cloudflare Workers. Baza przez typ `Baza` (zapytanie SQL → wiersze): na
produkcji `bazaNeon`, w testach `bazaTestowa()` — PGlite z prawdziwymi migracjami.
Importy w `src/serwer/` względne (`../lib/…`), bo ładuje je też `vite.config.ts`.

- `api.ts` — API logowania jako jedna funkcja `Request → Response`:
  `POST /api/logowanie/kod`, `POST /api/logowanie/sprawdz`, `GET /api/ja`,
  `POST /api/wyloguj`. Sesja w ciasteczku `wo_sesja` (HttpOnly, SameSite=Lax,
  Secure na produkcji) albo w nagłówku `Authorization: Bearer` (aplikacje mobilne).
  POST tylko z JSON-em (ochrona przed CSRF). Konta operatora nie da się założyć z API;
- `kody-sms.ts` — logowanie kodem SMS: 6 cyfr, 5 minut, 5 prób, liczy się
  najnowszy kod; limity na numer 30 s / 3 na 15 min / 10 na dobę, na IP 20 na
  godzinę, łącznie 200 na godzinę (bezpiecznik na saldo SMSAPI). W bazie tylko
  HMAC kodu i adresu IP;
- `sesje.ts` — token 32 bajty, w bazie SHA-256, 90 dni od ostatniego użycia;
- `bramka-sms.ts` — SMSAPI (konto Prometheusa; błędy przychodzą jako HTTP 200
  z polem `error`; konto odrzuca SMS-y z linkiem, także z samą domeną);
- `salony.ts` — rejestracja usługodawcy: dane firmy (adres → punkt na mapie przez
  `geokoder.ts`, OpenStreetMap), cennik zapisywany w całości jednym poleceniem,
  przyjmowanie zapytań. Reguły pól i cennika: `src/domain/rejestracja-salonu.ts`
  (te same sprawdza formularz). Endpointy `GET/POST /api/salon`,
  `POST /api/salon/cennik`, `POST /api/salon/przyjmowanie`;
- `zapytania.ts` — strona klientki: zapytanie na żywo (okno czasu, punkt na mapie,
  limit ceny, tryb „porównuję” albo „biorę pierwszą pasującą”), fale rozesłania
  z `src/domain/fale.ts` (promień 3→30 km, odległość haversine w SQL na `lat/lon`),
  przyjęcie oferty jednym poleceniem CTE (rezerwacja + wygaszenie reszty + ochrona
  przed podwójną rezerwacją), wizyty, odwołanie, odpowiedź po wizycie. Przy usługach
  medycznych opis nie jest zapisywany. Blokada po 3 nieobecnościach:
  `src/domain/nieobecnosci.ts`. Wygasanie leniwe (`zakonczPrzeterminowane`);
- `skrzynka.ts` — strona usługodawcy: zapytania z okolicy, oferta (jedna na
  zapytanie, najwcześniej 10 min od teraz, nie powyżej limitu), „nie mam czasu”,
  nadchodzące wizyty z telefonem klientki; wskaźnik odpowiedzi jako średnia krocząca.
  Endpointy: `POST /api/zapytania`, `GET /api/zapytania/:id`, `…/anuluj`,
  `POST /api/oferty/:id/przyjmij`, `GET /api/wizyty`, `…/odwolaj`, `…/potwierdz`,
  `GET /api/salon/zapytania`, `…/:id/oferta`, `…/:id/odmowa`, `GET /api/salon/wizyty`;
- `profil.ts` — opis, logo i zdjęcia (base64 → `bytea`, typ po bajtach, bez SVG,
  `GET /api/zdjecia/:id` publicznie z długim cache), pracownicy (samo imię),
  profil publiczny `GET /api/salony/:id` (bez NIP-u i telefonu);
- `kalendarz.ts` + `kalendarz-ics.ts` — kalendarz salonu z tajnego adresu iCal: lista
  dozwolonych hostów (SSRF), adres szyfrowany AES-GCM (klucz z `KODY_SMS_PIEPRZ`
  przez HKDF — zmiana sekretu = salony podłączają kalendarz ponownie), z pliku tylko
  przedziały zajętości na 8 dni, odświeżanie co 10 min przy pobieraniu skrzynki;
- `vite-api.ts` — to samo API pod `npm run dev` / `npm run preview`. Lokalnie
  domyślnie baza w pamięci (PGlite) i kody SMS wypisane w terminalu — nic nie
  kosztuje i nie dotyka produkcji. `DATABASE_URL_DEV` w `.env.local` → baza Neon,
  `SMS_PRAWDZIWE=1` → prawdziwe SMS-y.

Przy hostingu na Cloudflare: adapter wywołuje `utworzApi({…, bezpieczneCiasteczka: true})`
i przekazuje adres z nagłówka `CF-Connecting-IP`.

Dokumenty prawne dla użytkowników: `docs/prawne/*.md` (wyświetla je `src/ekrany/Dokument.tsx`;
wersje w `src/domain/dokumenty.ts`). Dokumenty wewnętrzne: `docs/prawne/wewnetrzne/`.

Aplikacja rozmawia z API przez `src/lib/api.ts` (interfejs `KlientApi` w `api-typy.ts`,
wersja HTTP w `api-http.ts`). `npm run build:podglad` buduje wersję bez serwera
(`api-podglad.ts`: wszystko w pamięci, kod 123456, oferty od przykładowych salonów)
do podglądu w przeglądarce. Ekrany na żywo: `Oferty.tsx` (odpytuje stan co 3 s),
`Wizyty.tsx`, `SkrzynkaSalonu.tsx` (w panelu usługodawcy, co 5 s). Zakładka Okienka
i start pokazują jeszcze przykładowe okienka; w aplikacji „Rezerwuję” otwiera zapytanie.

Narzędzia usługodawcy: import cennika (`src/domain/import-cennika.ts` — rozpoznawanie
i dopasowanie do katalogu, `src/lib/arkusz.ts` — CSV/XLSX bez bibliotek, `src/lib/ocr.ts`
— Tesseract w przeglądarce), profil i zespół (`src/ekrany/PanelProfil.tsx`), wniosek
o eksport danych (`src/domain/wniosek-eksport.ts`). Pliki OCR (program ok. 4 MB,
polski słownik 2,6 MB) serwujemy sami z katalogu `ocr/` — kopiuje je z node_modules
wtyczka w `vite.config.ts`. Nie logujemy się do cudzych systemów i nie importujemy
danych klientów (docs/DECYZJE.md, § 12).

Sekrety w `.env.local` (poza gitem): `DATABASE_URL`, `SMSAPI_TOKEN`,
`KODY_SMS_PIEPRZ` (klucz HMAC kodów — zmiana unieważnia tylko kody w drodze),
`SMSAPI_NADAWCA` (opcjonalnie; domyślnie „WolneOkno”, zatwierdzone w SMSAPI 30.09.2026).

## Weryfikacja przed pushem — lokalnie

```bash
npm run verify   # typecheck + lint + test + build
```

Push dopiero, gdy wszystko jest zielone. Nie dokładamy GitHub Actions.
