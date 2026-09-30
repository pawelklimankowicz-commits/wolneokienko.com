// Aplikacja klientki (cztery zakładki) i panel usługodawcy.
// Zapytania, oferty na żywo i wizyty idą przez API (src/lib/api.ts →
// src/serwer/api.ts); zakładka Okienka i ekran startowy pokazują jeszcze
// przykładowe okienka (src/dane/przyklad.ts). Numer potwierdzamy dopiero
// wtedy, gdy klientka wysyła zapytanie albo rezerwuje.
import { useCallback, useEffect, useState } from "react";
import { salon, type Okienko } from "./dane/przyklad";
import { Dokument } from "./ekrany/Dokument";
import { Logowanie } from "./ekrany/Logowanie";
import { Okienka } from "./ekrany/Okienka";
import { Oferty } from "./ekrany/Oferty";
import { Potwierdzenie } from "./ekrany/Potwierdzenie";
import { Profil } from "./ekrany/Profil";
import { RejestracjaSalonu } from "./ekrany/RejestracjaSalonu";
import { Salon } from "./ekrany/Salon";
import { Start } from "./ekrany/Start";
import { Wizyty } from "./ekrany/Wizyty";
import { Zapytanie, type WyslaneZapytanie } from "./ekrany/Zapytanie";
import type { NazwaDokumentu } from "./domain/dokumenty";
import { KATALOG_USLUG, czyMedyczna, type Branza } from "./domain/katalog-uslug";
import { oknoZapytania } from "./domain/okno";
import type { StanZapytania, WizytaWidok } from "./domain/widoki";
import { api, type Konto } from "./lib/api";
import { pobierzLokalizacje } from "./lib/lokalizacja";
import { Ikona, type NazwaIkony } from "./ui/Ikona";

type Zakladka = "start" | "okienka" | "wizyty" | "profil";
type Nakladka =
  | { typ: "zapytanie"; tekst: string; branza?: Branza; glos?: boolean; poprzednie?: WyslaneZapytanie }
  | { typ: "oferty"; wyslane: WyslaneZapytanie; stan: StanZapytania }
  | { typ: "potwierdzenie"; wizyta: WizytaWidok }
  | { typ: "salon" }
  | { typ: "rejestracja" }
  | null;

const ZAKLADKI: { id: Zakladka; etykieta: string; ikona: NazwaIkony }[] = [
  { id: "start", etykieta: "Start", ikona: "start" },
  { id: "okienka", etykieta: "Okienka", ikona: "okienka" },
  { id: "wizyty", etykieta: "Wizyty", ikona: "wizyty" },
  { id: "profil", etykieta: "Profil", ikona: "profil" },
];

