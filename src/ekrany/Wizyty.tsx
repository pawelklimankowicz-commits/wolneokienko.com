// Wizyty klientki z bazy: nadchodzące, do potwierdzenia po terminie
// (byłam / nie byłam / salon odwołał — podstawa rozliczenia prowizji), historia.
import { useCallback, useEffect, useState } from "react";
import { KATALOG_USLUG } from "@/domain/katalog-uslug";
import type { StatusWizyty, WizytaWidok } from "@/domain/widoki";
import type { KlientApi, Konto, OdpowiedzPoWizycie } from "@/lib/api";
import { cena } from "@/lib/format";
import { telefonCzytelny } from "@/lib/telefon";
import { AwatarKolory } from "@/ui/wspolne";

const ETYKIETA: Record<StatusWizyty, string> = {
  potwierdzona: "Potwierdzona",
  do_potwierdzenia: "Czekamy na Twoją odpowiedź",
  zakonczona: "Zakończona",
  odwolana_przez_klientke: "Odwołana przez Ciebie",
  odwolana_przez_salon: "Odwołana przez salon",
  nieobecnosc: "Nieobecność",
};

const miesiac = new Intl.DateTimeFormat("pl-PL", { month: "short" });
const godzina = new Intl.DateTimeFormat("pl-PL", { hour: "numeric", minute: "2-digit" });
const nazwaUslugi = (kod: string) => KATALOG_USLUG.find((u) => u.kod === kod)?.nazwa ?? kod;

