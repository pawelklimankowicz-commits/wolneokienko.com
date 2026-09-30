// Skrzynka usługodawcy w panelu: zapytania z okolicy na żywo, oferta jednym
// dotknięciem (godzina z okna klientki, cena z cennika), „nie mam czasu”
// i nadchodzące wizyty z telefonem klientki. Serwer: src/serwer/skrzynka.ts.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KATALOG_USLUG } from "@/domain/katalog-uslug";
import { kolidujeZ, proponowaneTerminy, terminCzesci, terminCzytelny } from "@/domain/okno";
import type { Pracownik } from "@/domain/profil-salonu";
import { zlotowkiNaGrosze } from "@/domain/rejestracja-salonu";
import type { WizytaSalonu, ZapytanieDlaSalonu } from "@/domain/widoki";
import type { KlientApi } from "@/lib/api";
import { cena, km, mmss, odmiana } from "@/lib/format";
import { telefonCzytelny } from "@/lib/telefon";
import { Ikona } from "@/ui/Ikona";

const godzina = new Intl.DateTimeFormat("pl-PL", { hour: "numeric", minute: "2-digit" });
const nazwaUslugi = (kod: string) => KATALOG_USLUG.find((u) => u.kod === kod)?.nazwa ?? kod;

/** Cena do oferty jednym dotknięciem: z cennika, ale nie wyżej niż limit klientki. */
function cenaOferty(z: ZapytanieDlaSalonu): number | null {
  if (z.mojaCenaGr === null) return z.limitGr;
  return z.limitGr === null ? z.mojaCenaGr : Math.min(z.mojaCenaGr, z.limitGr);
}

