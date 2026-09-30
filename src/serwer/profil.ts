// Profil usługodawcy: opis, logo i zdjęcia (materiały salonu — salon oświadcza,
// że ma do nich prawa), pracownicy (samo imię), profil publiczny dla klientek.
// Reguły: src/domain/profil-salonu.ts. Kalendarz: src/serwer/kalendarz.ts.

import { KATALOG_USLUG } from "../domain/katalog-uslug";
import {
  LIMITY_PROFILU,
  adresZdjecia,
  oczyscPracownikow,
  rodzajObrazu,
  walidujPracownikow,
  type Pracownik,
  type ProfilPubliczny,
} from "../domain/profil-salonu";
import type { Branza } from "../domain/katalog-uslug";
import { czas, type Baza } from "./baza";
import { bajtyZBase64 } from "./kryptografia";

async function salonKonta(baza: Baza, kontoId: string) {
  const [s] = await baza<{ id: string; branza: Branza }>(
    "select id, branza from public.salony where wlasciciel_id = $1 order by created_at limit 1",
    [kontoId],
  );
  return s ?? null;
}

export async function zapiszOpis(opcje: { baza: Baza; kontoId: string; opis: string }): Promise<"ok" | "brak_salonu" | "za_dlugi"> {
  const opis = opcje.opis.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (opis.length > LIMITY_PROFILU.maksOpis) return "za_dlugi";
  const [s] = await opcje.baza<{ id: string }>(
    `update public.salony set opis = $2, updated_at = now()
     where id = (select id from public.salony where wlasciciel_id = $1 order by created_at limit 1) returning id`,
    [opcje.kontoId, opis || null],
  );
  return s ? "ok" : "brak_salonu";
}

export type WynikZdjecia =
  | { ok: true; id: string }
  | { ok: false; blad: "brak_salonu" | "brak_oswiadczenia" | "zly_plik" | "za_duzy" | "za_duzo_zdjec" };

/**
 * Dodaje zdjęcie albo logo (logo zastępuje poprzednie). Plik przychodzi już
 * zmniejszony w przeglądarce; sprawdzamy rodzaj po bajtach, nie po nazwie.
 */
export async function dodajZdjecie(opcje: {
  baza: Baza;
  kontoId: string;
  rodzaj: "logo" | "zdjecie";
  base64: string;
  oswiadczenie: boolean;
  teraz?: Date;
}): Promise<WynikZdjecia> {
  if (!opcje.oswiadczenie) return { ok: false, blad: "brak_oswiadczenia" };
  const bajty = bajtyZBase64(opcje.base64);
  if (!bajty) return { ok: false, blad: "zly_plik" };
  if (bajty.length > LIMITY_PROFILU.maksBajtowZdjecia) return { ok: false, blad: "za_duzy" };
  const typ = rodzajObrazu(bajty);
  if (!typ || bajty.length < 100) return { ok: false, blad: "zly_plik" };
  const salon = await salonKonta(opcje.baza, opcje.kontoId);
  if (!salon) return { ok: false, blad: "brak_salonu" };
  const [z] = await opcje.baza<{ id: string }>(
    `with stare_logo as (
       delete from public.zdjecia_salonow where salon_id = $1 and rodzaj = 'logo' and $2 = 'logo'
     )
     insert into public.zdjecia_salonow (salon_id, rodzaj, typ, dane, oswiadczenie_at)
     select $1, $2, $3, decode($4, 'base64'), $5::timestamptz
     where $2 = 'logo' or (select count(*) from public.zdjecia_salonow where salon_id = $1 and rodzaj = 'zdjecie') < $6
     returning id`,
    [salon.id, opcje.rodzaj, typ, opcje.base64, czas(opcje.teraz ?? new Date()), LIMITY_PROFILU.maksZdjec],
  );
  return z ? { ok: true, id: z.id } : { ok: false, blad: "za_duzo_zdjec" };
}

export async function usunZdjecie(opcje: { baza: Baza; kontoId: string; zdjecieId: string }): Promise<boolean> {
  const [z] = await opcje.baza<{ id: string }>(
    `delete from public.zdjecia_salonow
     where id = $2 and salon_id in (select id from public.salony where wlasciciel_id = $1) returning id`,
    [opcje.kontoId, opcje.zdjecieId],
  );
  return !!z;
}

/** Plik zdjęcia do wyświetlenia (publiczny — to materiały reklamowe salonu). */
export async function plikZdjecia(baza: Baza, id: string): Promise<{ typ: string; bajty: Uint8Array } | null> {
  const [z] = await baza<{ typ: string; dane: string }>(
    `select z.typ, encode(z.dane, 'base64') as dane
     from public.zdjecia_salonow z join public.salony s on s.id = z.salon_id
     where z.id = $1 and s.zablokowany_at is null`,
    [id],
  );
  const bajty = z ? bajtyZBase64(z.dane.replace(/\s/g, "")) : null;
  return z && bajty ? { typ: z.typ, bajty } : null;
}

export type WynikPracownikow = { ok: true; pracownicy: Pracownik[] } | { ok: false; blad: "brak_salonu" } | { ok: false; blad: "zle_dane"; komunikat: string };