function KartaWizyty({
  w,
  zajete,
  onPotwierdz,
  onOdwolaj,
  onZapytaj,
}: {
  w: WizytaWidok;
  zajete: boolean;
  onPotwierdz: (p: OdpowiedzPoWizycie) => void;
  onOdwolaj: () => void;
  onZapytaj: () => void;
}) {
  const [pytamOOdwolanie, setPytamOOdwolanie] = useState(false);
  const termin = new Date(w.termin);
  const trasa = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(w.adres)}`;
  return (
    <article className={`karta-wizyty status-${w.status}`}>
      <div className="karta-wizyty-lewa">
        <span className="pigulka-statusu">{ETYKIETA[w.status]}</span>
        <h3>{nazwaUslugi(w.uslugaKod)}</h3>
        <p className="salon-rzad">
          <AwatarKolory nazwa={w.salonNazwa} kolory={w.kolory} rozmiar={30} />
          {w.salonNazwa}
        </p>
        <p className="wyciszony maly">
          {cena(w.cenaGr)} · płatne na miejscu{w.status === "potwierdzona" ? ` · ${w.adres}` : ""}
        </p>

        {w.status === "do_potwierdzenia" && (
          <div className="pytanie-po-wizycie">
            <p>Byłaś na tej wizycie?</p>
            <div className="przyciski-rzad">
              <button type="button" className="btn btn-maly" disabled={zajete} onClick={() => onPotwierdz("bylam")}>
                Byłam
              </button>
              <button type="button" className="btn btn-maly btn-obrys" disabled={zajete} onClick={() => onPotwierdz("nie_bylam")}>
                Nie byłam
              </button>
              <button type="button" className="btn btn-maly btn-obrys" disabled={zajete} onClick={() => onPotwierdz("salon_odwolal")}>
                Salon odwołał
              </button>
            </div>
          </div>
        )}
        {w.status === "potwierdzona" && !pytamOOdwolanie && (
          <div className="przyciski-rzad">
            <a className="btn btn-maly btn-obrys" href={trasa} target="_blank" rel="noreferrer">
              Trasa
            </a>
            {w.telefon && (
              <a className="btn btn-maly btn-obrys" href={`tel:${w.telefon}`} aria-label={`Zadzwoń: ${telefonCzytelny(w.telefon)}`}>
                Zadzwoń
              </a>
            )}
            <button type="button" className="btn btn-maly btn-obrys" onClick={() => setPytamOOdwolanie(true)}>
              Odwołaj
            </button>
          </div>
        )}
        {w.status === "potwierdzona" && pytamOOdwolanie && (
          <div className="pytanie-po-wizycie">
            <p>Odwołać wizytę? Salon dostanie wiadomość i odda termin komuś innemu.</p>
            <div className="przyciski-rzad">
              <button type="button" className="btn btn-maly" disabled={zajete} onClick={onOdwolaj}>
                Tak, odwołuję
              </button>
              <button type="button" className="btn btn-maly btn-obrys" onClick={() => setPytamOOdwolanie(false)}>
                Zostawiam
              </button>
            </div>
          </div>
        )}
        {(w.status === "zakonczona" || w.status.startsWith("odwolana") || w.status === "nieobecnosc") && (
          <div className="przyciski-rzad">
            <button type="button" className="btn btn-maly" onClick={onZapytaj}>
              Zapytaj ponownie
            </button>
          </div>
        )}
      </div>
      <div className="karta-wizyty-data">
        <span>{miesiac.format(termin).replace(".", "")}</span>
        <strong>{termin.getDate()}</strong>
        <span className="mono">{godzina.format(termin)}</span>
      </div>
    </article>
  );
}

export function Wizyty({
  api,
  konto,
  onZapytaj,
  onZaloguj,
  onInfo,
}: {
  api: KlientApi;
  /** undefined — jeszcze sprawdzamy sesję */
  konto: Konto | null | undefined;
  onZapytaj: (tekst: string) => void;
  onZaloguj: () => void;
  onInfo: (tekst: string) => void;
}) {
  const [wizyty, setWizyty] = useState<WizytaWidok[] | null>(null);
  const [zajeta, setZajeta] = useState<string | null>(null);
  const zalogowana = !!konto || api.podglad;

  const wczytaj = useCallback(async () => setWizyty(await api.mojeWizyty()), [api]);
  useEffect(() => {
    if (zalogowana) wczytaj();
  }, [zalogowana, wczytaj]);

  const akcja = async (id: string, zadanie: Promise<{ ok: boolean; komunikat?: string }>, dziekujemy: string) => {
    setZajeta(id);
    const w = await zadanie;
    setZajeta(null);
    onInfo(w.ok ? dziekujemy : (w.komunikat ?? "Coś poszło nie tak."));
    await wczytaj();
  };

  const lista = wizyty ?? [];
  const sekcje: { tytul: string; wizyty: WizytaWidok[] }[] = [
    { tytul: "Do potwierdzenia", wizyty: lista.filter((w) => w.status === "do_potwierdzenia") },
    { tytul: "Nadchodzące", wizyty: lista.filter((w) => w.status === "potwierdzona").sort((a, b) => a.termin.localeCompare(b.termin)) },
    { tytul: "Zakończone i odwołane", wizyty: lista.filter((w) => w.status !== "potwierdzona" && w.status !== "do_potwierdzenia") },
  ];

  return (
    <div className="ekran ekran-jasny">
      <header className="tytul-ekranu">
        <h1>Wizyty</h1>
      </header>

      {konto === null && !api.podglad && (
        <div className="pusto">
          <p>Tu zobaczysz swoje rezerwacje. Zaloguj się numerem telefonu, którym rezerwujesz.</p>
          <button type="button" className="btn" onClick={onZaloguj}>
            Zaloguj się
          </button>
        </div>
      )}
      {zalogowana && wizyty !== null && lista.length === 0 && (
        <div className="pusto">
          <p>Nie masz jeszcze wizyt. Napisz, czego potrzebujesz i na kiedy — salony z okolicy odpowiedzą w kilka minut.</p>
          <button type="button" className="btn" onClick={() => onZapytaj("")}>
            Nowe zapytanie
          </button>
        </div>
      )}

      {sekcje
        .filter((s) => s.wizyty.length > 0)
        .map((s) => (
          <section key={s.tytul} className="sekcja-wizyt">
            <h2 className="maly-naglowek">{s.tytul}</h2>
            {s.wizyty.map((w) => (
              <KartaWizyty
                key={w.id}
                w={w}
                zajete={zajeta === w.id}
                onPotwierdz={(p) =>
                  akcja(w.id, api.potwierdzWizyte(w.id, p), p === "bylam" ? "Dziękujemy! Wizyta zapisana jako zakończona." : "Dziękujemy za informację.")
                }
                onOdwolaj={() => akcja(w.id, api.odwolajWizyte(w.id), "Wizyta odwołana. Salon może oddać termin innej osobie.")}
                onZapytaj={() => onZapytaj(`${nazwaUslugi(w.uslugaKod).toLowerCase()} dziś`)}
              />
            ))}
          </section>
        ))}
    </div>
  );
}
