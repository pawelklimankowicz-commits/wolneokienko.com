-- =====================================================================
-- Wolne Okienko — schemat podstawowy (faza 1).
--
-- Przepływ: klientka składa ZAPYTANIE → system rozsyła je falami do salonów
-- (ROZESLANIA) → salony składają OFERTY → klientka wybiera jedną (REZERWACJA)
-- → po terminie salon i klientka zgłaszają, czy wizyta się odbyła
-- (src/domain/wynik-wizyty.ts) → powstaje ROZLICZENIE (prowizja 20% + VAT).
--
-- Faza 1 bez zadatku: klientka płaci w salonie, prowizja idzie na miesięczną
-- fakturę salonu. Kolumny zadatku zostają na późniejsze fazy (domyślnie 0).
--
-- Kwoty w groszach (integer). Czas w timestamptz. Lokalizacja w PostGIS
-- (geography, WGS84) — zapytania „wykonawcy w promieniu X km”.
--
-- Baza: Neon (Postgres + PostGIS, Frankfurt), wykonywana przez
-- scripts/neon-api.mjs. Konta i logowanie SMS-em są nasze (tabela KONTA),
-- bez zależności od dostawcy uwierzytelniania.
--
-- RLS włączone na wszystkich tabelach bez polityk: dostęp tylko przez API
-- aplikacji, działające jako właściciel bazy.
-- =====================================================================

-- PostGIS w osobnym schemacie, żeby tabele rozszerzenia nie mieszały się z naszymi.
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- ── Konta (klientki, usługodawcy, operatorzy) ───────────────────────
create table public.konta (
  id uuid primary key default gen_random_uuid(),
  telefon text not null unique check (telefon ~ '^\+[0-9]{9,15}$'),
  rola text not null check (rola in ('klientka', 'salon', 'operator')),
  telefon_zweryfikowany_at timestamptz,
  created_at timestamptz not null default now()
);

-- Jednorazowe kody SMS do logowania (przechowujemy tylko skrót kodu).
create table public.kody_sms (
  id uuid primary key default gen_random_uuid(),
  telefon text not null,
  kod_skrot text not null,
  wygasa_at timestamptz not null,
  proby smallint not null default 0 check (proby between 0 and 5),
  uzyty_at timestamptz,
  created_at timestamptz not null default now()
);

create index kody_sms_telefon on public.kody_sms (telefon, created_at desc);

-- ── Salony ──────────────────────────────────────────────────────────
create table public.salony (
  id uuid primary key default gen_random_uuid(),
  wlasciciel_id uuid not null references public.konta (id) on delete restrict,
  nazwa text not null,
  nip text not null unique check (nip ~ '^[0-9]{10}$'),
  adres text not null,
  lokalizacja extensions.geography (point, 4326) not null,
  przyjmuje_zapytania boolean not null default false,
  wskaznik_odpowiedzi numeric(4, 3) not null default 0.5 check (wskaznik_odpowiedzi between 0 and 1),
  aktywowany_at timestamptz,
  zablokowany_at timestamptz,
  -- nieopłacona faktura prowizyjna po terminie: salon nie dostaje zapytań
  wstrzymany_za_zaleglosc_at timestamptz,
  created_at timestamptz not null default now()
);

create index salony_lokalizacja_gist on public.salony using gist (lokalizacja);
create index salony_przyjmuje on public.salony (przyjmuje_zapytania) where przyjmuje_zapytania;

-- ── Katalog usług wszystkich branż (źródło: src/domain/katalog-uslug.ts) ──
create table public.uslugi (
  kod text primary key,
  nazwa text not null,
  kategoria text not null,
  branza text not null check (branza in ('uroda', 'zdrowie', 'auto', 'zwierzeta', 'sport', 'nauka', 'dom')),
  -- zdrowie: zgoda na dane o zdrowiu, bez promocji, neutralna kolejność ofert
  medyczna boolean not null default false,
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
  id uuid primary key references public.konta (id) on delete cascade,
  imie text,
  telefon text,
  telefon_zweryfikowany_at timestamptz,
  wskaznik_stawiennictwa numeric(4, 3) not null default 1 check (wskaznik_stawiennictwa between 0 and 1),
  nieobecnosci integer not null default 0 check (nieobecnosci >= 0),
  -- bez zadatku nieobecności nic nie kosztują, więc po kilku blokujemy konto
  zablokowana_at timestamptz,
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
  lokalizacja extensions.geography (point, 4326) not null,
  limit_ceny_gr integer check (limit_ceny_gr > 0),
  tryb text not null default 'zbieram' check (tryb in ('pierwsza', 'zbieram')),
  -- wyraźna zgoda na przekazanie rodzaju wizyty medycznej (art. 9 ust. 2 lit. a RODO)
  zgoda_dane_zdrowotne_at timestamptz,
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
  zadatek_gr integer not null default 0 check (zadatek_gr >= 0),
  platnosc_ref text,
  -- zgłoszenia po terminie wizyty (src/domain/wynik-wizyty.ts)
  zgloszenie_salonu text check (zgloszenie_salonu in ('zrealizowana', 'nieobecnosc', 'odwolana_przez_klientke', 'odwolana_przez_salon')),
  zgloszenie_salonu_at timestamptz,
  potwierdzenie_klientki text check (potwierdzenie_klientki in ('bylam', 'nie_bylam', 'salon_odwolal')),
  potwierdzenie_klientki_at timestamptz,
  spor_at timestamptz,
  -- wynik ostateczny: podstawa rozliczenia
  wynik text check (wynik in ('zrealizowana', 'nieobecnosc', 'odwolana_przez_klientke', 'odwolana_przez_salon')),
  wynik_at timestamptz,
  created_at timestamptz not null default now(),
  check (zadatek_gr <= cena_gr)
);

create index rezerwacje_salon_termin on public.rezerwacje (salon_id, termin);

-- ── Rozliczenia (src/domain/rozliczenie.ts) ──────────────────────────
create table public.rozliczenia (
  rezerwacja_id uuid primary key references public.rezerwacje (id),
  prowizja_netto_gr integer not null check (prowizja_netto_gr >= 0),
  prowizja_vat_gr integer not null check (prowizja_vat_gr >= 0),
  wyplata_dla_salonu_gr integer not null check (wyplata_dla_salonu_gr >= 0),
  zwrot_dla_klientki_gr integer not null check (zwrot_dla_klientki_gr >= 0),
  do_faktury_gr integer not null check (do_faktury_gr >= 0),
  zwolniona_promocja boolean not null,
  -- null, gdy rezerwacja była bez zadatku (faza 1)
  polityka_odwolania text check (polityka_odwolania in ('zwrot', 'przepada')),
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
alter table public.konta enable row level security;
alter table public.kody_sms enable row level security;
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
