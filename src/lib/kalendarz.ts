// Plik .ics z wizytą — „Dodaj do kalendarza” działa w każdym telefonie i komputerze.
const ics = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const tekst = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

export function plikIcs(w: { id: string; tytul: string; adres: string; termin: Date; czasMin: number; opis: string }): string {
  const koniec = new Date(w.termin.getTime() + w.czasMin * 60 * 1000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wolne Okienko//PL",
    "BEGIN:VEVENT",
    `UID:${w.id}@wolneokienko.com`,
    `DTSTAMP:${ics(new Date())}`,
    `DTSTART:${ics(w.termin)}`,
    `DTEND:${ics(koniec)}`,
    `SUMMARY:${tekst(w.tytul)}`,
    `LOCATION:${tekst(w.adres)}`,
    `DESCRIPTION:${tekst(w.opis)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Wizyta za godzinę",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function pobierzIcs(nazwaPliku: string, tresc: string) {
  const url = URL.createObjectURL(new Blob([tresc], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nazwaPliku;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
