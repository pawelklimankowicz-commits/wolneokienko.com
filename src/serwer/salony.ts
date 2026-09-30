// Rejestracja usługodawcy: dane firmy, cennik i przyjmowanie zapytań.
// Reguły pól i cennika są w src/domain/rejestracja-salonu.ts (te same
// sprawdza formularz w aplikacji); tu zapis, adres na mapie i spójność z bazą.

import { WERSJE_DOKUMENTOW } from "../domain/dokumenty";
import type { Branza } from "../domain/katalog-uslug";
import {
  bezBledow,
  oczyscDane,
  walidujCennik,
  walidujDaneSalonu,
  type BledyCennika,
  type BledyDanych,
  type DaneSalonu,
  type PozycjaCennika,
  type SalonKonta,
} from "../domain/rejestracja-salonu";
import { czas, type Baza } from "./baza";
import type { Geokoder } from "./geokoder";
import { profilKonta } from "./profil";

export type WynikZapisuSalonu =
  | { ok: true; salon: SalonKonta }
  | { ok: false; blad: "zle_dane"; pola: BledyDanych }
  | { ok: false; blad: "nip_zajety" | "brak_akceptacji" | "adres_nieznaleziony" };

export type WynikZapisuCennika =
  | { ok: true; salon: SalonKonta }
  | { ok: false; blad: "zle_dane"; cennik: BledyCennika }
  | { ok: false; blad: "brak_salonu" };

export type WynikPrzyjmowania = { ok: true; salon: SalonKonta } | { ok: false; blad: "brak_salonu" | "brak_cennika" | "wstrzymany" };

interface WierszSalonu {
  id: string;
  nazwa: string;
  nip: string;
  ulica: string;
  kod_pocztowy: string;
  miasto: string;
  branza: Branza;
  telefon: string;
  email: string;
  numer_rejestru: string | null;
  adres_z_mapy: string | null;
  przyjmuje_zapytania: boolean;
  aktywowany_at: Date | string | null;
  wstrzymany: boolean;
  wizyty: number;
}

export async function mojSalon(baza: Baza, kontoId: string): Promise<SalonKonta | null> {
  const [s] = await baza<WierszSalonu>(
    `select s.id, s.nazwa, s.nip, s.ulica, s.kod_pocztowy, s.miasto, s.branza, s.telefon, s.email, s.numer_rejestru,
            s.adres_z_mapy, s.przyjmuje_zapytania, s.aktywowany_at,
            (s.zablokowany_at is not null or s.wstrzymany_za_zaleglosc_at is not null) as wstrzymany,
            (select count(*)::int from public.rezerwacje r where r.salon_id = s.id and r.wynik = 'zrealizowana') as wizyty
     from public.salony s where s.wlasciciel_id = $1 order by s.created_at limit 1`,
    [kontoId],
  );
  if (!s) return null;
  const cennik = await baza<{ usluga_kod: string; cena_gr: number; czas_min: number; wykonuje_lekarz: boolean; deklaracja_kwalifikacji: string | null }>(
    "select usluga_kod, cena_gr, czas_min, wykonuje_lekarz, deklaracja_kwalifikacji from public.cennik where salon_id = $1 order by usluga_kod",
    [s.id],
  );
  const profil = await profilKonta(baza, s.id);
  return {
    ...profil,
    id: s.id,
    nazwa: s.nazwa,
    nip: s.nip,
    ulica: s.ulica,
    kodPocztowy: s.kod_pocztowy,
    miasto: s.miasto,
    branza: s.branza,
    telefon: s.telefon,
    email: s.email,
    ...(s.numer_rejestru ? { numerRejestru: s.numer_rejestru } : {}),
    adresZMapy: s.adres_z_mapy,
    przyjmujeZapytania: s.przyjmuje_zapytania,
    aktywowanyAt: s.aktywowany_at ? new Date(s.aktywowany_at).toISOString() : null,
    wstrzymany: s.wstrzymany,
    wizytyZrealizowane: s.wizyty,
    cennik: cennik.map((c) => ({
      usluga: c.usluga_kod,
      cenaGr: c.cena_gr,
      czasMin: c.czas_min,
      ...(c.wykonuje_lekarz ? { wykonujeLekarz: true } : {}),
      ...(c.deklaracja_kwalifikacji ? { deklaracja: c.deklaracja_kwalifikacji } : {}),
    })),
  };
}

