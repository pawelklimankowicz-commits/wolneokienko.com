// Oferty na żywo: zapytanie jest już w bazie, salony z okolicy odpowiadają
// falami (src/domain/fale.ts). Ekran odpytuje stan co kilka sekund.
import { useCallback, useEffect, useMemo, useState } from "react";
import { branzaUslugi, czyMedyczna, opisBranzy } from "@/domain/katalog-uslug";
import { terminCzesci } from "@/domain/okno";
import { WAZNOSC_OFERTY_PO_ZBIERANIU_MIN, type StanZapytania, type WizytaWidok } from "@/domain/widoki";
import type { KlientApi } from "@/lib/api";
import { cena, km, mmss, odmiana } from "@/lib/format";
import { Ikona } from "@/ui/Ikona";
import { AwatarKolory, NaglowekEkranu } from "@/ui/wspolne";
import type { WyslaneZapytanie } from "./Zapytanie";

type Sortowanie = "najszybciej" | "najtaniej" | "najblizej";
/** Po tylu sekundach bez żadnej oferty podpowiadamy zmianę warunków. */
const BEZ_OFERT_PO_SEK = 12;

const KIEDY_TEKST = { teraz: "teraz", dzis: "dziś", jutro: "jutro", weekend: "w weekend" } as const;
const godzina = new Intl.DateTimeFormat("pl-PL", { hour: "numeric", minute: "2-digit" });

