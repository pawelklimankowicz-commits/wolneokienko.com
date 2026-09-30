// Gdzie klientka szuka wizyty: lokalizacja urządzenia (za zgodą przeglądarki),
// a gdy jej nie ma — centrum Poznania (start w fazie 1).
import { POZNAN } from "../domain/odleglosc";

export interface Lokalizacja {
  lat: number;
  lon: number;
  zUrzadzenia: boolean;
}

let zapamietana: Lokalizacja | null = null;

export function pobierzLokalizacje(podglad: boolean): Promise<Lokalizacja> {
  if (zapamietana) return Promise.resolve(zapamietana);
  if (podglad || typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({ ...POZNAN, zUrzadzenia: false });
  return new Promise((ok) => {
    navigator.geolocation.getCurrentPosition(
      (p) => ok((zapamietana = { lat: p.coords.latitude, lon: p.coords.longitude, zUrzadzenia: true })),
      () => ok({ ...POZNAN, zUrzadzenia: false }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
