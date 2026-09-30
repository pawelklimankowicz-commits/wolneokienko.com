import { useEffect, useState } from "react";
import { SALONY } from "@/dane/przyklad";
import { czyZwolnionaPromocja, prowizjaOd, PROMOCJA_STARTOWA } from "@/domain/prowizja";
import { mmss, zlote, zloteGr } from "@/lib/format";
import { Ikona } from "@/ui/Ikona";
import { EtykietaPodgladu, NaglowekEkranu } from "@/ui/wspolne";

const DZIEN_MS = 24 * 60 * 60 * 1000;
const TERMIN_ODPOWIEDZI = 588;

/** Wizyty z aplikacji od aktywacji salonu (9 dni temu), cena w groszach. */
const WIZYTY_Z_APLIKACJI = [13000, 13000, 9000, 15000, 13000, 18000, 13000];

export function Salon({ onWyjdz }: { onWyjdz: () => void }) {
  const s = SALONY[0];
  const [przyjmuje, setPrzyjmuje] = useState(true);
  const [sekundy, setSekundy] = useState(0);
  const [odpowiedz, setOdpowiedz] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setSekundy((x) => Math.min(x + 1, TERMIN_ODPOWIEDZI)), 1000);
    return () => clearInterval(t);
  }, []);

  // Promocja startowa i prowizja liczone tym samym kodem, który rozlicza salony.
  const aktywowanyAt = new Date(Date.now() - 9 * DZIEN_MS);
  const rozliczenie = WIZYTY_Z_APLIKACJI.map((cenaGr, i) => {
    const zwolniona = czyZwolnionaPromocja({ aktywowanyAt, wizytyPrzed: i }, new Date());
    return { cenaGr, zwolniona, prowizja: zwolniona ? null : prowizjaOd(cenaGr) };
  });
  const darmowe = rozliczenie.filter((r) => r.zwolniona).length;
  const prowizjaNetto = rozliczenie.reduce((n, r) => n + (r.prowizja?.nettoGr ?? 0), 0);
  const obrot = WIZYTY_Z_APLIKACJI.reduce((a, b) => a + b, 0);

  return (
    <div className="nakladka">
      <NaglowekEkranu
        tytul={s.nazwa}
        onWstecz={onWyjdz}
        prawa={<span className="wyciszony maly">salon</span>}
      />
      <div className="nakladka-tresc">
        <EtykietaPodgladu />
        <button
          type="button"
          className={`przelacznik ${przyjmuje ? "wlaczony" : ""}`}
          role="switch"
          aria-checked={przyjmuje}
          onClick={() => setPrzyjmuje((p) => !p)}
        >
          <span>
            <strong>{przyjmuje ? "Przyjmuję zapytania" : "Nie przyjmuję zapytań"}</strong>
            <small>{przyjmuje ? "Klientki z okolicy widzą, że masz wolny czas." : "Włącz, gdy masz lukę w grafiku."}</small>
          </span>
          <span className="przelacznik-suwak" aria-hidden="true" />
        </button>

        {przyjmuje && !odpowiedz && (
          <article className="zapytanie-salonu">
            <span className="tag-nowe">Nowe zapytanie</span>
            <h2>Manicure hybrydowy</h2>
            <p className="wyciszony">dziś 16:00–19:00 · do 150 zł · 1,2 km od salonu</p>
            <span className="licznik">
              <Ikona nazwa="zegar" rozmiar={14} />
              <span className="mono">{mmss(TERMIN_ODPOWIEDZI - sekundy)}</span> na odpowiedź
            </span>
            <div className="odpowiedzi">
              {["16:30", "17:30"].map((g) => (
                <button key={g} type="button" className="btn btn-duzy mono" onClick={() => setOdpowiedz(`${g} · 130 zł`)}>
                  {g} · 130 zł
                </button>
              ))}
              <button type="button" className="btn btn-duzy btn-obrys" onClick={() => setOdpowiedz("18:15 · 130 zł")}>
                Inna godzina
              </button>
              <button type="button" className="btn btn-tekst" onClick={() => setOdpowiedz("")}>
                Nie teraz
              </button>
            </div>
          </article>
        )}

        {odpowiedz !== null && (
          <article className="zapytanie-salonu wyslane">
            <span className="potwierdzenie-znak maly" aria-hidden="true">
              <Ikona nazwa="ok" rozmiar={20} />
            </span>
            <h2>{odpowiedz ? `Oferta wysłana: ${odpowiedz}` : "Pominięte"}</h2>
            <p className="wyciszony">
              {odpowiedz ? "Dostaniesz powiadomienie, gdy klientka wybierze Twój termin." : "To zapytanie nie wpłynie na Twój wskaźnik odpowiedzi."}
            </p>
            <button type="button" className="link" onClick={() => setOdpowiedz(null)}>
              Pokaż zapytanie jeszcze raz
            </button>
          </article>
        )}

        <section className="podsumowanie-salonu">
          <h2 className="maly-naglowek">Od aktywacji (9 dni)</h2>
          <div className="kafle">
            <div className="kafel">
              <strong>{WIZYTY_Z_APLIKACJI.length}</strong>
              <span>wizyt z aplikacji</span>
            </div>
            <div className="kafel">
              <strong>{zlote(obrot)}</strong>
              <span>obrotu z tych wizyt</span>
            </div>
            <div className="kafel">
              <strong>{zloteGr(prowizjaNetto)}</strong>
              <span>prowizji + VAT</span>
            </div>
          </div>
          <p className="promocja-info">
            <Ikona nazwa="prezent" rozmiar={18} />
            Miesiąc próbny: jeszcze {PROMOCJA_STARTOWA.dniProbne - 9} dni. {darmowe} z {PROMOCJA_STARTOWA.darmoweWizyty} darmowych
            klientek wykorzystane, kolejne wizyty po 20% + VAT.
          </p>
        </section>

        <button type="button" className="btn btn-duzy btn-obrys" onClick={onWyjdz}>
          Wróć do aplikacji klientki
        </button>
      </div>
    </div>
  );
}
