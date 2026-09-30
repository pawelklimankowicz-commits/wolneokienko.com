// Logowanie kodem SMS: wysłanie kodu i jego sprawdzenie.
//
// Baza trzyma tylko HMAC-SHA256 kodu z tajnym „pieprzem” (zmienna
// KODY_SMS_PIEPRZ) — sześć cyfr to milion możliwości, więc sam SHA-256
// dałoby się odwrócić w ułamku sekundy. Kod jest związany z numerem,
// ważny 5 minut, ma 5 prób i liczy się tylko najnowszy.

import { czas, type Baza } from "./baza";
import { BladBramkiSms, type BramkaSms } from "./bramka-sms";
import { hmacSha256, losowyKod, rowneStaloczasowo } from "./kryptografia";
import { normalizujTelefon } from "../lib/telefon";

export const PARAMETRY_KODOW = {
  dlugosc: 6,
  waznoscSek: 5 * 60,
  /** zgodne z CHECK (proby between 0 and 5) w tabeli kody_sms */
  maksProb: 5,
  /** „wyślij ponownie” najwcześniej po 30 s */
  odstepSek: 30,
  /** najwyżej 3 kody na 15 minut… */
  limitWOknie: 3,
  oknoSek: 15 * 60,
  /** …i 10 na dobę na jeden numer */
  limitDobowy: 10,
  /** z jednego adresu IP najwyżej 20 kodów na godzinę (sieci komórkowe dzielą adresy, stąd zapas) */
  limitIpNaGodzine: 20,
  /** bezpiecznik na saldo SMSAPI: łącznie najwyżej 200 kodów na godzinę */
  limitLacznyNaGodzine: 200,
} as const;

export type Rola = "klientka" | "salon" | "operator";

export type WynikWyslania =
  | { ok: true; telefon: string; wygasaAt: Date }
  | { ok: false; powod: "zly_numer" }
  | { ok: false; powod: "za_czesto"; ponowZaSek: number }
  | { ok: false; powod: "przeciazenie" | "blad_bramki" };

export type WynikSprawdzenia =
  | { ok: true; kontoId: string; rola: Rola; telefon: string; nowe: boolean }
  | { ok: false; powod: "zly_numer" | "brak_kodu" | "wygasl" | "za_duzo_prob" }
  | { ok: false; powod: "zly_kod"; pozostaloProb: number };

const GODZINA_SEK = 60 * 60;
const DOBA_SEK = 24 * GODZINA_SEK;
const sekundyMiedzy = (od: Date, doCzasu: Date) => (doCzasu.getTime() - od.getTime()) / 1000;
const plus = (data: Date, sek: number) => new Date(data.getTime() + sek * 1000);

export const skrotKodu = (pieprz: string, telefon: string, kod: string) => hmacSha256(pieprz, `${telefon}:${kod}`);
const skrotIp = (pieprz: string, ip: string) => hmacSha256(pieprz, `ip:${ip}`);

/**
 * Treść SMS-a bez polskich znaków — mieści się w jednej wiadomości (160 znaków
 * GSM-7 zamiast 70 w Unicode). Kod na początku, żeby był widoczny w powiadomieniu.
 * Bez adresu strony: SMSAPI na tym koncie odrzuca wiadomości z linkami
 * („Not allowed to send messages with link”), a domena liczy się jako link —
 * dlatego odpada też linia WebOTP „@wolneokienko.com #kod”.
 */
export function trescSms(kod: string): string {
  return `${kod} to Twoj kod do Wolnego Okienka. Wazny 5 min. Nie podawaj go nikomu.`;
}

/**
 * Limit „najwyżej `limit` w oknie”: po ilu sekundach zmieści się jeszcze jedno
 * zdarzenie, gdy `wczesniejsze` to czasy poprzednich. 0 = można teraz.
 */
export function czekanieNaLimit(wczesniejsze: Date[], limit: number, oknoSek: number, teraz: Date): number {
  const wOknie = wczesniejsze.filter((t) => sekundyMiedzy(t, teraz) < oknoSek).sort((a, b) => a.getTime() - b.getTime());
  // tyle najstarszych musi wypaść z okna
  const nadmiar = wOknie.length - (limit - 1);
  return nadmiar > 0 ? Math.max(0, Math.ceil(oknoSek - sekundyMiedzy(wOknie[nadmiar - 1], teraz))) : 0;
}

