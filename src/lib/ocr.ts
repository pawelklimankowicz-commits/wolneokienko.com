// Odczyt tekstu ze zdjęcia cennika — w przeglądarce (Tesseract), zdjęcie nie
// opuszcza telefonu. Program (ok. 4 MB) i słownik języka polskiego (2,6 MB)
// leżą na naszym serwerze w katalogu ocr/ (vite.config.ts) i pobierają się
// dopiero przy pierwszym użyciu; słownik przeglądarka zapamiętuje.

export async function tekstZeZdjecia(plik: Blob, onPostep?: (ulamek: number) => void): Promise<string> {
  let tesseract: typeof import("tesseract.js");
  try {
    tesseract = await import("tesseract.js");
  } catch {
    throw new Error("Nie udało się uruchomić odczytu zdjęć. Sprawdź internet albo wklej cennik jako tekst.");
  }
  let worker: Awaited<ReturnType<typeof tesseract.createWorker>> | null = null;
  try {
    const katalog = new URL("ocr/", document.baseURI).href;
    worker = await tesseract.createWorker("pol", 1, {
      workerPath: `${katalog}worker.min.js`,
      corePath: katalog,
      // Tesseract dopisuje „/pol.traineddata.gz”; w podglądzie plik nazywa się pol-slownik.wasm
      // (vite.config.ts), a dopisek trafia do zapytania po „?” i serwer go pomija
      langPath: import.meta.env.MODE === "podglad" ? `${katalog}pol-slownik.wasm?` : katalog,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") onPostep?.(m.progress);
      },
    });
    const { data } = await worker.recognize(plik);
    return data.text;
  } catch {
    throw new Error("Nie udało się odczytać zdjęcia. Zrób ostrzejsze zdjęcie z bliska albo wklej cennik jako tekst.");
  } finally {
    await worker?.terminate();
  }
}