const naruszaUnikalnosc = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";

/**
 * Zakłada salon albo poprawia jego dane. Nowy salon wymaga akceptacji
 * regulaminu dla usługodawców; konto klientki staje się kontem salonu
 * (profil klientki zostaje — można dalej się umawiać).
 */
export async function zapiszSalon(opcje: {
  baza: Baza;
  geokoder: Geokoder;
  kontoId: string;
  dane: DaneSalonu;
  akceptujeRegulamin: boolean;
  teraz?: Date;
}): Promise<WynikZapisuSalonu> {
  const { baza, kontoId } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const pola = walidujDaneSalonu(opcje.dane);
  if (!bezBledow(pola)) return { ok: false, blad: "zle_dane", pola };
  const d = oczyscDane(opcje.dane);

  const [obecny] = await baza<{ id: string; ulica: string; kod_pocztowy: string; miasto: string }>(
    "select id, ulica, kod_pocztowy, miasto from public.salony where wlasciciel_id = $1 order by created_at limit 1",
    [kontoId],
  );
  if (!obecny && !opcje.akceptujeRegulamin) return { ok: false, blad: "brak_akceptacji" };

  const [zajety] = await baza("select 1 from public.salony where nip = $1 and wlasciciel_id <> $2", [d.nip, kontoId]);
  if (zajety) return { ok: false, blad: "nip_zajety" };

  const adresBezZmian = obecny && obecny.ulica === d.ulica && obecny.kod_pocztowy === d.kodPocztowy && obecny.miasto === d.miasto;
  const punkt = adresBezZmian ? null : await opcje.geokoder.znajdz(d);
  if (!adresBezZmian && !punkt) return { ok: false, blad: "adres_nieznaleziony" };

  const adres = `${d.ulica}, ${d.kodPocztowy} ${d.miasto}`;
  const akceptacja = opcje.akceptujeRegulamin ? WERSJE_DOKUMENTOW.regulaminUslugodawcy : null;
  const wspolne = [d.nazwa, d.nip, adres, d.ulica, d.kodPocztowy, d.miasto, d.branza, d.telefon, d.email, d.numerRejestru ?? null, czas(teraz), akceptacja];
  try {
    if (obecny) {
      await baza(
        `update public.salony set nazwa = $1, nip = $2, adres = $3, ulica = $4, kod_pocztowy = $5, miasto = $6, branza = $7,
           telefon = $8, email = $9, numer_rejestru = $10, updated_at = $11::timestamptz,
           regulamin_wersja = coalesce($12, regulamin_wersja),
           regulamin_zaakceptowany_at = case when $12::text is null then regulamin_zaakceptowany_at else $11::timestamptz end,
           lokalizacja = coalesce($14, lokalizacja), adres_z_mapy = coalesce($15, adres_z_mapy),
           lat = coalesce($16, lat), lon = coalesce($17, lon)
         where id = $13`,
        [...wspolne, obecny.id, punkt && `POINT(${punkt.lon} ${punkt.lat})`, punkt?.opis ?? null, punkt?.lat ?? null, punkt?.lon ?? null],
      );
    } else {
      // jedno polecenie: salon i przejście konta klientki na konto salonu
      await baza(
        `with salon as (
           insert into public.salony (nazwa, nip, adres, ulica, kod_pocztowy, miasto, branza, telefon, email, numer_rejestru,
             updated_at, created_at, regulamin_wersja, regulamin_zaakceptowany_at, wlasciciel_id, lokalizacja, adres_z_mapy, lat, lon)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $11::timestamptz, $12, $11::timestamptz, $13, $14, $15, $16, $17)
           returning wlasciciel_id
         )
         update public.konta k set rola = 'salon' from salon where k.id = salon.wlasciciel_id and k.rola = 'klientka'`,
        [...wspolne, kontoId, `POINT(${punkt!.lon} ${punkt!.lat})`, punkt!.opis, punkt!.lat, punkt!.lon],
      );
    }
  } catch (e) {
    if (naruszaUnikalnosc(e)) return { ok: false, blad: "nip_zajety" };
    throw e;
  }
  return { ok: true, salon: (await mojSalon(baza, kontoId))! };
}

