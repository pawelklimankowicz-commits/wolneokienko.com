import { geokoderNominatim } from "./geokoder";

const DABROWSKIEGO = {
  lat: "52.4108616",
  lon: "16.9105570",
  address: { house_number: "12", road: "Jana Henryka Dąbrowskiego", suburb: "Jeżyce", city: "Poznań", postcode: "60-844" },
};

function atrapa(odpowiedzi: unknown[][]) {
  const adresy: URL[] = [];
  const f = (async (url: string) => {
    adresy.push(new URL(url));
    return new Response(JSON.stringify(odpowiedzi.shift() ?? []), { status: 200 });
  }) as unknown as typeof fetch;
  return { f, adresy };
}

describe("geokoderNominatim", () => {
  it("szuka strukturalnie, bez numeru lokalu i przedrostka „ul.”", async () => {
    const { f, adresy } = atrapa([[DABROWSKIEGO]]);
    const p = await geokoderNominatim({ fetch: f }).znajdz({ ulica: "ul. Dąbrowskiego 12/3", kodPocztowy: "60-838", miasto: "Poznań" });
    expect(p).toEqual({ lat: 52.4108616, lon: 16.910557, opis: "Jana Henryka Dąbrowskiego 12, Jeżyce, Poznań" });
    expect(adresy[0].searchParams.get("street")).toBe("Dąbrowskiego 12");
    expect(adresy[0].searchParams.get("postalcode")).toBe("60-838");
    expect(adresy[0].searchParams.get("countrycodes")).toBe("pl");
  });

  it("bez trafienia z kodem pocztowym próbuje bez kodu", async () => {
    const { f, adresy } = atrapa([[], [DABROWSKIEGO]]);
    expect(await geokoderNominatim({ fetch: f }).znajdz({ ulica: "Dąbrowskiego 12", kodPocztowy: "00-000", miasto: "Poznań" })).not.toBeNull();
    expect(adresy).toHaveLength(2);
    expect(adresy[1].searchParams.has("postalcode")).toBe(false);
  });

  it("brak trafień albo punkt poza Polską to null", async () => {
    expect(await geokoderNominatim({ fetch: atrapa([[], []]).f }).znajdz({ ulica: "Nieistniejąca 1", kodPocztowy: "60-000", miasto: "Poznań" })).toBeNull();
    const berlin = { lat: "52.52", lon: "13.40", address: {} };
    expect(await geokoderNominatim({ fetch: atrapa([[berlin]]).f }).znajdz({ ulica: "Poznańska 1", kodPocztowy: "10-115", miasto: "Berlin" })).toBeNull();
  });
});
