export type PwaInstallStatus = "installed" | "prompt" | "ios" | "manual";

export function shouldRegisterServiceWorker(
  nodeEnv: string,
  hasServiceWorker: boolean,
) {
  return nodeEnv === "production" && hasServiceWorker;
}

export function isStandaloneDisplay(input: {
  displayModeStandalone: boolean;
  iosStandalone: boolean;
}) {
  return input.displayModeStandalone || input.iosStandalone;
}

export function isIosDevice(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function getPwaInstallStatus(input: {
  standalone: boolean;
  canPrompt: boolean;
  ios: boolean;
}): PwaInstallStatus {
  if (input.standalone) return "installed";
  if (input.canPrompt) return "prompt";
  if (input.ios) return "ios";
  return "manual";
}
