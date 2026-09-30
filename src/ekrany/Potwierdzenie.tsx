import { KATALOG_USLUG } from "@/domain/katalog-uslug";
import { terminCzytelny } from "@/domain/okno";
import type { WizytaWidok } from "@/domain/widoki";
import { cena } from "@/lib/format";
import { pobierzIcs, plikIcs } from "@/lib/kalendarz";
import { telefonCzytelny } from "@/lib/telefon";
import { Ikona } from "@/ui/Ikona";

export function Potwierdzenie({ w, onGotowe }: { w: WizytaWidok; onGotowe: () => void }) {
  const usluga = KATALOG_USLUG.find((u) => u.kod === w.uslugaKod);
  const termin = new Date(w.termin);
  const doKalendarza = () =>
    pobierzIcs(
      "wizyta-wolne-okienko.ics",
      plikIcs({
        id: w.id,
        tytul: `${usluga?.nazwa ?? "Wizyta"} — ${w.salonNazwa}`,
        adres: w.adres,
        termin,
        czasMin: usluga?.typowyCzasMin ?? 60,
        opis: `Umówione przez Wolne Okienko. Płacisz na miejscu: ${cena(w.cenaGr)}.${w.telefon ? ` Telefon: ${telefonCzytelny(w.telefon)}.` : ""}`,
      }),
    );
  return (
    <div className="nakladka">
      <div className="nakladka-tresc potwierdzenie">
        <span className="potwierdzenie-znak" aria-hidden="true">
          <Ikona nazwa="ok" rozmiar={34} />
        </span>
        <h1>Zarezerwowane</h1>
        <p className="wyciszony">Termin jest Twój. Salon dostał Twój numer telefonu i wie, że przyjdziesz.</p>

        <article className="karta-rezerwacji">
          <div className="okladka" style={{ height: 96, background: `linear-gradient(135deg, ${w.kolory[1]}, ${w.kolory[0]})` }} aria-hidden="true" />
          <div className="karta-rezerwacji-tresc">
            <h2>{w.salonNazwa}</h2>
            <p className="wyciszony maly">{w.adres}</p>
            <dl>
              <div>
                <dt>Usługa</dt>
                <dd>{usluga?.nazwa ?? w.uslugaKod}</dd>
              </div>
              <div>
                <dt>Termin</dt>
                <dd>{terminCzytelny(termin, new Date())}</dd>
              </div>
              <div>
                <dt>Płacisz w salonie</dt>
                <dd className="cena">{cena(w.cenaGr)}</dd>
              </div>
              {w.telefon && (
                <div>
                  <dt>Telefon</dt>
                  <dd>
                    <a href={`tel:${w.telefon}`}>{telefonCzytelny(w.telefon)}</a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </article>

        <p className="wyciszony maly">Nie dasz rady przyjść? Odwołaj wizytę w zakładce Wizyty — to nic nie kosztuje, a salon odda termin komuś innemu.</p>
      </div>
      <footer className="nakladka-stopka">
        <button type="button" className="btn btn-duzy btn-obrys" onClick={doKalendarza}>
          Dodaj do kalendarza
        </button>
        <button type="button" className="btn btn-duzy" onClick={onGotowe}>
          Gotowe
        </button>
      </footer>
    </div>
  );
}
