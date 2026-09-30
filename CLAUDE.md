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
- `katalog-uslug.ts` — usługi, fazy, zasady dla zabiegów iniekcyjnych.

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
- `vite-api.ts` — to samo API pod `npm run dev` / `npm run preview`. Lokalnie
  domyślnie baza w pamięci (PGlite) i kody SMS wypisane w terminalu — nic nie
  kosztuje i nie dotyka produkcji. `DATABASE_URL_DEV` w `.env.local` → baza Neon,
  `SMS_PRAWDZIWE=1` → prawdziwe SMS-y.

Przy hostingu na Cloudflare: adapter wywołuje `utworzApi({…, bezpieczneCiasteczka: true})`
i przekazuje adres z nagłówka `CF-Connecting-IP`.

Aplikacja rozmawia z API przez `src/lib/api.ts`. `npm run build:podglad` buduje
wersję bez serwera (logowanie w pamięci, kod 123456) do podglądu w przeglądarce.

Sekrety w `.env.local` (poza gitem): `DATABASE_URL`, `SMSAPI_TOKEN`,
`KODY_SMS_PIEPRZ` (klucz HMAC kodów — zmiana unieważnia tylko kody w drodze),
`SMSAPI_NADAWCA` (nazwa nadawcy — dopiero gdy SMSAPI ją zatwierdzi).

## Weryfikacja przed pushem — lokalnie

```bash
npm run verify   # typecheck + lint + test + build
```

Push dopiero, gdy wszystko jest zielone. Nie dokładamy GitHub Actions.