/** Zastępuje cały cennik jednym poleceniem: nowe i zmienione pozycje zapisuje, usunięte kasuje. */
export async function zapiszCennik(opcje: { baza: Baza; kontoId: string; pozycje: PozycjaCennika[] }): Promise<WynikZapisuCennika> {
  const { baza, kontoId } = opcje;
  const [salon] = await baza<{ id: string; branza: Branza }>("select id, branza from public.salony where wlasciciel_id = $1 order by created_at limit 1", [
    kontoId,
  ]);
  if (!salon) return { ok: false, blad: "brak_salonu" };
  const cennik = walidujCennik(salon.branza, opcje.pozycje);
  if (!bezBledow(cennik)) return { ok: false, blad: "zle_dane", cennik };

  const wiersze = opcje.pozycje.map((p) => ({
    usluga: p.usluga,
    cena_gr: p.cenaGr,
    czas_min: p.czasMin,
    wykonuje_lekarz: !!p.wykonujeLekarz,
    deklaracja: p.deklaracja?.trim() || null,
  }));
  await baza(
    `with nowe as (
       select * from jsonb_to_recordset($2::jsonb) as x(usluga text, cena_gr int, czas_min int, wykonuje_lekarz boolean, deklaracja text)
     ), zapis as (
       insert into public.cennik (salon_id, usluga_kod, cena_gr, czas_min, wykonuje_lekarz, deklaracja_kwalifikacji)
       select $1, usluga, cena_gr, czas_min, wykonuje_lekarz, deklaracja from nowe
       on conflict (salon_id, usluga_kod) do update set cena_gr = excluded.cena_gr, czas_min = excluded.czas_min,
         wykonuje_lekarz = excluded.wykonuje_lekarz, deklaracja_kwalifikacji = excluded.deklaracja_kwalifikacji
     )
     delete from public.cennik where salon_id = $1 and usluga_kod not in (select usluga from nowe)`,
    [salon.id, JSON.stringify(wiersze)],
  );
  return { ok: true, salon: (await mojSalon(baza, kontoId))! };
}

/** Włącza albo wyłącza przyjmowanie zapytań. Pierwsze włączenie rozpoczyna miesiąc próbny. */
export async function ustawPrzyjmowanie(opcje: { baza: Baza; kontoId: string; wlaczone: boolean; teraz?: Date }): Promise<WynikPrzyjmowania> {
  const { baza, kontoId, wlaczone } = opcje;
  const salon = await mojSalon(baza, kontoId);
  if (!salon) return { ok: false, blad: "brak_salonu" };
  if (wlaczone && salon.wstrzymany) return { ok: false, blad: "wstrzymany" };
  if (wlaczone && salon.cennik.length === 0) return { ok: false, blad: "brak_cennika" };
  await baza(
    `update public.salony set przyjmuje_zapytania = $2,
       aktywowany_at = case when $2 then coalesce(aktywowany_at, $3::timestamptz) else aktywowany_at end
     where id = $1`,
    [salon.id, wlaczone, czas(opcje.teraz ?? new Date())],
  );
  return { ok: true, salon: (await mojSalon(baza, kontoId))! };
}
