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

- `kody-sms.ts` — logowanie kodem SMS: 6 cyfr, 5 minut, 5 prób, liczy się
  najnowszy kod; limity 30 s / 3 na 15 min / 10 na dobę; w bazie tylko HMAC kodu;
- `sesje.ts` — token 32 bajty, w bazie SHA-256, 90 dni od ostatniego użycia;
- `bramka-sms.ts` — SMSAPI (konto Prometheusa; błędy przychodzą jako HTTP 200
  z polem `error`);
- `telefon.ts` — tylko polskie numery, zapis `+48XXXXXXXXX`.

Sekrety w `.env.local` (poza gitem): `DATABASE_URL`, `SMSAPI_TOKEN`,
`KODY_SMS_PIEPRZ` (klucz HMAC kodów — zmiana unieważnia tylko kody w drodze).

## Weryfikacja przed pushem — lokalnie

```bash
npm run verify   # typecheck + lint + test + build
```

Push dopiero, gdy wszystko jest zielone. Nie dokładamy GitHub Actions.