export function Oferty({
  wyslane,
  stanPoczatkowy,
  api,
  onPrzyjeto,
  onZamknij,
  onZmien,
  onInfo,
}: {
  wyslane: WyslaneZapytanie;
  stanPoczatkowy: StanZapytania;
  api: KlientApi;
  onPrzyjeto: (w: WizytaWidok) => void;
  onZamknij: () => void;
  /** wróć do formularza z tymi samymi warunkami */
  onZmien: () => void;
  onInfo: (tekst: string) => void;
}) {
  const [stan, setStan] = useState(stanPoczatkowy);
  const [teraz, setTeraz] = useState(() => Date.now());
  const [start] = useState(() => Date.now());
  const [sort, setSort] = useState<Sortowanie>("najszybciej");
  const [wybieram, setWybieram] = useState<string | null>(null);
  const opis = opisBranzy(branzaUslugi(wyslane.usluga));
  const medyczna = czyMedyczna(wyslane.usluga);

  useEffect(() => {
    const t = setInterval(() => setTeraz(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // odpytywanie stanu, dopóki zapytanie jest otwarte
  const otwarte = stan.status === "otwarte";
  useEffect(() => {
    if (!otwarte) return;
    let aktualne = true;
    const t = setInterval(
      async () => {
        const s = await api.stanZapytania(stan.id);
        if (aktualne && s) setStan(s);
      },
      api.podglad ? 1000 : 3000,
    );
    return () => {
      aktualne = false;
      clearInterval(t);
    };
  }, [api, stan.id, otwarte]);

  // rezerwacja zrobiona po stronie serwera (tryb „pierwsza pasująca”) — pokazujemy potwierdzenie
  const { status, rezerwacjaId } = stan;
  useEffect(() => {
    if (status !== "zarezerwowane" || !rezerwacjaId || wybieram) return;
    let aktualne = true;
    api.mojeWizyty().then((lista) => {
      const w = lista.find((x) => x.id === rezerwacjaId);
      if (aktualne && w) onPrzyjeto(w);
    });
    return () => {
      aktualne = false;
    };
  }, [api, status, rezerwacjaId, wybieram, onPrzyjeto]);

  const oferty = useMemo(
    () =>
      [...stan.oferty].sort((a, b) => {
        if (sort === "najtaniej") return a.cenaGr - b.cenaGr || a.termin.localeCompare(b.termin);
        if (sort === "najblizej") return (a.odlegloscKm ?? 99) - (b.odlegloscKm ?? 99) || a.termin.localeCompare(b.termin);
        return a.termin.localeCompare(b.termin) || a.cenaGr - b.cenaGr;
      }),
    [stan.oferty, sort],
  );

  const wybierz = useCallback(
    async (ofertaId: string) => {
      setWybieram(ofertaId);
      const w = await api.przyjmijOferte(ofertaId);
      if (w.ok) return onPrzyjeto(w.wizyta);
      setWybieram(null);
      onInfo(w.komunikat);
      const s = await api.stanZapytania(stan.id);
      if (s) setStan(s);
    },
    [api, stan.id, onPrzyjeto, onInfo],
  );

  const anuluj = async () => {
    if (otwarte) await api.anulujZapytanie(stan.id);
    onZamknij();
  };

  const zbieranieDo = new Date(stan.zbieranieDo).getTime();
  const zostaloSek = Math.max(0, Math.round((zbieranieDo - teraz) / 1000));
  const wyborDo = new Date(zbieranieDo + WAZNOSC_OFERTY_PO_ZBIERANIU_MIN * 60 * 1000);
  const minelo = (teraz - start) / 1000;
  const n = stan.liczbaWykonawcow;
  const nikogo = n === 0 || stan.status === "bez_ofert";
  const koniec = stan.status === "wygasle" || stan.status === "anulowane";

  const kiedyOferta = (termin: string) => terminCzesci(new Date(termin), new Date(teraz));
  const warunki = [
    wyslane.usluga.nazwa,
    KIEDY_TEKST[wyslane.kiedy] + (wyslane.odGodziny !== null ? ` po ${wyslane.odGodziny}:00` : ""),
    wyslane.limitZl !== null ? `do ${wyslane.limitZl} zł` : null,
    wyslane.liczbaOsob ? `${wyslane.liczbaOsob} ${odmiana(wyslane.liczbaOsob, "osoba", "osoby", "osób")}` : null,
  ].filter(Boolean);

  const tytul = nikogo
    ? n === 0
      ? `W okolicy nie ma jeszcze ${opis.wykonawcaDop[1]} z tą usługą`
      : "Tym razem nikt nie miał terminu"
    : koniec
      ? "Czas na wybór minął"
      : oferty.length
        ? `Masz ${oferty.length} ${odmiana(oferty.length, "ofertę", "oferty", "ofert")}`
        : `Zapytanie wysłane do ${n} ${n === 1 ? opis.wykonawcaDop[0] : opis.wykonawcaDop[1]}`;

  return (
    <div className="nakladka">
      <NaglowekEkranu
        tytul="Oferty na żywo"
        onWstecz={anuluj}
        prawa={
          otwarte ? (
            <button type="button" className="link" onClick={anuluj}>
              Anuluj
            </button>
          ) : undefined
        }
      />
      <div className="nakladka-tresc">
        <section className={`radar ${otwarte && !nikogo ? "" : "radar-stop"}`} aria-live="polite">
          <div className="radar-kola" aria-hidden="true">
            <span />
            <span />
            <span />
            <Ikona nazwa="okienka" rozmiar={26} />
          </div>
          <div className="radar-opis">
            <p className="radar-tytul">{tytul}</p>
            <p className="wyciszony maly">{warunki.join(" · ")}</p>
            {otwarte && !nikogo && (
              <span className="licznik">
                <Ikona nazwa="zegar" rozmiar={14} />
                {zostaloSek > 0 ? (
                  <>
                    {wyslane.tryb === "pierwsza" ? "rezerwujemy pierwszą pasującą · " : "zbieramy oferty · "}
                    <span className="mono">{mmss(zostaloSek)}</span>
                  </>
                ) : (
                  <>wybierz do {godzina.format(wyborDo)}</>
                )}
              </span>
            )}
          </div>
        </section>

        {otwarte && oferty.length > 1 && (
          <div className="segment" role="tablist" aria-label="Sortowanie ofert">
            {(["najszybciej", "najtaniej", "najblizej"] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={sort === s} className={sort === s ? "wybrany" : ""} onClick={() => setSort(s)}>
                {s === "najszybciej" ? "Najszybciej" : s === "najtaniej" ? "Najtaniej" : "Najbliżej"}
              </button>
            ))}
          </div>
        )}

        <div className="lista-ofert">
          {otwarte &&
            oferty.map((o, i) => (
              <article key={o.id} className={`karta-oferty ${i === 0 && sort === "najszybciej" && !medyczna ? "najlepsza" : ""}`}>
                <div className="karta-oferty-gora">
                  <AwatarKolory nazwa={o.salonNazwa} kolory={o.kolory} rozmiar={42} />
                  <div className="karta-oferty-salon">
                    <h3>{o.salonNazwa}</h3>
                    <p className="wyciszony maly">{[o.odlegloscKm !== null ? km(o.odlegloscKm) : null, o.okolica].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="karta-oferty-termin">
                    <span className="wyciszony maly">{kiedyOferta(o.termin).dzien}</span>
                    <strong className="mono">{kiedyOferta(o.termin).godzina}</strong>
                    <span className="cena">{cena(o.cenaGr)}</span>
                  </div>
                </div>
                <button type="button" className="btn" disabled={wybieram !== null} onClick={() => wybierz(o.id)}>
                  {wybieram === o.id ? "Rezerwuję…" : "Wybieram"}
                </button>
              </article>
            ))}

          {otwarte && !nikogo && oferty.length === 0 && minelo < BEZ_OFERT_PO_SEK &&
            [0, 1].map((i) => (
              <div key={i} className="karta-oferty szkielet" aria-hidden="true">
                <span />
                <span />
              </div>
            ))}

          {otwarte && !nikogo && oferty.length === 0 && minelo >= BEZ_OFERT_PO_SEK && (
            <div className="pusto">
              <p>
                Czekamy na odpowiedzi. Zapytanie trafia do kolejnych {opis.wykonawcaDop[1]} co kilka minut. Szybciej znajdziesz termin, jeśli
                podniesiesz limit ceny albo poszerzysz godziny.
              </p>
              <button type="button" className="btn btn-obrys" onClick={onZmien}>
                Zmień zapytanie
              </button>
            </div>
          )}

          {(nikogo || koniec) && (
            <div className="pusto">
              <p>
                {n === 0
                  ? "Dopiero startujemy i w promieniu 30 km nikt jeszcze nie przyjmuje zapytań na tę usługę. Spróbuj innej usługi albo zajrzyj za kilka dni."
                  : stan.status === "bez_ofert"
                    ? "Nikt nie miał wolnego terminu w Twoich warunkach. Spróbuj z innymi godzinami albo wyższym limitem ceny."
                    : "Oferty już wygasły. Wyślij zapytanie jeszcze raz — salony odpowiadają zwykle w kilka minut."}
              </p>
              <button type="button" className="btn" onClick={onZmien}>
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
