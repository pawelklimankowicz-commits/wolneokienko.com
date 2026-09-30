-- =====================================================================
-- Profil usługodawcy i narzędzia importu (docs/DECYZJE.md, § 12).
--
-- • Opis, logo i do 6 zdjęć salonu. Zdjęcia już zmniejszone w przeglądarce
--   (WebP albo JPEG); w bazie do czasu przeniesienia plików na hosting.
--   Salon oświadcza, że ma prawa do zdjęć i zgody osób na nich widocznych.
-- • Pracownicy: tylko imię (albo pseudonim) i usługi, które wykonuje —
--   klientka widzi w ofercie, u kogo będzie wizyta. Oferta zapamiętuje imię.
-- • Kalendarz salonu (adres iCal): adres zaszyfrowany, z kalendarza tylko
--   przedziały zajętości na najbliższe dni — bez tytułów i opisów wydarzeń.
-- =====================================================================

alter table public.salony add column opis text check (char_length(opis) <= 600);

create table public.zdjecia_salonow (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salony (id) on delete cascade,
  rodzaj text not null check (rodzaj in ('logo', 'zdjecie')),
  typ text not null check (typ in ('image/webp', 'image/jpeg', 'image/png')),
  dane bytea not null check (octet_length(dane) between 100 and 600000),
  oswiadczenie_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index zdjecia_salonow_salonu on public.zdjecia_salonow (salon_id, rodzaj, created_at);

create table public.pracownicy (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salony (id) on delete cascade,
  imie text not null check (char_length(imie) between 2 and 30),
  uslugi text[] not null default '{}',
  kolejnosc integer not null default 0,
  created_at timestamptz not null default now(),
  unique (salon_id, imie)
);

alter table public.oferty add column pracownik_imie text check (char_length(pracownik_imie) between 2 and 30);

create table public.kalendarze_salonow (
  salon_id uuid primary key references public.salony (id) on delete cascade,
  -- AES-GCM, klucz wyprowadzony z sekretu serwera (src/serwer/kalendarz.ts)
  adres_szyfr text not null,
  host text not null,
  zajete jsonb not null default '[]',
  pobrano_at timestamptz,
  blad text,
  created_at timestamptz not null default now()
);

alter table public.zdjecia_salonow enable row level security;
alter table public.pracownicy enable row level security;
alter table public.kalendarze_salonow enable row level security;
