// =====================================================================
// Zajętość salonu z jego własnego kalendarza: tajny adres iCal z Google,
// Outlooka albo iCloud. Czytamy go tylko po to, żeby propozycje godzin
// „jednym dotknięciem” omijały zajęte terminy.
// Prywatność: z kalendarza wychodzą wyłącznie przedziały „zajęte”. Tytułów,
// opisów, miejsc i uczestników nie zwracamy ani nie zapisujemy — parser
// w ogóle ich nie rozbiera.
// =====================================================================

export interface Przedzial {
  /** ISO 8601, UTC */
  od: string;
  do: string;
}

interface Zakres {
  od: Date;
  do: Date;
}

type BladAdresu = "zly_adres" | "niedozwolony_host";
type WynikPobrania = { ok: true; zajete: Przedzial[] } | { ok: false; powod: BladAdresu | "nie_odpowiada" | "nie_kalendarz" | "za_duzy" };

const DZIEN_MS = 24 * 60 * 60 * 1000;
const STREFA_DOMYSLNA = "Europe/Warsaw";
const LIMIT_ITERACJI = 2000; // na jedno wydarzenie cykliczne
const LIMIT_PRZEDZIALOW = 500;
const LIMIT_PRZEKIEROWAN = 3;
const AGENT = "WolneOkienko/1.0 (kontakt: wolneokienko.com)";

// ---------- adres ----------

// Adres wpisuje salon, więc serwer pyta tylko znanych dostawców kalendarzy —
// inaczej dałby się namówić na zapytania w głąb sieci (SSRF).
const DOZWOLONE_HOSTY = new Set(["calendar.google.com", "outlook.office365.com", "outlook.live.com", "outlook.office.com"]);