function KartaZapytania({
  z,
  teraz,
  api,
  pracownicy,
  onZmiana,
  onInfo,
}: {
  z: ZapytanieDlaSalonu;
  teraz: number;
  api: KlientApi;
  /** osoby z zespołu, które wykonują tę usługę */
  pracownicy: string[];
  onZmiana: () => void;
  onInfo: (tekst: string) => void;
}) {
  const [zajete, setZajete] = useState(false);
  const [inna, setInna] = useState(false);
  const [kto, setKto] = useState<string | null>(pracownicy.length === 1 ? pracownicy[0] : null);
  const okno = { od: new Date(z.oknoOd), do: new Date(z.oknoDo) };
  // zajętość z kalendarza salonu: propozycje jednym dotknięciem ją omijają
  const zKalendarza = z.zajete.map((p) => ({ od: new Date(p.od), do: new Date(p.do) }));
  const terminy = proponowaneTerminy(okno, new Date(teraz), z.czasMin, 3, zKalendarza);
  const wszystkieTerminy = proponowaneTerminy(okno, new Date(teraz), z.czasMin, 40);
  const cenaGr = cenaOferty(z);
  const [innyTermin, setInnyTermin] = useState(() => wszystkieTerminy[0]?.toISOString() ?? "");
  const [innaCena, setInnaCena] = useState(() => (cenaGr !== null ? String(cenaGr / 100).replace(".", ",") : ""));
  const zostaloSek = Math.max(0, Math.round((new Date(z.zbieranieDo).getTime() - teraz) / 1000));
  const terazData = new Date(teraz);

  const wyslij = async (termin: string, gr: number) => {
    setZajete(true);
    const w = await api.zlozOferte(z.id, termin, gr, kto);
    setZajete(false);
    if (!w.ok) return onInfo(w.komunikat);
    onInfo(w.przyjeta ? "Klientka ma rezerwację u Ciebie — szczegóły w nadchodzących wizytach." : "Oferta wysłana. Damy znać, gdy klientka wybierze.");
    setInna(false);
    onZmiana();
  };
  const odmow = async () => {
    setZajete(true);
    const w = await api.odmowZapytania(z.id);
    setZajete(false);
    if (!w.ok) onInfo(w.komunikat);
    onZmiana();
  };
  const wyslijInna = (e: FormEvent) => {
    e.preventDefault();
    const gr = zlotowkiNaGrosze(innaCena);
    if (gr === null) return onInfo("Podaj cenę w złotych, np. 130 albo 129,50.");
    wyslij(innyTermin, gr);
  };

  const warunki = [
    `${terminCzytelny(okno.od, terazData)}–${godzina.format(okno.do)}`,
    z.limitGr !== null ? `do ${cena(z.limitGr)}` : "bez limitu ceny",
    z.liczbaOsob ? `${z.liczbaOsob} ${odmiana(z.liczbaOsob, "osoba", "osoby", "osób")}` : null,
    z.odlegloscKm !== null ? `${km(z.odlegloscKm)} od Ciebie` : null,
  ].filter(Boolean);

  const o = z.mojaOferta;
  if (o || z.odmowa) {
    const tekst = !o
      ? "Pominięte — to nie obniża Twojego wskaźnika odpowiedzi."
      : o.status === "zlozona"
        ? `Oferta wysłana: ${terminCzytelny(new Date(o.termin), terazData)} · ${cena(o.cenaGr)}${o.pracownik ? ` · ${o.pracownik}` : ""}. Czekamy na wybór klientki.`
        : o.status === "potwierdzona"
          ? `Klientka wybrała Twój termin: ${terminCzytelny(new Date(o.termin), terazData)} · ${cena(o.cenaGr)}${o.pracownik ? ` · ${o.pracownik}` : ""}.`
          : "Klientka wybrała inną ofertę albo zrezygnowała.";
    return (
      <article className={`zapytanie-salonu wyslane ${o?.status === "potwierdzona" ? "wybrane" : ""}`}>
        {o?.status === "potwierdzona" && (
          <span className="tag-nowe tag-wybrane">
            <Ikona nazwa="ok" rozmiar={14} /> Rezerwacja
          </span>
        )}
        <h2>{nazwaUslugi(z.uslugaKod)}</h2>
        <p className="wyciszony maly">{warunki.join(" · ")}</p>
        <p>{tekst}</p>
      </article>
    );
  }

  return (
    <article className="zapytanie-salonu">
      <span className="tag-nowe">Nowe zapytanie</span>
      <h2>{nazwaUslugi(z.uslugaKod)}</h2>
      <p className="wyciszony">{warunki.join(" · ")}</p>
      {z.tresc && <p className="tresc-klientki">„{z.tresc}”</p>}
      {zKalendarza.length > 0 && (
        <p className="wyciszony maly">
          W kalendarzu masz wtedy zajęte: {zKalendarza.map((p) => `${godzina.format(p.od)}–${godzina.format(p.do)}`).join(", ")} — te godziny pomijamy.
        </p>
      )}
      {pracownicy.length > 1 && (
        <div className="chipy" role="group" aria-label="Kto wykona usługę">
          {[null, ...pracownicy].map((p) => (
            <button key={p ?? "ktokolwiek"} type="button" className={`chip chip-maly ${kto === p ? "chip-wybrany" : ""}`} aria-pressed={kto === p} onClick={() => setKto(p)}>
              {p ?? "Ktokolwiek"}
            </button>
          ))}
        </div>
      )}
      <span className="licznik">
        <Ikona nazwa="zegar" rozmiar={14} />
        {zostaloSek > 0 ? (
          <>
            <span className="mono">{mmss(zostaloSek)}</span> na odpowiedź
          </>
        ) : (
          "czas na odpowiedź minął"
        )}
      </span>

      {cenaGr !== null && terminy.length > 0 && !inna && (
        <div className="odpowiedzi">
          {terminy.map((t) => (
            <button key={t.toISOString()} type="button" className="btn btn-duzy btn-termin" disabled={zajete} onClick={() => wyslij(t.toISOString(), cenaGr)}>
              {terminCzesci(t, terazData).dzien} <span className="mono">{terminCzesci(t, terazData).godzina}</span> · {cena(cenaGr)}
            </button>
          ))}
          <button type="button" className="btn btn-duzy btn-obrys" disabled={zajete} onClick={() => setInna(true)}>
            Inna godzina lub cena
          </button>
          <button type="button" className="btn btn-tekst" disabled={zajete} onClick={odmow}>
            Nie mam czasu
          </button>
        </div>
      )}

      {(inna || cenaGr === null) && wszystkieTerminy.length > 0 && (
        <form className="oferta-inna" onSubmit={wyslijInna}>
          <label>
            <span>Godzina</span>
            <select value={innyTermin} onChange={(e) => setInnyTermin(e.target.value)}>
              {wszystkieTerminy.map((t) => (
                <option key={t.toISOString()} value={t.toISOString()}>
                  {terminCzytelny(t, terazData)}
                  {kolidujeZ(zKalendarza, t, z.czasMin) ? " (zajęte w kalendarzu)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cena, zł</span>
            <input inputMode="decimal" value={innaCena} onChange={(e) => setInnaCena(e.target.value)} />
          </label>
          <div className="przyciski-rzad">
            <button type="submit" className="btn" disabled={zajete}>
              Wyślij ofertę
            </button>
            <button type="button" className="btn btn-obrys" onClick={() => (cenaGr === null ? odmow() : setInna(false))}>
              {cenaGr === null ? "Nie mam czasu" : "Wróć"}
            </button>
          </div>
        </form>
      )}

      {cenaGr !== null && terminy.length === 0 && wszystkieTerminy.length > 0 && !inna && (
        <div className="odpowiedzi">
          <p className="wyciszony maly">W oknie klientki masz wszystko zajęte w kalendarzu.</p>
          <button type="button" className="btn btn-duzy btn-obrys" disabled={zajete} onClick={() => setInna(true)}>
            Mimo to podaj godzinę
          </button>
          <button type="button" className="btn btn-tekst" disabled={zajete} onClick={odmow}>
            Nie mam czasu
          </button>
        </div>
      )}

      {wszystkieTerminy.length === 0 && (
        <div className="odpowiedzi">
          <p className="wyciszony maly">Na tę usługę nie zmieścisz się już w oknie klientki.</p>
          <button type="button" className="btn btn-tekst" disabled={zajete} onClick={odmow}>
            Nie mam czasu
          </button>
        </div>
      )}
    </article>
  );
}

export function SkrzynkaSalonu({
  api,
  przyjmuje,
  pracownicy,
  onInfo,
}: {
  api: KlientApi;
  przyjmuje: boolean;
  pracownicy: Pracownik[];
  onInfo: (tekst: string) => void;
}) {
  const [zapytania, setZapytania] = useState<ZapytanieDlaSalonu[]>([]);
  const [wizyty, setWizyty] = useState<WizytaSalonu[]>([]);
  const [teraz, setTeraz] = useState(() => Date.now());

  const odswiez = useCallback(async () => {
    const [z, w] = await Promise.all([api.skrzynkaSalonu(), api.wizytySalonu()]);
    setZapytania(z);
    setWizyty(w);
  }, [api]);

  useEffect(() => {
    let aktualne = true;
    const krok = async () => {
      if (!aktualne) return;
      await odswiez();
    };
    krok();
    const t = setInterval(krok, api.podglad ? 2000 : przyjmuje ? 5000 : 30000);
    return () => {
      aktualne = false;
      clearInterval(t);
    };
  }, [api, przyjmuje, odswiez]);

  useEffect(() => {
    const t = setInterval(() => setTeraz(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nadchodzace = wizyty.filter((w) => w.status === "potwierdzona");

  return (
    <>
      <section className="skrzynka" aria-live="polite">
        <h3 className="maly-naglowek">Zapytania z okolicy</h3>
        {zapytania.map((z) => (
          <KartaZapytania
            key={z.id}
            z={z}
            teraz={teraz}
            api={api}
            pracownicy={pracownicy.filter((p) => p.uslugi.includes(z.uslugaKod)).map((p) => p.imie)}
            onZmiana={odswiez}
            onInfo={onInfo}
          />
        ))}
        {zapytania.length === 0 && (
          <p className="pusto-maly">
            {przyjmuje
              ? "Nowe zapytania pojawią się tutaj. Na każde masz kilka minut — odpowiedz godziną jednym dotknięciem."
              : "Włącz przyjmowanie zapytań, żeby dostawać zapytania od klientów z okolicy."}
          </p>
        )}
      </section>

      {nadchodzace.length > 0 && (
        <section className="karta-panelu">
          <div className="karta-panelu-glowa">
            <h3>Nadchodzące wizyty</h3>
          </div>
          <ul className="cennik-lista">
            {nadchodzace.map((w) => (
              <li key={w.id}>
                <span>
                  {terminCzesci(new Date(w.termin), new Date(teraz)).dzien}{" "}
                  <strong className="mono">{terminCzesci(new Date(w.termin), new Date(teraz)).godzina}</strong> · {nazwaUslugi(w.uslugaKod)}
                  {w.pracownik ? ` · ${w.pracownik}` : ""}
                </span>
                <span className="wyciszony">
                  {cena(w.cenaGr)} · <a href={`tel:${w.telefonKlientki}`}>{telefonCzytelny(w.telefonKlientki)}</a>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
