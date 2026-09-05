import { describe, expect, it } from "vitest";
import {
  getPwaInstallStatus,
  isIosDevice,
  isStandaloneDisplay,
  shouldRegisterServiceWorker,
} from "@/lib/pwa/installState";

describe("PWA install state", () => {
  it("registreert de service worker alleen in productie", () => {
    expect(shouldRegisterServiceWorker("production", true)).toBe(true);
    expect(shouldRegisterServiceWorker("development", true)).toBe(false);
    expect(shouldRegisterServiceWorker("production", false)).toBe(false);
  });

  it("herkent standalone weergave via media query of iOS", () => {
    expect(
      isStandaloneDisplay({
        displayModeStandalone: true,
        iosStandalone: false,
      }),
    ).toBe(true);
    expect(
      isStandaloneDisplay({
        displayModeStandalone: false,
        iosStandalone: true,
      }),
    ).toBe(true);
    expect(
      isStandaloneDisplay({
        displayModeStandalone: false,
        iosStandalone: false,
      }),
    ).toBe(false);
  });

  it("herkent iPhone, iPad en iPadOS-desktop-UA", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", "iPhone", 5)).toBe(
      true,
    );
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(
      true,
    );
    expect(isIosDevice("Mozilla/5.0 (Windows NT 10.0)", "Win32", 0)).toBe(false);
  });

  it("kiest de juiste installatiestatus", () => {
    expect(
      getPwaInstallStatus({ standalone: true, canPrompt: true, ios: true }),
    ).toBe("installed");
    expect(
      getPwaInstallStatus({ standalone: false, canPrompt: true, ios: false }),
    ).toBe("prompt");
    expect(
      getPwaInstallStatus({ standalone: false, canPrompt: false, ios: true }),
    ).toBe("ios");
    expect(
      getPwaInstallStatus({ standalone: false, canPrompt: false, ios: false }),
    ).toBe("manual");
  });
});
