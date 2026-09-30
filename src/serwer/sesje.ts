// Sesje po zalogowaniu. Aplikacja trzyma losowy token (32 bajty, base64url),
// baza tylko jego SHA-256 — token ma dość entropii, więc pieprz nie jest
// potrzebny. Sesja przedłuża się przy każdym użyciu.

import { czas, type Baza } from "./baza";
import type { Rola } from "./kody-sms";
import { base64url, losoweBajty, sha256 } from "./kryptografia";

export const PARAMETRY_SESJI = { waznoscDni: 90 } as const;

const wygasaOd = (teraz: Date) => new Date(teraz.getTime() + PARAMETRY_SESJI.waznoscDni * 24 * 60 * 60 * 1000);

export async function utworzSesje(opcje: { baza: Baza; kontoId: string; teraz?: Date }): Promise<{ token: string; wygasaAt: Date }> {
  const teraz = opcje.teraz ?? new Date();
  const token = base64url(losoweBajty(32));
  const wygasaAt = wygasaOd(teraz);
  await opcje.baza(
    `insert into public.sesje (konto_id, token_skrot, wygasa_at, ostatnio_at, created_at)
     values ($1, $2, $3::timestamptz, $4::timestamptz, $4::timestamptz)`,
    [opcje.kontoId, await sha256(token), czas(wygasaAt), czas(teraz)],
  );
  return { token, wygasaAt };
}

/** Konto zalogowane tym tokenem albo null (brak, wygasła, wylogowana). */
export async function sesjaZTokenu(opcje: { baza: Baza; token: string; teraz?: Date }): Promise<{ kontoId: string; rola: Rola } | null> {
  const teraz = opcje.teraz ?? new Date();
  if (!/^[A-Za-z0-9_-]{43}$/.test(opcje.token)) return null;
  const [sesja] = await opcje.baza<{ konto_id: string; rola: Rola }>(
    `update public.sesje s set ostatnio_at = $2::timestamptz, wygasa_at = $3::timestamptz
     from public.konta k
     where s.token_skrot = $1 and s.uniewazniona_at is null and s.wygasa_at > $2::timestamptz and k.id = s.konto_id
     returning s.konto_id, k.rola`,
    [await sha256(opcje.token), czas(teraz), czas(wygasaOd(teraz))],
  );
  return sesja ? { kontoId: sesja.konto_id, rola: sesja.rola } : null;
}

export async function wyloguj(opcje: { baza: Baza; token: string; teraz?: Date }): Promise<void> {
  await opcje.baza("update public.sesje set uniewazniona_at = $2::timestamptz where token_skrot = $1 and uniewazniona_at is null", [
    await sha256(opcje.token),
    czas(opcje.teraz ?? new Date()),
  ]);
}
