// =====================================================================
// Czytanie cennika z pliku eksportu z innego systemu: CSV, TXT, XLSX — bez zewnętrznych bibliotek.
// Tylko standardowe API (TextDecoder, DecompressionStream, Blob/Response, DataView),
// więc działa i w przeglądarce, i w Node 22 (testy). XML czytamy skanowaniem tekstu — bez DOMParsera.
// Wynik to surowe komórki; liczby zostają w zapisie z pliku („129.5”), resztę rozpoznaje wywołujący.
// =====================================================================

export type Tabela = string[][];

const MAKS_BAJTOW = 5 * 1024 * 1024;
const BLAD_ROZMIAR = "Plik jest za duży (najwyżej 5 MB).";
const BLAD_XLS = "Stary format .xls — zapisz plik jako .xlsx albo .csv i spróbuj ponownie.";
const BLAD_HASLO = "Plik jest zabezpieczony hasłem — zapisz go bez hasła i spróbuj ponownie.";
const BLAD_FORMAT = "Obsługujemy pliki .xlsx, .csv i .txt.";
const BLAD_USZKODZONY = "Nie udało się odczytać pliku — zapisz go ponownie jako .xlsx albo .csv.";

const zaczynaSie = (bajty: Uint8Array, wzor: number[]) => wzor.every((b, i) => bajty[i] === b);

