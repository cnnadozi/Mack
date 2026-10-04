import { describe, expect, it } from "vitest";
import { registrableDomain, sameSite, supportedUrl } from "./settings";

describe("supportedUrl", () => {
  it("accepts any https page", () => {
    for (const url of ["https://www.uhc.com/", "https://identity.healthsafe-id.com/login", "https://www.libertymutual.com/log-in", "https://www.citylibrary.org/"])
      expect(supportedUrl(url)).toBe(true);
  });
  it("rejects non-https schemes and the Chrome Web Store", () => {
    for (const url of ["http://www.uhc.com/", "chrome://extensions", "file:///C:/a.html", "https://chromewebstore.google.com/detail/x", "https://chrome.google.com/webstore/detail/x", undefined, "not a url"])
      expect(supportedUrl(url)).toBe(false);
    expect(supportedUrl("https://chrome.google.com/other")).toBe(true);
  });
});

describe("sameSite", () => {
  it("treats subdomains of one registrable domain as the same site", () => {
    expect(registrableDomain("member.uhc.com")).toBe("uhc.com");
    expect(registrableDomain("identity.healthsafe-id.com")).toBe("healthsafe-id.com");
    expect(sameSite("https://uhc.com/", "https://member.uhc.com/claims")).toBe(true);
    expect(sameSite("https://www.uhc.com/", "https://member.uhc.com/claims")).toBe(true);
  });
  it("keeps separate sign-in domains apart", () => {
    expect(sameSite("https://www.uhc.com/", "https://identity.healthsafe-id.com/")).toBe(false);
    expect(sameSite("https://www.uhc.com/sign-in", "https://identity.healthsafe-id.com/login")).toBe(false);
  });
  it("handles two-part country suffixes", () => {
    expect(registrableDomain("www.gov.uk")).toBe("www.gov.uk");
    expect(registrableDomain("gov.uk")).toBe("gov.uk");
    expect(sameSite("https://www.gov.uk/browse/benefits", "https://www.gov.uk/apply-for-a-passport")).toBe(true);
    expect(sameSite("https://www.gov.uk/", "https://gov.uk/")).toBe(false);
    expect(sameSite("https://foo.co.uk/", "https://bar.co.uk/")).toBe(false);
    expect(sameSite("https://www.foo.co.uk/", "https://shop.foo.co.uk/")).toBe(true);
  });
  it("requires https on both sides", () => {
    expect(sameSite("http://www.uhc.com/", "https://www.uhc.com/")).toBe(false);
  });
});
