// Kalendarz usługodawcy podłączony tajnym adresem iCal (Google, Outlook, iCloud).
// Czytamy wyłącznie przedziały zajętości na najbliższe dni — bez tytułów, opisów
// i uczestników — żeby oferta jednym dotknięciem nie proponowała zajętych godzin.
// Adres to klucz do kalendarza salonu, więc w bazie leży zaszyfrowany.

import type { StanKalendarza } from "../domain/profil-salonu";
import type { Przedzial } from "../domain/widoki";
import { czas, type Baza } from "./baza";
import { adresKalendarza, pobierzZajetosc } from "./kalendarz-ics";
import { odszyfruj, zaszyfruj } from "./kryptografia";

const CEL_SZYFRU = "kalendarz-salonu";
/** Kalendarz odświeżamy najwyżej co tyle minut (przy pobieraniu skrzynki). */
export const ODSWIEZANIE_KALENDARZA_MIN = 10;
const HORYZONT_DNI = 8;

type Blad = "brak_salonu" | "zly_adres" | "niedozwolony_host" | "nie_odpowiada" | "nie_kalendarz" | "za_duzy";
export type WynikKalendarza = { ok: true; kalendarz: StanKalendarza } | { ok: false; blad: Blad };

interface Opcje {
  baza: Baza;
  kontoId: string;
  /** sekret serwera, z którego wyprowadzamy klucz szyfrujący adres (KODY_SMS_PIEPRZ) */
  sekret: string;
  fetch?: typeof fetch;
  teraz?: Date;
}

const zakres = (teraz: Date) => ({ od: teraz, do: new Date(teraz.getTime() + HORYZONT_DNI * 24 * 60 * 60 * 1000) });

export async function polaczKalendarz(opcje: Opcje & { adres: string }): Promise<WynikKalendarza> {
  const teraz = opcje.teraz ?? new Date();
  const a = adresKalendarza(opcje.adres);
  if (!a.ok) return { ok: false, blad: a.powod };
  const [salon] = await opcje.baza<{ id: string }>("select id from public.salony where wlasciciel_id = $1 order by created_at limit 1", [opcje.kontoId]);
  if (!salon) return { ok: false, blad: "brak_salonu" };
  const w = await pobierzZajetosc(a.url, zakres(teraz), { fetch: opcje.fetch });
  if (!w.ok) return { ok: false, blad: w.powod };
  const host = new URL(a.url).host;
  await opcje.baza(
    `insert into public.kalendarze_salonow (salon_id, adres_szyfr, host, zajete, pobrano_at, blad)
     values ($1, $2, $3, $4::jsonb, $5::timestamptz, null)
     on conflict (salon_id) do update set adres_szyfr = excluded.adres_szyfr, host = excluded.host, zajete = excluded.zajete,
       pobrano_at = excluded.pobrano_at, blad = null`,
    [salon.id, await zaszyfruj(opcje.sekret, CEL_SZYFRU, a.url), host, JSON.stringify(w.zajete), czas(teraz)],
  );
  return { ok: true, kalendarz: { host, pobranoAt: teraz.toISOString(), blad: null, zajeteBloki: w.zajete.length } };
}

export async function odlaczKalendarz(opcje: { baza: Baza; kontoId: string }): Promise<boolean> {
  const [k] = await opcje.baza<{ salon_id: string }>(
    `delete from public.kalendarze_salonow where salon_id in (select id from public.salony where wlasciciel_id = $1) returning salon_id`,
    [opcje.kontoId],
  );
  return !!k;
}

const KOMUNIKAT: Record<string, string> = {
  nie_odpowiada: "Kalendarz nie odpowiada — pokazujemy zajętość z ostatniego pobrania.",
  nie_kalendarz: "Pod tym adresem nie ma już kalendarza. Podłącz go ponownie.",
  za_duzy: "Kalendarz jest za duży do odczytu.",
  klucz: "Podłącz kalendarz ponownie.",
};

/**
 * Zajętość salonu z kalendarza (pusta, gdy nie podłączony). Starszą niż
 * `ODSWIEZANIE_KALENDARZA_MIN` odświeżamy; przy błędzie zostaje ostatnia znana.
 */
export async function zajetoscSalonu(opcje: Opcje): Promise<Przedzial[]> {
  const teraz = opcje.teraz ?? new Date();
  const [k] = await opcje.baza<{ salon_id: string; adres_szyfr: string; zajete: Przedzial[]; pobrano_at: Date | string | null }>(
    `select k.salon_id, k.adres_szyfr, k.zajete, k.pobrano_at
     from public.kalendarze_salonow k join public.salony s on s.id = k.salon_id
     where s.wlasciciel_id = $1 order by s.created_at limit 1`,
    [opcje.kontoId],
  );
  if (!k) return [];
  let zajete = k.zajete ?? [];
  const swiezy = k.pobrano_at && teraz.getTime() - new Date(k.pobrano_at).getTime() < ODSWIEZANIE_KALENDARZA_MIN * 60 * 1000;
  if (!swiezy) {
    const adres = await odszyfruj(opcje.sekret, CEL_SZYFRU, k.adres_szyfr);
    const w = adres ? await pobierzZajetosc(adres, zakres(teraz), { fetch: opcje.fetch }) : null;
    if (w?.ok) zajete = w.zajete;
    await opcje.baza(
      `update public.kalendarze_salonow set pobrano_at = $2::timestamptz, blad = $3, zajete = coalesce($4::jsonb, zajete) where salon_id = $1`,
      [k.salon_id, czas(teraz), w?.ok ? null : KOMUNIKAT[w ? w.powod : "klucz"] ?? KOMUNIKAT.nie_odpowiada, w?.ok ? JSON.stringify(zajete) : null],
    );
  }
  const terazIso = teraz.toISOString();
  return zajete.filter((p) => p.do > terazIso);
}
