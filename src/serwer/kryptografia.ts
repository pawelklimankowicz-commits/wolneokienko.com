// Drobne narzędzia kryptograficzne na Web Crypto — działają tak samo w Node,
// w przeglądarce i w Cloudflare Workers, bez zależności.

const koder = new TextEncoder();

const hex = (bufor: ArrayBuffer) => [...new Uint8Array(bufor)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function losoweBajty(ile: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ile));
}

/** Kod z samych cyfr. Rozkład równomierny: losowania z „ogona” zakresu są odrzucane. */
export function losowyKod(dlugosc: number): string {
  const zakres = 10 ** dlugosc;
  const granica = Math.floor(2 ** 32 / zakres) * zakres;
  const bufor = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(bufor);
    if (bufor[0] < granica) return String(bufor[0] % zakres).padStart(dlugosc, "0");
  }
}

export async function hmacSha256(klucz: string, tresc: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", koder.encode(klucz), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, koder.encode(tresc)));
}

export async function sha256(tresc: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", koder.encode(tresc)));
}

export function base64url(bajty: Uint8Array): string {
  return btoa(String.fromCharCode(...bajty)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Porównanie skrótów w stałym czasie — czas odpowiedzi nie zdradza, ile znaków się zgadza. */
export function rowneStaloczasowo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let roznica = 0;
  for (let i = 0; i < a.length; i++) roznica |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return roznica === 0;
}
