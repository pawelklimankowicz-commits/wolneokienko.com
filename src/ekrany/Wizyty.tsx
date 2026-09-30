import { useState } from "react";
import { WIZYTY, salon, type StatusWizyty, type Wizyta } from "@/dane/przyklad";
import type { PotwierdzenieKlientki } from "@/domain/wynik-wizyty";
import { zlote } from "@/lib/format";
import { AwatarSalonu, EtykietaPodgladu } from "@/ui/wspolne";

const ETYKIETA: Record<StatusWizyty | "nieobecnosc", string> = {
  potwierdzona: "Potwierdzona",
  do_potwierdzenia: "Czekamy na Twoją odpowiedź",
  zakonczona: "Zakończona",
  odwolana_przez_salon: "Odwołana przez salon",
  nieobecnosc: "Nieobecność",
};

function KartaWizyty({
  w,
  status,
  onPotwierdz,
  onZapytaj,
  onInfo,
}: {
  w: Wizyta;
  status: StatusWizyty | "nieobecnosc";
  onPotwierdz: (p: PotwierdzenieKlientki) => void;
  onZapytaj: () => void;
  onInfo: (tekst: string) => void;
}) {
  const s = salon(w.salonId);
  return (
    <article className={`karta-wizyty status-${status}`}>
      <div className="karta-wizyty-lewa">
        <span className="pigulka-statusu">{ETYKIETA[status]}</span>
        <h3>{w.usluga}</h3>
        <p className="salon-rzad">
          <AwatarSalonu salon={s} rozmiar={30} />
          {s.nazwa}
        </p>
        <p className="wyciszony maly">{zlote(w.cenaGr)} · płatne w salonie</p>

        {status === "do_potwierdzenia" && (
          <div className="pytanie-po-wizycie">
            <p>Byłaś na tej wizycie?</p>
            <div className="przyciski-rzad">
              <button type="button" className="btn btn-maly" onClick={() => onPotwierdz("bylam")}>
                Byłam
              </button>
              <button type="button" className="btn btn-maly btn-obrys" onClick={() => onPotwierdz("nie_bylam")}>
                Nie byłam
              </button>
              <button type="button" className="btn btn-maly btn-obrys" onClick={() => onPotwierdz("salon_odwolal")}>
                Salon odwołał
              </button>
            </div>
          </div>
        )}
        {status === "potwierdzona" && (
          <div className="przyciski-rzad">
            <button type="button" className="btn btn-maly btn-obrys" onClick={() => onInfo("Trasa do salonu otworzy się w mapach telefonu.")}>
              Trasa
            </button>
            <button type="button" className="btn btn-maly btn-obrys" onClick={() => onInfo("Wizyta odwołana. Salon dostał powiadomienie i może oddać termin innej osobie.")}>
              Odwołaj
            </button>
          </div>
        )}
        {(status === "zakonczona" || status === "odwolana_przez_salon" || status === "nieobecnosc") && (
          <div className="przyciski-rzad">
            <button type="button" className="btn btn-maly" onClick={onZapytaj}>
              Zapytaj ponownie
            </button>
            {status === "zakonczona" && (
              <button type="button" className="btn btn-maly btn-obrys" onClick={() => onInfo("Dziękujemy za ocenę.")}>
                Oceń
              </button>
            )}
          </div>
        )}
      </div>
      <div className="karta-wizyty-data">
        <span>{w.miesiac}</span>
        <strong>{w.dzien}</strong>
        <span className="mono">{w.godzina}</span>
      </div>
    </article>
  );
}

export function Wizyty({ onZapytaj, onInfo }: { onZapytaj: (tekst: string) => void; onInfo: (tekst: string) => void }) {
  const [statusy, setStatusy] = useState<Record<string, StatusWizyty | "nieobecnosc">>(
    Object.fromEntries(WIZYTY.map((w) => [w.id, w.status])),
  );

  const potwierdz = (w: Wizyta, p: PotwierdzenieKlientki) => {
    const nowy = p === "bylam" ? "zakonczona" : p === "salon_odwolal" ? "odwolana_przez_salon" : "nieobecnosc";
    setStatusy((st) => ({ ...st, [w.id]: nowy }));
    onInfo(p === "bylam" ? "Dziękujemy! Wizyta zapisana jako zakończona." : "Dziękujemy za informację.");
  };

  const sekcje: { tytul: string; wizyty: Wizyta[] }[] = [
    { tytul: "Nadchodzące", wizyty: WIZYTY.filter((w) => statusy[w.id] === "potwierdzona") },
    { tytul: "Do potwierdzenia", wizyty: WIZYTY.filter((w) => statusy[w.id] === "do_potwierdzenia") },
    {
      tytul: "Zakończone i odwołane",
      wizyty: WIZYTY.filter((w) => ["zakonczona", "odwolana_przez_salon", "nieobecnosc"].includes(statusy[w.id])),
    },
  ];

  return (
    <div className="ekran ekran-jasny">
      <header className="tytul-ekranu">
        <h1>Wizyty</h1>
        <EtykietaPodgladu />
      </header>
      {sekcje
        .filter((s) => s.wizyty.length > 0)
        .map((s) => (
          <section key={s.tytul} className="sekcja-wizyt">
            <h2 className="maly-naglowek">{s.tytul}</h2>
            {s.wizyty.map((w) => (
              <KartaWizyty
                key={w.id}
                w={w}
                status={statusy[w.id]}
                onPotwierdz={(p) => potwierdz(w, p)}
                onZapytaj={() => onZapytaj(`${w.usluga.toLowerCase()} dziś`)}
                onInfo={onInfo}
              />
            ))}
          </section>
        ))}
    </div>
  );
}
