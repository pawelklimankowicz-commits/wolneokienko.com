import { adresKalendarza, pobierzZajetosc, zajetoscZIcs } from "./kalendarz-ics";

function kalendarz(...wydarzenia: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//PL", ...wydarzenia, "END:VCALENDAR", ""].join("\r\n");
}

function wydarzenie(...linie: string[]): string {
  return ["BEGIN:VEVENT", ...linie, "END:VEVENT"].join("\r\n");
}

function zakres(od: string, koniec: string) {
  return { od: new Date(od), do: new Date(koniec) };
}

const PAZDZIERNIK = zakres("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z");

describe("adresKalendarza", () => {
  it("przepuszcza znanych dostawców, webcal zamienia na https", () => {
    const google = "https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-123/basic.ics";
    expect(adresKalendarza(`  ${google}  `)).toEqual({ ok: true, url: google });
    expect(adresKalendarza("webcal://p57-caldav.icloud.com/published/2/abc")).toEqual({ ok: true, url: "https://p57-caldav.icloud.com/published/2/abc" });
    expect(adresKalendarza("https://p12-caldav.icloud.com/published/2/xyz").ok).toBe(true);
    expect(adresKalendarza("https://outlook.office365.com/owa/calendar/a@b.pl/c/calendar.ics").ok).toBe(true);
  });

  it("odrzuca http, dane logowania, port i śmieci", () => {
    expect(adresKalendarza("http://calendar.google.com/calendar/ical/x/basic.ics")).toEqual({ ok: false, powod: "zly_adres" });
    expect(adresKalendarza("https://jan:haslo@calendar.google.com/x.ics")).toEqual({ ok: false, powod: "zly_adres" });
    expect(adresKalendarza("https://calendar.google.com:8443/x.ics")).toEqual({ ok: false, powod: "zly_adres" });
    expect(adresKalendarza("mój kalendarz")).toEqual({ ok: false, powod: "zly_adres" });
  });

  it("odrzuca adresy IP i obce hosty (SSRF)", () => {
    for (const adres of [
      "https://127.0.0.1/x.ics",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/x.ics",
      "https://evil.com/x.ics",
      "https://calendar.google.com.evil.com/x.ics",
      "https://icloud.com.evil.com/x.ics",
      "https://evilicloud.com/x.ics",
    ]) {
      expect(adresKalendarza(adres)).toEqual({ ok: false, powod: "niedozwolony_host" });
    }
  });
});

