-- =====================================================================
-- Sesje po zalogowaniu kodem SMS (src/serwer/sesje.ts).
--
-- Aplikacja dostaje losowy token (32 bajty), baza trzyma tylko jego skrót
-- SHA-256 — wyciek tabeli nie daje dostępu do kont. Sesja przedłuża się
-- przy każdym użyciu; wylogowanie ustawia uniewazniona_at.
-- =====================================================================

create table public.sesje (
  id uuid primary key default gen_random_uuid(),
  konto_id uuid not null references public.konta (id) on delete cascade,
  token_skrot text not null unique,
  wygasa_at timestamptz not null,
  ostatnio_at timestamptz not null default now(),
  uniewazniona_at timestamptz,
  created_at timestamptz not null default now()
);

create index sesje_konto on public.sesje (konto_id);

alter table public.sesje enable row level security;
