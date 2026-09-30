import type { Salon } from "@/dane/przyklad";
import { km, zlote } from "@/lib/format";
import { Ikona } from "@/ui/Ikona";
import { OcenaWLinii, Okladka } from "@/ui/wspolne";

export interface Rezerwacja {
  salon: Salon;
  usluga: string;
  dzien: string;
  godzina: string;
  cenaGr: number;
}

export function Potwierdzenie({ r, onGotowe, onInfo }: { r: Rezerwacja; onGotowe: () => void; onInfo: (t: string) => void }) {
  return (
    <div className="nakladka">
      <div className="nakladka-tresc potwierdzenie">
        <span className="potwierdzenie-znak" aria-hidden="true">
          <Ikona nazwa="ok" rozmiar={34} />
        </span>
        <h1>Zarezerwowane</h1>
        <p className="wyciszony">Salon potwierdził termin. Przypomnimy Ci o wizycie godzinę wcześniej.</p>

        <article className="karta-rezerwacji">
          <Okladka salon={r.salon} wysokosc={110} />
          <div className="karta-rezerwacji-tresc">
            <h2>{r.salon.nazwa}</h2>
            <p className="wyciszony maly">
              {r.salon.adres} · {km(r.salon.km)}
            </p>
            <OcenaWLinii salon={r.salon} />
            <dl>
              <div>
                <dt>Usługa</dt>
                <dd>{r.usluga}</dd>
              </div>
              <div>
                <dt>Termin</dt>
                <dd className="mono">
                  {r.dzien} {r.godzina}
                </dd>
              </div>
              <div>
                <dt>Płacisz w salonie</dt>
                <dd className="cena">{zlote(r.cenaGr)}</dd>
              </div>
            </dl>
          </div>
        </article>

        <p className="wyciszony maly">Nie dasz rady przyjść? Odwołaj wizytę w zakładce Wizyty, żeby salon mógł oddać termin komuś innemu.</p>
      </div>
      <footer className="nakladka-stopka">
        <button type="button" className="btn btn-duzy btn-obrys" onClick={() => onInfo("Wizyta dodana do kalendarza.")}>
          Dodaj do kalendarza
        </button>
        <button type="button" className="btn btn-duzy" onClick={onGotowe}>
          Gotowe
        </button>
      </footer>
    </div>
  );
}
