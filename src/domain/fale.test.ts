import { zaplanujFale, type SalonKandydat } from "./fale";

const salon = (id: string, odlegloscKm: number, wskaznikOdpowiedzi = 0.5, extra: Partial<SalonKandydat> = {}): SalonKandydat => ({
  id,
  odlegloscKm,
  wskaznikOdpowiedzi,
  przyjmujeZapytania: true,
  maUsluge: true,
  ...extra,
});

describe("zaplanujFale", () => {
  it("w gęstym mieście zostaje przy 3 km i dzieli salony na fale 5 / 10 / reszta", () => {
    const kandydaci = Array.from({ length: 22 }, (_, i) => salon(`s${String(i).padStart(2, "0")}`, 0.1 * i));
    const plan = zaplanujFale(kandydaci);
    expect(plan.promienKm).toBe(3);
    expect(plan.fale.map((f) => f.salonIds.length)).toEqual([5, 10, 7]);
    expect(plan.fale.map((f) => f.startPoSek)).toEqual([0, 180, 360]);
    expect(plan.terminOdpowiedziSek).toBe(600);
  });

  it("pomija salony z wyłączonym trybem i bez tej usługi", () => {
    const plan = zaplanujFale([
      salon("a", 1),
      salon("b", 1, 0.5, { przyjmujeZapytania: false }),
      salon("c", 1, 0.5, { maUsluge: false }),
    ]);
    expect(plan.fale.flatMap((f) => f.salonIds)).toEqual(["a"]);
  });

  it("na wsi powiększa promień, aż obejmie co najmniej 5 salonów", () => {
    const plan = zaplanujFale([2, 4, 8, 12, 14, 40].map((km, i) => salon(`s${i}`, km)));
    expect(plan.promienKm).toBe(15);
    expect(plan.fale.flatMap((f) => f.salonIds)).toHaveLength(5);
  });

  it("gdy nawet 30 km nie wystarcza, bierze wszystkich w 30 km", () => {
    const plan = zaplanujFale([salon("a", 12), salon("b", 29), salon("c", 31)]);
    expect(plan.promienKm).toBe(30);
    expect(plan.fale.flatMap((f) => f.salonIds).sort()).toEqual(["a", "b"]);
  });

  it("do pierwszej fali trafiają salony, które szybko odpowiadają", () => {
    const kandydaci = [
      ...Array.from({ length: 5 }, (_, i) => salon(`wolny${i}`, 0.5, 0.1)),
      ...Array.from({ length: 5 }, (_, i) => salon(`szybki${i}`, 1.5, 0.95)),
    ];
    const plan = zaplanujFale(kandydaci);
    expect(plan.fale[0].salonIds.every((id) => id.startsWith("szybki"))).toBe(true);
  });

  it("bez dostępnych salonów zwraca pusty plan na maksymalnym promieniu", () => {
    expect(zaplanujFale([])).toEqual({ promienKm: 30, fale: [], terminOdpowiedziSek: 600 });
  });
});
