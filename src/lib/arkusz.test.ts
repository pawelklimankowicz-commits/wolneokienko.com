import { czytajArkusz, dekodujTekst, parsujCsv, parsujXlsx } from "./arkusz";

// ── pomocnicy: plik, kodowania, mały zapis ZIP ─────────────────────────

const utf8 = (s: string) => new TextEncoder().encode(s);
const plik = (name: string, bajty: Uint8Array) => ({ name, arrayBuffer: async () => new Uint8Array(bajty).buffer });

/** Polskie litery w cp1250 (ASCII bez zmian). */
const CP1250: Record<string, number> = { ą: 0xb9, ć: 0xe6, ę: 0xea, ł: 0xb3, ń: 0xf1, ó: 0xf3, ś: 0x9c, ź: 0x9f, ż: 0xbf, Ł: 0xa3 };
const cp1250 = (s: string) => Uint8Array.from([...s], (z) => CP1250[z] ?? z.charCodeAt(0));

const utf16le = (s: string) => {
  const bajty = [0xff, 0xfe];
  for (let i = 0; i < s.length; i++) bajty.push(s.charCodeAt(i) & 0xff, s.charCodeAt(i) >> 8);
  return Uint8Array.from(bajty);
};

const TABLICA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(dane: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of dane) c = TABLICA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(dane: Uint8Array): Promise<Uint8Array> {
  const strumien = new Blob([dane]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(strumien).arrayBuffer());
}

function polacz(czesci: Uint8Array[]): Uint8Array {
  const wynik = new Uint8Array(czesci.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of czesci) {
    wynik.set(c, p);
    p += c.length;
  }
  return wynik;
}

interface WpisZip {
  nazwa: string;
  tresc: string;
  /** metoda 8 (deflate); bez tego metoda 0 (bez kompresji) */
  deflate?: boolean;
  /** dodatkowe pole w nagłówku lokalnym — czytnik musi je przeskoczyć */
  extra?: boolean;
  /** gotowe bajty zamiast skompresowanej treści (do psucia archiwum) */
  surowe?: Uint8Array;
}

