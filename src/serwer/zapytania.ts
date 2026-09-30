// Zapytania klientek na żywo: wysłanie z rozesłaniem falami, stan z ofertami,
// przyjęcie oferty (rezerwacja), anulowanie, wizyty klientki.
// Strona salonu: src/serwer/skrzynka.ts. Zasady: regulamin dla klientek, § 6–8.

import { PARAMETRY_FAL, zaplanujFale } from "../domain/fale";
import { KATALOG_USLUG, czyMedyczna } from "../domain/katalog-uslug";
import { blokadaDo } from "../domain/nieobecnosci";
import { koloryDla } from "../domain/odleglosc";
import {
  WAZNOSC_OFERTY_PO_ZBIERANIU_MIN,
  type NoweZapytanie,
  type OfertaNaZywo,
  type StanZapytania,
  type StatusWizyty,
  type StatusZapytania,
  type WizytaWidok,
} from "../domain/widoki";
import { czas, type Baza } from "./baza";

export const LIMITY_ZAPYTAN = {
  /** otwartych naraz — żeby nie blokować terminów wielu salonów jednocześnie */
  otwartych: 3,
  naDobe: 20,
  maksOknoDni: 3,
  maksWyprzedzenieDni: 8,
  maksTresc: 300,
} as const;

const MAKS_PROMIEN_KM = PARAMETRY_FAL.promienieKm[PARAMETRY_FAL.promienieKm.length - 1];
const DZIEN_MS = 24 * 60 * 60 * 1000;
const plusMin = (d: Date, min: number) => new Date(d.getTime() + min * 60 * 1000);
const iso = (x: Date | string) => new Date(x).toISOString();

/** Odległość w km między punktem ($lat, $lon) a kolumnami `lat`, `lon` tabeli o aliasie `t` — haversine w zwykłym SQL-u. */
export const sqlOdleglosc = (t: string, lat: string, lon: string) =>
  `(12742 * asin(sqrt(power(sin(radians(${t}.lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(${t}.lat)) * power(sin(radians(${t}.lon - ${lon}) / 2), 2))))`;