/** Plik od użytkownika → wiersze komórek. Format po sygnaturze, potem po rozszerzeniu. */
export async function czytajArkusz(plik: { name: string; size?: number; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Tabela> {
  if ((plik.size ?? 0) > MAKS_BAJTOW) throw new Error(BLAD_ROZMIAR);
  const bajty = new Uint8Array(await plik.arrayBuffer());
  if (bajty.length > MAKS_BAJTOW) throw new Error(BLAD_ROZMIAR);
  const rozszerzenie = /\.([a-z0-9]+)$/i.exec(plik.name)?.[1].toLowerCase() ?? "";
  // ZIP: .xlsx (a .ods/.numbers/.docx odpadną w parsujXlsx, bo nie mają xl/)
  if (zaczynaSie(bajty, [0x50, 0x4b, 0x03, 0x04])) return parsujXlsx(bajty);
  // kontener OLE: stary .xls albo .xlsx zaszyfrowany hasłem
  if (zaczynaSie(bajty, [0xd0, 0xcf, 0x11, 0xe0])) throw new Error(rozszerzenie === "xlsx" ? BLAD_HASLO : BLAD_XLS);
  if (["csv", "tsv", "txt"].includes(rozszerzenie)) return parsujCsv(dekodujTekst(bajty));
  throw new Error(rozszerzenie === "xls" ? BLAD_XLS : BLAD_FORMAT);
}

// ── tekst ──────────────────────────────────────────────────────────────

/** Bajty → tekst: UTF-16 z BOM („Tekst Unicode” z Excela), UTF-8, a gdy się nie da — polski Excel (cp1250). */
export function dekodujTekst(bajty: Uint8Array): string {
  if (zaczynaSie(bajty, [0xff, 0xfe])) return new TextDecoder("utf-16le").decode(bajty.subarray(2));
  if (zaczynaSie(bajty, [0xfe, 0xff])) return new TextDecoder("utf-16be").decode(bajty.subarray(2));
  const bezBom = zaczynaSie(bajty, [0xef, 0xbb, 0xbf]) ? bajty.subarray(3) : bajty;
  for (const kodowanie of ["utf-8", "windows-1250", "iso-8859-2"]) {
    try {
      return new TextDecoder(kodowanie, { fatal: true, ignoreBOM: true }).decode(bezBom);
    } catch {
      // niepoprawne bajty albo brak kodowania w silniku — następne
    }
  }
  return new TextDecoder("utf-8").decode(bezBom);
}

const SEPARATORY = [";", "\t", ",", "|"];

/** CSV/TSV/TXT → tabela. Separator zgadujemy z pierwszych 10 niepustych wierszy; bez separatora — linia to komórka. */
export function parsujCsv(tekst: string): Tabela {
  const t = tekst.replace(/\r\n?/g, "\n");
  let najlepszy: { sep: string; zgodnych: number } | undefined;
  for (const sep of SEPARATORY) {
    const czestosc = new Map<number, number>();
    for (const w of rozbij(t, sep, 10)) czestosc.set(w.length, (czestosc.get(w.length) ?? 0) + 1);
    // najczęstsza liczba kolumn (przy remisie większa) i w ilu wierszach wystąpiła
    let [kolumn, zgodnych] = [0, 0];
    for (const [n, ile] of czestosc) if (ile > zgodnych || (ile === zgodnych && n > kolumn)) [kolumn, zgodnych] = [n, ile];
    if (kolumn > 1 && zgodnych > (najlepszy?.zgodnych ?? 0)) najlepszy = { sep, zgodnych };
  }
  return oczysc(najlepszy ? rozbij(t, najlepszy.sep) : t.split("\n").map((linia) => [linia]));
}

/** RFC 4180: pola w cudzysłowie, "" jako cudzysłów, separator i nowa linia w środku pola. Pomija puste wiersze. */
function rozbij(tekst: string, sep: string, limit = Infinity): Tabela {
  const wiersze: Tabela = [];
  let wiersz: string[] = [];
  let pole = "";
  let cytat = false;
  const zamknijPole = () => {
    wiersz.push(pole);
    pole = "";
  };
  const zamknijWiersz = () => {
    zamknijPole();
    if (wiersz.some((k) => k.trim())) wiersze.push(wiersz);
    wiersz = [];
  };
  for (let i = 0; i < tekst.length && wiersze.length < limit; i++) {
    const z = tekst[i];
    if (cytat) {
      if (z !== '"') pole += z;
      else if (tekst[i + 1] === '"') pole += tekst[i++];
      else cytat = false;
    } else if (z === '"' && !pole.trim()) {
      cytat = true;
      pole = "";
    } else if (z === sep) zamknijPole();
    else if (z === "\n") zamknijWiersz();
    else pole += z;
  }
  if (pole || wiersz.length) zamknijWiersz();
  return wiersze;
}

/** Przycina komórki, obcina puste komórki z prawej, usuwa puste wiersze. */
function oczysc(wiersze: Tabela): Tabela {
  const wynik: Tabela = [];
  for (const wiersz of wiersze) {
    const komorki = wiersz.map((k) => k.trim());
    while (komorki.length && !komorki[komorki.length - 1]) komorki.pop();
    if (komorki.length) wynik.push(komorki);
  }
  return wynik;
}

// ── ZIP ────────────────────────────────────────────────────────────────

/** Spis archiwum ZIP (bez ZIP64) → funkcja czytająca wpis po nazwie (wielkość liter bez znaczenia). */
function otworzZip(bajty: Uint8Array): (nazwa: string | undefined) => Promise<Uint8Array | undefined> {
  const dv = new DataView(bajty.buffer, bajty.byteOffset, bajty.byteLength);
  const u16 = (p: number) => dv.getUint16(p, true);
  const u32 = (p: number) => dv.getUint32(p, true);
  // koniec katalogu centralnego: 22 bajty + komentarz do 64 KB
  let eocd = -1;
  for (let p = bajty.length - 22; p >= Math.max(0, bajty.length - 22 - 0xffff); p--) {
    if (u32(p) === 0x06054b50) {
      eocd = p;
      break;
    }
  }
  if (eocd < 0) throw new Error(BLAD_USZKODZONY);
  const liczba = u16(eocd + 10);
  if (liczba === 0xffff || u32(eocd + 16) === 0xffffffff) throw new Error(BLAD_FORMAT);
  const wpisy = new Map<string, { metoda: number; rozmiar: number; naglowek: number }>();
  for (let n = 0, p = u32(eocd + 16); n < liczba; n++) {
    if (p + 46 > bajty.length || u32(p) !== 0x02014b50) throw new Error(BLAD_USZKODZONY);
    const [rozmiar, naglowek] = [u32(p + 20), u32(p + 42)];
    if (rozmiar === 0xffffffff || naglowek === 0xffffffff) throw new Error(BLAD_FORMAT);
    const nazwa = new TextDecoder().decode(bajty.subarray(p + 46, p + 46 + u16(p + 28)));
    wpisy.set(nazwa.replace(/\\/g, "/").toLowerCase(), { metoda: u16(p + 10), rozmiar, naglowek });
    p += 46 + u16(p + 28) + u16(p + 30) + u16(p + 32);
  }
  return async (nazwa) => {
    const wpis = nazwa === undefined ? undefined : wpisy.get(nazwa.toLowerCase());
    if (!wpis) return undefined;
    const h = wpis.naglowek;
    if (h + 30 > bajty.length || u32(h) !== 0x04034b50) throw new Error(BLAD_USZKODZONY);
    const start = h + 30 + u16(h + 26) + u16(h + 28);
    if (start + wpis.rozmiar > bajty.length) throw new Error(BLAD_USZKODZONY);
    const dane = bajty.subarray(start, start + wpis.rozmiar);
    if (wpis.metoda === 0) return dane;
    if (wpis.metoda !== 8) throw new Error(BLAD_FORMAT);
    try {
      const strumien = new Blob([dane]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(strumien).arrayBuffer());
    } catch {
      throw new Error(BLAD_USZKODZONY);
    }
  };
}

// ── XML (skanowanie tekstu) ────────────────────────────────────────────

const ENCJE: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function odkoduj(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (calosc, k: string) => {
    if (k[0] !== "#") return ENCJE[k] ?? calosc;
    const kod = k[1] === "x" || k[1] === "X" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return kod <= 0x10ffff ? String.fromCodePoint(kod) : calosc;
  });
}

interface Element {
  atr: Record<string, string>;
  tresc: string;
}

/** Elementy <nazwa …>…</nazwa> i <nazwa …/> (także z prefiksem, np. <x:c>); ta sama nazwa się nie zagnieżdża. */
function elementy(xml: string, nazwa: string): Element[] {
  const wynik: Element[] = [];
  const re = new RegExp(`<(\\w+:)?${nazwa}(\\s[^>]*?)?(/?)>`, "g");
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const atr: Record<string, string> = {};
    for (const a of (m[2] ?? "").matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) atr[a[1]] = odkoduj(a[2] ?? a[3]);
    if (m[3]) {
      wynik.push({ atr, tresc: "" });
      continue;
    }
    const koniec = xml.indexOf(`</${m[1] ?? ""}${nazwa}>`, re.lastIndex);
    if (koniec < 0) break;
    wynik.push({ atr, tresc: xml.slice(re.lastIndex, koniec) });
    re.lastIndex = koniec;
  }
  return wynik;
}

