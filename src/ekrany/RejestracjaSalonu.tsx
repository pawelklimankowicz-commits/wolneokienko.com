// Rejestracja usługodawcy: wstęp → dane firmy → cennik → panel.
// Reguły pól i cennika: src/domain/rejestracja-salonu.ts (te same sprawdza serwer).
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { NazwaDokumentu } from "@/domain/dokumenty";
import { BRANZE, KATALOG_USLUG, KATEGORIE_KATALOGU, opisBranzy, uslugiBranzy } from "@/domain/katalog-uslug";
import { PROMOCJA_STARTOWA, STAWKA_PROWIZJI, prowizjaOd } from "@/domain/prowizja";
import {
  bezBledow,
  walidujCennik,
  walidujDaneSalonu,
  zlotowkiNaGrosze,
  type BledyDanych,
  type DaneSalonu,
  type PozycjaCennika,
  type SalonKonta,
} from "@/domain/rejestracja-salonu";
import type { KlientApi, Konto } from "@/lib/api";
import { cena, odmiana, zlote, zloteGr } from "@/lib/format";
import { grupujNumer, telefonCzytelny } from "@/lib/telefon";
import { Ikona, type NazwaIkony } from "@/ui/Ikona";
import { NaglowekEkranu } from "@/ui/wspolne";

type Krok = "wstep" | "firma" | "cennik" | "panel";

const DZIEN_MS = 24 * 60 * 60 * 1000;
const dataKrotka = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });

export function RejestracjaSalonu({
  api,
  konto,
  onZaloguj,
  onDemo,
  onDokument,
  onZamknij,
  onInfo,
}: {
  api: KlientApi;
  konto: Konto | null;
  onZaloguj: (potem: () => void) => void;
  onDemo: () => void;
  onDokument: (d: NazwaDokumentu) => void;
  onZamknij: () => void;
  onInfo: (tekst: string) => void;
}) {
  const [salon, setSalon] = useState<SalonKonta | null | undefined>(konto ? undefined : null);
  const [krok, setKrok] = useState<Krok>("wstep");

  useEffect(() => {
    if (!konto) return setSalon(null);
    let aktualne = true;
    api.mojSalon().then((s) => {
      if (!aktualne) return;
      setSalon(s);
      if (s) setKrok(s.cennik.length ? "panel" : "cennik");
    });
    return () => {
      aktualne = false;
    };
  }, [api, konto]);

  const zacznij = () => (konto ? setKrok("firma") : onZaloguj(() => setKrok("firma")));
  const wstecz = () => {
    if (krok === "firma" && !salon) return setKrok("wstep");
    if ((krok === "firma" || krok === "cennik") && salon?.cennik.length) return setKrok("panel");
    onZamknij();
  };

  const tytul = { wstep: "Dla usługodawców", firma: "Dane firmy", cennik: "Cennik", panel: "Twoja firma" }[krok];

  return (
    <div className="nakladka">
      <NaglowekEkranu tytul={tytul} onWstecz={wstecz} />
      {salon === undefined ? (
        <div className="nakladka-tresc">
          <p className="wyciszony srodek">Wczytuję…</p>
        </div>
      ) : krok === "wstep" ? (
        <Wstep onZacznij={zacznij} onDemo={onDemo} onDokument={onDokument} />
      ) : krok === "firma" ? (
        <FormularzFirmy
          api={api}
          salon={salon}
          telefonKonta={konto?.telefon ?? ""}
          onDokument={onDokument}
          onZapisano={(s) => {
            const pierwszy = !salon;
            setSalon(s);
            if (pierwszy || !s.cennik.length) setKrok("cennik");
            else {
              setKrok("panel");
              onInfo("Dane firmy zapisane.");
            }
          }}
        />
      ) : krok === "cennik" && salon ? (
        <EdytorCennika
          api={api}
          salon={salon}
          onZapisano={(s) => {
            setSalon(s);
            setKrok("panel");
            onInfo("Cennik zapisany.");
          }}
        />
      ) : salon ? (
        <Panel api={api} salon={salon} onZmiana={setSalon} onEdytuj={setKrok} onDemo={onDemo} onInfo={onInfo} />
      ) : null}
    </div>
  );
}

// ── Wstęp ──────────────────────────────────────────────────────────────

