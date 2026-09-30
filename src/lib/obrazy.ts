// Zdjęcia salonu zmniejszamy w przeglądarce, zanim wyjdą z telefonu: mniej
// danych, szybsze wysyłanie, a przy okazji znikają metadane (EXIF z GPS-em) —
// na płótno trafia sam obraz.
import { LIMITY_PROFILU } from "@/domain/profil-salonu";

const naBase64 = async (blob: Blob) => {
  const bajty = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
};

const doBloba = (plotno: HTMLCanvasElement, typ: string, jakosc: number) =>
  new Promise<Blob | null>((ok) => plotno.toBlob(ok, typ, jakosc));

/**
 * Obraz z pliku → base64 (WebP, a gdy przeglądarka nie umie — JPEG), dłuższy bok
 * najwyżej `maksBok`. Logo przycinamy do kwadratu. Rzuca błąd z komunikatem po polsku.
 */
export async function zmniejszObraz(plik: File, opcje: { maksBok: number; kwadrat?: boolean }): Promise<string> {
  if (!plik.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(plik.name)) throw new Error("To nie jest zdjęcie. Wybierz plik JPG, PNG albo WebP.");
  let obraz: ImageBitmap;
  try {
    obraz = await createImageBitmap(plik);
  } catch {
    throw new Error("Nie udało się otworzyć tego zdjęcia. Zapisz je jako JPG i spróbuj ponownie.");
  }
  const bok = Math.min(obraz.width, obraz.height);
  const [zw, zh] = opcje.kwadrat ? [bok, bok] : [obraz.width, obraz.height];
  const [sx, sy] = opcje.kwadrat ? [(obraz.width - bok) / 2, (obraz.height - bok) / 2] : [0, 0];

  for (let skala = Math.min(1, opcje.maksBok / Math.max(zw, zh)); skala > 0.1; skala *= 0.75) {
    const plotno = document.createElement("canvas");
    plotno.width = Math.max(1, Math.round(zw * skala));
    plotno.height = Math.max(1, Math.round(zh * skala));
    const ctx = plotno.getContext("2d");
    if (!ctx) break;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(obraz, sx, sy, zw, zh, 0, 0, plotno.width, plotno.height);
    for (const jakosc of [0.82, 0.7]) {
      let blob = await doBloba(plotno, "image/webp", jakosc);
      // Safari zapisuje płótno tylko jako PNG albo JPEG
      if (!blob || blob.type !== "image/webp") blob = await doBloba(plotno, "image/jpeg", jakosc + 0.03);
      if (blob && blob.size <= LIMITY_PROFILU.maksBajtowZdjecia * 0.95) {
        obraz.close();
        return naBase64(blob);
      }
    }
  }
  obraz.close();
  throw new Error("To zdjęcie jest za duże. Wybierz inne.");
}
