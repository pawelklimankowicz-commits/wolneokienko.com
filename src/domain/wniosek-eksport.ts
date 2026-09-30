// =====================================================================
// Wniosek usługodawcy do jego obecnego dostawcy systemu rezerwacji o eksport
// danych firmy — legalna droga przeniesienia usług, cennika, zespołu i zdjęć
// (docs/DECYZJE.md, § 12). Podstawa: akt w sprawie danych (Data Act,
// rozporządzenie (UE) 2023/2854, rozdział VI — zmiana dostawcy usług
// przetwarzania danych, stosowany od 12.09.2025), a dla danych osobowych
// przedsiębiorcy będącego osobą fizyczną także art. 20 RODO.
// To wzór pisma, nie porada prawna. Danych klientów nie obejmuje.
// =====================================================================

export type ZakresEksportu = "uslugi" | "pracownicy" | "grafik" | "profil";

export const ZAKRES_EKSPORTU: { id: ZakresEksportu; opis: string }[] = [
  { id: "uslugi", opis: "listę usług z nazwami, cenami, czasem trwania i kategoriami" },
  { id: "pracownicy", opis: "listę pracowników (imiona) z przypisanymi usługami" },
  { id: "grafik", opis: "godziny pracy i grafik pracowników" },
  { id: "profil", opis: "opis firmy, logo i zdjęcia dodane przeze mnie do profilu, w oryginalnej rozdzielczości" },
];

export interface DaneWniosku {
  dostawca: string;
  nazwaFirmy: string;
  nip: string;
  adres: string;
  /** adres e-mail, na który założone jest konto u dostawcy */
  emailKonta: string;
  miejscowosc: string;
  data: Date;
  zakres: ZakresEksportu[];
  /** przedsiębiorca — osoba fizyczna (JDG): dodatkowo art. 20 RODO dla jej danych osobowych */
  osobaFizyczna: boolean;
  /** czy razem z eksportem wypowiada umowę (zmiana dostawcy) — domyślnie nie */
  wypowiadam: boolean;
}

const dataPelna = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" });

export function brakujacePolaWniosku(d: DaneWniosku): string[] {
  const braki: string[] = [];
  if (!d.dostawca.trim()) braki.push("dostawca");
  if (!d.nazwaFirmy.trim()) braki.push("nazwa firmy");
  if (!d.emailKonta.trim()) braki.push("e-mail konta");
  if (!d.zakres.length) braki.push("zakres danych");
  return braki;
}

export function wniosekOEksport(d: DaneWniosku): { temat: string; tresc: string } {
  const dostawca = d.dostawca.trim();
  const zakres = ZAKRES_EKSPORTU.filter((z) => d.zakres.includes(z.id)).map((z) => `  • ${z.opis};`);
  if (zakres.length) zakres[zakres.length - 1] = zakres[zakres.length - 1].replace(/;$/, ".");
  const naglowek = [d.nazwaFirmy.trim(), d.nip.trim() && `NIP ${d.nip.trim()}`, d.adres.trim(), d.emailKonta.trim() && `e-mail konta: ${d.emailKonta.trim()}`].filter(Boolean);

  const tresc = [
    `${d.miejscowosc.trim() || "…"}, ${dataPelna.format(d.data)}`,
    "",
    ...naglowek,
    "",
    `Do: ${dostawca} — obsługa klienta`,
    "",
    "Wniosek o eksport danych firmy w związku z przenoszeniem ich do innego dostawcy",
    "",
    `Jako klient usługi ${dostawca} (konto firmy powiązane z adresem ${d.emailKonta.trim() || "…"}) proszę o przekazanie danych mojej firmy ` +
      "przechowywanych w Państwa systemie, w ustrukturyzowanym, powszechnie używanym formacie nadającym się do odczytu maszynowego " +
      "(CSV albo XLSX; zdjęcia w ich oryginalnych formatach), obejmujących:",
    ...zakres,
    "",
    "Podstawa: rozporządzenie Parlamentu Europejskiego i Rady (UE) 2023/2854 w sprawie zharmonizowanych przepisów dotyczących " +
      "sprawiedliwego dostępu do danych i ich wykorzystywania (akt w sprawie danych), rozdział VI — w szczególności art. 23 i 25, " +
      "zgodnie z którymi dostawca usług przetwarzania danych umożliwia klientowi przeniesienie jego eksportowalnych danych do innego dostawcy.",
    ...(d.osobaFizyczna ? ["", "W zakresie moich danych osobowych wnoszę również o ich przekazanie na podstawie art. 20 RODO (prawo do przenoszenia danych)."] : []),
    "",
    "Wniosek nie obejmuje danych osobowych moich klientów.",
    d.wypowiadam
      ? "Po przekazaniu danych rezygnuję z usługi — proszę o potwierdzenie daty zakończenia umowy zgodnie z jej warunkami."
      : "Na tym etapie nie wypowiadam umowy — proszę o sam eksport danych.",
    "",
    "Proszę o przekazanie danych na adres e-mail konta, bez zbędnej zwłoki, nie później niż w ciągu 30 dni, " +
      "a jeśli eksport tych danych nie jest możliwy — o wskazanie przyczyny.",
    "",
    "Z poważaniem",
    "",
    d.nazwaFirmy.trim(),
  ].join("\n");

  return { temat: `Wniosek o eksport danych firmy — ${d.nazwaFirmy.trim() || "konto"}`, tresc };
}
