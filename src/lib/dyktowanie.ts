// Dyktowanie po polsku przez rozpoznawanie mowy wbudowane w przeglądarkę
// (Web Speech API: Chrome na komputerze i Androidzie, Safari na iPhonie).
// Nagranie przetwarza przeglądarka lub system (Google, Apple) — do nas
// trafia tylko rozpoznany tekst. Opisane w polityce prywatności.
import { useCallback, useEffect, useRef, useState } from "react";

interface Rozpoznanie {
  transcript: string;
}
interface WynikRozpoznania {
  isFinal: boolean;
  0: Rozpoznanie;
}
interface ZdarzenieRozpoznania {
  results: ArrayLike<WynikRozpoznania>;
}
interface Rozpoznawanie {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: ZdarzenieRozpoznania) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type KonstruktorRozpoznawania = new () => Rozpoznawanie;

function konstruktor(): KonstruktorRozpoznawania | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: KonstruktorRozpoznawania; webkitSpeechRecognition?: KonstruktorRozpoznawania };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const KOMUNIKATY: Record<string, string> = {
  "not-allowed": "Zezwól na mikrofon w ustawieniach przeglądarki, żeby dyktować.",
  "service-not-allowed": "Dyktowanie jest wyłączone w tej przeglądarce.",
  "no-speech": "Nic nie usłyszeliśmy. Dotknij mikrofonu i powiedz, czego szukasz.",
  "audio-capture": "Nie znaleźliśmy mikrofonu w tym urządzeniu.",
  network: "Dyktowanie potrzebuje internetu. Sprawdź połączenie.",
};

export const BRAK_DYKTOWANIA = "Ta przeglądarka nie obsługuje dyktowania. Spróbuj w Chrome albo Safari — albo wpisz zapytanie.";

/** Rozpoznany tekst trafia do `onTekst` na bieżąco (także wyniki pośrednie). */
export function useDyktowanie(onTekst: (tekst: string) => void) {
  const [slucha, setSlucha] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const aktywne = useRef<Rozpoznawanie | null>(null);
  const odbiorca = useRef(onTekst);

  useEffect(() => {
    odbiorca.current = onTekst;
  }, [onTekst]);

  const start = useCallback(() => {
    const K = konstruktor();
    if (!K) return setBlad(BRAK_DYKTOWANIA);
    aktywne.current?.abort();
    const r = new K();
    r.lang = "pl-PL";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    // zdarzenia sesji, którą zastąpiła nowsza, pomijamy
    r.onresult = (e) => {
      if (aktywne.current !== r) return;
      let tekst = "";
      for (let i = 0; i < e.results.length; i++) tekst += e.results[i][0].transcript;
      odbiorca.current(tekst.trim());
    };
    r.onerror = (e) => {
      if (aktywne.current === r && e.error !== "aborted") setBlad(KOMUNIKATY[e.error] ?? "Dyktowanie nie zadziałało. Spróbuj jeszcze raz.");
    };
    r.onend = () => {
      if (aktywne.current !== r) return;
      aktywne.current = null;
      setSlucha(false);
    };
    aktywne.current = r;
    setBlad(null);
    setSlucha(true);
    try {
      r.start();
    } catch {
      setSlucha(false);
      setBlad("Dotknij mikrofonu, żeby zacząć mówić.");
    }
  }, []);

  const stop = useCallback(() => aktywne.current?.stop(), []);

  useEffect(() => () => aktywne.current?.abort(), []);

  return { slucha, blad, start, stop };
}
