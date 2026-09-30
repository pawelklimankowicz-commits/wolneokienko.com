-- =====================================================================
-- Rejestracja usługodawców (src/serwer/salony.ts) i akceptacja dokumentów.
--
-- Salon: adres w częściach (miasto do podziału na fazy geograficzne),
-- kontakt, branża główna, numer rejestru dla gabinetów medycznych i wersja
-- zaakceptowanego regulaminu dla usługodawców (P2B).
-- Konto: wersja zaakceptowanego regulaminu klientki przy logowaniu.
-- Miesiąc próbny liczy się od pierwszego włączenia przyjmowania zapytań
-- (aktywowany_at), nie od samej rejestracji.
-- =====================================================================

alter table public.salony
  add column branza text check (branza in ('uroda', 'zdrowie', 'auto', 'zwierzeta', 'sport', 'nauka', 'dom')),
  add column ulica text,
  add column kod_pocztowy text check (kod_pocztowy ~ '^[0-9]{2}-[0-9]{3}$'),
  add column miasto text,
  add column telefon text check (telefon ~ '^\+[0-9]{9,15}$'),
  add column email text,
  add column numer_rejestru text,
  add column adres_z_mapy text,
  add column regulamin_wersja text,
  add column regulamin_zaakceptowany_at timestamptz,
  add column updated_at timestamptz not null default now();

create index salony_wlasciciel on public.salony (wlasciciel_id);
create index salony_miasto on public.salony (miasto);

alter table public.konta
  add column regulamin_wersja text,
  add column regulamin_zaakceptowany_at timestamptz;
