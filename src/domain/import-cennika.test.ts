import {
  cenaZKomorki,
  czasZKomorki,
  dopasuj,
  dopasujUsluge,
  imiePracownika,
  pozycjeZImportu,
  wierszeZTabeli,
  wierszeZTekstu,
  wyciagnijCene,
  wyciagnijCzas,
} from "./import-cennika";
import { uslugiBranzy } from "./katalog-uslug";

describe("cena i czas z tekstu", () => {
  it("kwoty z walutą, zakresy, grosze i tysiące", () => {
    expect(wyciagnijCene("Manicure hybrydowy 120 zł").cenaGr).toBe(12000);
    expect(wyciagnijCene("Hybryda ...... od 99,50 zł").cenaGr).toBe(9950);
    expect(wyciagnijCene("Koloryzacja 180–250 zł").cenaGr).toBe(18000);
    expect(wyciagnijCene("Balayage 1 200 zł").cenaGr).toBe(120000);
    expect(wyciagnijCene("Strzyżenie PLN 70").cenaGr).toBe(7000);
    expect(wyciagnijCene("Pedicure 150,-").cenaGr).toBe(15000);
  });

  it("bez waluty bierze liczbę z końca wiersza, ale nie „1:1” ani drobne liczby", () => {
    expect(wyciagnijCene("Hybryda ........ 120").cenaGr).toBe(12000);
    expect(wyciagnijCene("Rzęsy 1:1").cenaGr).toBeNull();
    expect(wyciagnijCene("Pakiet 3").cenaGr).toBeNull();
  });

  it("czas: minuty, godziny, zapis Booksy i zegarowy", () => {
    expect(wyciagnijCzas("Masaż 60 min").czasMin).toBe(60);
    expect(wyciagnijCzas("Koloryzacja 2 h 30 min").czasMin).toBe(150);
    expect(wyciagnijCzas("Keratyna 1,5 h").czasMin).toBe(90);
    expect(wyciagnijCzas("Manicure hybrydowy 1g 15min").czasMin).toBe(75);
    expect(wyciagnijCzas("Rzęsy 1:30").czasMin).toBe(90);
    expect(wyciagnijCzas("3 hybrydy").czasMin).toBeNull();
  });

  it("komórki tabeli: cena, czas i ułamek doby z Excela", () => {
    expect(cenaZKomorki("120")).toBe(12000);
    expect(cenaZKomorki("129.5")).toBe(12950);
    expect(cenaZKomorki("od 80,00 zł")).toBe(8000);
    expect(cenaZKomorki("")).toBeNull();
    expect(czasZKomorki("45")).toBe(45);
    expect(czasZKomorki("0.0625")).toBe(90);
    expect(czasZKomorki("1h 30min")).toBe(90);
  });
});

describe("wiersze z tekstu", () => {
  it("cennik ze strony salonu: sekcje, kropki prowadzące, czas przed ceną", () => {
    const w = wierszeZTekstu(`
      PAZNOKCIE
      Manicure hybrydowy ............ 60 min ... 120 zł
      • Pedicure hybrydowy – 150,00 zł
      Zdjęcie hybrydy: 30 zł

      Rzęsy
      Przedłużanie rzęs 1:1   2 h   od 180 zł
    `);
    expect(w.map((x) => [x.nazwa, x.cenaGr, x.czasMin, x.sekcja])).toEqual([
      ["Manicure hybrydowy", 12000, 60, "PAZNOKCIE"],
      ["Pedicure hybrydowy", 15000, null, "PAZNOKCIE"],
      ["Zdjęcie hybrydy", 3000, null, "PAZNOKCIE"],
      ["Przedłużanie rzęs 1:1", 18000, 120, "Rzęsy"],
    ]);
  });

  it("OCR rozdziela kolumny: nazwa w jednym wierszu, cena w następnym", () => {
    const w = wierszeZTekstu("Manicure japoński\n90 zł\nPedicure klasyczny\n1g\n110,00 zł");
    expect(w.map((x) => [x.nazwa, x.cenaGr])).toEqual([["Manicure japoński", 9000]]);
    // „1g” to sam czas — pedicure zostaje nagłówkiem, a cena bez nazwy nie tworzy pozycji
    expect(w).toHaveLength(1);
  });
});

describe("tabela z pliku eksportu", () => {
  it("rozpoznaje kolumny po nagłówku, bierze tylko imiona pracowników", () => {
    const w = wierszeZTabeli([
      ["Eksport usług", "", "", ""],
      ["Kategoria", "Nazwa usługi", "Cena (zł)", "Czas trwania", "Pracownik"],
      ["Paznokcie", "Manicure hybrydowy", "120,00", "60", "Anna Kowalska, Ewa Nowak"],
      ["Paznokcie", "Manicure hybrydowy", "110", "60", "Kasia"],
      ["Brwi", "Henna brwi", "50", "0.020833333", ""],
      ["", "", "", "", ""],
    ]);
    expect(w).toHaveLength(3);
    expect(w[0]).toMatchObject({ nazwa: "Manicure hybrydowy", cenaGr: 12000, czasMin: 60, pracownicy: ["Anna", "Ewa"], sekcja: "Paznokcie" });
    expect(w[2]).toMatchObject({ nazwa: "Henna brwi", cenaGr: 5000, czasMin: 30 });
    // nazwisk nie ma w danych wynikowych
    expect(JSON.stringify(w.map(({ zrodlo: _z, ...r }) => r))).not.toMatch(/Kowalska|Nowak/);
  });

  it("bez nagłówka czyta wiersze jak tekst", () => {
    expect(wierszeZTabeli([["Strzyżenie męskie", "70 zł"], ["Broda", "40 zł"]]).map((x) => x.cenaGr)).toEqual([7000, 4000]);
  });

  it("imię pracownika: tylko pierwsze słowo, z wielkiej litery", () => {
    expect(imiePracownika("ANNA kowalska")).toBe("Anna");
    expect(imiePracownika("  ")).toBeNull();
    expect(imiePracownika("X")).toBeNull();
  });
});

