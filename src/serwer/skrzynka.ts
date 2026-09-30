// Skrzynka usługodawcy: zapytania z okolicy, oferta jednym dotknięciem,
// „nie mam czasu”, nadchodzące wizyty. Strona klientki: src/serwer/zapytania.ts.
// Zasady: regulamin dla usługodawców, § 3–5.

import { czyMedyczna, KATALOG_USLUG } from "../domain/katalog-uslug";
import { LIMITY_CENNIKA } from "../domain/rejestracja-salonu";
import type { Przedzial, StatusWizyty, WizytaSalonu, ZapytanieDlaSalonu } from "../domain/widoki";
import { czas, type Baza } from "./baza";
import { przyjmijOferte, statusWizyty } from "./zapytania";

const iso = (x: Date | string) => new Date(x).toISOString();
/** Oferta najwcześniej 10 minut od teraz — salon musi zdążyć się przygotować. */
const MIN_WYPRZEDZENIE_MIN = 10;

async function salonKonta(baza: Baza, kontoId: string) {
  const [s] = await baza<{ id: string; aktywny: boolean }>(
    `select id, (przyjmuje_zapytania and zablokowany_at is null and wstrzymany_za_zaleglosc_at is null) as aktywny
     from public.salony where wlasciciel_id = $1 order by created_at limit 1`,
    [kontoId],
  );
  return s ?? null;
}

/**
 * Zapytania, które dotarły do salonu (fala już ruszyła), jeszcze otwarte —
 * razem z odpowiedziami salonu. Pierwsze pobranie zapisuje, że zapytanie
 * zostało salonowi pokazane.
 */
export async function zapytaniaSalonu(opcje: {
  baza: Baza;
  kontoId: string;
  teraz?: Date;
  /** zajętość z kalendarza salonu (src/serwer/kalendarz.ts) — przycinana do okna każdego zapytania */
  zajete?: Przedzial[];
}): Promise<ZapytanieDlaSalonu[] | null> {
  const { baza } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const salon = await salonKonta(baza, opcje.kontoId);
  if (!salon) return null;
  const wiersze = await baza<{
    id: string; usluga_kod: string; okno_od: Date | string; okno_do: Date | string; limit_ceny_gr: number | null; liczba_osob: number | null;
    odleglosc_km: string | null; tresc: string | null; wygasa_at: Date | string; cena_gr: number | null; czas_min: number | null;
    odmowa: boolean; oferta_termin: Date | string | null; oferta_cena: number | null; oferta_status: string | null; oferta_pracownik: string | null;
  }>(
    `with pokazane as (
       update public.rozeslania set wyslano_at = $2::timestamptz
       where salon_id = $1 and wyslano_at is null and zaplanowano_na <= $2::timestamptz
     )
     select z.id, z.usluga_kod, z.okno_od, z.okno_do, z.limit_ceny_gr, z.liczba_osob, r.odleglosc_km, z.tresc, z.wygasa_at,
       c.cena_gr, c.czas_min, r.odmowa, o.termin as oferta_termin, o.cena_gr as oferta_cena, o.status as oferta_status,
       o.pracownik_imie as oferta_pracownik
     from public.rozeslania r
     join public.zapytania z on z.id = r.zapytanie_id
     left join public.cennik c on c.salon_id = r.salon_id and c.usluga_kod = z.usluga_kod
     left join public.oferty o on o.zapytanie_id = z.id and o.salon_id = r.salon_id
     where r.salon_id = $1 and r.zaplanowano_na <= $2::timestamptz
       and (z.status = 'otwarte' and z.wygasa_at > $2::timestamptz or o.status in ('potwierdzona', 'zlozona') and z.wygasa_at > $3::timestamptz)
     order by z.wygasa_at desc
     limit 30`,
    [salon.id, czas(teraz), czas(new Date(teraz.getTime() - 60 * 60 * 1000))],
  );
  return wiersze.map((w) => {
    const usluga = KATALOG_USLUG.find((u) => u.kod === w.usluga_kod);
    return {
      id: w.id,
      uslugaKod: w.usluga_kod,
      oknoOd: iso(w.okno_od),
      oknoDo: iso(w.okno_do),
      limitGr: w.limit_ceny_gr,
      liczbaOsob: w.liczba_osob,
      odlegloscKm: w.odleglosc_km === null ? null : Number(w.odleglosc_km),
      tresc: usluga && czyMedyczna(usluga) ? null : w.tresc,
      zbieranieDo: iso(w.wygasa_at),
      mojaCenaGr: w.cena_gr,
      czasMin: w.czas_min ?? usluga?.typowyCzasMin ?? 60,
      mojaOferta: w.oferta_termin && w.oferta_cena !== null
        ? {
            termin: iso(w.oferta_termin),
            cenaGr: w.oferta_cena,
            pracownik: w.oferta_pracownik,
            status: w.oferta_status as NonNullable<ZapytanieDlaSalonu["mojaOferta"]>["status"],
          }
        : null,
      odmowa: w.odmowa,
      zajete: (opcje.zajete ?? [])
        .filter((p) => p.od < iso(w.okno_do) && iso(w.okno_od) < p.do)
        .slice(0, 50),
    };
  });
}