/**
 * Po ilu sekundach numer może dostać kolejny kod, gdy `wczesniejsze` to czasy
 * wysłania kodów na ten numer z ostatniej doby (bez bieżącej próby). 0 = można teraz.
 */
export function ponowZaSek(wczesniejsze: Date[], teraz: Date): number {
  const p = PARAMETRY_KODOW;
  const ostatni = Math.max(...wczesniejsze.map((t) => t.getTime()));
  const odstep = wczesniejsze.length ? Math.ceil(p.odstepSek - (teraz.getTime() - ostatni) / 1000) : 0;
  return Math.max(0, odstep, czekanieNaLimit(wczesniejsze, p.limitWOknie, p.oknoSek, teraz), czekanieNaLimit(wczesniejsze, p.limitDobowy, DOBA_SEK, teraz));
}

export async function wyslijKod(opcje: {
  baza: Baza;
  sms: BramkaSms;
  pieprz: string;
  telefon: string;
  /** adres IP prośby — do limitu na adres; w bazie tylko jego HMAC */
  ip?: string | null;
  teraz?: Date;
}): Promise<WynikWyslania> {
  const { baza, sms, pieprz } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const telefon = normalizujTelefon(opcje.telefon);
  if (!telefon) return { ok: false, powod: "zly_numer" };

  const kod = losowyKod(PARAMETRY_KODOW.dlugosc);
  const wygasaAt = plus(teraz, PARAMETRY_KODOW.waznoscSek);

  // Najpierw rezerwujemy miejsce (wstawiamy kod), potem liczymy. Dwie
  // równoczesne prośby widzą nawzajem swoje wiersze, więc limit nie przecieka
  // — w najgorszym razie obie zostaną odrzucone.
  const ipSkrot = opcje.ip ? await skrotIp(pieprz, opcje.ip) : null;
  const [{ id }] = await baza<{ id: string }>(
    `insert into public.kody_sms (telefon, kod_skrot, wygasa_at, created_at, ip_skrot)
     values ($1, $2, $3::timestamptz, $4::timestamptz, $5) returning id`,
    [telefon, await skrotKodu(pieprz, telefon, kod), czas(wygasaAt), czas(teraz), ipSkrot],
  );
  const godzinaTemu = czas(plus(teraz, -GODZINA_SEK));
  const inne = await baza<{ created_at: Date | string; ten_numer: boolean; ten_ip: boolean | null }>(
    `select created_at, telefon = $1 as ten_numer, ip_skrot = $3 as ten_ip
     from public.kody_sms
     where id <> $2 and created_at <= $4::timestamptz
       and ((telefon = $1 and created_at > $5::timestamptz) or (ip_skrot = $3 and created_at > $6::timestamptz))`,
    [telefon, id, ipSkrot, czas(teraz), czas(plus(teraz, -DOBA_SEK)), godzinaTemu],
  );
  const [{ n: wszystkie }] = await baza<{ n: number }>(
    "select count(*)::int as n from public.kody_sms where id <> $1 and created_at > $2::timestamptz and created_at <= $3::timestamptz",
    [id, godzinaTemu, czas(teraz)],
  );
  const usun = () => baza("delete from public.kody_sms where id = $1", [id]);

  if (wszystkie >= PARAMETRY_KODOW.limitLacznyNaGodzine) {
    await usun();
    console.error(`Bezpiecznik SMS: ${wszystkie} kodów w ostatniej godzinie, wstrzymuję wysyłkę.`);
    return { ok: false, powod: "przeciazenie" };
  }
  const czasy = (filtr: (w: (typeof inne)[number]) => boolean) => inne.filter(filtr).map((w) => new Date(w.created_at));
  const czekaj = Math.max(
    ponowZaSek(czasy((w) => w.ten_numer), teraz),
    czekanieNaLimit(czasy((w) => w.ten_ip === true), PARAMETRY_KODOW.limitIpNaGodzine, GODZINA_SEK, teraz),
  );
  if (czekaj > 0) {
    await usun();
    return { ok: false, powod: "za_czesto", ponowZaSek: czekaj };
  }

  try {
    await sms.wyslij(telefon, trescSms(kod));
  } catch (e) {
    // kod, który nie doszedł, nie zużywa limitu klientki
    await usun();
    if (e instanceof BladBramkiSms) {
      console.error(`Kod SMS nie wysłany: ${e.message}`);
      return { ok: false, powod: "blad_bramki" };
    }
    throw e;
  }
  return { ok: true, telefon, wygasaAt };
}

