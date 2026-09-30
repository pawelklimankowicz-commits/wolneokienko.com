// Zdjęcia kategorii (src/assets/kategorie/<kategoria>.webp, 256×256).
// Kategoria bez zdjęcia pokazuje ikonę na kolorowym tle.
import type { Kategoria } from "@/domain/katalog-uslug";

const PLIKI = import.meta.glob<string>("../assets/kategorie/*.webp", { eager: true, import: "default" });

const OBRAZY = new Map(Object.entries(PLIKI).map(([sciezka, url]) => [sciezka.replace(/^.*\/|\.webp$/g, ""), url]));

export const obrazKategorii = (k: Kategoria): string | undefined => OBRAZY.get(k);