export type WynikOferty =
  | { ok: true; przyjeta: boolean }
  | { ok: false; blad: "brak_salonu" | "nieaktualne" | "wstrzymany" | "zly_termin" | "zla_cena" | "powyzej_limitu" | "zly_pracownik" };

/** Pierwsza odpowiedź salonu podnosi jego wskaźnik odpowiedzi (średnia krocząca). */
const sqlPodniesWskaznik = `update public.salony set wskaznik_odpowiedzi = round((wskaznik_odpowiedzi * 0.9 + 0.1)::numeric, 3) where id = $1`;

export async function zlozOferte(opcje: {
  baza: Baza;
  kontoId: string;
  zapytanieId: string;
  termin: string;
  cenaGr: number;
  /** imię z listy pracowników salonu, u którego będzie wizyta */
  pracownik?: string | null;
  teraz?: Date;
}): Promise<WynikOferty> {
  const { baza, zapytanieId } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const salon = await salonKonta(baza, opcje.kontoId);
  if (!salon) return { ok: false, blad: "brak_salonu" };
  if (!salon.aktywny) return { ok: false, blad: "wstrzymany" };
  const termin = new Date(opcje.termin);
  if (!Number.isInteger(opcje.cenaGr) || opcje.cenaGr < LIMITY_CENNIKA.minCenaGr || opcje.cenaGr > LIMITY_CENNIKA.maksCenaGr) return { ok: false, blad: "zla_cena" };

  const [z] = await baza<{ okno_od: Date | string; okno_do: Date | string; limit_ceny_gr: number | null; tryb: string; klientka_id: string; odpowiedziano_at: unknown }>(
    `select z.okno_od, z.okno_do, z.limit_ceny_gr, z.tryb, z.klientka_id, r.odpowiedziano_at
     from public.zapytania z join public.rozeslania r on r.zapytanie_id = z.id and r.salon_id = $2
     where z.id = $1 and z.status = 'otwarte' and z.wygasa_at > $3::timestamptz and r.zaplanowano_na <= $3::timestamptz`,
    [zapytanieId, salon.id, czas(teraz)],
  );
  if (!z) return { ok: false, blad: "nieaktualne" };
  if (isNaN(termin.getTime()) || termin < new Date(z.okno_od) || termin > new Date(z.okno_do) || termin.getTime() < teraz.getTime() + MIN_WYPRZEDZENIE_MIN * 60 * 1000)
    return { ok: false, blad: "zly_termin" };
  if (z.limit_ceny_gr !== null && opcje.cenaGr > z.limit_ceny_gr) return { ok: false, blad: "powyzej_limitu" };
  const pracownik = opcje.pracownik?.trim() || null;
  if (pracownik) {
    const [jest] = await baza("select 1 from public.pracownicy where salon_id = $1 and imie = $2", [salon.id, pracownik]);
    if (!jest) return { ok: false, blad: "zly_pracownik" };
  }

  const [oferta] = await baza<{ id: string }>(
    `with o as (
       insert into public.oferty (zapytanie_id, salon_id, termin, cena_gr, created_at, pracownik_imie)
       values ($1, $2, $3::timestamptz, $4, $5::timestamptz, $6)
       on conflict (zapytanie_id, salon_id) do update
         set termin = excluded.termin, cena_gr = excluded.cena_gr, pracownik_imie = excluded.pracownik_imie, status = 'zlozona'
         where public.oferty.status = 'zlozona'
       returning id
     ), r as (
       update public.rozeslania set odpowiedziano_at = coalesce(odpowiedziano_at, $5::timestamptz), odmowa = false
       where zapytanie_id = $1 and salon_id = $2 and exists (select 1 from o)
     )
     select id from o`,
    [zapytanieId, salon.id, termin.toISOString(), opcje.cenaGr, czas(teraz), pracownik],
  );
  if (!oferta) return { ok: false, blad: "nieaktualne" };
  if (!z.odpowiedziano_at) await baza(sqlPodniesWskaznik, [salon.id]);

  // tryb „biorę pierwszą pasującą”: pierwsza oferta w warunkach klientki od razu staje się rezerwacją
  if (z.tryb === "pierwsza") {
    const w = await przyjmijOferte({ baza, kontoId: z.klientka_id, ofertaId: oferta.id, teraz });
    return { ok: true, przyjeta: w.ok };
  }
  return { ok: true, przyjeta: false };
}

