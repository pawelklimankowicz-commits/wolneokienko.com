// Panel usługodawcy, część „profil i narzędzia”: opis, logo i zdjęcia dla klientek,
// pracownicy (samo imię), kalendarz (tylko zajętość). Serwer: src/serwer/profil.ts,
// src/serwer/kalendarz.ts. Zasady: docs/DECYZJE.md, § 12.
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { KATALOG_USLUG } from "@/domain/katalog-uslug";
import { LIMITY_PROFILU, type Pracownik } from "@/domain/profil-salonu";
import type { SalonKonta } from "@/domain/rejestracja-salonu";
import type { KlientApi } from "@/lib/api";
import { odmiana } from "@/lib/format";
import { zmniejszObraz } from "@/lib/obrazy";
import { Ikona } from "@/ui/Ikona";
import { AwatarKolory } from "@/ui/wspolne";
import { koloryDla } from "@/domain/odleglosc";

interface Wspolne {
  api: KlientApi;
  salon: SalonKonta;
  onZmiana: (s: SalonKonta) => void;
  onInfo: (tekst: string) => void;
}

const nazwaUslugi = (kod: string) => KATALOG_USLUG.find((u) => u.kod === kod)?.nazwa ?? kod;
const godzinaIData = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// ── Profil: opis, logo, zdjęcia ────────────────────────────────────────

export function ProfilDlaKlientek({ api, salon, onZmiana, onInfo }: Wspolne) {
  const [opis, setOpis] = useState(salon.opis ?? "");
  const [oswiadczenie, setOswiadczenie] = useState(false);
  const [zajete, setZajete] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const zdjeciaInput = useRef<HTMLInputElement>(null);

  const zapiszOpis = async () => {
    setZajete("opis");
    const w = await api.zapiszOpis(opis);
    setZajete(null);
    if (!w.ok) return onInfo(w.komunikat);
    onZmiana(w.salon);
    onInfo("Opis zapisany.");
  };

  const wyslij = async (rodzaj: "logo" | "zdjecie", pliki: File[]) => {
    let s = salon;
    for (const [i, plik] of pliki.entries()) {
      setZajete(pliki.length > 1 ? `${rodzaj}:${i + 1}/${pliki.length}` : rodzaj);
      try {
        const dane = await zmniejszObraz(plik, rodzaj === "logo" ? { maksBok: 512, kwadrat: true } : { maksBok: 1600 });
        const w = await api.dodajZdjecie(rodzaj, dane, oswiadczenie);
        if (!w.ok) {
          onInfo(w.komunikat);
          break;
        }
        s = w.salon;
        onZmiana(s);
      } catch (e) {
        onInfo(e instanceof Error ? e.message : "Nie udało się dodać zdjęcia.");
        break;
      }
    }
    setZajete(null);
  };
  const wybrano = (rodzaj: "logo" | "zdjecie") => (e: ChangeEvent<HTMLInputElement>) => {
    const pliki = [...(e.target.files ?? [])].slice(0, rodzaj === "logo" ? 1 : LIMITY_PROFILU.maksZdjec - salon.zdjecia.length);
    e.target.value = "";
    if (pliki.length) wyslij(rodzaj, pliki);
  };
  const usun = async (id: string) => {
    setZajete(`usun:${id}`);
    const w = await api.usunZdjecie(id);
    setZajete(null);
    if (w.ok) onZmiana(w.salon);
    else onInfo(w.komunikat);
  };
  const idLogo = salon.logoUrl?.split("/").pop() ?? "logo";
  const wolneMiejsca = LIMITY_PROFILU.maksZdjec - salon.zdjecia.length;

  return (
    <section className="karta-panelu profil-panel">
      <div className="karta-panelu-glowa">
        <h3>Profil dla klientek</h3>
      </div>
      <p className="wyciszony maly">Klientka widzi go przy Twojej ofercie. Dobre zdjęcia prac to więcej wybranych ofert.</p>

      <div className="profil-logo">
        {salon.logoUrl ? (
          <img src={salon.logoUrl} alt="Logo" className="logo-podglad" />
        ) : (
          <AwatarKolory nazwa={salon.nazwa} kolory={koloryDla(salon.id)} rozmiar={64} />
        )}
        <div>
          <strong>Logo</strong>
          <div className="przyciski-rzad">
            <button type="button" className="btn btn-maly btn-obrys" disabled={!oswiadczenie || zajete !== null} onClick={() => logoInput.current?.click()}>
              {zajete === "logo" ? "Wysyłam…" : salon.logoUrl ? "Zmień" : "Dodaj logo"}
            </button>
            {salon.logoUrl && (
              <button type="button" className="btn btn-maly btn-tekst" disabled={zajete !== null} onClick={() => usun(idLogo)}>
                Usuń
              </button>
            )}
          </div>
        </div>
        <input ref={logoInput} type="file" accept="image/*" hidden onChange={wybrano("logo")} />
      </div>

      <label className="pole-opisu">
        <span className="pole-etykieta">Opis</span>
        <textarea
          rows={4}
          maxLength={LIMITY_PROFILU.maksOpis}
          placeholder="Czym się zajmujesz, na czym się znasz, jak do Ciebie trafić. Bez danych klientów."
          value={opis}
          onChange={(e) => setOpis(e.target.value)}
        />
        <span className="licznik-znakow">
          {opis.length}/{LIMITY_PROFILU.maksOpis}
        </span>
      </label>
      {opis.trim() !== (salon.opis ?? "") && (
        <button type="button" className="btn btn-maly" disabled={zajete !== null} onClick={zapiszOpis}>
          {zajete === "opis" ? "Zapisuję…" : "Zapisz opis"}
        </button>
      )}

      <div>
        <span className="pole-etykieta">
          Zdjęcia · {salon.zdjecia.length}/{LIMITY_PROFILU.maksZdjec}
        </span>
        <div className="siatka-zdjec">
          {salon.zdjecia.map((z) => (
            <figure key={z.id}>
              <img src={z.url} alt="" loading="lazy" />
              <button type="button" className="usun-zdjecie" aria-label="Usuń zdjęcie" disabled={zajete !== null} onClick={() => usun(z.id)}>
                <Ikona nazwa="zamknij" rozmiar={16} />
              </button>
            </figure>
          ))}
          {wolneMiejsca > 0 && (
            <button type="button" className="dodaj-zdjecie" disabled={!oswiadczenie || zajete !== null} onClick={() => zdjeciaInput.current?.click()}>
              <Ikona nazwa="plus" rozmiar={22} />
              <span>{zajete?.startsWith("zdjecie") ? `Wysyłam ${zajete.split(":")[1] ?? ""}…` : "Dodaj"}</span>
            </button>
          )}
        </div>
        <input ref={zdjeciaInput} type="file" accept="image/*" multiple hidden onChange={wybrano("zdjecie")} />
      </div>

      <label className="oswiadczenie">
        <input type="checkbox" checked={oswiadczenie} onChange={(e) => setOswiadczenie(e.target.checked)} />
        <span>
          Mam prawa do zdjęć, które dodaję (zrobiłam je sama albo mam zgodę autora), a osoby na nich widoczne zgodziły się na publikację.
          Zdjęcia zmniejszamy na telefonie i usuwamy z nich dane o miejscu zrobienia.
        </span>
      </label>
    </section>
  );
}

