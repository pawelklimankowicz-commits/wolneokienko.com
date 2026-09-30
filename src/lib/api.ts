// Klient API dla aplikacji. Dwie wersje o tym samym interfejsie:
//  - http    — prawdziwe API (/api/…, src/serwer/api.ts), sesja w ciasteczku;
//  - podgląd — w pamięci przeglądarki, bez SMS-ów (kod 123456); budowana przez
//              `npm run build:podglad` do podglądu aplikacji bez serwera.
import { apiHttp } from "./api-http";
import { apiPodglad } from "./api-podglad";
import type { KlientApi } from "./api-typy";

export { apiHttp } from "./api-http";
export { apiPodglad } from "./api-podglad";
export * from "./api-typy";

export const api: KlientApi = import.meta.env.MODE === "podglad" ? apiPodglad() : apiHttp();
