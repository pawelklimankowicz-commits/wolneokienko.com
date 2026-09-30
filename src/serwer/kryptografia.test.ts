import { base64url, hmacSha256, losoweBajty, losowyKod, rowneStaloczasowo, sha256 } from "./kryptografia";

describe("kryptografia", () => {
  it("kod ma zawsze tyle cyfr, ile trzeba, także z zerami na początku", () => {
    const kody = Array.from({ length: 2000 }, () => losowyKod(6));
    expect(kody.every((k) => /^\d{6}$/.test(k))).toBe(true);
    expect(new Set(kody).size).toBeGreaterThan(1990);
    expect(kody.some((k) => k.startsWith("0"))).toBe(true);
  });

  it("HMAC-SHA256 i SHA-256 zgadzają się z wektorami wzorcowymi", async () => {
    // RFC 4231, przypadek 2
    expect(await hmacSha256("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
    expect(await sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("token w base64url nie ma znaków +, / ani =", () => {
    const token = base64url(losoweBajty(32));
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("porównanie stałoczasowe", () => {
    expect(rowneStaloczasowo("abc", "abc")).toBe(true);
    expect(rowneStaloczasowo("abc", "abd")).toBe(false);
    expect(rowneStaloczasowo("abc", "abcd")).toBe(false);
  });
});
