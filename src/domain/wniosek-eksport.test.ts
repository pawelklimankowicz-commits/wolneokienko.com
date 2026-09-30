import { brakujacePolaWniosku, wniosekOEksport, type DaneWniosku } from "./wniosek-eksport";

const dane: DaneWniosku = {
  dostawca: "Booksy",
  nazwaFirmy: "Studio Paznokci Jeżyce",
  nip: "774-000-14-54",
  adres: "Dąbrowskiego 12/3, 60-838 Poznań",
  emailKonta: "studio@example.pl",
  miejscowosc: "Poznań",
  data: new Date(2026, 9, 1),
  zakres: ["uslugi", "profil"],
  osobaFizyczna: false,
  wypowiadam: false,
};

describe("wniosek o eksport danych", () => {
  it("zawiera strony, zakres, podstawę prawną i wykluczenie danych klientów", () => {
    const { temat, tresc } = wniosekOEksport(dane);
    expect(temat).toBe("Wniosek o eksport danych firmy — Studio Paznokci Jeżyce");
    expect(tresc).toMatch(/^Poznań, 1 października 2026/);
    expect(tresc).toContain("Do: Booksy — obsługa klienta");
    expect(tresc).toContain("e-mail konta: studio@example.pl");
    expect(tresc).toContain("  • listę usług z nazwami, cenami, czasem trwania i kategoriami;");
    expect(tresc).toContain("  • opis firmy, logo i zdjęcia dodane przeze mnie do profilu, w oryginalnej rozdzielczości.");
    expect(tresc).not.toContain("pracowników");
    expect(tresc).toContain("(UE) 2023/2854");
    expect(tresc).toContain("Wniosek nie obejmuje danych osobowych moich klientów.");
    expect(tresc).toContain("nie wypowiadam umowy");
    expect(tresc).not.toContain("RODO");
  });

  it("osoba fizyczna dostaje art. 20 RODO; wypowiedzenie tylko na życzenie", () => {
    const { tresc } = wniosekOEksport({ ...dane, osobaFizyczna: true, wypowiadam: true });
    expect(tresc).toContain("art. 20 RODO");
    expect(tresc).toContain("rezygnuję z usługi");
  });

  it("brakujące pola", () => {
    expect(brakujacePolaWniosku(dane)).toEqual([]);
    expect(brakujacePolaWniosku({ ...dane, dostawca: " ", zakres: [] })).toEqual(["dostawca", "zakres danych"]);
  });
});