function Wstep({ onZacznij, onDemo, onDokument }: { onZacznij: () => void; onDemo: () => void; onDokument: (d: NazwaDokumentu) => void }) {
  const przyklad = prowizjaOd(13000);
  const punkty: { ikona: NazwaIkony; tytul: string; tekst: string }[] = [
    {
      ikona: "okienka",
      tytul: "Zapełniasz wolne okienka",
      tekst: "Klientki z okolicy piszą, czego szukają i na kiedy. Odpowiadasz jednym dotknięciem, gdy masz wolny czas.",
    },
    {
      ikona: "tarcza",
      tytul: "Bez abonamentu",
      tekst: `Płacisz tylko za wizyty z aplikacji, które się odbyły: ${Math.round(STAWKA_PROWIZJI * 100)}% + VAT. Przy wizycie za ${zlote(13000)} to ${zloteGr(przyklad.nettoGr)} + VAT.`,
    },
    {
      ikona: "prezent",
      tytul: "Pierwszy miesiąc na próbę",
      tekst: `${PROMOCJA_STARTOWA.darmoweWizyty} pierwszych wizyt w ciągu ${PROMOCJA_STARTOWA.dniProbne} dni bez prowizji.`,
    },
    {
      ikona: "zegar",
      tytul: "Ty decydujesz, kiedy",
      tekst: "Przyjmowanie zapytań włączasz i wyłączasz jednym przełącznikiem. Nie oddajesz nam kalendarza.",
    },
  ];
  return (
    <>
      <div className="nakladka-tresc">
        <div className="logowanie-intro">
          <h2>Wolne Okienko dla usługodawców</h2>
          <p className="wyciszony">Rejestracja zajmuje kilka minut: dane firmy i cennik usług.</p>
        </div>
        <ul className="lista-korzysci">
          {punkty.map((p) => (
            <li key={p.tytul}>
              <span className="lista-korzysci-znak" aria-hidden="true">
                <Ikona nazwa={p.ikona} rozmiar={22} />
              </span>
              <span>
                <strong>{p.tytul}</strong>
                <span className="wyciszony">{p.tekst}</span>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" className="link" onClick={onDemo}>
          Zobacz, jak wygląda odpowiadanie na zapytania
        </button>
      </div>
      <footer className="nakladka-stopka">
        <button type="button" className="btn btn-duzy" onClick={onZacznij}>
          Zarejestruj firmę
        </button>
        <p className="maly wyciszony srodek">
          Zasady współpracy:{" "}
          <button type="button" className="link link-w-tekscie maly" onClick={() => onDokument("regulamin-uslugodawcy")}>
            regulamin dla usługodawców
          </button>
        </p>
      </footer>
    </>
  );
}

// ── Dane firmy ─────────────────────────────────────────────────────────

function Pole({ etykieta, blad, podpowiedz, children }: { etykieta: string; blad?: string; podpowiedz?: string; children: ReactNode }) {
  return (
    <label className={`pole ${blad ? "z-bledem" : ""}`}>
      <span className="pole-etykieta">{etykieta}</span>
      {children}
      {blad ? <span className="blad-pola">{blad}</span> : podpowiedz ? <span className="pole-podpowiedz">{podpowiedz}</span> : null}
    </label>
  );
}

function FormularzFirmy({
  api,
  salon,
  telefonKonta,
  onDokument,
  onZapisano,
}: {
  api: KlientApi;
  salon: SalonKonta | null;
  telefonKonta: string;
  onDokument: (d: NazwaDokumentu) => void;
  onZapisano: (s: SalonKonta) => void;
}) {
  const [d, setD] = useState<DaneSalonu>(() => ({
    nazwa: salon?.nazwa ?? "",
    nip: salon?.nip ?? "",
    ulica: salon?.ulica ?? "",
    kodPocztowy: salon?.kodPocztowy ?? "",
    miasto: salon?.miasto ?? "Poznań",
    branza: salon?.branza ?? "uroda",
    telefon: grupujNumer(salon?.telefon ?? telefonKonta),
    email: salon?.email ?? "",
    numerRejestru: salon?.numerRejestru ?? "",
  }));
  const [akceptuje, setAkceptuje] = useState(false);
  const [bledy, setBledy] = useState<BledyDanych>({});
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [czekam, setCzekam] = useState(false);
  const [probowano, setProbowano] = useState(false);

  const ustaw = <K extends keyof DaneSalonu>(k: K, v: DaneSalonu[K]) => {
    const nowe = { ...d, [k]: v };
    setD(nowe);
    if (probowano) setBledy(walidujDaneSalonu(nowe));
  };
  const medyczna = opisBranzy(d.branza).medyczna;
  const branzaZablokowana = !!salon?.cennik.length;

  async function zapisz(e: FormEvent) {
    e.preventDefault();
    setProbowano(true);
    setKomunikat(null);
    const lokalne = walidujDaneSalonu(d);
    setBledy(lokalne);
    if (!bezBledow(lokalne)) return setKomunikat("Popraw zaznaczone pola.");
    if (!salon && !akceptuje) return setKomunikat("Zaakceptuj regulamin, żeby przejść dalej.");
    setCzekam(true);
    const w = await api.zapiszSalon({ ...d, numerRejestru: medyczna ? d.numerRejestru : undefined }, akceptuje);
    setCzekam(false);
    if (w.ok) return onZapisano(w.salon);
    setKomunikat(w.komunikat);
    if (w.pola) setBledy(w.pola);
  }

  const pole = (k: keyof DaneSalonu) => ({
    value: String(d[k] ?? ""),
    "aria-invalid": !!bledy[k],
    onChange: (e: { target: { value: string } }) => ustaw(k, e.target.value as never),
  });

  return (
    <>
      <form id="formularz-firmy" className="nakladka-tresc formularz" onSubmit={zapisz} noValidate>
        <fieldset className="grupa">
          <legend>Branża</legend>
          <div className="branze">
            {BRANZE.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`branza ${d.branza === b.id ? "aktywna" : ""}`}
                aria-pressed={d.branza === b.id}
                disabled={branzaZablokowana && d.branza !== b.id}
                onClick={() => ustaw("branza", b.id)}
              >
                <Ikona nazwa={b.id} rozmiar={18} />
                {b.nazwa}
              </button>
            ))}
          </div>
          {branzaZablokowana && <p className="pole-podpowiedz">Branżę zmienisz po wyczyszczeniu cennika.</p>}
        </fieldset>

        <Pole etykieta="Nazwa widoczna dla klientek" blad={bledy.nazwa}>
          <input id="firma-nazwa" autoComplete="organization" placeholder="np. Studio Paznokci Jeżyce" {...pole("nazwa")} />
        </Pole>
        <Pole etykieta="NIP" blad={bledy.nip} podpowiedz="Na ten NIP wystawimy fakturę za prowizję.">
          <input id="firma-nip" inputMode="numeric" placeholder="10 cyfr" {...pole("nip")} />
        </Pole>
        <Pole etykieta="Ulica i numer" blad={bledy.ulica}>
          <input id="firma-ulica" autoComplete="address-line1" placeholder="np. Dąbrowskiego 12/3" {...pole("ulica")} />
        </Pole>
        <div className="pola-rzad">
          <Pole etykieta="Kod pocztowy" blad={bledy.kodPocztowy}>
            <input id="firma-kod" inputMode="numeric" autoComplete="postal-code" placeholder="60-838" {...pole("kodPocztowy")} />
          </Pole>
          <Pole etykieta="Miejscowość" blad={bledy.miasto}>
            <input id="firma-miasto" autoComplete="address-level2" {...pole("miasto")} />
          </Pole>
        </div>
        <Pole etykieta="Telefon do klientek" blad={bledy.telefon} podpowiedz="Pokażemy go klientce dopiero po rezerwacji.">
          <input
            id="firma-telefon"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={d.telefon}
            aria-invalid={!!bledy.telefon}
            onChange={(e) => ustaw("telefon", grupujNumer(e.target.value))}
          />
        </Pole>
        <Pole etykieta="E-mail do faktur" blad={bledy.email}>
          <input id="firma-email" type="email" inputMode="email" autoComplete="email" placeholder="np. biuro@twojsalon.pl" {...pole("email")} />
        </Pole>
        {medyczna && (
          <Pole
            etykieta="Numer w rejestrze"
            blad={bledy.numerRejestru}
            podpowiedz="Numer księgi rejestrowej RPWDL albo prawa wykonywania zawodu. Sprawdzamy, czy gabinet działa legalnie."
          >
            <input id="firma-rejestr" {...pole("numerRejestru")} />
          </Pole>
        )}

        {!salon && (
          <label className="zgoda-medyczna zgoda-regulamin">
            <input
              id="akceptuje-regulamin"
              type="checkbox"
              checked={akceptuje}
              onChange={(e) => {
                setAkceptuje(e.target.checked);
                setKomunikat(null);
              }}
            />
            <span>
              Akceptuję{" "}
              <button type="button" className="link link-w-tekscie" onClick={() => onDokument("regulamin-uslugodawcy")}>
                regulamin dla usługodawców
              </button>
              , w tym prowizję {Math.round(STAWKA_PROWIZJI * 100)}% + VAT od każdej wizyty z aplikacji, która się odbyła.
            </span>
          </label>
        )}

        {komunikat && (
          <p className="blad-pola" role="alert">
            {komunikat}
          </p>
        )}
      </form>
      <footer className="nakladka-stopka">
        <button type="submit" form="formularz-firmy" className="btn btn-duzy" disabled={czekam}>
          {czekam ? "Zapisuję…" : salon ? "Zapisz dane" : "Dalej: cennik"}
        </button>
      </footer>
    </>
  );
}