/** Tekst z <si> albo <is>: sklejone wszystkie <t> (także z przebiegów <r>), bez fonetyki <rPh>. */
function tekstKomorki(xml: string): string {
  const bezFonetyki = xml.replace(/<(\w+:)?rPh\b[\s\S]*?<\/(\w+:)?rPh>/g, "");
  const tekst = elementy(bezFonetyki, "t").map((e) => odkoduj(e.tresc)).join("");
  // OOXML zapisuje znaki sterujące jako _xHHHH_ (np. _x000D_)
  return tekst.replace(/_x([0-9a-f]{4})_/gi, (_, kod: string) => String.fromCharCode(parseInt(kod, 16)));
}

/** „BC12” → 54 (kolumny od zera); -1, gdy adres nie zaczyna się od liter. */
function numerKolumny(adres: string): number {
  let n = 0;
  for (const z of adres.toUpperCase()) {
    if (z < "A" || z > "Z") break;
    n = n * 26 + z.charCodeAt(0) - 64;
  }
  return n - 1;
}

// ── XLSX ───────────────────────────────────────────────────────────────

/** XLSX → tabela z pierwszego widocznego arkusza. */
export async function parsujXlsx(bajty: Uint8Array): Promise<Tabela> {
  const zip = otworzZip(bajty);
  const czytaj = async (nazwa: string | undefined) => {
    const dane = await zip(nazwa);
    return dane && new TextDecoder().decode(dane);
  };
  const relacje = elementy((await czytaj("xl/_rels/workbook.xml.rels")) ?? "", "Relationship").map((e) => e.atr);
  const sciezka = (typ: string, id?: string) => {
    const cel = relacje.find((r) => (id ? r.Id === id : r.Type?.endsWith(typ)))?.Target;
    return cel && (cel.startsWith("/") ? cel.slice(1) : `xl/${cel}`);
  };
  const arkusze = elementy((await czytaj("xl/workbook.xml")) ?? "", "sheet").map((e) => e.atr);
  const pierwszy = arkusze.find((a) => !/hidden/i.test(a.state ?? "")) ?? arkusze[0];
  const idArkusza = pierwszy && Object.entries(pierwszy).find(([k]) => k.endsWith(":id"))?.[1];
  const arkusz = (idArkusza && (await czytaj(sciezka("/worksheet", idArkusza)))) || (await czytaj("xl/worksheets/sheet1.xml"));
  if (arkusz === undefined) throw new Error(BLAD_FORMAT);
  const wspolneXml = (await czytaj(sciezka("/sharedStrings"))) ?? (await czytaj("xl/sharedStrings.xml")) ?? "";
  const wspolne = elementy(wspolneXml, "si").map((e) => tekstKomorki(e.tresc));

  const wiersze: Tabela = [];
  for (const wiersz of elementy(arkusz, "row")) {
    const komorki: string[] = [];
    let kolumna = 0;
    for (const { atr, tresc } of elementy(wiersz.tresc, "c")) {
      const numer = numerKolumny(atr.r ?? "");
      if (numer >= 0) kolumna = numer;
      komorki[kolumna++] = wartosc(atr.t, tresc, wspolne);
    }
    wiersze.push(Array.from(komorki, (k) => k ?? ""));
  }
  return oczysc(wiersze);
}

function wartosc(typ: string | undefined, tresc: string, wspolne: string[]): string {
  if (typ === "inlineStr") return tekstKomorki(elementy(tresc, "is")[0]?.tresc ?? "");
  const v = elementy(tresc, "v")[0];
  if (!v) return "";
  const surowa = odkoduj(v.tresc);
  if (typ === "s") return wspolne[Number(surowa)] ?? "";
  if (typ === "b") return surowa.trim() === "1" ? "TAK" : "NIE";
  return surowa; // n, str, e, d — w zapisie z pliku
}
