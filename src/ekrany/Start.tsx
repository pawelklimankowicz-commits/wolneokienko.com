import { useState } from "react";
import { KATEGORIE, OKIENKA, SALONY, salon, type Okienko } from "@/dane/przyklad";
import { BRANZE, opisBranzy, type Branza } from "@/domain/katalog-uslug";
import { km, zlote } from "@/lib/format";
import { Ikona, Znak, type NazwaIkony } from "@/ui/Ikona";
import { obrazKategorii } from "@/ui/obrazyKategorii";
import { EtykietaPodgladu, OcenaNaOkladce, OcenaWLinii, Okladka } from "@/ui/wspolne";

const SZYBKIE = [
  { etykieta: "Teraz", tekst: "teraz" },
  { etykieta: "Dziś po 16", tekst: "dziś po 16" },
  { etykieta: "Jutro rano", tekst: "jutro po 8" },
  { etykieta: "Weekend", tekst: "weekend" },
];

export function Start({
  onZapytaj,
  onRezerwuj,
  onWszystkieOkienka,
}: {
  onZapytaj: (tekst: string, branza: Branza, glos?: boolean) => void;
  onRezerwuj: (o: Okienko) => void;
  onWszystkieOkienka: () => void;
}) {
  const [branza, setBranza] = useState<Branza>("uroda");
  const opis = opisBranzy(branza);
  const kategorie = KATEGORIE.filter((k) => k.branza === branza);
  const okienka = OKIENKA.filter((o) => salon(o.salonId).branza === branza);
  const ulubione = SALONY.filter((x) => x.branza === branza).slice(0, 3);

  return (
    <div className="ekran">
      <section className="hero">
        <div className="hero-gora">
          <div className="logo">
            <Znak rozmiar={28} />
            <span>Wolne Okienko</span>
          </div>
          <button type="button" className="lokalizacja">
            <Ikona nazwa="pinezka" rozmiar={16} />
            Jeżyce, Poznań
            <Ikona nazwa="w_dol" rozmiar={14} />
          </button>
        </div>

        <h1 className="hero-tytul">
          Wolny termin
          <br />
          <em>jeszcze dziś?</em>
        </h1>

        <div className="branze" role="tablist" aria-label="Branża">
          {BRANZE.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={branza === b.id}
              className={`branza ${branza === b.id ? "aktywna" : ""}`}
              onClick={() => setBranza(b.id)}
            >
              <Ikona nazwa={b.id as NazwaIkony} rozmiar={18} />
              {b.nazwa}
            </button>
          ))}
        </div>

        <div className="kompozytor-rzad">
          <button type="button" className="kompozytor" onClick={() => onZapytaj("", branza)}>
            <span className="kompozytor-ikona">
              <Ikona nazwa="iskra" rozmiar={20} />
            </span>
            <span className="kompozytor-tekst">
              <strong>Czego potrzebujesz i na kiedy?</strong>
              <span>np. {opis.przyklad}</span>
            </span>
          </button>
          <button type="button" className="mikrofon mikrofon-duzy" aria-label="Powiedz, czego szukasz" onClick={() => onZapytaj("", branza, true)}>
            <Ikona nazwa="mikrofon" rozmiar={28} />
            <span>Powiedz</span>
          </button>
        </div>

        <div className="szybkie" role="list">
          {SZYBKIE.map((s) => (
            <button key={s.etykieta} type="button" role="listitem" className="chip" onClick={() => onZapytaj(s.tekst, branza)}>
              {s.etykieta}
            </button>
          ))}
        </div>

        <div className="kategorie" role="list" aria-label={`Kategorie: ${opis.nazwa}`}>
          {kategorie.map((k) => (
            <button key={k.kategoria} type="button" role="listitem" className="kategoria" onClick={() => onZapytaj(k.zapytanie, branza)}>
              {obrazKategorii(k.kategoria) ? (
                <span className="kategoria-kolo kategoria-zdjecie">
                  <img src={obrazKategorii(k.kategoria)} alt="" width={70} height={70} loading="lazy" decoding="async" />
                </span>
              ) : (
                <span className="kategoria-kolo" style={{ background: `linear-gradient(145deg, ${k.kolory[0]}, ${k.kolory[1]})` }}>
                  <Ikona nazwa={k.kategoria as NazwaIkony} rozmiar={30} />
                </span>
              )}
              <span className="kategoria-etykieta">{k.etykieta}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tresc">
        <EtykietaPodgladu />
        {opis.medyczna && (
          <p className="info-medyczna">
            <Ikona nazwa="tarcza" rozmiar={18} />
            W zdrowiu pokazujemy tylko termin, cenę i adres. Bez promocji i płatnych wyróżnień, kolejność według terminu.
          </p>
        )}

        <div className="sekcja-naglowek">
          <h2>
            <span className="kropka-live" aria-hidden="true" />
            Wolne okienka w pobliżu
          </h2>
          <button type="button" className="link" onClick={onWszystkieOkienka}>
            Wszystkie
          </button>
        </div>
        <div className="karuzela">
          {okienka.map((o) => {
            const s = salon(o.salonId);
            return (
              <article key={o.id} className="karta-okienka">
                <Okladka salon={s} wysokosc={128}>
                  <OcenaNaOkladce salon={s} />
                  <span className="pigulka-czas">
                    <Ikona nazwa="zegar" rozmiar={14} />
                    {o.dzien} {o.godzina}
                  </span>
                </Okladka>
                <div className="karta-okienka-tresc">
                  <h3>{o.usluga}</h3>
                  <p className="wyciszony">
                    {s.nazwa}
                    {s.km > 0 ? ` · ${km(s.km)}` : ` · ${s.adres}`}
                  </p>
                  <div className="karta-okienka-dol">
                    <span className="cena">{zlote(o.cenaGr)}</span>
                    <button type="button" className="btn btn-maly" onClick={() => onRezerwuj(o)}>
                      Rezerwuję
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="sekcja-naglowek">
          <h2>Polecane w okolicy</h2>
        </div>
        <div className="karuzela">
          {ulubione.map((s) => (
            <article key={s.id} className="karta-salonu">
              <Okladka salon={s} wysokosc={150}>
                <OcenaNaOkladce salon={s} />
                <button type="button" className="btn btn-na-okladce" onClick={() => onZapytaj("dziś", branza)}>
                  Zapytaj o termin
                </button>
              </Okladka>
              <h3>{s.nazwa}</h3>
              <p className="wyciszony">
                {s.adres} · {s.dzielnica}
              </p>
              <OcenaWLinii salon={s} />
            </article>
          ))}
        </div>

        <section className="jak-dziala" aria-label="Jak to działa">
          <h2>Jak to działa</h2>
          <ol>
            <li>
              <strong>Piszesz, czego potrzebujesz.</strong> Usługa, dzień, godzina i ile chcesz wydać.
            </li>
            <li>
              <strong>Ci, którzy mają wolny czas, odpowiadają.</strong> Konkretna godzina i cena w kilka minut.
            </li>
            <li>
              <strong>Wybierasz i idziesz.</strong> Płacisz na miejscu, bez przedpłat.
            </li>
          </ol>
        </section>
      </section>
    </div>
  );
}
