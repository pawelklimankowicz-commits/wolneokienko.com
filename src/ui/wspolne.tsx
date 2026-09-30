import type { ReactNode } from "react";
import type { Salon } from "@/dane/przyklad";
import { ocena as fOcena } from "@/lib/format";
import { Ikona } from "./Ikona";

/** Okładka salonu: w miejscu zdjęcia, które salon doda przy rejestracji. */
export function Okladka({ salon, wysokosc = 150, children }: { salon: Salon; wysokosc?: number; children?: ReactNode }) {
  const [a, b] = salon.okladka;
  const inicjaly = salon.nazwa
    .split(/\s+/)
    .filter((s) => /^[A-ZŁŚŻŹĆŃÓĘĄ]/.test(s))
    .slice(0, 2)
    .map((s) => s[0])
    .join("");
  return (
    <div
      className="okladka"
      style={{
        height: wysokosc,
        background: `radial-gradient(120% 90% at 85% 10%, ${a} 0%, transparent 60%), radial-gradient(90% 90% at 10% 100%, ${b} 0%, transparent 70%), linear-gradient(135deg, ${b}, ${a})`,
      }}
    >
      <span className="okladka-inicjaly" aria-hidden="true">
        {inicjaly}
      </span>
      {children}
    </div>
  );
}

export function OcenaNaOkladce({ salon }: { salon: Salon }) {
  return (
    <div className="ocena-badge" aria-label={`Ocena ${fOcena(salon.ocena)} z ${salon.opinie} opinii`}>
      <strong>{fOcena(salon.ocena)}</strong>
      <span>{salon.opinie} opinii</span>
    </div>
  );
}

export function OcenaWLinii({ salon }: { salon: Salon }) {
  return (
    <span className="ocena-linia">
      <Ikona nazwa="gwiazdka" rozmiar={14} className="ocena-gwiazdka" />
      {fOcena(salon.ocena)} <span className="wyciszony">({salon.opinie})</span>
    </span>
  );
}

export function AwatarSalonu({ salon, rozmiar = 36 }: { salon: Salon; rozmiar?: number }) {
  return (
    <span
      className="awatar"
      style={{ width: rozmiar, height: rozmiar, background: `linear-gradient(135deg, ${salon.okladka[0]}, ${salon.okladka[1]})` }}
      aria-hidden="true"
    >
      {salon.nazwa[0]}
    </span>
  );
}

export function NaglowekEkranu({ tytul, onWstecz, prawa }: { tytul: string; onWstecz: () => void; prawa?: ReactNode }) {
  return (
    <header className="naglowek-ekranu">
      <button type="button" className="ikona-btn" onClick={onWstecz} aria-label="Wróć">
        <Ikona nazwa="wstecz" />
      </button>
      <h1>{tytul}</h1>
      <div className="naglowek-prawa">{prawa}</div>
    </header>
  );
}

export function EtykietaPodgladu() {
  return <span className="etykieta-podgladu">Podgląd · przykładowe dane</span>;
}