/** Minimalny zapis ZIP: nagłówki lokalne, katalog centralny, EOCD; CRC-32 policzone. */
async function zbudujZip(wpisy: WpisZip[]): Promise<Uint8Array> {
  const lokalne: Uint8Array[] = [];
  const centralne: Uint8Array[] = [];
  let przesuniecie = 0;
  for (const wpis of wpisy) {
    const nazwa = utf8(wpis.nazwa);
    const tresc = utf8(wpis.tresc);
    const metoda = wpis.deflate || wpis.surowe ? 8 : 0;
    const dane = wpis.surowe ?? (wpis.deflate ? await deflateRaw(tresc) : tresc);
    const extra = wpis.extra ? Uint8Array.from([0xfe, 0xca, 4, 0, 1, 2, 3, 4]) : new Uint8Array(0);
    const crc = crc32(tresc);

    const lokalny = new Uint8Array(30 + nazwa.length + extra.length);
    const l = new DataView(lokalny.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(8, metoda, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, dane.length, true);
    l.setUint32(22, tresc.length, true);
    l.setUint16(26, nazwa.length, true);
    l.setUint16(28, extra.length, true);
    lokalny.set(nazwa, 30);
    lokalny.set(extra, 30 + nazwa.length);

    const centralny = new Uint8Array(46 + nazwa.length);
    const c = new DataView(centralny.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(10, metoda, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, dane.length, true);
    c.setUint32(24, tresc.length, true);
    c.setUint16(28, nazwa.length, true);
    c.setUint32(42, przesuniecie, true);
    centralny.set(nazwa, 46);

    lokalne.push(lokalny, dane);
    centralne.push(centralny);
    przesuniecie += lokalny.length + dane.length;
  }
  const katalog = polacz(centralne);
  const eocd = new Uint8Array(22);
  const e = new DataView(eocd.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, wpisy.length, true);
  e.setUint16(10, wpisy.length, true);
  e.setUint32(12, katalog.length, true);
  e.setUint32(16, przesuniecie, true);
  return polacz([...lokalne, katalog, eocd]);
}

// ── wzorcowy XLSX ──────────────────────────────────────────────────────

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const SKOROSZYT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook ${NS} ${NS_R}><sheets>
<sheet name="Archiwum" sheetId="1" state="hidden" r:id="rId1"/>
<sheet name="Cennik" sheetId="2" r:id="rId2"/>
</sheets></workbook>`;

const RELACJE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="${REL}/worksheet" Target="/xl/worksheets/cennik.xml"/>
<Relationship Id="rId3" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

const WSPOLNE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst ${NS} count="6" uniqueCount="6">
<si><t>Usługa</t></si>
<si><t>Cena</t></si>
<si><r><rPr><b/><sz val="11"/></rPr><t>Pedi</t></r><r><t xml:space="preserve">cure </t></r><rPh sb="0" eb="1"><t>ペ</t></rPh></si>
<si><t/></si>
<si><t>Henna &amp; regulacja</t></si>
<si><t>Brwi_x0020_i rzęsy</t></si>
</sst>`;

const CENNIK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet ${NS} ${NS_R}><dimension ref="A1:E6"/><sheetData>
<row r="1" spans="1:3"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>Czas</t></is></c></row>
<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>129.5</v></c><c r="C2" t="n"><v>60</v></c><c r="E2" s="3"/></row>
<row r="3"><c r="A3" t="s"><v>4</v></c><c r="C3"><v>30</v></c></row>
<row r="4"><c r="A4" s="1"/><c r="B4" t="s"><v>3</v></c></row>
<row r="6"><c r="A6" t="inlineStr"><is><t>Zdj&#281;cie hybrydy &#x2014; 15&apos;</t></is></c>
<c r="B6" t="str"><f>B2*0</f><v>0</v></c><c r="C6" t="b"><v>1</v></c><c r="D6" t="e"><v>#N/A</v></c></row>
<row r="7"><c t="s"><v>5</v></c><c><v>45</v></c></row>
</sheetData></worksheet>`;

const ARCHIWUM = `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>stary cennik</t></is></c></row></sheetData></worksheet>`;

const wzorcowyXlsx = () =>
  zbudujZip([
    { nazwa: "[Content_Types].xml", tresc: '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>' },
    { nazwa: "xl/workbook.xml", tresc: SKOROSZYT },
    { nazwa: "xl/_rels/workbook.xml.rels", tresc: RELACJE, extra: true },
    { nazwa: "xl/sharedStrings.xml", tresc: WSPOLNE, deflate: true },
    { nazwa: "xl/worksheets/sheet1.xml", tresc: ARCHIWUM },
    { nazwa: "xl/worksheets/cennik.xml", tresc: CENNIK, deflate: true },
  ]);

// ── testy ──────────────────────────────────────────────────────────────

describe("parsujCsv", () => {
  it("średnik, pola w cudzysłowie ze średnikiem i podwojonym cudzysłowem", () => {
    const tekst = 'Usługa;Cena;Opis\n"Manicure; hybrydowy";120;"Lakier ""Semilac"""\nPedicure;150,50;\n';
    expect(parsujCsv(tekst)).toEqual([
      ["Usługa", "Cena", "Opis"],
      ["Manicure; hybrydowy", "120", 'Lakier "Semilac"'],
      ["Pedicure", "150,50"],
    ]);
  });

  it("przecinek, CRLF i nowa linia w polu w cudzysłowie", () => {
    const tekst = 'Nazwa,Cena,Czas\r\n"Strzyżenie\r\ndamskie",90,45\r\n  Modelowanie , 60 ,30\r\n\r\n';
    expect(parsujCsv(tekst)).toEqual([
      ["Nazwa", "Cena", "Czas"],
      ["Strzyżenie\ndamskie", "90", "45"],
      ["Modelowanie", "60", "30"],
    ]);
  });

  it("TSV wygrywa z przecinkiem dziesiętnym w cenach", () => {
    const tekst = "Usługa\tCena\tCzas\nMasaż, relaks\t200,00\t60\nPeeling\t80,00\t30\n";
    expect(parsujCsv(tekst)).toEqual([
      ["Usługa", "Cena", "Czas"],
      ["Masaż, relaks", "200,00", "60"],
      ["Peeling", "80,00", "30"],
    ]);
  });

  it("kreska pionowa jako separator", () => {
    expect(parsujCsv("Usługa|Cena\nHenna|40")).toEqual([
      ["Usługa", "Cena"],
      ["Henna", "40"],
    ]);
  });

  it("zwykła lista bez separatora: linia to jedna komórka, cudzysłowy zostają", () => {
    const tekst = 'Manicure hybrydowy\nStrzyżenie, modelowanie\n\n  Henna brwi  \nMasaż "Bambus"\n';
    expect(parsujCsv(tekst)).toEqual([["Manicure hybrydowy"], ["Strzyżenie, modelowanie"], ["Henna brwi"], ['Masaż "Bambus"']]);
  });

  it("puste wiersze z samych separatorów (Excel) znikają; pusty tekst → pusta tabela", () => {
    expect(parsujCsv("Usługa;Cena;;\n;;;\n\nHenna;40;;\n")).toEqual([
      ["Usługa", "Cena"],
      ["Henna", "40"],
    ]);
    expect(parsujCsv("")).toEqual([]);
  });
});

describe("dekodujTekst", () => {
  it("cp1250 z polskiego Excela", () => {
    const bajty = cp1250("Manicure hybrydowy;120 zł\nŁuk brwi;35 zł");
    expect(bajty[24]).toBe(0xb3);
    expect(dekodujTekst(bajty)).toBe("Manicure hybrydowy;120 zł\nŁuk brwi;35 zł");
    expect(parsujCsv(dekodujTekst(bajty))).toEqual([
      ["Manicure hybrydowy", "120 zł"],
      ["Łuk brwi", "35 zł"],
    ]);
  });

  it("zdejmuje BOM z UTF-8", () => {
    const tekst = dekodujTekst(polacz([Uint8Array.from([0xef, 0xbb, 0xbf]), utf8("Usługa;Cena")]));
    expect(tekst).toBe("Usługa;Cena");
    expect(tekst.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("UTF-16 z BOM („Tekst Unicode” z Excela)", () => {
    expect(dekodujTekst(utf16le("Usługa\tCena\r\nHenna\t40"))).toBe("Usługa\tCena\r\nHenna\t40");
  });
});

describe("parsujXlsx", () => {
  it("pierwszy widoczny arkusz: wspólne teksty, rich text, encje, liczby, inlineStr, luki w kolumnach", async () => {
    expect(await parsujXlsx(await wzorcowyXlsx())).toEqual([
      ["Usługa", "Cena", "Czas"],
      ["Pedicure", "129.5", "60"],
      ["Henna & regulacja", "", "30"],
      ["Zdjęcie hybrydy — 15'", "0", "TAK", "#N/A"],
      ["Brwi i rzęsy", "45"],
    ]);
  });

  it("bez skoroszytu sięga po xl/worksheets/sheet1.xml; komórki bez adresu idą po kolei", async () => {
    const tresc = ARCHIWUM.replace("<row", '<row><c t="b"><v>0</v></c></row><row');
    const zip = await zbudujZip([{ nazwa: "xl/worksheets/sheet1.xml", tresc, deflate: true }]);
    expect(await parsujXlsx(zip)).toEqual([["NIE"], ["stary cennik"]]);
  });

  it("uszkodzone archiwum → polski komunikat", async () => {
    const pelne = await wzorcowyXlsx();
    await expect(parsujXlsx(pelne.subarray(0, 200))).rejects.toThrow("Nie udało się odczytać pliku");
    const zepsute = await zbudujZip([{ nazwa: "xl/worksheets/sheet1.xml", tresc: "", surowe: Uint8Array.from([0xff, 0xff, 0xff, 0xff]) }]);
    await expect(parsujXlsx(zepsute)).rejects.toThrow("Nie udało się odczytać pliku");
  });
});

describe("czytajArkusz", () => {
  it("rozpoznaje XLSX po sygnaturze ZIP, nawet bez rozszerzenia", async () => {
    const tabela = await czytajArkusz(plik("eksport", await wzorcowyXlsx()));
    expect(tabela[1]).toEqual(["Pedicure", "129.5", "60"]);
  });

  it(".csv w cp1250 idzie ścieżką tekstową", async () => {
    expect(await czytajArkusz(plik("cennik.csv", cp1250("Usługa;Cena\nStrzyżenie męskie;60 zł")))).toEqual([
      ["Usługa", "Cena"],
      ["Strzyżenie męskie", "60 zł"],
    ]);
  });

  it(".txt w UTF-16 (tabulatory)", async () => {
    expect(await czytajArkusz(plik("CENNIK.TXT", utf16le("Usługa\tCena\r\nHenna\t40\r\n")))).toEqual([
      ["Usługa", "Cena"],
      ["Henna", "40"],
    ]);
  });

  it("stary .xls → prośba o zapis jako .xlsx albo .csv", async () => {
    const ole = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    await expect(czytajArkusz(plik("cennik.xls", ole))).rejects.toThrow(
      "Stary format .xls — zapisz plik jako .xlsx albo .csv i spróbuj ponownie.",
    );
    await expect(czytajArkusz(plik("cennik.xlsx", ole))).rejects.toThrow("zabezpieczony hasłem");
    await expect(czytajArkusz(plik("cennik.xls", utf8("<html>")))).rejects.toThrow("Stary format .xls");
  });

  it("inne formaty → lista obsługiwanych", async () => {
    const ods = await zbudujZip([
      { nazwa: "mimetype", tresc: "application/vnd.oasis.opendocument.spreadsheet" },
      { nazwa: "content.xml", tresc: "<office:document-content/>" },
    ]);
    await expect(czytajArkusz(plik("cennik.ods", ods))).rejects.toThrow("Obsługujemy pliki .xlsx, .csv i .txt.");
    await expect(czytajArkusz(plik("cennik.numbers", utf8("coś")))).rejects.toThrow("Obsługujemy pliki .xlsx, .csv i .txt.");
    await expect(czytajArkusz(plik("cennik.pdf", utf8("%PDF-1.7")))).rejects.toThrow("Obsługujemy pliki .xlsx, .csv i .txt.");
  });

  it("plik ponad 5 MB → odrzucony", async () => {
    await expect(czytajArkusz(plik("cennik.csv", new Uint8Array(5 * 1024 * 1024 + 1)))).rejects.toThrow(
      "Plik jest za duży (najwyżej 5 MB).",
    );
    const nieCzytaj = { name: "cennik.csv", size: 6e6, arrayBuffer: () => Promise.reject(new Error("nie powinno czytać")) };
    await expect(czytajArkusz(nieCzytaj)).rejects.toThrow("Plik jest za duży");
  });
});
