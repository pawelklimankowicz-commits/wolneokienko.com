import { useMemo, useState } from "react";
import { KANDYDACI_PODGLAD } from "@/dane/przyklad";
import { zaplanujFale } from "@/domain/fale";
import { KATALOG_USLUG, type Usluga } from "@/domain/katalog-uslug";
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
  liczbaSalonow: number;
  promienKm: number;
}

const KIEDY: { wartosc: Kiedy; etykieta: string }[] = [
  { wartosc: "teraz", etykieta: "Teraz" },
  { wartosc: "dzis", etykieta: "Dziś" },
  { wartosc: "jutro", etykieta: "Jutro" },
  { wartosc: "weekend", etykieta: "Weekend" },
];
const GODZINY: (number | null)[] = [null, 10, 12, 16, 18];
const LIMITY: (number | null)[] = [null, 100, 150, 200, 300];
const PODPOWIEDZI = ["manicure_hybrydowy", "przedluzanie_paznokci_zel", "pedicure_hybrydowy", "rzesy_1_1", "strzyzenie_meskie"];

export function Zapytanie({
  tekstPoczatkowy,
  onWyslij,
  onZamknij,
}: {
  tekstPoczatkowy: string;
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

  const rozbior = useMemo(() => parsujZapytanie(tekst), [tekst]);

  const zmienTekst = (t: string) => {
    setTekst(t);
    const r = parsujZapytanie(t);
    if (r.uslugi[0]) setWybranaUsluga(r.uslugi[0].kod);
    if (r.kiedy) setKiedy(r.kiedy);
    if (r.odGodziny !== null) setOdGodziny(r.odGodziny);
    if (r.limitZl !== null) setLimitZl(r.limitZl);
  };

  const propozycje = useMemo(() => {
    const kody = [...rozbior.uslugi.map((u) => u.kod), ...PODPOWIEDZI];
    return [...new Set(kody)].slice(0, 6).map((k) => KATALOG_USLUG.find((u) => u.kod === k)!);
  }, [rozbior]);

  const plan = useMemo(() => zaplanujFale(KANDYDACI_PODGLAD), []);
  const liczbaSalonow = plan.fale.reduce((n, f) => n + f.salonIds.length, 0);
  const usluga = KATALOG_USLUG.find((u) => u.kod === wybranaUsluga) ?? null;

  return (
    <div className="nakladka">
      <NaglowekEkranu tytul="Nowe zapytanie" onWstecz={onZamknij} />
      <div className="nakladka-tresc">
        <label className="pole-zapytania">
          <Ikona nazwa="iskra" />
          <textarea
            id="tekst-zapytania"
            rows={2}
            autoFocus
            placeholder="np. hybryda dziś po 16, do 150 zł"
            value={tekst}
            onChange={(e) => zmienTekst(e.target.value)}
          />
        </label>

        <fieldset className="grupa">
          <legend>Usługa</legend>
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
      </div>

      <footer className="nakladka-stopka">
        <p className="zasieg">
          <span className="kropka-live" aria-hidden="true" />
          <span>
            Zapytanie trafi do{" "}
            <strong>
              {liczbaSalonow} {odmiana(liczbaSalonow, "salonu", "salonów", "salonów")}
            </strong>{" "}
            w promieniu {km(plan.promienKm)}
          </span>
        </p>
        <button
          type="button"
          className="btn btn-duzy"
          disabled={!usluga}
          onClick={() =>
            usluga && onWyslij({ usluga, kiedy, odGodziny, limitZl, tryb, liczbaSalonow, promienKm: plan.promienKm })
          }
        >
          {usluga ? "Wyślij do salonów" : "Wybierz usługę"}
        </button>
      </footer>
    </div>
  );
}