// ── Cennik ─────────────────────────────────────────────────────────────

interface StanPozycji {
  wybrana: boolean;
  cena: string;
  czas: string;
  lekarz: boolean;
  deklaracja: string;
}

function EdytorCennika({ api, salon, onZapisano }: { api: KlientApi; salon: SalonKonta; onZapisano: (s: SalonKonta) => void }) {
  const uslugi = useMemo(() => uslugiBranzy(salon.branza), [salon.branza]);
  const [stan, setStan] = useState<Record<string, StanPozycji>>(() =>
    Object.fromEntries(
      uslugi.map((u) => {
        const p = salon.cennik.find((c) => c.usluga === u.kod);
        return [
          u.kod,
          {
            wybrana: !!p,
            cena: p ? String(p.cenaGr / 100).replace(".", ",") : "",
            czas: String(p?.czasMin ?? u.typowyCzasMin),
            lekarz: !!p?.wykonujeLekarz,
            deklaracja: p?.deklaracja ?? "",
          },
        ];
      }),
    ),
  );
  const [bledy, setBledy] = useState<Record<string, string>>({});
  const [komunikat, setKomunikat] = useState<string | null>(null);
  const [czekam, setCzekam] = useState(false);

  const grupy = useMemo(() => {
    const m = new Map<string, typeof uslugi>();
    for (const u of uslugi) m.set(KATEGORIE_KATALOGU[u.kategoria].nazwa, [...(m.get(KATEGORIE_KATALOGU[u.kategoria].nazwa) ?? []), u]);
    return [...m.entries()];
  }, [uslugi]);

  const zmien = (kod: string, zmiana: Partial<StanPozycji>) => {
    setStan((s) => ({ ...s, [kod]: { ...s[kod], ...zmiana } }));
    setBledy((b) => {
      const { [kod]: _pominiety, ...reszta } = b;
      return reszta;
    });
  };
  const wybrane = uslugi.filter((u) => stan[u.kod].wybrana);
  const medyczna = opisBranzy(salon.branza).medyczna;

  async function zapisz(e: FormEvent) {
    e.preventDefault();
    setKomunikat(null);
    const pozycje: PozycjaCennika[] = wybrane.map((u) => {
      const s = stan[u.kod];
      return {
        usluga: u.kod,
        cenaGr: zlotowkiNaGrosze(s.cena) ?? NaN,
        czasMin: Number.parseInt(s.czas, 10),
        ...(u.wymagaLekarza ? { wykonujeLekarz: s.lekarz } : {}),
        ...(u.wymagaDeklaracjiKwalifikacji ? { deklaracja: s.deklaracja } : {}),
      };
    });
    const lokalne = walidujCennik(salon.branza, pozycje);
    if (!bezBledow(lokalne)) {
      setBledy(lokalne.pozycje);
      return setKomunikat(lokalne.ogolny ?? "Popraw zaznaczone usługi.");
    }
    setCzekam(true);
    const w = await api.zapiszCennik(pozycje);
    setCzekam(false);
    if (w.ok) return onZapisano(w.salon);
    setKomunikat(w.komunikat);
    if (w.cennik) setBledy(w.cennik.pozycje);
  }

  return (
    <>
      <form id="formularz-cennika" className="nakladka-tresc formularz" onSubmit={zapisz} noValidate>
        <div className="logowanie-intro">
          <h2>Co robisz i za ile?</h2>
          <p className="wyciszony">
            Zaznacz usługi i podaj cenę „od”. Dopasujemy do nich zapytania klientek — w ofercie i tak podasz dokładną cenę.
          </p>
        </div>
        {medyczna && (
          <p className="info-medyczna">
            <Ikona nazwa="tarcza" rozmiar={18} />
            <span>Usługi medyczne pokazujemy bez promocji i wyróżnień, w neutralnej kolejności — tak wymagają przepisy.</span>
          </p>
        )}
        {grupy.map(([kategoria, lista]) => (
          <fieldset key={kategoria} className="grupa">
            <legend>{kategoria}</legend>
            <div className="lista-uslug">
              {lista.map((u) => {
                const s = stan[u.kod];
                const blad = bledy[u.kod];
                return (
                  <div key={u.kod} className={`pozycja ${s.wybrana ? "wybrana" : ""} ${blad ? "z-bledem" : ""}`}>
                    <label className="pozycja-glowa">
                      <input type="checkbox" checked={s.wybrana} onChange={(e) => zmien(u.kod, { wybrana: e.target.checked })} />
                      <span>{u.nazwa}</span>
                    </label>
                    {s.wybrana && (
                      <div className="pozycja-pola">
                        <label>
                          <span>Cena od</span>
                          <span className="pole-z-jednostka">
                            <input
                              inputMode="decimal"
                              aria-label={`Cena od — ${u.nazwa}`}
                              placeholder="0"
                              value={s.cena}
                              onChange={(e) => zmien(u.kod, { cena: e.target.value })}
                            />
                            zł
                          </span>
                        </label>
                        <label>
                          <span>Czas</span>
                          <span className="pole-z-jednostka">
                            <input
                              inputMode="numeric"
                              aria-label={`Czas — ${u.nazwa}`}
                              value={s.czas}
                              onChange={(e) => zmien(u.kod, { czas: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                            />
                            min
                          </span>
                        </label>
                      </div>
                    )}
                    {s.wybrana && u.wymagaLekarza && (
                      <label className="pozycja-deklaracja">
                        <input type="checkbox" checked={s.lekarz} onChange={(e) => zmien(u.kod, { lekarz: e.target.checked })} />
                        <span>Oświadczam, że ten zabieg wykonuje u nas lekarz albo lekarz dentysta.</span>
                      </label>
                    )}
                    {s.wybrana && u.wymagaDeklaracjiKwalifikacji && (
                      <label className="pozycja-deklaracja-tekst">
                        <span>Kto wykonuje zabieg i jakie ma kwalifikacje?</span>
                        <textarea
                          rows={2}
                          placeholder="np. lek. med. Anna Nowak, PWZ 1234567"
                          value={s.deklaracja}
                          onChange={(e) => zmien(u.kod, { deklaracja: e.target.value })}
                        />
                      </label>
                    )}
                    {blad && <p className="blad-pola">{blad}</p>}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
        {komunikat && (
          <p className="blad-pola" role="alert">
            {komunikat}
          </p>
        )}
      </form>
      <footer className="nakladka-stopka">
        <button type="submit" form="formularz-cennika" className="btn btn-duzy" disabled={czekam || wybrane.length === 0}>
          {czekam
            ? "Zapisuję…"
            : wybrane.length
              ? `Zapisz cennik · ${wybrane.length} ${odmiana(wybrane.length, "usługa", "usługi", "usług")}`
              : "Zaznacz co najmniej jedną usługę"}
        </button>
      </footer>
    </>
  );
}

// ── Panel ──────────────────────────────────────────────────────────────

function Panel({
  api,
  salon,
  onZmiana,
  onEdytuj,
  onDemo,
  onInfo,
}: {
  api: KlientApi;
  salon: SalonKonta;
  onZmiana: (s: SalonKonta) => void;
  onEdytuj: (k: Krok) => void;
  onDemo: () => void;
  onInfo: (tekst: string) => void;
}) {
  const [czekam, setCzekam] = useState(false);
  const przelacz = async () => {
    setCzekam(true);
    const w = await api.ustawPrzyjmowanie(!salon.przyjmujeZapytania);
    setCzekam(false);
    if (w.ok) onZmiana(w.salon);
    else onInfo(w.komunikat);
  };

  const koniecProby = salon.aktywowanyAt ? new Date(new Date(salon.aktywowanyAt).getTime() + PROMOCJA_STARTOWA.dniProbne * DZIEN_MS) : null;
  const darmoweZostalo = Math.max(0, PROMOCJA_STARTOWA.darmoweWizyty - salon.wizytyZrealizowane);
  const probaTrwa = !koniecProby || (koniecProby > new Date() && darmoweZostalo > 0);
  const nazwy = new Map(KATALOG_USLUG.map((u) => [u.kod, u.nazwa]));

  return (
    <div className="nakladka-tresc">
      <div className="logowanie-intro">
        <h2>{salon.nazwa}</h2>
        <p className="wyciszony">
          <Ikona nazwa="pinezka" rozmiar={15} /> {salon.adresZMapy ?? salon.ulica}
        </p>
      </div>

      <button
        type="button"
        className={`przelacznik ${salon.przyjmujeZapytania ? "wlaczony" : ""}`}
        role="switch"
        aria-checked={salon.przyjmujeZapytania}
        disabled={czekam}
        onClick={przelacz}
      >
        <span>
          <strong>{salon.przyjmujeZapytania ? "Przyjmuję zapytania" : "Nie przyjmuję zapytań"}</strong>
          <small>{salon.przyjmujeZapytania ? "Zapytania z okolicy trafią do Ciebie." : "Włącz, gdy masz wolny czas w najbliższych dniach."}</small>
        </span>
        <span className="przelacznik-suwak" aria-hidden="true" />
      </button>

      {probaTrwa && (
        <p className="promocja-info">
          <Ikona nazwa="prezent" rozmiar={18} />
          <span>
            {koniecProby
              ? `Miesiąc próbny do ${dataKrotka.format(koniecProby)}: zostało ${darmoweZostalo} ${odmiana(darmoweZostalo, "wizyta", "wizyty", "wizyt")} bez prowizji.`
              : `Miesiąc próbny zacznie się, gdy pierwszy raz włączysz przyjmowanie zapytań: ${PROMOCJA_STARTOWA.darmoweWizyty} pierwszych wizyt w ciągu ${PROMOCJA_STARTOWA.dniProbne} dni bez prowizji.`}
          </span>
        </p>
      )}

      <section className="karta-panelu">
        <div className="karta-panelu-glowa">
          <h3>Cennik</h3>
          <button type="button" className="link" onClick={() => onEdytuj("cennik")}>
            Zmień
          </button>
        </div>
        <ul className="cennik-lista">
          {salon.cennik.slice(0, 6).map((p) => (
            <li key={p.usluga}>
              <span>{nazwy.get(p.usluga) ?? p.usluga}</span>
              <span className="wyciszony">
                od {cena(p.cenaGr)} · {p.czasMin} min
              </span>
            </li>
          ))}
        </ul>
        {salon.cennik.length > 6 && <p className="wyciszony maly">i {salon.cennik.length - 6} więcej</p>}
      </section>

      <section className="karta-panelu">
        <div className="karta-panelu-glowa">
          <h3>Dane firmy</h3>
          <button type="button" className="link" onClick={() => onEdytuj("firma")}>
            Zmień
          </button>
        </div>
        <dl className="dane-firmy">
          <div>
            <dt>NIP</dt>
            <dd>{salon.nip}</dd>
          </div>
          <div>
            <dt>Telefon</dt>
            <dd>{telefonCzytelny(salon.telefon)}</dd>
          </div>
          <div>
            <dt>Faktury</dt>
            <dd>{salon.email}</dd>
          </div>
        </dl>
      </section>

      <button type="button" className="link" onClick={onDemo}>
        Zobacz, jak wygląda odpowiadanie na zapytania
      </button>
    </div>
  );
}
