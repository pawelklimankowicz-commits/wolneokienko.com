import { useEffect, useMemo, useState } from "react";
import { ofertyDla, salon, type Oferta } from "@/dane/przyklad";
import { branzaUslugi, czyMedyczna, opisBranzy } from "@/domain/katalog-uslug";
import { km, minutyGodziny, mmss, odmiana, zlote } from "@/lib/format";
import { Ikona } from "@/ui/Ikona";
import { AwatarSalonu, NaglowekEkranu, OcenaWLinii } from "@/ui/wspolne";
import type { WyslaneZapytanie } from "./Zapytanie";

type Sortowanie = "najszybciej" | "najtaniej" | "najblizej";
const TERMIN_SEK = 600;
/** Po tylu sekundach bez żadnej oferty podpowiadamy zmianę warunków. */
const BEZ_OFERT_PO_SEK = 12;

const KIEDY_TEKST = { teraz: "teraz", dzis: "dziś", jutro: "jutro", weekend: "w weekend" } as const;

export function Oferty({
  zapytanie,
  onWybierz,
  onAnuluj,
}: {
  zapytanie: WyslaneZapytanie;
  onWybierz: (o: Oferta) => void;
  onAnuluj: () => void;
}) {
  const [sekundy, setSekundy] = useState(0);
  const [sort, setSort] = useState<Sortowanie>("najszybciej");
  const opis = opisBranzy(branzaUslugi(zapytanie.usluga));
  const medyczna = czyMedyczna(zapytanie.usluga);

  useEffect(() => {
    const t = setInterval(() => setSekundy((s) => Math.min(s + 1, TERMIN_SEK)), 1000);
    return () => clearInterval(t);
  }, []);

  const wszystkie = useMemo(() => ofertyDla(zapytanie.usluga, zapytanie.odGodziny), [zapytanie.usluga, zapytanie.odGodziny]);
  const oferty = useMemo(
    () =>
      wszystkie
        .filter((o) => o.poSek <= sekundy)
        .filter((o) => zapytanie.limitZl === null || o.cenaGr <= zapytanie.limitZl * 100)
        .sort((a, b) => {
          if (sort === "najtaniej") return a.cenaGr - b.cenaGr;
          if (sort === "najblizej") return salon(a.salonId).km - salon(b.salonId).km;
          return minutyGodziny(a.godzina) - minutyGodziny(b.godzina);
        }),
    [wszystkie, sekundy, sort, zapytanie.limitZl],
  );

  // Tryb „biorę pierwszą pasującą”: rezerwujemy pierwszą ofertę, która przyjdzie.
  const pierwsza = oferty[0];
  useEffect(() => {
    if (zapytanie.tryb === "pierwsza" && pierwsza) {
      const t = setTimeout(() => onWybierz(pierwsza), 900);
      return () => clearTimeout(t);
    }
  }, [zapytanie.tryb, pierwsza, onWybierz]);

  const warunki = [
    zapytanie.usluga.nazwa,
    KIEDY_TEKST[zapytanie.kiedy] + (zapytanie.odGodziny !== null ? ` po ${zapytanie.odGodziny}:00` : ""),
    zapytanie.limitZl !== null ? `do ${zapytanie.limitZl} zł` : null,
  ].filter(Boolean);
  const n = zapytanie.liczbaWykonawcow;

  return (
    <div className="nakladka">
      <NaglowekEkranu
        tytul="Oferty na żywo"
        onWstecz={onAnuluj}
        prawa={
          <button type="button" className="link" onClick={onAnuluj}>
            Anuluj
          </button>
        }
      />
      <div className="nakladka-tresc">
        <section className="radar" aria-live="polite">
          <div className="radar-kola" aria-hidden="true">
            <span />
            <span />
            <span />
            <Ikona nazwa="okienka" rozmiar={26} />
          </div>
          <div className="radar-opis">
            <p className="radar-tytul">
              {oferty.length === 0
                ? `Zapytanie wysłane do ${n} ${n === 1 ? opis.wykonawcaDop[0] : opis.wykonawcaDop[1]}`
                : `Masz ${oferty.length} ${odmiana(oferty.length, "ofertę", "oferty", "ofert")}`}
            </p>
            <p className="wyciszony maly">{warunki.join(" · ")}</p>
            <span className="licznik">
              <Ikona nazwa="zegar" rozmiar={14} />
              {zapytanie.tryb === "pierwsza" ? "rezerwujemy pierwszą pasującą · " : "zbieramy oferty · "}
              <span className="mono">{mmss(TERMIN_SEK - sekundy)}</span>
            </span>
          </div>
        </section>

        <div className="segment" role="tablist" aria-label="Sortowanie ofert">
          {(["najszybciej", "najtaniej", "najblizej"] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={sort === s} className={sort === s ? "wybrany" : ""} onClick={() => setSort(s)}>
              {s === "najszybciej" ? "Najszybciej" : s === "najtaniej" ? "Najtaniej" : "Najbliżej"}
            </button>
          ))}
        </div>

        <div className="lista-ofert">
          {oferty.map((o, i) => {
            const s = salon(o.salonId);
            return (
              <article key={o.id} className={`karta-oferty ${i === 0 && !medyczna ? "najlepsza" : ""}`}>
                <div className="karta-oferty-gora">
                  <AwatarSalonu salon={s} rozmiar={42} />
                  <div className="karta-oferty-salon">
                    <h3>{s.nazwa}</h3>
                    <p className="wyciszony maly">
                      <OcenaWLinii salon={s} /> · {s.km > 0 ? `${km(s.km)} · ${s.dzielnica}` : s.adres}
                    </p>
                  </div>
                  <div className="karta-oferty-termin">
                    <strong className="mono">{o.godzina}</strong>
                    <span className="cena">{zlote(o.cenaGr)}</span>
                  </div>
                </div>
                <button type="button" className="btn" onClick={() => onWybierz(o)}>
                  Wybieram
                </button>
              </article>
            );
          })}
          {oferty.length === 0 && sekundy < BEZ_OFERT_PO_SEK &&
            [0, 1].map((i) => (
              <div key={i} className="karta-oferty szkielet" aria-hidden="true">
                <span />
                <span />
              </div>
            ))}
          {oferty.length === 0 && sekundy >= BEZ_OFERT_PO_SEK && (
            <div className="pusto">
              <p>
                Na razie nikt nie ma terminu w Twoich warunkach. Czekamy dalej, ale szybciej znajdziesz termin, jeśli podniesiesz
                limit ceny albo poszerzysz godziny.
              </p>
              <button type="button" className="btn btn-obrys" onClick={onAnuluj}>
                Zmień zapytanie
              </button>
            </div>
          )}
        </div>
        <p className="wyciszony maly srodek">
          {medyczna ? "Kolejność według terminu. Bez promocji i płatnych wyróżnień. " : ""}Płacisz na miejscu. Nie pobieramy przedpłat.
        </p>
      </div>
    </div>
  );
}