// ── Pracownicy ─────────────────────────────────────────────────────────

export function PracownicySalonu({ api, salon, onZmiana, onInfo }: Wspolne) {
  const [lista, setLista] = useState<Pracownik[]>(salon.pracownicy);
  const [imie, setImie] = useState("");
  const [zajete, setZajete] = useState(false);
  const uslugi = salon.cennik.map((p) => p.usluga);
  const zmienione = JSON.stringify(lista) !== JSON.stringify(salon.pracownicy);

  const dodaj = (e: FormEvent) => {
    e.preventDefault();
    const nowe = imie.trim().split(/\s+/)[0] ?? "";
    if (nowe.length < 2) return onInfo("Wpisz imię (co najmniej 2 litery).");
    if (lista.some((p) => p.imie.toLowerCase() === nowe.toLowerCase())) return onInfo("To imię już jest na liście.");
    setLista([...lista, { imie: nowe[0].toUpperCase() + nowe.slice(1), uslugi }]);
    setImie("");
  };
  const przelacz = (i: number, kod: string) =>
    setLista(lista.map((p, j) => (j !== i ? p : { ...p, uslugi: p.uslugi.includes(kod) ? p.uslugi.filter((k) => k !== kod) : [...p.uslugi, kod] })));
  const zapisz = async () => {
    setZajete(true);
    const w = await api.zapiszPracownikow(lista);
    setZajete(false);
    if (!w.ok) return onInfo(w.komunikat);
    onZmiana(w.salon);
    setLista(w.salon.pracownicy);
    onInfo("Zespół zapisany.");
  };

  return (
    <section className="karta-panelu">
      <div className="karta-panelu-glowa">
        <h3>Pracownicy</h3>
        <span className="wyciszony maly">opcjonalnie</span>
      </div>
      <p className="wyciszony maly">
        W ofercie wybierzesz, kto wykona usługę, a klientka zobaczy to imię. Wpisz samo imię albo pseudonim i powiedz tej osobie, że je tu dodajesz.
      </p>
      {lista.map((p, i) => (
        <div key={p.imie} className="pracownik">
          <div className="pracownik-glowa">
            <strong>{p.imie}</strong>
            <button type="button" className="link" onClick={() => setLista(lista.filter((_, j) => j !== i))}>
              Usuń
            </button>
          </div>
          <div className="chipy">
            {uslugi.map((kod) => (
              <button key={kod} type="button" className={`chip chip-maly ${p.uslugi.includes(kod) ? "chip-wybrany" : ""}`} aria-pressed={p.uslugi.includes(kod)} onClick={() => przelacz(i, kod)}>
                {nazwaUslugi(kod)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <form className="dodaj-pracownika" onSubmit={dodaj}>
        <input aria-label="Imię pracownika" placeholder="Imię, np. Ania" value={imie} maxLength={30} onChange={(e) => setImie(e.target.value)} />
        <button type="submit" className="btn btn-maly btn-obrys">
          Dodaj
        </button>
      </form>
      {zmienione && (
        <button type="button" className="btn btn-maly" disabled={zajete} onClick={zapisz}>
          {zajete ? "Zapisuję…" : `Zapisz zespół · ${lista.length} ${odmiana(lista.length, "osoba", "osoby", "osób")}`}
        </button>
      )}
    </section>
  );
}

// ── Kalendarz ──────────────────────────────────────────────────────────

export function KalendarzSalonu({ api, salon, onZmiana, onInfo }: Wspolne) {
  const [adres, setAdres] = useState("");
  const [zajete, setZajete] = useState(false);
  const k = salon.kalendarz;

  const polacz = async (e: FormEvent) => {
    e.preventDefault();
    setZajete(true);
    const w = await api.polaczKalendarz(adres);
    setZajete(false);
    if (!w.ok) return onInfo(w.komunikat);
    setAdres("");
    onZmiana(w.salon);
    onInfo("Kalendarz podłączony.");
  };
  const odlacz = async () => {
    setZajete(true);
    const w = await api.odlaczKalendarz();
    setZajete(false);
    if (w.ok) onZmiana(w.salon);
    else onInfo(w.komunikat);
  };

  return (
    <section className="karta-panelu">
      <div className="karta-panelu-glowa">
        <h3>Kalendarz</h3>
        <span className="wyciszony maly">opcjonalnie</span>
      </div>
      {k ? (
        <>
          <p className="kalendarz-stan">
            <Ikona nazwa="ok" rozmiar={16} /> Podłączony: <strong>{k.host}</strong>
          </p>
          <p className="wyciszony maly">
            {k.pobranoAt ? `Sprawdzony ${godzinaIData.format(new Date(k.pobranoAt))}` : "Jeszcze nie sprawdzony"} · {k.zajeteBloki}{" "}
            {odmiana(k.zajeteBloki, "zajęty termin", "zajęte terminy", "zajętych terminów")} w najbliższych dniach. Propozycje godzin w ofertach je omijają.
          </p>
          {k.blad && <p className="blad-pola">{k.blad}</p>}
          <button type="button" className="btn btn-maly btn-obrys" disabled={zajete} onClick={odlacz}>
            Odłącz
          </button>
        </>
      ) : (
        <form className="formularz-kalendarza" onSubmit={polacz}>
          <p className="wyciszony maly">
            Wklej tajny adres iCal swojego kalendarza, a godziny w ofertach nie będą wpadać na zajęte terminy. Czytamy tylko, kiedy jesteś zajęta
            — bez nazw wizyt i danych klientów.
          </p>
          <details className="instrukcja">
            <summary>Skąd wziąć adres?</summary>
            <ul>
              <li>
                <strong>Kalendarz Google</strong> (na komputerze): Ustawienia → wybierz kalendarz → Integracja kalendarza → „Adres tajny w formacie iCal” → kopiuj.
              </li>
              <li>
                <strong>Outlook</strong>: Ustawienia → Kalendarz → Kalendarze udostępnione → Opublikuj kalendarz → „Może wyświetlać, kiedy jestem zajęty” → link ICS.
              </li>
              <li>
                <strong>iCloud</strong>: w aplikacji Kalendarz udostępnij kalendarz jako publiczny i skopiuj łącze (zaczyna się od webcal://).
              </li>
              <li>Grafik w innym systemie rezerwacji? Jeśli ma synchronizację z Kalendarzem Google albo Outlookiem, włącz ją i podłącz tutaj ten kalendarz.</li>
            </ul>
          </details>
          <input
            aria-label="Adres kalendarza iCal"
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            value={adres}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setAdres(e.target.value)}
          />
          <button type="submit" className="btn btn-maly" disabled={zajete || adres.trim().length < 10}>
            {zajete ? "Sprawdzam kalendarz…" : "Podłącz"}
          </button>
        </form>
      )}
    </section>
  );
}
