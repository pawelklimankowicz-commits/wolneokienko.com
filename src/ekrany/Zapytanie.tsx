import { useEffect, useMemo, useRef, useState } from "react";
import { KANDYDACI_PODGLAD } from "@/dane/przyklad";
import { zaplanujFale } from "@/domain/fale";
import { KATALOG_USLUG, branzaUslugi, czyMedyczna, opisBranzy, uslugiBranzy, type Branza, type Usluga } from "@/domain/katalog-uslug";
import { useDyktowanie } from "@/lib/dyktowanie";
import { km } from "@/lib/format";
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
  liczbaWykonawcow: number;
  promienKm: number;
}

const KIEDY: { wartosc: Kiedy; etykieta: string }[] = [
  { wartosc: "teraz", etykieta: "Teraz" },
  { wartosc: "dzis", etykieta: "Dziś" },
  { wartosc: "jutro", etykieta: "Jutro" },
  { wartosc: "weekend", etykieta: "Weekend" },
];
const GODZINY: (number | null)[] = [null, 8, 12, 16, 18];
const LIMITY: (number | null)[] = [null, 100, 150, 200, 300];

export function Zapytanie({
  tekstPoczatkowy,
  branzaPoczatkowa,
  sluchajOdRazu = false,
  onWyslij,
  onZamknij,
}: {
  tekstPoczatkowy: string;
  branzaPoczatkowa?: Branza;
  /** otwarte przyciskiem mikrofonu na starcie — od razu słuchamy */
  sluchajOdRazu?: boolean;
  onWyslij: (z: WyslaneZapytanie) => void;
  onZamknij: () => void;
}) {
  const poczatek = parsujZapytanie(tekstPoczatkowy);
  const [tekst, setTekst] = useState(tekstPoczatkowy);
  const [wybranaUsluga, setWybranaUsluga] = useState<string | null>(poczatek.uslugi[0]?.kod ?? null);
  const [kiedy, setKiedy] = useState<Kiedy>(poczatek.kiedy ?? "dzis");
  const [odGodziny, setOdGodziny] = useState<number | null>(poczatek.odGodziny);
  const [limitZl, setLimitZl] = useState<number | null>(poczatek.limitZl);
  const [tryb, setTryb] = useState<TrybWyboru>("zbieram");
  const [zgodaZdrowie, setZgodaZdrowie] = useState(false);

  const rozbior = useMemo(() => parsujZapytanie(tekst), [tekst]);

  const zmienTekst = (t: string) => {
    setTekst(t);
    const r = parsujZapytanie(t);
    if (r.uslugi[0]) setWybranaUsluga(r.uslugi[0].kod);
    if (r.kiedy) setKiedy(r.kiedy);
    if (r.odGodziny !== null) setOdGodziny(r.odGodziny);
    if (r.limitZl !== null) setLimitZl(r.limitZl);
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
  const moznaWyslac = usluga !== null && (!medyczna || zgodaZdrowie);

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
          <span>
            Zapytanie trafi do{" "}
            <strong>
              {liczbaWykonawcow} {liczbaWykonawcow === 1 ? opis.wykonawcaDop[0] : opis.wykonawcaDop[1]}
            </strong>{" "}
            w promieniu {km(plan.promienKm)}
          </span>
        </p>
        <button
          type="button"
          className="btn btn-duzy"
          disabled={!moznaWyslac}
          onClick={() => usluga && onWyslij({ usluga, kiedy, odGodziny, limitZl, tryb, liczbaWykonawcow, promienKm: plan.promienKm })}
        >
          {!usluga ? "Wybierz usługę" : medyczna && !zgodaZdrowie ? "Zaznacz zgodę, żeby wysłać" : "Wyślij zapytanie"}
        </button>
      </footer>
    </div>
  );
}