export function adresKalendarza(wpisany: string): { ok: true; url: string } | { ok: false; powod: BladAdresu } {
  let url: URL;
  try {
    url = new URL(wpisany.trim().replace(/^webcal:\/\//i, "https://"));
  } catch {
    return { ok: false, powod: "zly_adres" };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return { ok: false, powod: "zly_adres" };
  const host = url.hostname.toLowerCase();
  // IPv4 (URL sprowadza „0x7f.1” do „127.0.0.1”) albo IPv6 w nawiasach
  const ip = /^[\d.]+$/.test(host) || host.startsWith("[");
  if (ip || !(DOZWOLONE_HOSTY.has(host) || host.endsWith(".icloud.com"))) return { ok: false, powod: "niedozwolony_host" };
  url.hash = "";
  return { ok: true, url: url.href };
}

// ---------- czas w strefach ----------

/** Data z pliku. `lokalny` to godzina ścienna zapisana jak UTC (Date.UTC) — bez strefy. */
interface Czas {
  lokalny: number;
  strefa: string; // nazwa IANA albo "UTC"
  caly: boolean; // cały dzień (VALUE=DATE)
}

/** Dni i godziny osobno: doba po kalendarzu ma 23–25 h, godzina zawsze 60 min. */
interface Trwanie {
  dni: number;
  ms: number;
}

// Outlook potrafi podać strefę po windowsowemu
const STREFY_WINDOWS: Record<string, string> = {
  "central european standard time": "Europe/Warsaw",
  "central europe standard time": "Europe/Warsaw",
  "w. europe standard time": "Europe/Berlin",
  "romance standard time": "Europe/Paris",
  "gmt standard time": "Europe/London",
};

const formatery = new Map<string, Intl.DateTimeFormat | null>();

function formater(strefa: string): Intl.DateTimeFormat | null {
  if (!formatery.has(strefa)) {
    if (formatery.size > 200) formatery.clear();
    let f: Intl.DateTimeFormat | null = null;
    try {
      const pola = { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" } as const;
      f = new Intl.DateTimeFormat("en-US", { timeZone: strefa, hourCycle: "h23", ...pola });
    } catch {
      f = null; // strefa nieznana
    }
    formatery.set(strefa, f);
  }
  return formatery.get(strefa) ?? null;
}

function strefaIana(tzid: string | undefined): string {
  if (!tzid) return STREFA_DOMYSLNA;
  const t = tzid.trim();
  if (formater(t)) return t;
  // „/citadel.org/20190914_1/Europe/Warsaw” — przedrostek generatora przed nazwą IANA
  const koncowka = /[A-Za-z_]+\/[A-Za-z_]+$/.exec(t)?.[0];
  if (koncowka && formater(koncowka)) return koncowka;
  return STREFY_WINDOWS[t.toLowerCase()] ?? STREFA_DOMYSLNA;
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** O ile godzina ścienna w strefie wyprzedza UTC w danej chwili (ms). */
function przesuniecie(utc: number, strefa: string): number {
  const f = strefa === "UTC" ? null : formater(strefa);
  if (!f) return 0;
  const c: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(utc))) c[p.type] = Number(p.value);
  return Date.UTC(c.year, c.month - 1, c.day, c.hour % 24, c.minute, c.second) - (utc - mod(utc, 1000));
}

/** Godzina ścienna w strefie → chwila UTC. Zgadujemy i raz poprawiamy (przejścia czasu letniego). */
function naUtc(lokalny: number, strefa: string): number {
  if (strefa === "UTC") return lokalny;
  const zgadniete = lokalny - przesuniecie(lokalny, strefa);
  return lokalny - przesuniecie(zgadniete, strefa);
}

function czytajCzas(wartosc: string, tzid: string | undefined): Czas | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(wartosc.trim());
  if (!m) return null;
  const [, r, mies, d, g, min, s, z] = m;
  const lokalny = Date.UTC(+r, +mies - 1, +d, +(g ?? 0), +(min ?? 0), +(s ?? 0));
  // bez strefy („pływająca” godzina) liczymy po polsku
  return { lokalny, strefa: z ? "UTC" : strefaIana(tzid), caly: g === undefined };
}

function czytajTrwanie(wartosc: string): Trwanie | null {
  const m = /^\+?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(wartosc.trim());
  if (!m) return null;
  const n = (i: number) => Number(m[i] ?? 0);
  return { dni: n(1) * 7 + n(2), ms: ((n(3) * 60 + n(4)) * 60 + n(5)) * 1000 };
}

// ---------- rozbiór pliku ----------

interface Wydarzenie {
  uid: string;
  start?: Czas;
  koniec?: Czas;
  trwanie?: Trwanie;
  regula?: string;
  wyjatki: Czas[]; // EXDATE
  zastepuje?: Czas; // RECURRENCE-ID: zmienione pojedyncze wystąpienie serii
  wolne: boolean; // odwołane albo oznaczone jako „wolny” (TRANSP:TRANSPARENT)
}

// Tylko te właściwości czytamy — reszta linii (SUMMARY, DESCRIPTION, ATTENDEE…) jest pomijana bez rozbioru
const POTRZEBNE = /^(BEGIN|END|UID|DTSTART|DTEND|DURATION|RRULE|EXDATE|RECURRENCE-ID|STATUS|TRANSP)[;:]/i;

function rozbierzLinie(linia: string): { nazwa: string; parametry: Record<string, string>; wartosc: string } | null {
  let cudzyslow = false; // dwukropek w TZID="…" nie kończy parametrów
  for (let i = 0; i < linia.length; i++) {
    if (linia[i] === '"') cudzyslow = !cudzyslow;
    else if (linia[i] === ":" && !cudzyslow) {
      const [nazwa, ...czesci] = linia.slice(0, i).split(";");
      const parametry: Record<string, string> = {};
      for (const c of czesci) {
        const r = c.indexOf("=");
        if (r > 0) parametry[c.slice(0, r).toUpperCase()] = c.slice(r + 1).replace(/^"(.*)"$/, "$1");
      }
      return { nazwa: nazwa.toUpperCase(), parametry, wartosc: linia.slice(i + 1).trim() };
    }
  }
  return null;
}

function wydarzenia(ics: string): Wydarzenie[] {
  // linie zawinięte: znak nowej linii + spacja/tabulator to ciąg dalszy poprzedniej
  const linie = ics.replace(/(?:\r\n|\n|\r)[ \t]/g, "").split(/\r\n|\n|\r/);
  const wynik: Wydarzenie[] = [];
  let w: Wydarzenie | null = null;
  let glebiej = 0; // komponenty wewnątrz VEVENT (VALARM) — ich właściwości nie należą do wydarzenia
  for (const surowa of linie) {
    if (!POTRZEBNE.test(surowa)) continue;
    const l = rozbierzLinie(surowa);
    if (!l) continue;
    const { nazwa, parametry, wartosc } = l;
    if (nazwa === "BEGIN") {
      if (w) glebiej++;
      else if (wartosc.toUpperCase() === "VEVENT") w = { uid: "", wyjatki: [], wolne: false };
    } else if (nazwa === "END") {
      if (w && glebiej > 0) glebiej--;
      else if (w && wartosc.toUpperCase() === "VEVENT") {
        wynik.push(w);
        w = null;
      }
    } else if (w && glebiej === 0) {
      if (nazwa === "UID") w.uid = wartosc;
      else if (nazwa === "DTSTART") w.start = czytajCzas(wartosc, parametry.TZID) ?? undefined;
      else if (nazwa === "DTEND") w.koniec = czytajCzas(wartosc, parametry.TZID) ?? undefined;
      else if (nazwa === "DURATION") w.trwanie = czytajTrwanie(wartosc) ?? undefined;
      else if (nazwa === "RRULE") w.regula = wartosc;
      else if (nazwa === "RECURRENCE-ID") w.zastepuje = czytajCzas(wartosc, parametry.TZID) ?? undefined;
      else if (nazwa === "STATUS" && wartosc.toUpperCase() === "CANCELLED") w.wolne = true;
      else if (nazwa === "TRANSP" && wartosc.toUpperCase() === "TRANSPARENT") w.wolne = true;
      else if (nazwa === "EXDATE") {
        for (const v of wartosc.split(",")) {
          const c = czytajCzas(v, parametry.TZID);
          if (c) w.wyjatki.push(c);
        }
      }
    }
  }
  return wynik;
}

// ---------- powtórzenia (RRULE) ----------

const DNI_TYGODNIA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]; // indeks = getUTCDay()

interface Regula {
  czestosc: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  co: number;
  ile?: number;
  doLokalnie?: number; // UNTIL jako godzina ścienna strefy DTSTART
  dni?: number[];
  poczatekTygodnia: number;
}

/** null = reguła, której nie rozwijamy — zostaje samo pierwsze wystąpienie. */
function czytajRegule(tekst: string, start: Czas): Regula | null {
  const p: Record<string, string> = {};
  for (const c of tekst.split(";")) {
    const [k, v] = c.split("=");
    if (k && v !== undefined) p[k.trim().toUpperCase()] = v.trim().toUpperCase();
  }
  const czestosc = p.FREQ;
  if (czestosc !== "DAILY" && czestosc !== "WEEKLY" && czestosc !== "MONTHLY" && czestosc !== "YEARLY") return null;
  const nieobslugiwane = ["BYMONTHDAY", "BYSETPOS", "BYMONTH", "BYYEARDAY", "BYWEEKNO", "BYHOUR", "BYMINUTE", "BYSECOND"];
  if (nieobslugiwane.some((k) => k in p) || (p.BYDAY && czestosc !== "WEEKLY")) return null;
  const dni = p.BYDAY?.split(",").map((d) => DNI_TYGODNIA.indexOf(d.trim()));
  if (dni?.some((d) => d < 0)) return null; // np. „1MO” — z numerem tylko w regułach miesięcznych
  const regula: Regula = { czestosc, co: Math.max(1, parseInt(p.INTERVAL ?? "1", 10) || 1), dni, poczatekTygodnia: 1 };
  if (p.WKST && DNI_TYGODNIA.includes(p.WKST)) regula.poczatekTygodnia = DNI_TYGODNIA.indexOf(p.WKST);
  if (p.COUNT) regula.ile = Math.max(0, parseInt(p.COUNT, 10) || 0);
  const u = p.UNTIL ? czytajCzas(p.UNTIL, start.strefa) : null;
  if (u) {
    // sama data w UNTIL obejmuje cały ten dzień
    const utc = naUtc(u.lokalny + (u.caly ? DZIEN_MS - 1 : 0), u.strefa);
    regula.doLokalnie = utc + przesuniecie(utc, start.strefa);
  }
  return regula;
}

/**
 * Początki wystąpień (godzina ścienna strefy DTSTART) w lokalnym oknie [odL, doL].
 * Rozwijamy po godzinie ściennej, więc zmiana czasu nie przesuwa „9:00 w poniedziałki”.
 */
function poczatki(start: Czas, regula: Regula | null, odL: number, doL: number): number[] {
  const L0 = start.lokalny;
  if (!regula) return [L0];
  const pora = mod(L0, DZIEN_MS);
  const dzien0 = L0 - pora;
  const dzienTygodnia = (t: number) => new Date(t).getUTCDay();
  let okres: (p: number) => number[];
  let baza = dzien0;
  let dlugosc = 0; // ms okresu; 0 = miesiące, bez przeskoku
  if (regula.czestosc === "DAILY") {
    dlugosc = regula.co * DZIEN_MS;
    okres = (p) => [dzien0 + p * dlugosc + pora];
  } else if (regula.czestosc === "WEEKLY") {
    const pt = regula.poczatekTygodnia;
    baza = dzien0 - mod(dzienTygodnia(dzien0) - pt, 7) * DZIEN_MS;
    dlugosc = regula.co * 7 * DZIEN_MS;
    const przesuniecia = [...new Set((regula.dni ?? [dzienTygodnia(dzien0)]).map((d) => mod(d - pt, 7)))].sort((a, b) => a - b);
    okres = (p) => przesuniecia.map((o) => baza + p * dlugosc + o * DZIEN_MS + pora);
  } else {
    const miesiace = regula.czestosc === "YEARLY" ? regula.co * 12 : regula.co;
    const d0 = new Date(dzien0);
    okres = (p) => {
      const t = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + p * miesiace, d0.getUTCDate());
      // 31. w miesiącu, który ma 30 dni — takiego wystąpienia nie ma (RFC 5545)
      return new Date(t).getUTCDate() === d0.getUTCDate() ? [t + pora] : [];
    };
  }
  // stara seria bez końca: przeskok do okolic zakresu, żeby limit iteracji nie skończył się przed nim
  let p = dlugosc ? Math.max(0, Math.floor((odL - baza) / dlugosc) - 1) : 0;
  let n = p === 0 ? 0 : okres(0).filter((L) => L >= L0).length + (p - 1) * okres(1).length;
  const wynik: number[] = [];
  for (let i = 0; i < LIMIT_ITERACJI; i++, p++) {
    for (const L of okres(p)) {
      if (L < L0) continue;
      if ((regula.ile !== undefined && n >= regula.ile) || (regula.doLokalnie !== undefined && L > regula.doLokalnie) || L > doL) return wynik;
      n++;
      if (L >= odL) wynik.push(L);
    }
  }
  return wynik;
}

