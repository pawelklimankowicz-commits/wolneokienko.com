import { useMemo, useState } from "react";
import { KATEGORIE, OKIENKA, salon, type Okienko } from "@/dane/przyklad";
import { KATALOG_USLUG, type Kategoria } from "@/domain/katalog-uslug";
import { km, zlote } from "@/lib/format";
import { Ikona } from "@/ui/Ikona";
import { EtykietaPodgladu, OcenaNaOkladce, Okladka } from "@/ui/wspolne";

type Sortowanie = "najwczesniej" | "najtaniej" | "najblizej";

const kategoriaUslugi = (kod: string) => KATALOG_USLUG.find((u) => u.kod === kod)?.kategoria;
const minuty = (o: Okienko) => (o.dzien === "jutro" ? 24 * 60 : 0) + Number(o.godzina.slice(0, 2)) * 60 + Number(o.godzina.slice(3));

const POPULARNE = ["Manicure hybrydowy", "Strzyżenie męskie", "Laminacja brwi", "Masaż relaksacyjny"];

export function Okienka({ onRezerwuj, onZapytaj }: { onRezerwuj: (o: Okienko) => void; onZapytaj: (tekst: string) => void }) {
  const [kategoria, setKategoria] = useState<Kategoria | "wszystkie">("wszystkie");
  const [szukane, setSzukane] = useState("");
  const [sort, setSort] = useState<Sortowanie>("najwczesniej");

  const lista = useMemo(() => {
    const q = szukane.trim().toLowerCase();
    return OKIENKA.filter((o) => kategoria === "wszystkie" || kategoriaUslugi(o.uslugaKod) === kategoria)
      .filter((o) => !q || o.usluga.toLowerCase().includes(q) || salon(o.salonId).nazwa.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "najtaniej") return a.cenaGr - b.cenaGr;
        if (sort === "najblizej") return salon(a.salonId).km - salon(b.salonId).km;
        return minuty(a) - minuty(b) || salon(a.salonId).km - salon(b.salonId).km;
      });
  }, [kategoria, szukane, sort]);

  return (
    <div className="ekran">
      <section className="pasek-szukania">
        <label className="pole-szukania">
          <Ikona nazwa="szukaj" />
          <input
            id="szukaj-okienek"
            type="search"
            placeholder="Szukaj usługi lub salonu"
            value={szukane}
            onChange={(e) => setSzukane(e.target.value)}
          />
        </label>
        <div className="pasek-szukania-rzad">
          <button type="button" className="pole-male">
            <Ikona nazwa="pinezka" rozmiar={18} /> W pobliżu
          </button>
          <button type="button" className="pole-male">
            <Ikona nazwa="wizyty" rozmiar={18} /> Dziś i jutro
          </button>
        </div>
        <div className="zakladki-kategorii" role="tablist" aria-label="Kategoria">
          {[{ kategoria: "wszystkie" as const, etykieta: "Wszystkie" }, ...KATEGORIE].map((k) => (
            <button
              key={k.kategoria}
              type="button"
              role="tab"
              aria-selected={kategoria === k.kategoria}
              className={kategoria === k.kategoria ? "aktywna" : ""}
              onClick={() => setKategoria(k.kategoria)}
            >
              {k.etykieta}
            </button>
          ))}
        </div>
      </section>

      <section className="tresc">
        <EtykietaPodgladu />
        <h2 className="maly-naglowek">Popularne usługi</h2>
        <div className="chipy-przewijane">
          {POPULARNE.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => setSzukane(p)}>
              {p}
            </button>
          ))}
        </div>

        <div className="rzad-narzedzi">
          <button type="button" className="chip chip-ikona" onClick={() => onZapytaj(szukane)}>
            <Ikona nazwa="iskra" rozmiar={18} /> Nie ma pasującego? Zapytaj salony
          </button>
          <label className="sortowanie">
            <span>Sortuj:</span>
            <select id="sortowanie-okienek" value={sort} onChange={(e) => setSort(e.target.value as Sortowanie)}>
              <option value="najwczesniej">Najwcześniej</option>
              <option value="najtaniej">Najtaniej</option>
              <option value="najblizej">Najbliżej</option>
            </select>
            <Ikona nazwa="w_dol" rozmiar={16} />
          </label>
        </div>

        <div className="wyniki-naglowek">
          <h2>Wolne okienka ({lista.length})</h2>
          <p className="wyciszony maly">
            Kolejność ustalają termin, cena albo odległość, zależnie od sortowania. Nie sprzedajemy miejsc w wynikach.
          </p>
        </div>

        {lista.length === 0 ? (
          <div className="pusto">
            <p>Brak wolnych okienek dla tego wyszukiwania.</p>
            <button type="button" className="btn" onClick={() => onZapytaj(szukane)}>
              Zapytaj salony w okolicy
            </button>
          </div>
        ) : (
          <div className="lista-wynikow">
            {lista.map((o) => {
              const s = salon(o.salonId);
              return (
                <article key={o.id} className="karta-wyniku">
                  <Okladka salon={s} wysokosc={168}>
                    <OcenaNaOkladce salon={s} />
                    <span className="pigulka-czas duza">
                      <Ikona nazwa="zegar" rozmiar={16} />
                      {o.dzien} {o.godzina}
                    </span>
                  </Okladka>
                  <div className="karta-wyniku-tresc">
                    <div>
                      <h3>{s.nazwa}</h3>
                      <p className="wyciszony">
                        {s.adres} · {km(s.km)}
                      </p>
                      <p className="usluga-cena">
                        {o.usluga} · <span className="cena">{zlote(o.cenaGr)}</span>
                      </p>
                    </div>
                    <button type="button" className="btn" onClick={() => onRezerwuj(o)}>
                      Rezerwuję
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