describe("zajetoscZIcs", () => {
  it("wydarzenie w UTC", () => {
    const ics = kalendarz(wydarzenie("UID:a", "DTSTART:20261001T100000Z", "DTEND:20261001T113000Z"));
    expect(zajetoscZIcs(ics, PAZDZIERNIK)).toEqual([{ od: "2026-10-01T10:00:00.000Z", do: "2026-10-01T11:30:00.000Z" }]);
  });

  it("TZID=Europe/Warsaw: latem +2, zimą +1; godzina pływająca i nazwa windowsowa też po polsku", () => {
    const lato = kalendarz(wydarzenie("DTSTART;TZID=Europe/Warsaw:20260715T120000", "DTEND;TZID=Europe/Warsaw:20260715T130000"));
    expect(zajetoscZIcs(lato, zakres("2026-07-15T00:00:00Z", "2026-07-16T00:00:00Z"))).toEqual([
      { od: "2026-07-15T10:00:00.000Z", do: "2026-07-15T11:00:00.000Z" },
    ]);
    const zima = kalendarz(wydarzenie('DTSTART;TZID="Europe/Warsaw":20261215T120000', "DTEND;TZID=Europe/Warsaw:20261215T130000"));
    const grudzien = zakres("2026-12-15T00:00:00Z", "2026-12-16T00:00:00Z");
    expect(zajetoscZIcs(zima, grudzien)).toEqual([{ od: "2026-12-15T11:00:00.000Z", do: "2026-12-15T12:00:00.000Z" }]);
    const plywajaca = kalendarz(wydarzenie("DTSTART:20261215T120000", "DTEND:20261215T130000"));
    expect(zajetoscZIcs(plywajaca, grudzien)).toEqual(zajetoscZIcs(zima, grudzien));
    const outlook = kalendarz(
      wydarzenie("DTSTART;TZID=Central European Standard Time:20261215T120000", "DTEND;TZID=Central European Standard Time:20261215T130000"),
    );
    expect(zajetoscZIcs(outlook, grudzien)).toEqual(zajetoscZIcs(zima, grudzien));
  });

  it("wydarzenie całodniowe blokuje dobę od polskiej północy", () => {
    const jeden = kalendarz(wydarzenie("DTSTART;VALUE=DATE:20261001"));
    expect(zajetoscZIcs(jeden, PAZDZIERNIK)).toEqual([{ od: "2026-10-01T00:00:00.000Z", do: "2026-10-01T22:00:00.000Z" }]);
    const dwa = kalendarz(wydarzenie("DTSTART;VALUE=DATE:20261014", "DTEND;VALUE=DATE:20261016"));
    expect(zajetoscZIcs(dwa, PAZDZIERNIK)).toEqual([{ od: "2026-10-13T22:00:00.000Z", do: "2026-10-15T22:00:00.000Z" }]);
    const zima = kalendarz(wydarzenie("DTSTART;VALUE=DATE:20261215"));
    expect(zajetoscZIcs(zima, zakres("2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"))).toEqual([
      { od: "2026-12-14T23:00:00.000Z", do: "2026-12-15T23:00:00.000Z" },
    ]);
  });

  it("DURATION: godziny, minuty, dni po kalendarzu (doba przez zmianę czasu ma 25 h)", () => {
    const ics = kalendarz(
      wydarzenie("DTSTART:20261002T100000Z", "DURATION:PT1H30M"),
      wydarzenie("DTSTART:20261003T100000Z", "DURATION:PT45M"),
      wydarzenie("DTSTART;TZID=Europe/Warsaw:20261024T120000", "DURATION:P1D"),
      wydarzenie("DTSTART:20261028T100000Z", "DURATION:P1DT2H"),
    );
    expect(zajetoscZIcs(ics, PAZDZIERNIK)).toEqual([
      { od: "2026-10-02T10:00:00.000Z", do: "2026-10-02T11:30:00.000Z" },
      { od: "2026-10-03T10:00:00.000Z", do: "2026-10-03T10:45:00.000Z" },
      { od: "2026-10-24T10:00:00.000Z", do: "2026-10-25T11:00:00.000Z" },
      { od: "2026-10-28T10:00:00.000Z", do: "2026-10-29T12:00:00.000Z" },
    ]);
  });

  it("rozwija zawinięte linie (CRLF i LF)", () => {
    const crlf = kalendarz(wydarzenie("DTSTART;TZID=Europe/War\r\n saw:20261001T12\r\n\t0000", "DTEND;TZID=Europe/Warsaw:20261001T130000"));
    const lf = crlf.replace(/\r\n/g, "\n");
    const oczekiwane = [{ od: "2026-10-01T10:00:00.000Z", do: "2026-10-01T11:00:00.000Z" }];
    expect(zajetoscZIcs(crlf, PAZDZIERNIK)).toEqual(oczekiwane);
    expect(zajetoscZIcs(lf, PAZDZIERNIK)).toEqual(oczekiwane);
  });

  it("pomija odwołane i „wolne” (TRANSP:TRANSPARENT), zadania i alarmy", () => {
    const ics = kalendarz(
      wydarzenie("DTSTART:20261001T100000Z", "DTEND:20261001T110000Z", "STATUS:CANCELLED"),
      wydarzenie("DTSTART:20261002T100000Z", "DTEND:20261002T110000Z", "TRANSP:TRANSPARENT"),
      ["BEGIN:VTODO", "DTSTART:20261003T100000Z", "DUE:20261003T110000Z", "END:VTODO"].join("\r\n"),
      // DURATION alarmu nie jest czasem trwania wydarzenia; DTEND po alarmie nadal należy do wydarzenia
      wydarzenie("DTSTART:20261004T100000Z", "BEGIN:VALARM", "TRIGGER:-PT15M", "DURATION:PT5M", "REPEAT:2", "ACTION:DISPLAY", "END:VALARM", "DTEND:20261004T120000Z"),
    );
    expect(zajetoscZIcs(ics, PAZDZIERNIK)).toEqual([{ od: "2026-10-04T10:00:00.000Z", do: "2026-10-04T12:00:00.000Z" }]);
  });

  it("co tydzień (BYDAY, COUNT) przez zmianę czasu 25.10: zostaje 9:00 w Warszawie", () => {
    const ics = kalendarz(
      wydarzenie(
        "UID:joga",
        "DTSTART;TZID=Europe/Warsaw:20261019T090000",
        "DTEND;TZID=Europe/Warsaw:20261019T100000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,TH;COUNT=4",
      ),
    );
    expect(zajetoscZIcs(ics, zakres("2026-10-18T00:00:00Z", "2026-12-01T00:00:00Z"))).toEqual([
      { od: "2026-10-19T07:00:00.000Z", do: "2026-10-19T08:00:00.000Z" },
      { od: "2026-10-22T07:00:00.000Z", do: "2026-10-22T08:00:00.000Z" },
      { od: "2026-10-26T08:00:00.000Z", do: "2026-10-26T09:00:00.000Z" },
      { od: "2026-10-29T08:00:00.000Z", do: "2026-10-29T09:00:00.000Z" },
    ]);
  });

  it("UNTIL włącznie, miesięcznie pomija brakujące dni, stara codzienna seria dociera do dziś", () => {
    const tygodniowo = kalendarz(
      wydarzenie("DTSTART;TZID=Europe/Warsaw:20261005T090000", "DURATION:PT1H", "RRULE:FREQ=WEEKLY;UNTIL=20261019T070000Z"),
    );
    expect(zajetoscZIcs(tygodniowo, PAZDZIERNIK).map((p) => p.od)).toEqual(["2026-10-05T07:00:00.000Z", "2026-10-12T07:00:00.000Z", "2026-10-19T07:00:00.000Z"]);
    const miesiecznie = kalendarz(wydarzenie("DTSTART:20260131T100000Z", "DURATION:PT1H", "RRULE:FREQ=MONTHLY;COUNT=3"));
    expect(zajetoscZIcs(miesiecznie, zakres("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z")).map((p) => p.od)).toEqual([
      "2026-01-31T10:00:00.000Z",
      "2026-03-31T10:00:00.000Z",
      "2026-05-31T10:00:00.000Z",
    ]);
    const odLat = kalendarz(wydarzenie("DTSTART;TZID=Europe/Warsaw:20150101T120000", "DURATION:PT1H", "RRULE:FREQ=DAILY"));
    expect(zajetoscZIcs(odLat, zakres("2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"))).toEqual([
      { od: "2026-10-01T10:00:00.000Z", do: "2026-10-01T11:00:00.000Z" },
    ]);
  });

  it("EXDATE: kilka linii, wiele wartości po przecinku, strefa albo UTC", () => {
    const ics = kalendarz(
      wydarzenie(
        "DTSTART;TZID=Europe/Warsaw:20261005T090000",
        "DTEND;TZID=Europe/Warsaw:20261005T093000",
        "RRULE:FREQ=DAILY;COUNT=5",
        "EXDATE;TZID=Europe/Warsaw:20261006T090000,20261008T090000",
        "EXDATE:20261009T070000Z",
      ),
    );
    expect(zajetoscZIcs(ics, PAZDZIERNIK)).toEqual([
      { od: "2026-10-05T07:00:00.000Z", do: "2026-10-05T07:30:00.000Z" },
      { od: "2026-10-07T07:00:00.000Z", do: "2026-10-07T07:30:00.000Z" },
    ]);
  });

  it("RECURRENCE-ID przenosi jedno wystąpienie serii, odwołane tylko je usuwa", () => {
    const seria = wydarzenie(
      "UID:seria-1",
      "DTSTART;TZID=Europe/Warsaw:20261005T090000",
      "DTEND;TZID=Europe/Warsaw:20261005T100000",
      "RRULE:FREQ=WEEKLY;COUNT=3",
    );
    const przeniesione = wydarzenie(
      "UID:seria-1",
      "RECURRENCE-ID;TZID=Europe/Warsaw:20261012T090000",
      "DTSTART;TZID=Europe/Warsaw:20261013T150000",
      "DTEND;TZID=Europe/Warsaw:20261013T160000",
    );
    const odwolane = wydarzenie("UID:seria-1", "RECURRENCE-ID:20261019T070000Z", "DTSTART:20261019T070000Z", "DTEND:20261019T080000Z", "STATUS:CANCELLED");
    // zmiany stoją w pliku przed serią — kolejność nie ma znaczenia
    expect(zajetoscZIcs(kalendarz(przeniesione, odwolane, seria), PAZDZIERNIK)).toEqual([
      { od: "2026-10-05T07:00:00.000Z", do: "2026-10-05T08:00:00.000Z" },
      { od: "2026-10-13T13:00:00.000Z", do: "2026-10-13T14:00:00.000Z" },
    ]);
  });

  it("scala nakładające się i stykające przedziały, przycina do zakresu", () => {
    const ics = kalendarz(
      wydarzenie("DTSTART:20261001T080000Z", "DTEND:20261001T110000Z"),
      wydarzenie("DTSTART:20261001T103000Z", "DTEND:20261001T120000Z"),
      wydarzenie("DTSTART:20261001T120000Z", "DTEND:20261001T123000Z"),
      wydarzenie("DTSTART:20261001T140000Z", "DTEND:20261001T150000Z"),
      wydarzenie("DTSTART:20261002T140000Z", "DTEND:20261002T150000Z"),
    );
    expect(zajetoscZIcs(ics, zakres("2026-10-01T09:00:00Z", "2026-10-01T14:30:00Z"))).toEqual([
      { od: "2026-10-01T09:00:00.000Z", do: "2026-10-01T12:30:00.000Z" },
      { od: "2026-10-01T14:00:00.000Z", do: "2026-10-01T14:30:00.000Z" },
    ]);
  });

  it("nie wynosi treści wydarzeń — tylko od i do", () => {
    const ics = kalendarz(
      wydarzenie(
        "UID:tajne-1",
        "SUMMARY:Koloryzacja Pani Kowalskiej",
        "DESCRIPTION:tel. 600 100 200",
        "LOCATION:Gabinet 2",
        "ATTENDEE;CN=Anna Kowalska:mailto:anna@example.com",
        "DTSTART:20261001T100000Z",
        "DTEND:20261001T110000Z",
      ),
    );
    const wynik = zajetoscZIcs(ics, PAZDZIERNIK);
    expect(wynik).toHaveLength(1);
    expect(Object.keys(wynik[0]).sort()).toEqual(["do", "od"]);
    const json = JSON.stringify(wynik);
    for (const tajne of ["Kowalsk", "Koloryzacja", "600", "Gabinet", "example.com", "tajne-1"]) expect(json).not.toContain(tajne);
  });
});

