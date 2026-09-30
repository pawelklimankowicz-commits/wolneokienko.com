import { useEffect, useMemo, useRef, useState } from "react";
import { KANDYDACI_PODGLAD } from "@/dane/przyklad";
import { zaplanujFale } from "@/domain/fale";
import { KATALOG_USLUG, branzaUslugi, czyMedyczna, opisBranzy, uslugiBranzy, type Branza, type Usluga } from "@/domain/katalog-uslug";
import { useDyktowanie } from "@/lib/dyktowanie";
import { km, odmiana } from "@/lib/format";
import { parsujZapytanie, type Kiedy } from "@/lib/parsuj-zapytanie";
import { Ikona } from "@/ui/Ikona";
import { NaglowekEkranu } from "@/ui/wspolne";

export type TrybWyboru = "zbieram" | "pierwsza";

export interface WyslaneZapytanie {
  usluga: Usluga;
  kiedy: Kiedy;
  odGodziny: number | null;
  limitZl: number | null;
  tryb: TrybWyboru;
  /** tylko „Czas wolny”: rezerwacja dla grupy */
  liczbaOsob: number | null;
  /** tekst wpisany lub podyktowany przez klientkę */
  tekst: string;
  /** wyraźna zgoda przy usługach medycznych */
  zgodaZdrowie: boolean;
}

const KIEDY: { wartosc: Kiedy; etykieta: string }[] = [
  { wartosc: "teraz", etykieta: "Teraz" },
  { wartosc: "dzis", etykieta: "Dziś" },
  { wartosc: "jutro", etykieta: "Jutro" },
  { wartosc: "weekend", etykieta: "Weekend" },
];
const GODZINY: (number | null)[] = [null, 8, 12, 16, 18];
const LIMITY: (number | null)[] = [null, 100, 150, 200, 300];
const OSOBY = [2, 3, 4, 5, 6, 8];