/** „Nie mam czasu” — też jest odpowiedzią i nie obniża wskaźnika odpowiedzi. */
export async function odmowZapytania(opcje: { baza: Baza; kontoId: string; zapytanieId: string; teraz?: Date }): Promise<boolean> {
  const teraz = opcje.teraz ?? new Date();
  const salon = await salonKonta(opcje.baza, opcje.kontoId);
  if (!salon) return false;
  const [r] = await opcje.baza<{ pierwsza: boolean }>(
    `update public.rozeslania r set odmowa = true, odpowiedziano_at = coalesce(r.odpowiedziano_at, $3::timestamptz)
     from public.zapytania z
     where r.zapytanie_id = $1 and r.salon_id = $2 and z.id = r.zapytanie_id and z.status = 'otwarte'
       and not exists (select 1 from public.oferty o where o.zapytanie_id = $1 and o.salon_id = $2)
     returning (r.odpowiedziano_at = $3::timestamptz) as pierwsza`,
    [opcje.zapytanieId, salon.id, czas(teraz)],
  );
  if (!r) return false;
  if (r.pierwsza) await opcje.baza(sqlPodniesWskaznik, [salon.id]);
  return true;
}

export async function wizytySalonu(opcje: { baza: Baza; kontoId: string; teraz?: Date }): Promise<WizytaSalonu[] | null> {
  const teraz = opcje.teraz ?? new Date();
  const salon = await salonKonta(opcje.baza, opcje.kontoId);
  if (!salon) return null;
  const wiersze = await opcje.baza<{
    id: string; usluga_kod: string; termin: Date | string; cena_gr: number; telefon: string; wynik: string | null; potwierdzenie_klientki: string | null;
    pracownik_imie: string | null;
  }>(
    `select r.id, z.usluga_kod, r.termin, r.cena_gr, k.telefon, r.wynik, r.potwierdzenie_klientki, o.pracownik_imie
     from public.rezerwacje r
     join public.oferty o on o.id = r.oferta_id
     join public.zapytania z on z.id = o.zapytanie_id
     join public.konta k on k.id = r.klientka_id
     where r.salon_id = $1 and r.termin > $2::timestamptz
     order by r.termin
     limit 50`,
    [salon.id, czas(new Date(teraz.getTime() - 7 * 24 * 60 * 60 * 1000))],
  );
  return wiersze.map((w) => ({
    id: w.id,
    uslugaKod: w.usluga_kod,
    termin: iso(w.termin),
    cenaGr: w.cena_gr,
    telefonKlientki: w.telefon,
    status: statusWizyty(w, teraz) as StatusWizyty,
    pracownik: w.pracownik_imie,
  }));
}
