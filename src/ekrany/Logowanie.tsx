import { useEffect, useRef, useState, type FormEvent } from "react";
import type { KlientApi, Konto } from "@/lib/api";
import { czasCzekania } from "@/lib/api";
import { grupujNumer, telefonCzytelny } from "@/lib/telefon";
import { Ikona } from "@/ui/Ikona";
import { NaglowekEkranu } from "@/ui/wspolne";

const ODSTEP_SEK = 30;

/**
 * Logowanie numerem telefonu: numer → kod z SMS-a. Bez hasła; pierwszy
 * poprawny kod zakłada konto. Kod wpisuje się w jedno pole z
 * autocomplete="one-time-code", więc iPhone i Android podpowiadają go z SMS-a.
 */
export function Logowanie({
  api,
  powod,
  onZalogowano,
  onZamknij,
}: {
  api: KlientApi;
  /** dlaczego prosimy o logowanie, np. „Potwierdź numer — potem od razu wyślemy zapytanie.” */
  powod?: string;
  onZalogowano: (konto: Konto) => void;
  onZamknij: () => void;
}) {
  const [krok, setKrok] = useState<"numer" | "kod">("numer");
  const [numer, setNumer] = useState("");
  const [telefon, setTelefon] = useState("");
  const [kod, setKod] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [nowyKod, setNowyKod] = useState(false);
  const [czekam, setCzekam] = useState(false);
  const [ponowZa, setPonowZa] = useState(0);
  const poleKodu = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ponowZa <= 0) return;
    const t = setTimeout(() => setPonowZa((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [ponowZa]);

  const cyfryNumeru = numer.replace(/\D/g, "");
  const numerGotowy = /^[1-9]\d{8}$/.test(cyfryNumeru);

  async function wyslijKod() {
    if (czekam) return;
    setCzekam(true);
    setBlad(null);
    const w = await api.wyslijKod(cyfryNumeru);
    setCzekam(false);
    if (w.ok) {
      setTelefon(w.telefon);
      setKod("");
      setNowyKod(false);
      setPonowZa(ODSTEP_SEK);
      setKrok("kod");
      setTimeout(() => poleKodu.current?.focus(), 0);
    } else {
      setBlad(w.komunikat);
      if (w.ponowZaSek) setPonowZa(w.ponowZaSek);
    }
  }

  async function sprawdz(wpisany: string) {
    if (czekam || wpisany.length !== 6) return;
    setCzekam(true);
    setBlad(null);
    const w = await api.zaloguj(telefon, wpisany);
    setCzekam(false);
    if (w.ok) return onZalogowano(w.konto);
    setBlad(w.komunikat);
    setNowyKod(!!w.nowyKod);
    setKod("");
    poleKodu.current?.focus();
  }

  const zatwierdz = (e: FormEvent) => {
    e.preventDefault();
    if (krok === "numer") void wyslijKod();
    else if (nowyKod) void wyslijKod();
    else void sprawdz(kod);
  };

  const wstecz = () => {
    if (krok === "kod") {
      setKrok("numer");
      setBlad(null);
    } else onZamknij();
  };

  const etykietaPrzycisku =
    krok === "numer"
      ? czekam
        ? "Wysyłam kod…"
        : ponowZa > 0 && blad
          ? `Wyślij kod za ${czasCzekania(ponowZa)}`
          : "Wyślij kod SMS-em"
      : nowyKod
        ? ponowZa > 0
          ? `Nowy kod za ${czasCzekania(ponowZa)}`
          : "Wyślij nowy kod"
        : czekam
          ? "Sprawdzam…"
          : "Zaloguj się";
  const przyciskAktywny =
    !czekam && (krok === "numer" ? numerGotowy && !(ponowZa > 0 && blad) : nowyKod ? ponowZa <= 0 : kod.length === 6);

  return (
    <div className="nakladka">
      <NaglowekEkranu tytul="Logowanie" onWstecz={wstecz} />
      <form id="formularz-logowania" className="nakladka-tresc logowanie" onSubmit={zatwierdz} noValidate>
        <div className="logowanie-intro">
          <span className="logowanie-znak" aria-hidden="true">
            <Ikona nazwa={krok === "numer" ? "telefon" : "tarcza"} rozmiar={26} />
          </span>
          {krok === "numer" ? (
            <>
              <h2>Podaj numer telefonu</h2>
              <p className="wyciszony">
                {powod ? `${powod} ` : ""}Dostaniesz SMS z kodem — bez hasła i bez formularzy.
              </p>
            </>
          ) : (
            <>
              <h2>Wpisz kod z SMS-a</h2>
              <p className="wyciszony">
                Wysłaliśmy go na <strong className="nie-lam">{telefonCzytelny(telefon)}</strong>.{" "}
                <button type="button" className="link link-w-tekscie" onClick={wstecz}>
                  Zmień numer
                </button>
              </p>
            </>
          )}
        </div>

        {krok === "numer" ? (
          <label className={`pole-telefonu ${blad ? "z-bledem" : ""}`}>
            <span className="kierunkowy">+48</span>
            <input
              id="numer-telefonu"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              autoFocus
              placeholder="600 123 123"
              aria-label="Numer telefonu"
              aria-invalid={!!blad}
              aria-describedby={blad ? "blad-logowania" : undefined}
              value={numer}
              onChange={(e) => {
                setNumer(grupujNumer(e.target.value));
                setBlad(null);
              }}
            />
          </label>
        ) : (
          <input
            ref={poleKodu}
            id="kod-sms"
            className={`pole-kodu ${blad ? "z-bledem" : ""}`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="••••••"
            aria-label="Kod z SMS-a"
            aria-invalid={!!blad}
            aria-describedby={blad ? "blad-logowania" : undefined}
            disabled={nowyKod}
            value={kod}
            onChange={(e) => {
              const cyfry = e.target.value.replace(/\D/g, "").slice(0, 6);
              setKod(cyfry);
              setBlad(null);
              if (cyfry.length === 6) void sprawdz(cyfry);
            }}
          />
        )}

        {blad && (
          <p id="blad-logowania" className="blad-pola" role="alert">
            {blad}
          </p>
        )}

        {krok === "kod" && !nowyKod && (
          <p className="ponow-kod">
            {ponowZa > 0 ? (
              <span className="wyciszony">Nie doszedł? Nowy kod za {czasCzekania(ponowZa)}.</span>
            ) : (
              <button type="button" className="link" onClick={() => void wyslijKod()} disabled={czekam}>
                Wyślij kod ponownie
              </button>
            )}
          </p>
        )}

        {api.podglad && (
          <p className="info-medyczna">
            <Ikona nazwa="iskra" rozmiar={18} />
            <span>Podgląd: SMS nie wychodzi. {krok === "numer" ? "Wpisz dowolny numer komórki." : "Wpisz kod 123456."}</span>
          </p>
        )}
      </form>

      <footer className="nakladka-stopka">
        <button type="submit" form="formularz-logowania" className="btn btn-duzy" disabled={!przyciskAktywny}>
          {etykietaPrzycisku}
        </button>
        <p className="maly wyciszony srodek">Numer służy do logowania i do kontaktu w sprawie Twoich wizyt.</p>
      </footer>
    </div>
  );
}