export async function sprawdzKod(opcje: {
  baza: Baza;
  pieprz: string;
  telefon: string;
  kod: string;
  /** rola nowego konta; istniejącemu kontu roli nie zmieniamy */
  rola?: Rola;
  teraz?: Date;
}): Promise<WynikSprawdzenia> {
  const { baza, pieprz } = opcje;
  const teraz = opcje.teraz ?? new Date();
  const rola = opcje.rola ?? "klientka";
  const telefon = normalizujTelefon(opcje.telefon);
  if (!telefon) return { ok: false, powod: "zly_numer" };
  const kod = opcje.kod.replace(/\s/g, "");

  // Próbę liczymy atomowo, zanim porównamy kod — równoległe zgadywanie
  // nie obejdzie limitu. Liczy się tylko najnowszy kod dla numeru.
  const [proba] = await baza<{ id: string; kod_skrot: string; proby: number }>(
    `update public.kody_sms k set proby = k.proby + 1
     where k.id = (select id from public.kody_sms where telefon = $1 order by created_at desc limit 1)
       and k.uzyty_at is null and k.wygasa_at > $2::timestamptz and k.proby < $3
     returning k.id, k.kod_skrot, k.proby`,
    [telefon, czas(teraz), PARAMETRY_KODOW.maksProb],
  );

  if (!proba) {
    const [ostatni] = await baza<{ uzyty_at: unknown; wygasa_at: Date | string; proby: number }>(
      "select uzyty_at, wygasa_at, proby from public.kody_sms where telefon = $1 order by created_at desc limit 1",
      [telefon],
    );
    if (!ostatni || ostatni.uzyty_at) return { ok: false, powod: "brak_kodu" };
    if (new Date(ostatni.wygasa_at) <= teraz) return { ok: false, powod: "wygasl" };
    return { ok: false, powod: "za_duzo_prob" };
  }

  if (!rowneStaloczasowo(await skrotKodu(pieprz, telefon, kod), proba.kod_skrot)) {
    return { ok: false, powod: "zly_kod", pozostaloProb: PARAMETRY_KODOW.maksProb - proba.proby };
  }

  // Jedno polecenie: zużycie kodu, konto (nowe albo istniejące) i profil
  // klientki. Jeśli kod zużyła równolegle inna prośba, nic się nie dzieje.
  const [konto] = await baza<{ id: string; rola: Rola; nowe: boolean }>(
    `with kod as (
       update public.kody_sms set uzyty_at = $2::timestamptz
       where id = $1 and uzyty_at is null
       returning telefon
     ), konto as (
       insert into public.konta (telefon, rola, telefon_zweryfikowany_at)
       select telefon, $3::text, $2::timestamptz from kod
       on conflict (telefon) do update
         set telefon_zweryfikowany_at = coalesce(public.konta.telefon_zweryfikowany_at, excluded.telefon_zweryfikowany_at)
       returning id, rola, telefon, (xmax = 0) as nowe
     ), klientka as (
       insert into public.klientki (id, telefon, telefon_zweryfikowany_at)
       select id, telefon, $2::timestamptz from konto where $3::text = 'klientka'
       on conflict (id) do nothing
     )
     select id, rola, nowe from konto`,
    [proba.id, czas(teraz), rola],
  );
  if (!konto) return { ok: false, powod: "brak_kodu" };
  return { ok: true, kontoId: konto.id, rola: konto.rola, telefon, nowe: konto.nowe };
}
