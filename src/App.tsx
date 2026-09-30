// Aplikacja klientki (cztery zakładki) i podgląd aplikacji salonu.
// Faza 1: dane przykładowe (src/dane/przyklad.ts); logika prowizji, fal
// i rozbioru zapytań to te same moduły, które pójdą na produkcję.
// Logowanie jest prawdziwe (src/lib/api.ts → src/serwer/api.ts): numer
// potwierdzamy dopiero wtedy, gdy klientka wysyła zapytanie albo rezerwuje.
import { useCallback, useEffect, useState } from "react";
import { salon, type Oferta, type Okienko } from "./dane/przyklad";
import { Logowanie } from "./ekrany/Logowanie";
import { Okienka } from "./ekrany/Okienka";
import { Oferty } from "./ekrany/Oferty";
import { Potwierdzenie, type Rezerwacja } from "./ekrany/Potwierdzenie";
import { Profil } from "./ekrany/Profil";
import { Salon } from "./ekrany/Salon";
import { Start } from "./ekrany/Start";
import { Wizyty } from "./ekrany/Wizyty";
import { Zapytanie, type WyslaneZapytanie } from "./ekrany/Zapytanie";
import type { Branza } from "./domain/katalog-uslug";
import { api, type Konto } from "./lib/api";
import { Ikona, type NazwaIkony } from "./ui/Ikona";

type Zakladka = "start" | "okienka" | "wizyty" | "profil";
type Nakladka =
  | { typ: "zapytanie"; tekst: string; branza?: Branza }
  | { typ: "oferty"; zapytanie: WyslaneZapytanie }
  | { typ: "potwierdzenie"; rezerwacja: Rezerwacja }
  | { typ: "salon" }
  | null;

const ZAKLADKI: { id: Zakladka; etykieta: string; ikona: NazwaIkony }[] = [
  { id: "start", etykieta: "Start", ikona: "start" },
  { id: "okienka", etykieta: "Okienka", ikona: "okienka" },
  { id: "wizyty", etykieta: "Wizyty", ikona: "wizyty" },
  { id: "profil", etykieta: "Profil", ikona: "profil" },
];

const DZIEN = { teraz: "dziś", dzis: "dziś", jutro: "jutro", weekend: "sobota" } as const;

export default function App() {
  const [zakladka, setZakladka] = useState<Zakladka>("start");
  const [nakladka, setNakladka] = useState<Nakladka>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** undefined — jeszcze sprawdzamy sesję */
  const [konto, setKonto] = useState<Konto | null | undefined>(undefined);
  /** logowanie leży nad bieżącym ekranem, więc zamknięcie nie gubi wpisanego zapytania */
  const [logowanie, setLogowanie] = useState<{ powod?: string; potem: () => void } | null>(null);

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

  const zapytaj = useCallback((tekst: string, branza?: Branza) => setNakladka({ typ: "zapytanie", tekst, branza }), []);
  const rezerwujOkienko = useCallback(
    (o: Okienko) =>
      poZalogowaniu("Potwierdź numer — potem od razu zarezerwujemy termin.", () =>
        setNakladka({
          typ: "potwierdzenie",
          rezerwacja: { salon: salon(o.salonId), usluga: o.usluga, dzien: o.dzien, godzina: o.godzina, cenaGr: o.cenaGr },
        }),
      ),
    [poZalogowaniu],
  );

  const zapytanieWToku = nakladka?.typ === "oferty" ? nakladka.zapytanie : null;
  const wybierzOferte = useCallback(
    (o: Oferta) => {
      if (!zapytanieWToku) return;
      setNakladka({
        typ: "potwierdzenie",
        rezerwacja: {
          salon: salon(o.salonId),
          usluga: zapytanieWToku.usluga.nazwa,
          dzien: DZIEN[zapytanieWToku.kiedy],
          godzina: o.godzina,
          cenaGr: o.cenaGr,
        },
      });
    },
    [zapytanieWToku],
  );

  return (
    <div className="aplikacja">
      <main className="przewijane" hidden={nakladka !== null}>
        {zakladka === "start" && (
          <Start onZapytaj={zapytaj} onRezerwuj={rezerwujOkienko} onWszystkieOkienka={() => setZakladka("okienka")} />
        )}
        {zakladka === "okienka" && <Okienka onRezerwuj={rezerwujOkienko} onZapytaj={zapytaj} />}
        {zakladka === "wizyty" && <Wizyty onZapytaj={(t) => zapytaj(t)} onInfo={setToast} />}
        {zakladka === "profil" && (
          <Profil
            konto={konto ?? null}
            onZaloguj={() => setLogowanie({ potem: () => setToast("Zalogowano.") })}
            onWyloguj={async () => {
              await api.wyloguj();
              setKonto(null);
              setToast("Wylogowano.");
            }}
            onSalon={() => setNakladka({ typ: "salon" })}
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
          onZamknij={() => setNakladka(null)}
          onWyslij={(z) => poZalogowaniu("Potwierdź numer — potem od razu wyślemy zapytanie.", () => setNakladka({ typ: "oferty", zapytanie: z }))}
        />
      )}
      {nakladka?.typ === "oferty" && (
        <Oferty zapytanie={nakladka.zapytanie} onWybierz={wybierzOferte} onAnuluj={() => setNakladka(null)} />
      )}
      {nakladka?.typ === "potwierdzenie" && (
        <Potwierdzenie
          r={nakladka.rezerwacja}
          onInfo={setToast}
          onGotowe={() => {
            setNakladka(null);
            setZakladka("wizyty");
          }}
        />
      )}
      {nakladka?.typ === "salon" && <Salon onWyjdz={() => setNakladka(null)} />}
      {logowanie && (
        <Logowanie
          api={api}
          powod={logowanie.powod}
          onZamknij={() => setLogowanie(null)}
          onZalogowano={(k) => {
            setKonto(k);
            setLogowanie(null);
            logowanie.potem();
          }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