// ---------- zajętość ----------

function trwanieWydarzenia(w: Wydarzenie, start: Czas): Trwanie {
  if (w.koniec && start.caly) return { dni: Math.max(1, Math.round((w.koniec.lokalny - start.lokalny) / DZIEN_MS)), ms: 0 };
  if (w.koniec) return { dni: 0, ms: naUtc(w.koniec.lokalny, w.koniec.strefa) - naUtc(start.lokalny, start.strefa) };
  if (w.trwanie) return w.trwanie;
  // bez końca: cały dzień trwa dobę, godzina bez końca nie zajmuje nic
  return { dni: start.caly ? 1 : 0, ms: 0 };
}

function scal(przedzialy: [number, number][]): Przedzial[] {
  przedzialy.sort((a, b) => a[0] - b[0]);
  const wynik: [number, number][] = [];
  for (const [od, koniec] of przedzialy) {
    const ostatni = wynik[wynik.length - 1];
    if (ostatni && od <= ostatni[1]) ostatni[1] = Math.max(ostatni[1], koniec);
    else if (wynik.length >= LIMIT_PRZEDZIALOW) break;
    else wynik.push([od, koniec]);
  }
  return wynik.map(([od, koniec]) => ({ od: new Date(od).toISOString(), do: new Date(koniec).toISOString() }));
}