describe("dopasowanie do katalogu", () => {
  const uroda = uslugiBranzy("uroda");
  const kod = (nazwa: string) => dopasujUsluge(nazwa, uroda)?.usluga.kod ?? null;

  it("nazwy z cenników salonów trafiają do właściwych usług", () => {
    expect(kod("Manicure hybrydowy")).toBe("manicure_hybrydowy");
    expect(kod("Hybryda")).toBe("manicure_hybrydowy");
    expect(kod("Pedicure hybrydowy")).toBe("pedicure_hybrydowy");
    expect(kod("Strzyżenie damskie + modelowanie")).toBe("strzyzenie_damskie");
    expect(kod("Przedłużanie rzęs 2D")).toBe("rzesy_objetosciowe");
    expect(kod("Rzęsy 1:1")).toBe("rzesy_1_1");
    expect(kod("Koloryzacja włosów")).toBe("koloryzacja");
    expect(kod("Voucher prezentowy")).toBeNull();
    // pełna nazwa z katalogu wygrywa z synonimem innej usługi
    expect(kod("Zdjęcie hybrydy")).toBe("zdjecie_hybrydy");
    expect(kod("Manicure")).toBe("manicure_klasyczny");
  });

  it("pewne tylko przy wyraźnym trafieniu", () => {
    expect(dopasujUsluge("Manicure hybrydowy", uroda)?.pewne).toBe(true);
    // „manicure” bez dopisku to w katalogu manicure klasyczny (synonim)
    expect(dopasujUsluge("Manicure", uroda)).toMatchObject({ usluga: { kod: "manicure_klasyczny" }, pewne: true });
    // samo „przedłużanie” — paznokcie czy rzęsy? propozycja, ale niepewna
    expect(dopasujUsluge("Przedłużanie", uroda)?.pewne).toBe(false);
  });

  it("tylko usługi branży salonu; nagłówek sekcji pomaga krótkim nazwom", () => {
    const [p] = dopasuj([{ zrodlo: "", nazwa: "Wymiana opon", cenaGr: 10000, czasMin: null, pracownicy: [], sekcja: null }], "uroda");
    expect(p.uslugaKod).toBeNull();
    const [s] = dopasuj([{ zrodlo: "", nazwa: "Klasyczny", cenaGr: 8000, czasMin: null, pracownicy: [], sekcja: "Manicure" }], "uroda");
    expect(s.uslugaKod).toBe("manicure_klasyczny");
    // sam nagłówek sekcji nie wystarcza
    const [bon] = dopasuj([{ zrodlo: "", nazwa: "Bon podarunkowy", cenaGr: 10000, czasMin: null, pracownicy: [], sekcja: "Paznokcie" }], "uroda");
    expect(bon.uslugaKod).toBeNull();
  });

  it("cennik z tekstu: tanie usługi dodatkowe nie zaniżają ceny głównej", () => {
    const { pozycje } = pozycjeZImportu(
      dopasuj(wierszeZTekstu("CENNIK\nManicure hybrydowy ..... 120 zł\nPedicure hybrydowy 1g 15min 150 zł\nZdjęcie hybrydy 30 zł\nVoucher 100 zł"), "uroda").filter((p) => p.pewne),
    );
    expect(pozycje).toEqual([
      { uslugaKod: "manicure_hybrydowy", cenaGr: 12000, czasMin: 60 },
      { uslugaKod: "pedicure_hybrydowy", cenaGr: 15000, czasMin: 75 },
      { uslugaKod: "zdjecie_hybrydy", cenaGr: 3000, czasMin: 20 },
    ]);
  });

  it("kilka wierszy tej samej usługi → jedna pozycja z najniższą ceną, pracownicy z usługami", () => {
    const propozycje = dopasuj(
      wierszeZTabeli([
        ["Usługa", "Cena", "Czas", "Pracownik"],
        ["Manicure hybrydowy", "120", "60", "Anna"],
        ["Manicure hybrydowy", "110", "75", "Kasia"],
        ["Pedicure hybrydowy", "150", "", "Anna"],
        ["Bon podarunkowy", "100", "", ""],
      ]),
      "uroda",
    );
    const { pozycje, pracownicy } = pozycjeZImportu(propozycje);
    expect(pozycje).toEqual([
      { uslugaKod: "manicure_hybrydowy", cenaGr: 11000, czasMin: 75 },
      { uslugaKod: "pedicure_hybrydowy", cenaGr: 15000, czasMin: 75 },
    ]);
    expect(pracownicy).toEqual([
      { imie: "Anna", uslugi: ["manicure_hybrydowy", "pedicure_hybrydowy"] },
      { imie: "Kasia", uslugi: ["manicure_hybrydowy"] },
    ]);
  });
});
