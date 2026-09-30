-- =====================================================================
-- Zapytania i oferty na żywo (src/serwer/zapytania.ts, src/serwer/skrzynka.ts).
--
-- • Współrzędne salonów i zapytań także jako liczby: odległość liczymy
--   wzorem haversine w zwykłym SQL-u (działa i w PostGIS, i w testach),
--   z prostokątem wstępnie zawężającym wyszukiwanie. Kolumny geography
--   zostają na później (duża skala).
-- • Jedna oferta salonu na zapytanie (salon może ją poprawić).
-- • Rozesłanie pamięta odległość, odmowę („nie mam czasu”) i to, czy brak
--   odpowiedzi został już policzony we wskaźniku odpowiedzi.
-- =====================================================================

alter table public.salony add column lat double precision, add column lon double precision;
create index salony_wspolrzedne on public.salony (lat, lon) where przyjmuje_zapytania;

alter table public.zapytania add column lat double precision, add column lon double precision;
create index zapytania_klientki on public.zapytania (klientka_id, created_at desc);

alter table public.rozeslania
  add column odleglosc_km numeric(5, 1),
  add column odmowa boolean not null default false,
  add column bez_odpowiedzi_policzone boolean not null default false;
create index rozeslania_salonu on public.rozeslania (salon_id, zaplanowano_na desc);

alter table public.oferty drop constraint oferty_zapytanie_id_salon_id_termin_key;
alter table public.oferty add constraint oferty_jedna_na_salon unique (zapytanie_id, salon_id);

create index rezerwacje_klientki on public.rezerwacje (klientka_id, termin desc);