/** Dzielnica albo miejscowość z opisu adresu na mapie („Dąbrowskiego 12, Jeżyce, Poznań” → „Jeżyce”). */
export function okolica(adresZMapy: string | null, miasto: string | null): string {
  const czesci = (adresZMapy ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (czesci.length >= 3) return czesci[czesci.length - 2];
  return miasto ?? czesci.at(-1) ?? "";
}

/**
 * Porządki „przy okazji” każdego odświeżenia: zamyka zapytania po czasie
 * ważności ofert i obniża wskaźnik odpowiedzi salonom, które dostały
 * zapytanie i nie odpowiedziały.
 */
export async function zakonczPrzeterminowane(baza: Baza, teraz: Date): Promise<void> {
  await baza(
    `with bez as (
       update public.rozeslania r set bez_odpowiedzi_policzone = true
       from public.zapytania z
       where z.id = r.zapytanie_id and z.wygasa_at < $1::timestamptz and r.zaplanowano_na < z.wygasa_at
         and r.odpowiedziano_at is null and not r.bez_odpowiedzi_policzone
       returning r.salon_id
     )
     update public.salony s set wskaznik_odpowiedzi = round((s.wskaznik_odpowiedzi * 0.9)::numeric, 3)
     from (select salon_id from bez group by salon_id) b where s.id = b.salon_id`,
    [czas(teraz)],
  );
  await baza(
    `with konczone as (
       update public.zapytania z set status = case when exists (select 1 from public.oferty o where o.zapytanie_id = z.id) then 'wygasle' else 'bez_ofert' end
       where z.status = 'otwarte' and z.wygasa_at + make_interval(mins => $2) < $1::timestamptz
       returning z.id
     )
     update public.oferty o set status = 'wygasla' from konczone k where o.zapytanie_id = k.id and o.status = 'zlozona'`,
    [czas(teraz), WAZNOSC_OFERTY_PO_ZBIERANIU_MIN],
  );
}

export type WynikWyslaniaZapytania =
  | { ok: true; zapytanie: StanZapytania }
  | { ok: false; blad: "zle_dane"; pole: string }
  | { ok: false; blad: "brak_zgody" }
  | { ok: false; blad: "zablokowana"; doKiedy: string }
  | { ok: false; blad: "za_duzo_otwartych" | "za_duzo_na_dobe" };

export async function wyslijZapytanie(opcje: { baza: Baza; kontoId: string; dane: NoweZapytanie; teraz?: Date }): Promise<WynikWyslaniaZapytania> {
  const { baza, kontoId, dane: d } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const L = LIMITY_ZAPYTAN;

  const usluga = KATALOG_USLUG.find((u) => u.kod === d.uslugaKod);
  if (!usluga) return { ok: false, blad: "zle_dane", pole: "uslugaKod" };
  const od = new Date(d.oknoOd);
  const doKiedy = new Date(d.oknoDo);
  if (isNaN(od.getTime()) || isNaN(doKiedy.getTime()) || doKiedy <= od || doKiedy <= teraz) return { ok: false, blad: "zle_dane", pole: "okno" };
  if (doKiedy.getTime() - od.getTime() > L.maksOknoDni * DZIEN_MS || od.getTime() - teraz.getTime() > L.maksWyprzedzenieDni * DZIEN_MS)
    return { ok: false, blad: "zle_dane", pole: "okno" };
  if (!(d.lat >= 48.9 && d.lat <= 55 && d.lon >= 14 && d.lon <= 24.3)) return { ok: false, blad: "zle_dane", pole: "lokalizacja" };
  if (d.limitGr !== null && !(Number.isInteger(d.limitGr) && d.limitGr >= 100 && d.limitGr <= 10_000_00)) return { ok: false, blad: "zle_dane", pole: "limit" };
  if (d.liczbaOsob !== null && !(Number.isInteger(d.liczbaOsob) && d.liczbaOsob >= 1 && d.liczbaOsob <= 50)) return { ok: false, blad: "zle_dane", pole: "liczbaOsob" };
  if (d.tresc.length > L.maksTresc) return { ok: false, blad: "zle_dane", pole: "tresc" };
  const medyczna = czyMedyczna(usluga);
  if (medyczna && !d.zgodaZdrowie) return { ok: false, blad: "brak_zgody" };

  // profil klientki (konto salonu też może się umawiać) i blokady
  await baza("insert into public.klientki (id) values ($1) on conflict (id) do nothing", [kontoId]);
  const [k] = await baza<{ zablokowana_at: Date | string | null; nieobecnosci: (Date | string)[] | null; otwarte: number; w_dobie: number }>(
    `select k.zablokowana_at,
       (select array_agg(r.termin) from public.rezerwacje r where r.klientka_id = k.id and r.wynik = 'nieobecnosc' and r.termin > $2::timestamptz) as nieobecnosci,
       (select count(*)::int from public.zapytania z where z.klientka_id = k.id and z.status = 'otwarte' and z.wygasa_at > $3::timestamptz) as otwarte,
       (select count(*)::int from public.zapytania z where z.klientka_id = k.id and z.created_at > $4::timestamptz) as w_dobie
     from public.klientki k where k.id = $1`,
    [kontoId, czas(new Date(teraz.getTime() - 366 * DZIEN_MS)), czas(teraz), czas(new Date(teraz.getTime() - DZIEN_MS))],
  );
  if (k.zablokowana_at) return { ok: false, blad: "zablokowana", doKiedy: "" };
  const blokada = blokadaDo((k.nieobecnosci ?? []).map((t) => new Date(t)), teraz);
  if (blokada) return { ok: false, blad: "zablokowana", doKiedy: blokada.toISOString() };
  if (k.otwarte >= L.otwartych) return { ok: false, blad: "za_duzo_otwartych" };
  if (k.w_dobie >= L.naDobe) return { ok: false, blad: "za_duzo_na_dobe" };

  // kandydaci: mają usługę w cenniku, przyjmują zapytania, cena „od” mieści się w limicie, w promieniu 30 km
  const kandydaci = await baza<{ id: string; wskaznik: number; km: number }>(
    `select s.id, s.wskaznik_odpowiedzi::float8 as wskaznik, ${sqlOdleglosc("s", "$1", "$2")} as km
     from public.salony s join public.cennik c on c.salon_id = s.id and c.usluga_kod = $3
     where s.przyjmuje_zapytania and s.zablokowany_at is null and s.wstrzymany_za_zaleglosc_at is null
       and s.lat between $1 - 0.3 and $1 + 0.3 and s.lon between $2 - 0.5 and $2 + 0.5
       and s.wlasciciel_id <> $4 and ($5::int is null or c.cena_gr <= $5::int)`,
    [d.lat, d.lon, usluga.kod, kontoId, d.limitGr],
  );
  const plan = zaplanujFale(
    kandydaci
      .filter((s) => Number(s.km) <= MAKS_PROMIEN_KM)
      .map((s) => ({ id: s.id, odlegloscKm: Number(s.km), wskaznikOdpowiedzi: Number(s.wskaznik), przyjmujeZapytania: true, maUsluge: true })),
  );
  const km = new Map(kandydaci.map((s) => [s.id, Math.round(Number(s.km) * 10) / 10]));
  const rozeslania = plan.fale.flatMap((f) =>
    f.salonIds.map((salon_id) => ({ salon_id, fala: f.numer, zaplanowano_na: iso(plusMin(teraz, f.startPoSek / 60)), odleglosc_km: km.get(salon_id) })),
  );
  const wygasa = plusMin(teraz, plan.terminOdpowiedziSek / 60);

  // zapytanie i rozesłania jednym poleceniem
  const [z] = await baza<{ id: string }>(
    `with z as (
       insert into public.zapytania (klientka_id, usluga_kod, tresc, okno_od, okno_do, lokalizacja, lat, lon, limit_ceny_gr, tryb,
         zgoda_dane_zdrowotne_at, promien_km, status, wygasa_at, created_at, liczba_osob)
       values ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8, $9, $10, $11::timestamptz, $12, $13, $14::timestamptz, $15::timestamptz, $16)
       returning id
     ), r as (
       insert into public.rozeslania (zapytanie_id, salon_id, fala, zaplanowano_na, odleglosc_km)
       select z.id, x.salon_id, x.fala, x.zaplanowano_na, x.odleglosc_km
       from z, jsonb_to_recordset($17::jsonb) as x(salon_id uuid, fala smallint, zaplanowano_na timestamptz, odleglosc_km numeric)
     )
     select id from z`,
    [
      kontoId,
      usluga.kod,
      medyczna ? null : d.tresc.trim() || null,
      iso(od),
      iso(doKiedy),
      `POINT(${d.lon} ${d.lat})`,
      d.lat,
      d.lon,
      d.limitGr,
      d.tryb === "pierwsza" ? "pierwsza" : "zbieram",
      medyczna ? czas(teraz) : null,
      plan.promienKm,
      rozeslania.length ? "otwarte" : "bez_ofert",
      czas(wygasa),
      czas(teraz),
      d.liczbaOsob,
      JSON.stringify(rozeslania),
    ],
  );
  return { ok: true, zapytanie: (await stanZapytania({ baza, kontoId, zapytanieId: z.id, teraz }))! };
}

/** Stan zapytania z aktualnymi ofertami — klientka odpytuje go co kilka sekund. */
export async function stanZapytania(opcje: { baza: Baza; kontoId: string; zapytanieId: string; teraz?: Date }): Promise<StanZapytania | null> {
  const { baza, kontoId, zapytanieId } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const [z] = await baza<{ id: string; status: StatusZapytania; usluga_kod: string; wygasa_at: Date | string; liczba: number; rezerwacja_id: string | null }>(
    `select z.id, z.status, z.usluga_kod, z.wygasa_at,
       (select count(*)::int from public.rozeslania r where r.zapytanie_id = z.id) as liczba,
       (select re.id from public.rezerwacje re join public.oferty o on o.id = re.oferta_id where o.zapytanie_id = z.id limit 1) as rezerwacja_id
     from public.zapytania z where z.id = $1 and z.klientka_id = $2`,
    [zapytanieId, kontoId],
  );
  if (!z) return null;
  const oferty = await baza<{ id: string; salon_id: string; nazwa: string; adres_z_mapy: string | null; miasto: string | null; km: string | null; termin: Date | string; cena_gr: number }>(
    `select o.id, o.salon_id, s.nazwa, s.adres_z_mapy, s.miasto, r.odleglosc_km as km, o.termin, o.cena_gr
     from public.oferty o
     join public.salony s on s.id = o.salon_id
     left join public.rozeslania r on r.zapytanie_id = o.zapytanie_id and r.salon_id = o.salon_id
     where o.zapytanie_id = $1 and o.status = 'zlozona' and o.termin > $2::timestamptz
     order by o.termin, o.created_at`,
    [zapytanieId, czas(teraz)],
  );
  return {
    id: z.id,
    status: z.status,
    uslugaKod: z.usluga_kod,
    zbieranieDo: iso(z.wygasa_at),
    liczbaWykonawcow: z.liczba,
    rezerwacjaId: z.rezerwacja_id,
    oferty: z.status === "otwarte" ? oferty.map(ofertaWidok) : [],
  };
}

const ofertaWidok = (o: { id: string; salon_id: string; nazwa: string; adres_z_mapy: string | null; miasto: string | null; km: string | null; termin: Date | string; cena_gr: number }): OfertaNaZywo => ({
  id: o.id,
  salonId: o.salon_id,
  salonNazwa: o.nazwa,
  okolica: okolica(o.adres_z_mapy, o.miasto),
  odlegloscKm: o.km === null ? null : Number(o.km),
  termin: iso(o.termin),
  cenaGr: o.cena_gr,
  kolory: koloryDla(o.salon_id),
});

export async function anulujZapytanie(opcje: { baza: Baza; kontoId: string; zapytanieId: string }): Promise<boolean> {
  const [z] = await opcje.baza<{ id: string }>(
    `with z as (
       update public.zapytania set status = 'anulowane' where id = $1 and klientka_id = $2 and status = 'otwarte' returning id
     ), o as (
       update public.oferty set status = 'wygasla' where zapytanie_id in (select id from z) and status = 'zlozona'
     )
     select id from z`,
    [opcje.zapytanieId, opcje.kontoId],
  );
  return !!z;
}

export type WynikPrzyjecia = { ok: true; wizyta: WizytaWidok } | { ok: false; blad: "nieaktualna" | "termin_zajety" };

/**
 * Przyjęcie oferty = umowa klientki z salonem (regulamin, § 7). Jednym
 * poleceniem: zapytanie → zarezerwowane, oferta → potwierdzona, pozostałe
 * oferty wygasają, powstaje rezerwacja. Dwie równoczesne akceptacje nie
 * przejdą obie (drugą zatrzyma warunek na statusie zapytania), a salon nie
 * dostanie dwóch wizyt nachodzących na siebie.
 */
export async function przyjmijOferte(opcje: { baza: Baza; kontoId: string; ofertaId: string; teraz?: Date }): Promise<WynikPrzyjecia> {
  const { baza, kontoId, ofertaId } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const [wynik] = await baza<{ rezerwacja_id: string | null; zajety: boolean }>(
    `with o as (
       select o.id, o.zapytanie_id, o.salon_id, o.termin, o.cena_gr, z.klientka_id, coalesce(c.czas_min, 60) as czas_min,
         exists (
           select 1 from public.rezerwacje r
           where r.salon_id = o.salon_id and r.wynik is null
             and r.termin < o.termin + make_interval(mins => coalesce(c.czas_min, 60))
             and o.termin < r.termin + make_interval(mins => coalesce(c.czas_min, 60))
         ) as zajety
       from public.oferty o
       join public.zapytania z on z.id = o.zapytanie_id
       left join public.cennik c on c.salon_id = o.salon_id and c.usluga_kod = z.usluga_kod
       where o.id = $1 and z.klientka_id = $2 and o.status = 'zlozona' and z.status = 'otwarte'
         and z.wygasa_at + make_interval(mins => $4) > $3::timestamptz and o.termin > $3::timestamptz
     ), zap as (
       update public.zapytania set status = 'zarezerwowane'
       where id = (select zapytanie_id from o where not zajety) and status = 'otwarte'
       returning id
     ), wybrana as (
       update public.oferty set status = 'potwierdzona' where id = (select id from o) and exists (select 1 from zap)
     ), pozostale as (
       update public.oferty set status = 'wygasla'
       where zapytanie_id = (select zapytanie_id from o) and id <> (select id from o) and status = 'zlozona' and exists (select 1 from zap)
     ), ten_sam_termin as (
       -- ten sam termin salonu w innych zapytaniach jest już zajęty
       update public.oferty x set status = 'wygasla'
       from o
       where exists (select 1 from zap) and x.salon_id = o.salon_id and x.zapytanie_id <> o.zapytanie_id and x.status = 'zlozona'
         and x.termin < o.termin + make_interval(mins => o.czas_min) and o.termin < x.termin + make_interval(mins => o.czas_min)
     ), rez as (
       insert into public.rezerwacje (oferta_id, klientka_id, salon_id, termin, cena_gr, created_at)
       select o.id, o.klientka_id, o.salon_id, o.termin, o.cena_gr, $3::timestamptz from o where exists (select 1 from zap)
       returning id
     )
     select (select id from rez) as rezerwacja_id, coalesce((select zajety from o), false) as zajety`,
    [ofertaId, kontoId, czas(teraz), WAZNOSC_OFERTY_PO_ZBIERANIU_MIN],
  );
  if (!wynik?.rezerwacja_id) return { ok: false, blad: wynik?.zajety ? "termin_zajety" : "nieaktualna" };
  const [w] = await wizytyKlientki({ baza, kontoId, teraz, rezerwacjaId: wynik.rezerwacja_id });
  return { ok: true, wizyta: w };
}

/** Status wizyty do pokazania, z wyniku i zgłoszeń. */
export function statusWizyty(r: { wynik: string | null; termin: Date | string; potwierdzenie_klientki: string | null }, teraz: Date): StatusWizyty {
  if (r.wynik === "zrealizowana") return "zakonczona";
  if (r.wynik) return r.wynik as StatusWizyty;
  if (new Date(r.termin) > teraz) return "potwierdzona";
  // przed ustaleniem wyniku pokazujemy to, co zgłosiła klientka
  if (r.potwierdzenie_klientki === "bylam") return "zakonczona";
  if (r.potwierdzenie_klientki === "nie_bylam") return "nieobecnosc";
  if (r.potwierdzenie_klientki === "salon_odwolal") return "odwolana_przez_salon";
  return "do_potwierdzenia";
}

export async function wizytyKlientki(opcje: { baza: Baza; kontoId: string; teraz?: Date; rezerwacjaId?: string }): Promise<WizytaWidok[]> {
  const teraz = opcje.teraz ?? new Date();
  const wiersze = await opcje.baza<{
    id: string; salon_id: string; nazwa: string; adres: string; telefon: string | null; usluga_kod: string; termin: Date | string; cena_gr: number;
    wynik: string | null; potwierdzenie_klientki: string | null;
  }>(
    `select r.id, s.id as salon_id, s.nazwa, s.adres, s.telefon, z.usluga_kod, r.termin, r.cena_gr, r.wynik, r.potwierdzenie_klientki
     from public.rezerwacje r
     join public.salony s on s.id = r.salon_id
     join public.oferty o on o.id = r.oferta_id
     join public.zapytania z on z.id = o.zapytanie_id
     where r.klientka_id = $1 and ($2::uuid is null or r.id = $2::uuid)
     order by r.termin desc
     limit 50`,
    [opcje.kontoId, opcje.rezerwacjaId ?? null],
  );
  return wiersze.map((r) => ({
    id: r.id,
    salonNazwa: r.nazwa,
    adres: r.adres,
    telefon: r.telefon,
    uslugaKod: r.usluga_kod,
    termin: iso(r.termin),
    cenaGr: r.cena_gr,
    kolory: koloryDla(r.salon_id),
    status: statusWizyty(r, teraz),
  }));
}

/** Klientka odwołuje wizytę przed jej rozpoczęciem — bezpłatnie, to nie jest nieobecność (regulamin, § 8). */
export async function odwolajWizyte(opcje: { baza: Baza; kontoId: string; rezerwacjaId: string; teraz?: Date }): Promise<boolean> {
  const teraz = opcje.teraz ?? new Date();
  const [r] = await opcje.baza<{ id: string }>(
    `update public.rezerwacje set wynik = 'odwolana_przez_klientke', wynik_at = $3::timestamptz
     where id = $1 and klientka_id = $2 and wynik is null and termin > $3::timestamptz returning id`,
    [opcje.rezerwacjaId, opcje.kontoId, czas(teraz)],
  );
  return !!r;
}

/** Po terminie klientka mówi, czy wizyta się odbyła (src/domain/wynik-wizyty.ts). */
export async function potwierdzWizyte(opcje: {
  baza: Baza;
  kontoId: string;
  rezerwacjaId: string;
  odpowiedz: "bylam" | "nie_bylam" | "salon_odwolal";
  teraz?: Date;
}): Promise<boolean> {
  const teraz = opcje.teraz ?? new Date();
  const [r] = await opcje.baza<{ id: string }>(
    `update public.rezerwacje set potwierdzenie_klientki = $3, potwierdzenie_klientki_at = $4::timestamptz
     where id = $1 and klientka_id = $2 and wynik is null and termin <= $4::timestamptz returning id`,
    [opcje.rezerwacjaId, opcje.kontoId, opcje.odpowiedz, czas(teraz)],
  );
  return !!r;
}