describe("pobierzZajetosc", () => {
  const ADRES = "https://calendar.google.com/calendar/ical/x/private-1/basic.ics";
  const ICS = kalendarz(wydarzenie("SUMMARY:Strzyżenie", "DTSTART:20261001T100000Z", "DTEND:20261001T110000Z"));

  function atrapa(odpowiedz: (url: string, proba: number) => Response | Promise<Response>) {
    const wywolania: { url: string; init?: RequestInit }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      wywolania.push({ url, init });
      return odpowiedz(url, wywolania.length);
    }) as unknown as typeof fetch;
    return { f, wywolania };
  }

  it("pobiera kalendarz i zwraca zajętość; nagłówki i ręczne przekierowania", async () => {
    const { f, wywolania } = atrapa(() => new Response(ICS, { status: 200, headers: { "Content-Type": "text/calendar" } }));
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: f })).toEqual({
      ok: true,
      zajete: [{ od: "2026-10-01T10:00:00.000Z", do: "2026-10-01T11:00:00.000Z" }],
    });
    const init = wywolania[0].init!;
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init.headers).get("Accept")).toBe("text/calendar");
    expect(new Headers(init.headers).get("User-Agent")).toBe("WolneOkienko/1.0 (kontakt: wolneokienko.com)");
  });

  it("zły adres nie wychodzi do sieci", async () => {
    const { f, wywolania } = atrapa(() => new Response(ICS));
    expect(await pobierzZajetosc("https://10.0.0.1/x.ics", PAZDZIERNIK, { fetch: f })).toEqual({ ok: false, powod: "niedozwolony_host" });
    expect(wywolania).toHaveLength(0);
  });

  it("idzie za przekierowaniem na dozwolony host (także względnym)", async () => {
    const { f, wywolania } = atrapa((_, proba) => {
      if (proba === 1) return new Response(null, { status: 302, headers: { Location: "webcal://p12-caldav.icloud.com/published/2/abc" } });
      if (proba === 2) return new Response(null, { status: 301, headers: { Location: "/published/2/nowy" } });
      return new Response(ICS);
    });
    const wynik = await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: f });
    expect(wynik.ok).toBe(true);
    expect(wywolania.map((w) => w.url)).toEqual([ADRES, "https://p12-caldav.icloud.com/published/2/abc", "https://p12-caldav.icloud.com/published/2/nowy"]);
  });

  it("przekierowanie na obcy host albo IP: niedozwolony_host, bez zapytania tam", async () => {
    const { f, wywolania } = atrapa(() => new Response(null, { status: 302, headers: { Location: "https://169.254.169.254/latest/meta-data" } }));
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: f })).toEqual({ ok: false, powod: "niedozwolony_host" });
    expect(wywolania).toHaveLength(1);
  });

  it("najwyżej 3 przekierowania", async () => {
    const { f, wywolania } = atrapa(() => new Response(null, { status: 302, headers: { Location: ADRES } }));
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: f })).toEqual({ ok: false, powod: "nie_odpowiada" });
    expect(wywolania).toHaveLength(4);
  });

  it("błąd serwera albo sieci: nie_odpowiada", async () => {
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: atrapa(() => new Response("błąd", { status: 500 })).f })).toEqual({
      ok: false,
      powod: "nie_odpowiada",
    });
    const zerwane = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: zerwane })).toEqual({ ok: false, powod: "nie_odpowiada" });
  });

  it("strona HTML zamiast kalendarza: nie_kalendarz", async () => {
    const { f } = atrapa(() => new Response("<!doctype html><title>Zaloguj się</title>", { headers: { "Content-Type": "text/html" } }));
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: f })).toEqual({ ok: false, powod: "nie_kalendarz" });
  });

  it("za duży: po nagłówku Content-Length albo liczony w trakcie czytania", async () => {
    const zNaglowkiem = atrapa(() => new Response(ICS, { headers: { "Content-Length": "999999999" } }));
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: zNaglowkiem.f })).toEqual({ ok: false, powod: "za_duzy" });

    let wyslane = 0;
    const bezKonca = new ReadableStream<Uint8Array>({
      pull(k) {
        wyslane += 1024;
        k.enqueue(new TextEncoder().encode("BEGIN:VCALENDAR\r\n".padEnd(1024, "X")));
      },
    });
    const strumien = atrapa(() => new Response(bezKonca));
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: strumien.f, limitBajtow: 10_000 })).toEqual({ ok: false, powod: "za_duzy" });
    expect(wyslane).toBeLessThan(20_000);
  });

  it("limit czasu: przerywa zapytanie przez AbortSignal", async () => {
    let przerwane = false;
    const wisi = ((_: string, init?: RequestInit) =>
      new Promise<Response>((_ok, blad) => {
        init?.signal?.addEventListener("abort", () => {
          przerwane = true;
          blad(new DOMException("przerwane", "AbortError"));
        });
      })) as unknown as typeof fetch;
    const start = Date.now();
    expect(await pobierzZajetosc(ADRES, PAZDZIERNIK, { fetch: wisi, limitMs: 30 })).toEqual({ ok: false, powod: "nie_odpowiada" });
    expect(przerwane).toBe(true);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