/** Zajęte przedziały z pliku iCalendar (RFC 5545), przycięte do zakresu, posortowane i scalone. */
export function zajetoscZIcs(ics: string, zakres: Zakres): Przedzial[] {
  const odZ = zakres.od.getTime();
  const doZ = zakres.do.getTime();
  if (!(doZ > odZ)) return [];
  const lista = wydarzenia(ics);
  // RECURRENCE-ID: to wystąpienie serii zostało przeniesione albo odwołane
  const zastapione = new Map<string, number[]>();
  for (const w of lista) {
    if (w.zastepuje) zastapione.set(w.uid, [...(zastapione.get(w.uid) ?? []), naUtc(w.zastepuje.lokalny, w.zastepuje.strefa)]);
  }
  const przedzialy: [number, number][] = [];
  for (const w of lista) {
    const start = w.start;
    if (!start || w.wolne) continue;
    const t = trwanieWydarzenia(w, start);
    const regula = w.regula && !w.zastepuje ? czytajRegule(w.regula, start) : null;
    const pomin = new Set(w.zastepuje ? [] : [...w.wyjatki.map((c) => naUtc(c.lokalny, c.strefa)), ...(zastapione.get(w.uid) ?? [])]);
    // okno lokalne z zapasem: strefy to najwyżej ±14 h, dłuższe wydarzenia zaczynają się wcześniej
    const zapas = 2 * DZIEN_MS;
    for (const L of poczatki(start, regula, odZ - t.dni * DZIEN_MS - t.ms - zapas, doZ + zapas)) {
      const od = naUtc(L, start.strefa);
      const koniec = naUtc(L + t.dni * DZIEN_MS, start.strefa) + t.ms;
      if (koniec <= od || pomin.has(od)) continue;
      if (od < doZ && koniec > odZ) przedzialy.push([Math.max(od, odZ), Math.min(koniec, doZ)]);
    }
  }
  return scal(przedzialy);
}