/** Zapisuje całą listę pracowników (jak cennik): nowi dochodzą, usunięci znikają, reszta dostaje nowe usługi. */
export async function zapiszPracownikow(opcje: { baza: Baza; kontoId: string; pracownicy: Pracownik[] }): Promise<WynikPracownikow> {
  const salon = await salonKonta(opcje.baza, opcje.kontoId);
  if (!salon) return { ok: false, blad: "brak_salonu" };
  const blad = walidujPracownikow(salon.branza, opcje.pracownicy);
  if (blad) return { ok: false, blad: "zle_dane", komunikat: blad };
  const lista = oczyscPracownikow(opcje.pracownicy);
  // kody usług to [a-z0-9_] — bezpiecznie łączymy je przecinkiem
  const dane = JSON.stringify(lista.map((p, i) => ({ imie: p.imie, uslugi: p.uslugi.join(","), kolejnosc: i })));
  await opcje.baza(
    `with dane as (
       select * from jsonb_to_recordset($2::jsonb) as x(imie text, uslugi text, kolejnosc int)
     ), usunieci as (
       delete from public.pracownicy where salon_id = $1 and imie not in (select imie from dane)
     )
     insert into public.pracownicy (salon_id, imie, uslugi, kolejnosc)
     select $1, d.imie, coalesce(string_to_array(nullif(d.uslugi, ''), ','), '{}'), d.kolejnosc from dane d
     on conflict (salon_id, imie) do update set uslugi = excluded.uslugi, kolejnosc = excluded.kolejnosc`,
    [salon.id, dane],
  );
  return { ok: true, pracownicy: lista };
}

interface WierszProfilu {
  opis: string | null;
  zdjecia: { id: string; rodzaj: "logo" | "zdjecie" }[] | null;
  pracownicy: { imie: string; uslugi: string[] }[] | null;
  kalendarz: { host: string; pobranoAt: string | null; blad: string | null; zajeteBloki: number } | null;
}

/** Część profilu do `SalonKonta` (panel usługodawcy) — jednym zapytaniem. */
export async function profilKonta(baza: Baza, salonId: string) {
  const [w] = await baza<WierszProfilu>(
    `select s.opis,
       (select json_agg(json_build_object('id', z.id, 'rodzaj', z.rodzaj) order by z.created_at)
          from public.zdjecia_salonow z where z.salon_id = s.id) as zdjecia,
       (select json_agg(json_build_object('imie', p.imie, 'uslugi', p.uslugi) order by p.kolejnosc, p.imie)
          from public.pracownicy p where p.salon_id = s.id) as pracownicy,
       (select json_build_object('host', k.host, 'pobranoAt', k.pobrano_at, 'blad', k.blad, 'zajeteBloki', jsonb_array_length(k.zajete))
          from public.kalendarze_salonow k where k.salon_id = s.id) as kalendarz
     from public.salony s where s.id = $1`,
    [salonId],
  );
  const zdjecia = w?.zdjecia ?? [];
  const logo = zdjecia.filter((z) => z.rodzaj === "logo").at(-1);
  const k = w?.kalendarz ?? null;
  return {
    opis: w?.opis ?? null,
    logoUrl: logo ? adresZdjecia(logo.id) : null,
    zdjecia: zdjecia.filter((z) => z.rodzaj === "zdjecie").map((z) => ({ id: z.id, url: adresZdjecia(z.id) })),
    pracownicy: (w?.pracownicy ?? []).map((p) => ({ imie: p.imie, uslugi: p.uslugi ?? [] })),
    kalendarz: k ? { ...k, pobranoAt: k.pobranoAt ? new Date(k.pobranoAt).toISOString() : null } : null,
  };
}

/** Profil, który klientka ogląda przy ofercie: bez NIP-u, telefonu i danych rozliczeń. */
export async function profilPubliczny(baza: Baza, salonId: string): Promise<ProfilPubliczny | null> {
  const [s] = await baza<{ id: string; nazwa: string; adres: string }>(
    "select id, nazwa, adres from public.salony where id = $1 and zablokowany_at is null",
    [salonId],
  );
  if (!s) return null;
  const [p, cennik] = await Promise.all([
    profilKonta(baza, s.id),
    baza<{ usluga_kod: string; cena_gr: number }>("select usluga_kod, cena_gr from public.cennik where salon_id = $1", [s.id]),
  ]);
  const kolejnosc = new Map(KATALOG_USLUG.map((u, i) => [u.kod, i]));
  return {
    id: s.id,
    nazwa: s.nazwa,
    opis: p.opis,
    adres: s.adres,
    logoUrl: p.logoUrl,
    zdjecia: p.zdjecia.map((z) => z.url),
    pracownicy: p.pracownicy.map((x) => x.imie),
    cennik: cennik
      .map((c) => ({ uslugaKod: c.usluga_kod, cenaGr: c.cena_gr }))
      .sort((a, b) => (kolejnosc.get(a.uslugaKod) ?? 999) - (kolejnosc.get(b.uslugaKod) ?? 999)),
  };
}