export function Zapytanie({
  tekstPoczatkowy,
  branzaPoczatkowa,
  poprzednie,
  sluchajOdRazu = false,
  podglad,
  wysylam = false,
  onWyslij,
  onZamknij,
}: {
  tekstPoczatkowy: string;
  /** „Zmień zapytanie” z ekranu ofert — te same warunki do poprawienia */
  poprzednie?: WyslaneZapytanie;
  /** podgląd bez serwera: pokazujemy przykładowy zasięg */
  podglad: boolean;
  /** zapytanie w drodze do serwera */
  wysylam?: boolean;
  branzaPoczatkowa?: Branza;
  /** otwarte przyciskiem mikrofonu na starcie — od razu słuchamy */
  sluchajOdRazu?: boolean;
  onWyslij: (z: WyslaneZapytanie) => void;
  onZamknij: () => void;
}) {
  const poczatek = parsujZapytanie(poprzednie?.tekst ?? tekstPoczatkowy);
  const [tekst, setTekst] = useState(poprzednie?.tekst ?? tekstPoczatkowy);
  const [wybranaUsluga, setWybranaUsluga] = useState<string | null>(poprzednie?.usluga.kod ?? poczatek.uslugi[0]?.kod ?? null);
  const [kiedy, setKiedy] = useState<Kiedy>(poprzednie?.kiedy ?? poczatek.kiedy ?? "dzis");
  const [odGodziny, setOdGodziny] = useState<number | null>(poprzednie ? poprzednie.odGodziny : poczatek.odGodziny);
  const [limitZl, setLimitZl] = useState<number | null>(poprzednie ? poprzednie.limitZl : poczatek.limitZl);
  const [osoby, setOsoby] = useState<number>(poprzednie?.liczbaOsob ?? poczatek.osoby ?? 2);
  const [tryb, setTryb] = useState<TrybWyboru>(poprzednie?.tryb ?? "zbieram");
  const [zgodaZdrowie, setZgodaZdrowie] = useState(poprzednie?.zgodaZdrowie ?? false);

  const rozbior = useMemo(() => parsujZapytanie(tekst), [tekst]);

  const zmienTekst = (t: string) => {
    setTekst(t);
    const r = parsujZapytanie(t);
    if (r.uslugi[0]) setWybranaUsluga(r.uslugi[0].kod);
    if (r.kiedy) setKiedy(r.kiedy);
    if (r.odGodziny !== null) setOdGodziny(r.odGodziny);
    if (r.limitZl !== null) setLimitZl(r.limitZl);
    if (r.osoby !== null) setOsoby(r.osoby);
  };

  // Dyktowanie dopisuje się do tego, co już było w polu przed dotknięciem mikrofonu.
  const tekstPrzedDyktowaniem = useRef("");
  const dyktowanie = useDyktowanie((mowa) => {
    const przed = tekstPrzedDyktowaniem.current.trim();
    zmienTekst(przed ? `${przed} ${mowa}` : mowa);
  });
  const mikrofon = () => {
    if (dyktowanie.slucha) return dyktowanie.stop();
    tekstPrzedDyktowaniem.current = tekst;
    dyktowanie.start();
  };
  const { start: zacznijSluchac } = dyktowanie;
  useEffect(() => {
    if (sluchajOdRazu) zacznijSluchac();
  }, [sluchajOdRazu, zacznijSluchac]);

  const usluga = KATALOG_USLUG.find((u) => u.kod === wybranaUsluga) ?? null;
  const branza: Branza = usluga ? branzaUslugi(usluga) : (branzaPoczatkowa ?? "uroda");
  const opis = opisBranzy(branza);
  const medyczna = usluga ? czyMedyczna(usluga) : opis.medyczna;

  const propozycje = useMemo(() => {
    const kody = [...rozbior.uslugi.map((u) => u.kod), ...uslugiBranzy(branza).map((u) => u.kod)];
    return [...new Set(kody)].slice(0, 7).map((k) => KATALOG_USLUG.find((u) => u.kod === k)!);
  }, [rozbior, branza]);

  const plan = useMemo(() => zaplanujFale(KANDYDACI_PODGLAD), []);
  const liczbaWykonawcow = plan.fale.reduce((n, f) => n + f.salonIds.length, 0);
  const moznaWyslac = usluga !== null && (!medyczna || zgodaZdrowie) && !wysylam;

  return (
    <div className="nakladka">
      <NaglowekEkranu tytul="Nowe zapytanie" onWstecz={onZamknij} />
      <div className="nakladka-tresc">
        <div className={`pole-zapytania ${dyktowanie.slucha ? "slucha" : ""}`}>
          <Ikona nazwa="iskra" />
          <textarea
            id="tekst-zapytania"
            rows={2}
            autoFocus={!sluchajOdRazu}
            aria-label="Czego potrzebujesz i na kiedy?"
            placeholder={dyktowanie.slucha ? "Słucham…" : `np. ${opis.przyklad}`}
            value={tekst}
            onChange={(e) => zmienTekst(e.target.value)}
          />
          <button
            type="button"
            className={`mikrofon ${dyktowanie.slucha ? "slucha" : ""}`}
            aria-label={dyktowanie.slucha ? "Zakończ dyktowanie" : "Powiedz, czego szukasz"}
            aria-pressed={dyktowanie.slucha}
            onClick={mikrofon}
          >
            <Ikona nazwa="mikrofon" rozmiar={24} />
          </button>
        </div>
        {(dyktowanie.slucha || dyktowanie.blad) && (
          <p className={dyktowanie.blad ? "blad-pola" : "podpowiedz-glosu"} role="status">
            {dyktowanie.blad ?? (
              <>
                <span className="kropka-live" aria-hidden="true" /> Słucham… powiedz np. „{opis.przyklad}”
              </>
            )}
          </p>
        )}

        <fieldset className="grupa">
          <legend>Usługa · {opis.nazwa}</legend>
          <div className="chipy">
            {propozycje.map((u) => (
              <button
                key={u.kod}
                type="button"
                className={`chip ${wybranaUsluga === u.kod ? "chip-wybrany" : ""}`}
                aria-pressed={wybranaUsluga === u.kod}
                onClick={() => setWybranaUsluga(u.kod)}
              >
                {u.nazwa}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grupa">
          <legend>Kiedy</legend>
          <div className="segment">
            {KIEDY.map((k) => (
              <button key={k.wartosc} type="button" aria-pressed={kiedy === k.wartosc} className={kiedy === k.wartosc ? "wybrany" : ""} onClick={() => setKiedy(k.wartosc)}>
                {k.etykieta}
              </button>
            ))}
          </div>
          <div className="chipy">
            {GODZINY.map((g) => (
              <button key={g ?? "kazda"} type="button" aria-pressed={odGodziny === g} className={`chip ${odGodziny === g ? "chip-wybrany" : ""}`} onClick={() => setOdGodziny(g)}>
                {g === null ? "Każda godzina" : `po ${g}:00`}
              </button>
            ))}
          </div>
        </fieldset>

        {branza === "czas_wolny" && (
          <fieldset className="grupa">
            <legend>Ile osób</legend>
            <div className="chipy">
              {OSOBY.map((n) => (
                <button key={n} type="button" aria-pressed={osoby === n} className={`chip ${osoby === n ? "chip-wybrany" : ""}`} onClick={() => setOsoby(n)}>
                  {n === 8 ? "8 i więcej" : `${n} ${odmiana(n, "osoba", "osoby", "osób")}`}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="grupa">
          <legend>Ile chcesz wydać</legend>
          <div className="chipy">
            {LIMITY.map((l) => (
              <button key={l ?? "bez"} type="button" aria-pressed={limitZl === l} className={`chip ${limitZl === l ? "chip-wybrany" : ""}`} onClick={() => setLimitZl(l)}>
                {l === null ? "Bez limitu" : `do ${l} zł`}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grupa">
          <legend>Jak wybierasz</legend>
          <div className="opcje-trybu">
            <button type="button" aria-pressed={tryb === "zbieram"} className={tryb === "zbieram" ? "wybrany" : ""} onClick={() => setTryb("zbieram")}>
              <strong>Porównuję oferty</strong>
              <span>Zbieramy odpowiedzi przez 10 minut, Ty wybierasz.</span>
            </button>
            <button type="button" aria-pressed={tryb === "pierwsza"} className={tryb === "pierwsza" ? "wybrany" : ""} onClick={() => setTryb("pierwsza")}>
              <strong>Biorę pierwszą pasującą</strong>
              <span>Rezerwujemy od razu pierwszy termin w Twoich warunkach.</span>
            </button>
          </div>
        </fieldset>

        {medyczna && (
          <div className="zgoda-medyczna">
            <p>
              <Ikona nazwa="tarcza" rozmiar={18} />
              Nie opisuj objawów. Wystarczy rodzaj wizyty.
            </p>
            <label>
              <input id="zgoda-zdrowie" type="checkbox" checked={zgodaZdrowie} onChange={(e) => setZgodaZdrowie(e.target.checked)} />
              <span>
                Zgadzam się, żeby Wolne Okienko przekazało gabinetom w okolicy rodzaj wizyty, której szukam, w celu znalezienia
                terminu. To informacja o zdrowiu (art. 9 ust. 2 lit. a RODO); zgodę mogę wycofać w profilu.
              </span>
            </label>
          </div>
        )}
      </div>

      <footer className="nakladka-stopka">
        <p className="zasieg">
          <span className="kropka-live" aria-hidden="true" />
          {podglad ? (
            <span>
              Zapytanie trafi do{" "}
              <strong>
                {liczbaWykonawcow} {liczbaWykonawcow === 1 ? opis.wykonawcaDop[0] : opis.wykonawcaDop[1]}
              </strong>{" "}
              w promieniu {km(plan.promienKm)}
            </span>
          ) : (
            <span>
              Zapytanie trafi do <strong>{opis.wykonawcaDop[1]} w okolicy</strong>, które mają teraz wolny czas
            </span>
          )}
        </p>
        <button
          type="button"
          className="btn btn-duzy"
          disabled={!moznaWyslac}
          onClick={() =>
            usluga &&
            onWyslij({ usluga, kiedy, odGodziny, limitZl, tryb, liczbaOsob: branza === "czas_wolny" ? osoby : null, tekst, zgodaZdrowie: medyczna && zgodaZdrowie })
          }
        >
          {!usluga ? "Wybierz usługę" : medyczna && !zgodaZdrowie ? "Zaznacz zgodę, żeby wysłać" : wysylam ? "Wysyłam…" : "Wyślij zapytanie"}
        </button>
      </footer>
    </div>
  );
}