// ---------- pobieranie ----------

async function czytajDoLimitu(odp: Response, limit: number, naCzas: <T>(p: Promise<T>) => Promise<T>): Promise<string | null> {
  if (!odp.body) return "";
  const czytnik = odp.body.getReader();
  const dekoder = new TextDecoder();
  let bajty = 0;
  let tekst = "";
  for (;;) {
    const { done, value } = await naCzas(czytnik.read());
    if (done) return tekst + dekoder.decode();
    bajty += value.byteLength;
    if (bajty > limit) {
      czytnik.cancel().catch(() => undefined);
      return null;
    }
    tekst += dekoder.decode(value, { stream: true });
  }
}

function porzuc(odp: Response): void {
  odp.body?.cancel().catch(() => undefined);
}

/** Pobiera kalendarz spod adresu salonu i zwraca same zajęte przedziały w zakresie. */
export async function pobierzZajetosc(
  url: string,
  zakres: Zakres,
  opcje: { fetch?: typeof fetch; limitBajtow?: number; limitMs?: number } = {},
): Promise<WynikPobrania> {
  const adres = adresKalendarza(url);
  if (!adres.ok) return adres;
  const pobierz = opcje.fetch ?? fetch;
  const limitBajtow = opcje.limitBajtow ?? 3 * 1024 * 1024;
  const sterownik = new AbortController();
  // twardy limit czasu na całość — przekierowania i czytanie treści — nawet gdy fetch nie słucha sygnału
  const czas = new Promise<never>((_, odrzuc) => {
    sterownik.signal.addEventListener("abort", () => odrzuc(new Error("limit czasu")), { once: true });
  });
  czas.catch(() => undefined);
  const naCzas = <T>(p: Promise<T>): Promise<T> => Promise.race([p, czas]);
  const zegar = setTimeout(() => sterownik.abort(), opcje.limitMs ?? 8000);
  try {
    let biezacy = adres.url;
    for (let skok = 0; ; skok++) {
      const odp = await naCzas(
        pobierz(biezacy, { redirect: "manual", signal: sterownik.signal, headers: { Accept: "text/calendar", "User-Agent": AGENT } }),
      );
      if (odp.status >= 300 && odp.status < 400) {
        porzuc(odp);
        const cel = odp.headers.get("location");
        if (!cel || skok >= LIMIT_PRZEKIEROWAN) return { ok: false, powod: "nie_odpowiada" };
        // każdy kolejny adres przechodzi tę samą kontrolę co wpisany przez salon
        const nastepny = adresKalendarza(new URL(cel, biezacy).href);
        if (!nastepny.ok) return nastepny;
        biezacy = nastepny.url;
        continue;
      }
      if (!odp.ok) {
        porzuc(odp);
        return { ok: false, powod: "nie_odpowiada" };
      }
      if (Number(odp.headers.get("content-length")) > limitBajtow) {
        porzuc(odp);
        return { ok: false, powod: "za_duzy" };
      }
      const tresc = await czytajDoLimitu(odp, limitBajtow, naCzas);
      if (tresc === null) return { ok: false, powod: "za_duzy" };
      if (!tresc.includes("BEGIN:VCALENDAR")) return { ok: false, powod: "nie_kalendarz" };
      return { ok: true, zajete: zajetoscZIcs(tresc, zakres) };
    }
  } catch {
    return { ok: false, powod: "nie_odpowiada" };
  } finally {
    clearTimeout(zegar);
  }
}
