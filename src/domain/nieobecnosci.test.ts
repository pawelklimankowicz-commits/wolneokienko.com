import { blokadaDo } from "./nieobecnosci";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

describe("blokada po nieobecnościach", () => {
  it("dwie nieobecności to jeszcze nie blokada", () => {
    expect(blokadaDo([d("2026-01-10"), d("2026-03-10")], d("2026-03-11"))).toBeNull();
  });

  it("trzecia w ciągu 12 miesięcy blokuje na 90 dni od tej nieobecności", () => {
    expect(blokadaDo([d("2026-01-10"), d("2026-03-10"), d("2026-06-01")], d("2026-06-02"))).toEqual(d("2026-08-30"));
    expect(blokadaDo([d("2026-01-10"), d("2026-03-10"), d("2026-06-01")], d("2026-08-31"))).toBeNull();
  });

  it("trzy nieobecności rozłożone na dłużej niż rok nie blokują", () => {
    expect(blokadaDo([d("2025-01-10"), d("2025-09-10"), d("2026-02-01")], d("2026-02-02"))).toBeNull();
  });
});
