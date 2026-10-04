import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../../platform/messages";
import { translator } from "../i18n";

describe("translator", () => {
  it("has every phrase in every language the settings offer", () => {
    const english = translator("");
    for (const { name } of LANGUAGES) {
      const { t } = translator(name);
      for (const key of ["originalPage", "exitMack", "nextStep", "search", "settings", "turnOff"] as const) {
        expect(t(key)).toBeTruthy();
        if (name !== "English") expect(t(key)).not.toBe(english.t(key));
      }
    }
  });

  it("fills in numbers and falls back to English for unknown languages", () => {
    expect(translator("Spanish").t("moreOptions", { n: 3 })).toBe("Más opciones (3)");
    expect(translator("Klingon").t("exitMack")).toBe("Exit Mack");
  });

  it("marks Arabic as right-to-left and gives screen readers the language code", () => {
    expect(translator("Arabic")).toMatchObject({ dir: "rtl", lang: "ar" });
    expect(translator("Chinese (Simplified)")).toMatchObject({ dir: "ltr", lang: "zh-Hans" });
    expect(translator("")).toMatchObject({ dir: "ltr", lang: "en" });
  });
});
