-- =====================================================================
-- Wolne Okienko — schemat podstawowy (faza 1).
--
-- Przepływ: klientka składa ZAPYTANIE → system rozsyła je falami do salonów
-- (ROZESLANIA) → salony składają OFERTY → klientka wybiera jedną, płaci
-- zadatek (REZERWACJA) → po terminie wizyty powstaje ROZLICZENIE
-- (prowizja 20% + VAT, wypłata dla salonu, ewentualny zwrot).
--
-- Kwoty w groszach (integer). Czas w timestamptz. Lokalizacja w PostGIS
-- (geography, WGS84) — zapytania „salony w promieniu X km”.
--
-- RLS włączone na wszystkich tabelach bez polityk = dostęp tylko dla
-- service_role (funkcje brzegowe). Polityki dla aplikacji klientki i salonu
-- dochodzą w osobnej migracji razem z ekranami.
-- =====================================================================

create extension if not exists postgis;

-- ── Salony ──────────────────────────────────────────────────────────
create table public.salony (
  id uuid primary key default gen_random_uuid(),
  wlasciciel_id uuid not null references auth.users (id) on delete restrict,
  nazwa text not null,
  nip text not null unique check (nip ~ '^[0-9]{10}$'),
  adres text not null,
  lokalizacja geography (point, 4326) not null,
  przyjmuje_zapytania boolean not null default false,
  wskaznik_odpowiedzi numeric(4, 3) not null default 0.5 check (wskaznik_odpowiedzi between 0 and 1),
  aktywowany_at timestamptz,
  zablokowany_at timestamptz,
  created_at timestamptz not null default now()
);

create index salony_lokalizacja_gist on public.salony using gist (lokalizacja);
create index salony_przyjmuje on public.salony (przyjmuje_zapytania) where przyjmuje_zapytania;

-- ── Katalog usług (źródło: src/domain/katalog-uslug.ts) ─────────────
create table public.uslugi (
  kod text primary key,
  nazwa text not null,
  kategoria text not null,
  faza smallint not null check (faza between 1 and 6),
  typowy_czas_min integer not null check (typowy_czas_min > 0),
  bez_promocji boolean not null default false,
  wymaga_lekarza boolean not null default false,
  wymaga_deklaracji_kwalifikacji boolean not null default false
);

-- ── Cennik salonu ───────────────────────────────────────────────────
create table public.cennik (
  salon_id uuid not null references public.salony (id) on delete cascade,
  usluga_kod text not null references public.uslugi (kod),
  cena_gr integer not null check (cena_gr > 0),
  czas_min integer not null check (czas_min > 0),
  -- zabiegi iniekcyjne: deklaracja salonu, kto wykonuje (docs/DECYZJE.md, pkt 5)
  wykonuje_lekarz boolean not null default false,
  deklaracja_kwalifikacji text,
  primary key (salon_id, usluga_kod)
);

-- ── Klientki ────────────────────────────────────────────────────────
create table public.klientki (
  id uuid primary key references auth.users (id) on delete cascade,
  imie text,
  telefon text,
  wskaznik_stawiennictwa numeric(4, 3) not null default 1 check (wskaznik_stawiennictwa between 0 and 1),
  created_at timestamptz not null default now()
);

-- ── Zapytania klientek ──────────────────────────────────────────────
create table public.zapytania (
  id uuid primary key default gen_random_uuid(),
  klientka_id uuid not null references public.klientki (id) on delete cascade,
  usluga_kod text not null references public.uslugi (kod),
  tresc text,
  okno_od timestamptz not null,
  okno_do timestamptz not null,
  lokalizacja geography (point, 4326) not null,
  limit_ceny_gr integer check (limit_ceny_gr > 0),
  tryb text not null default 'zbieram' check (tryb in ('pierwsza', 'zbieram')),
  promien_km numeric(5, 1),
  status text not null default 'otwarte'
    check (status in ('otwarte', 'zarezerwowane', 'bez_ofert', 'anulowane', 'wygasle')),
  wygasa_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (okno_do > okno_od)
);

create index zapytania_otwarte on public.zapytania (wygasa_at) where status = 'otwarte';

-- ── Rozesłania falami ───────────────────────────────────────────────
create table public.rozeslania (
  zapytanie_id uuid not null references public.zapytania (id) on delete cascade,
  salon_id uuid not null references public.salony (id) on delete cascade,
  fala smallint not null check (fala between 1 and 9),
  zaplanowano_na timestamptz not null,
  wyslano_at timestamptz,
  odpowiedziano_at timestamptz,
  primary key (zapytanie_id, salon_id)
);

create index rozeslania_do_wyslania on public.rozeslania (zaplanowano_na) where wyslano_at is null;

-- ── Oferty salonów ──────────────────────────────────────────────────
create table public.oferty (
  id uuid primary key default gen_random_uuid(),
  zapytanie_id uuid not null references public.zapytania (id) on delete cascade,
  salon_id uuid not null references public.salony (id) on delete cascade,
  termin timestamptz not null,
  cena_gr integer not null check (cena_gr > 0),
  status text not null default 'zlozona'
    check (status in ('zlozona', 'wybrana', 'potwierdzona', 'odrzucona', 'wygasla')),
  created_at timestamptz not null default now(),
  unique (zapytanie_id, salon_id, termin)
);

-- ── Rezerwacje ──────────────────────────────────────────────────────
create table public.rezerwacje (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid not null unique references public.oferty (id),
  klientka_id uuid not null references public.klientki (id),
  salon_id uuid not null references public.salony (id),
  termin timestamptz not null,
  cena_gr integer not null check (cena_gr > 0),
  zadatek_gr integer not null check (zadatek_gr >= 0),
  platnosc_ref text,
  wynik text check (wynik in ('zrealizowana', 'nieobecnosc', 'odwolana_przez_klientke', 'odwolana_przez_salon')),
  wynik_at timestamptz,
  created_at timestamptz not null default now(),
  check (zadatek_gr <= cena_gr)
);

create index rezerwacje_salon_termin on public.rezerwacje (salon_id, termin);

-- ── Rozliczenia (src/domain/zadatek.ts) ─────────────────────────────
create table public.rozliczenia (
  rezerwacja_id uuid primary key references public.rezerwacje (id),
  prowizja_netto_gr integer not null check (prowizja_netto_gr >= 0),
  prowizja_vat_gr integer not null check (prowizja_vat_gr >= 0),
  wyplata_dla_salonu_gr integer not null check (wyplata_dla_salonu_gr >= 0),
  zwrot_dla_klientki_gr integer not null check (zwrot_dla_klientki_gr >= 0),
  do_faktury_gr integer not null check (do_faktury_gr >= 0),
  zwolniona_promocja boolean not null,
  polityka_odwolania text not null check (polityka_odwolania in ('zwrot', 'przepada')),
  created_at timestamptz not null default now()
);

-- ── Oceny (tylko po zrealizowanej wizycie) ──────────────────────────
create table public.oceny (
  rezerwacja_id uuid primary key references public.rezerwacje (id),
  ocena smallint not null check (ocena between 1 and 5),
  komentarz text,
  created_at timestamptz not null default now()
);

-- ── RLS: domyślnie zamknięte ────────────────────────────────────────
alter table public.salony enable row level security;
alter table public.uslugi enable row level security;
alter table public.cennik enable row level security;
alter table public.klientki enable row level security;
alter table public.zapytania enable row level security;
alter table public.rozeslania enable row level security;
alter table public.oferty enable row level security;
alter table public.rezerwacje enable row level security;
alter table public.rozliczenia enable row level security;
alter table public.oceny enable row level security;
