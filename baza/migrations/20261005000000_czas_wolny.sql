-- =====================================================================
-- Rozbudowa katalogu (30.09.2026): nowa branża „Czas wolny” (escape room,
-- kręgle i bilard, sauna i balia, gokarty) oraz liczba osób w zapytaniu —
-- rezerwacje na grupę (np. escape room dla 4 osób).
-- =====================================================================

alter table public.uslugi drop constraint uslugi_branza_check;
alter table public.uslugi add constraint uslugi_branza_check
  check (branza in ('uroda', 'zdrowie', 'auto', 'zwierzeta', 'sport', 'nauka', 'dom', 'czas_wolny'));

alter table public.salony drop constraint salony_branza_check;
alter table public.salony add constraint salony_branza_check
  check (branza in ('uroda', 'zdrowie', 'auto', 'zwierzeta', 'sport', 'nauka', 'dom', 'czas_wolny'));

alter table public.zapytania add column liczba_osob smallint check (liczba_osob between 1 and 50);