export default function App() {
  const [zakladka, setZakladka] = useState<Zakladka>("start");
  const [nakladka, setNakladka] = useState<Nakladka>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** undefined — jeszcze sprawdzamy sesję */
  const [konto, setKonto] = useState<Konto | null | undefined>(undefined);
  /** logowanie leży nad bieżącym ekranem, więc zamknięcie nie gubi wpisanego zapytania */
  const [logowanie, setLogowanie] = useState<{ powod?: string; rola?: "klientka" | "salon"; potem: () => void } | null>(null);
  /** dokument prawny leży nad wszystkim, także nad logowaniem */
  const [dokument, setDokument] = useState<NazwaDokumentu | null>(null);

  useEffect(() => {
    let aktualne = true;
    api.ja().then((k) => aktualne && setKonto(k));
    return () => {
      aktualne = false;
    };
  }, []);

  const poZalogowaniu = useCallback(
    (powod: string, potem: () => void) => (konto ? potem() : setLogowanie({ powod, potem })),
    [konto],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const zapytaj = useCallback((tekst: string, branza?: Branza, glos?: boolean) => setNakladka({ typ: "zapytanie", tekst, branza, glos }), []);
  // Okienka to jeszcze przykładowe dane: w podglądzie rezerwujemy od razu,
  // w aplikacji otwieramy zapytanie o tę usługę na ten dzień.
  const rezerwujOkienko = useCallback(
    (o: Okienko) => {
      if (!api.podglad) return zapytaj(`${o.usluga.toLowerCase()} ${o.dzien} po ${o.godzina.split(":")[0]}`);
      poZalogowaniu("Potwierdź numer — potem od razu zarezerwujemy termin.", () => {
        const s = salon(o.salonId);
        const [h, m] = o.godzina.split(":").map(Number);
        const termin = new Date();
        if (o.dzien === "jutro") termin.setDate(termin.getDate() + 1);
        termin.setHours(h, m, 0, 0);
        setNakladka({
          typ: "potwierdzenie",
          wizyta: {
            id: `okienko-${o.id}`,
            salonNazwa: s.nazwa,
            adres: s.adres,
            telefon: "+48600100200",
            uslugaKod: KATALOG_USLUG.find((u) => u.nazwa === o.usluga)?.kod ?? o.usluga,
            termin: termin.toISOString(),
            cenaGr: o.cenaGr,
            kolory: s.okladka,
            status: "potwierdzona",
          },
        });
      });
    },
    [poZalogowaniu, zapytaj],
  );

  const [wysylam, setWysylam] = useState(false);
  const wyslijZapytanie = useCallback(async (z: WyslaneZapytanie) => {
    setWysylam(true);
    const miejsce = await pobierzLokalizacje(api.podglad);
    const okno = oknoZapytania(z.kiedy, z.odGodziny, new Date());
    const w = await api.wyslijZapytanie({
      uslugaKod: z.usluga.kod,
      oknoOd: okno.od.toISOString(),
      oknoDo: okno.do.toISOString(),
      lat: miejsce.lat,
      lon: miejsce.lon,
      limitGr: z.limitZl === null ? null : z.limitZl * 100,
      tryb: z.tryb,
      liczbaOsob: z.liczbaOsob,
      // przy usługach medycznych opis nie wychodzi z telefonu
      tresc: czyMedyczna(z.usluga) ? "" : z.tekst.trim().slice(0, 300),
      zgodaZdrowie: z.zgodaZdrowie,
    });
    setWysylam(false);
    if (!w.ok) return setToast(w.komunikat);
    setNakladka({ typ: "oferty", wyslane: z, stan: w.zapytanie });
  }, []);
  const pokazWizyte = useCallback((w: WizytaWidok) => setNakladka({ typ: "potwierdzenie", wizyta: w }), []);

  return (
    <div className="aplikacja">
      <main className="przewijane" hidden={nakladka !== null}>
        {zakladka === "start" && (
          <Start onZapytaj={zapytaj} onRezerwuj={rezerwujOkienko} onWszystkieOkienka={() => setZakladka("okienka")} />
        )}
        {zakladka === "okienka" && <Okienka onRezerwuj={rezerwujOkienko} onZapytaj={zapytaj} />}
        {zakladka === "wizyty" && (
          <Wizyty
            api={api}
            konto={konto}
            onZapytaj={(t) => zapytaj(t)}
            onZaloguj={() => setLogowanie({ potem: () => setToast("Zalogowano.") })}
            onInfo={setToast}
          />
        )}
        {zakladka === "profil" && (
          <Profil
            konto={konto ?? null}
            onZaloguj={() => setLogowanie({ potem: () => setToast("Zalogowano.") })}
            onWyloguj={async () => {
              await api.wyloguj();
              setKonto(null);
              setToast("Wylogowano.");
            }}
            onSalon={() => setNakladka({ typ: "rejestracja" })}
            onDokumenty={() => setDokument("regulamin-klientki")}
            onInfo={setToast}
          />
        )}
      </main>

      {nakladka === null && (
        <nav className="pasek-zakladek" aria-label="Nawigacja">
          {ZAKLADKI.map((z) => (
            <button
              key={z.id}
              type="button"
              className={zakladka === z.id ? "aktywna" : ""}
              aria-current={zakladka === z.id ? "page" : undefined}
              onClick={() => setZakladka(z.id)}
            >
              <Ikona nazwa={z.ikona} rozmiar={24} />
              <span>{z.etykieta}</span>
            </button>
          ))}
        </nav>
      )}

      {nakladka?.typ === "zapytanie" && (
        <Zapytanie
          tekstPoczatkowy={nakladka.tekst}
          branzaPoczatkowa={nakladka.branza}
          poprzednie={nakladka.poprzednie}
          sluchajOdRazu={nakladka.glos}
          podglad={api.podglad}
          wysylam={wysylam}
          onZamknij={() => setNakladka(null)}
          onWyslij={(z) => poZalogowaniu("Potwierdź numer — potem od razu wyślemy zapytanie.", () => wyslijZapytanie(z))}
        />
      )}
      {nakladka?.typ === "oferty" && (
        <Oferty
          key={nakladka.stan.id}
          wyslane={nakladka.wyslane}
          stanPoczatkowy={nakladka.stan}
          api={api}
          onPrzyjeto={pokazWizyte}
          onZamknij={() => setNakladka(null)}
          onZmien={() => setNakladka({ typ: "zapytanie", tekst: nakladka.wyslane.tekst, poprzednie: nakladka.wyslane })}
          onInfo={setToast}
        />
      )}
      {nakladka?.typ === "potwierdzenie" && (
        <Potwierdzenie
          w={nakladka.wizyta}
          onGotowe={() => {
            setNakladka(null);
            setZakladka("wizyty");
          }}
        />
      )}
      {nakladka?.typ === "salon" && <Salon onWyjdz={() => setNakladka({ typ: "rejestracja" })} />}
      {nakladka?.typ === "rejestracja" && (
        <RejestracjaSalonu
          api={api}
          konto={konto ?? null}
          onZaloguj={(potem) => setLogowanie({ rola: "salon", powod: "Zaloguj się numerem, którego używasz w firmie.", potem })}
          onDemo={() => setNakladka({ typ: "salon" })}
          onDokument={setDokument}
          onZamknij={() => setNakladka(null)}
          onInfo={setToast}
        />
      )}
      {logowanie && (
        <Logowanie
          api={api}
          powod={logowanie.powod}
          rola={logowanie.rola}
          onDokument={setDokument}
          onZamknij={() => setLogowanie(null)}
          onZalogowano={(k) => {
            setKonto(k);
            setLogowanie(null);
            logowanie.potem();
          }}
        />
      )}
      {dokument && <Dokument nazwa={dokument} onZamknij={() => setDokument(null)} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
