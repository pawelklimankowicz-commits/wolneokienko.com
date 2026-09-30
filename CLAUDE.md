# Zasady pracy w repozytorium Wolne Okienko

## Czym jest projekt

Aplikacja, w której klientka wysyła zapytanie („hybryda dziś po 16, Jeżyce, do 150 zł”),
a salony w okolicy, które mają wolny czas, odpowiadają ofertą na żywo. Decyzje
właściciela: `docs/DECYZJE.md`. Czytaj je przed zmianą logiki prowizji, zadatku
albo katalogu usług.

## Stos

React + Vite + TypeScript, Supabase (Postgres z PostGIS, Realtime, funkcje brzegowe),
docelowo Capacitor dla iOS i Androida. Domena: wolneokienko.app.

## Logika domenowa

`src/domain/` to czyste moduły bez bazy i bez sieci — wszystkie reguły pieniędzy
i dopasowania są tutaj i mają testy:

- `prowizja.ts` — 20% + VAT od każdej wizyty, promocja startowa;
- `zadatek.ts` — rozliczenie zadatku po wizycie (4 wyniki);
- `fale.ts` — rozsyłanie zapytań falami, rosnący promień;
- `katalog-uslug.ts` — usługi, fazy, zasady dla zabiegów iniekcyjnych.

Kwoty zawsze w groszach (liczby całkowite).

## Weryfikacja przed pushem — lokalnie

```bash
npm run verify   # typecheck + lint + test + build
```

Push dopiero, gdy wszystko jest zielone. Nie dokładamy GitHub Actions.
