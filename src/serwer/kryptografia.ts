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

const naBase64 = (bajty: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
};
const zBase64 = (tekst: string) => Uint8Array.from(atob(tekst), (z) => z.charCodeAt(0));

/** Base64 → bajty; null, gdy to nie base64. */
export function bajtyZBase64(tekst: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(tekst) || tekst.length % 4 !== 0) return null;
  try {
    return zBase64(tekst);
  } catch {
    return null;
  }
}

/** Klucz AES-GCM do danej rzeczy wyprowadzony (HKDF) z sekretu serwera — bez osobnego sekretu na każdą. */
async function kluczAes(sekret: string, cel: string) {
  const baza = await crypto.subtle.importKey("raw", koder.encode(sekret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: koder.encode("wolne-okienko"), info: koder.encode(cel) },
    baza,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Szyfrowanie krótkiego tekstu (np. tajnego adresu kalendarza): base64 z IV i szyfrogramem. */
export async function zaszyfruj(sekret: string, cel: string, tekst: string): Promise<string> {
  const iv = losoweBajty(12);
  const szyfr = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await kluczAes(sekret, cel), koder.encode(tekst)));
  const wynik = new Uint8Array(iv.length + szyfr.length);
  wynik.set(iv);
  wynik.set(szyfr, iv.length);
  return naBase64(wynik);
}

/** Odwrotność `zaszyfruj`; null, gdy klucz się zmienił albo dane są uszkodzone. */
export async function odszyfruj(sekret: string, cel: string, zapis: string): Promise<string | null> {
  const bajty = bajtyZBase64(zapis);
  if (!bajty || bajty.length < 13) return null;
  try {
    const tekst = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bajty.subarray(0, 12) }, await kluczAes(sekret, cel), bajty.subarray(12));
    return new TextDecoder().decode(tekst);
  } catch {
    return null;
  }
}
