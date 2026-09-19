import { logSafeError } from "@/lib/security/safeLog";
const PROCESS_SAFETY_KEY = Symbol.for(
  "leerkrachtentools.processSafetyNets",
);

export function installProcessSafetyNets() {
  const globals = globalThis as typeof globalThis & {
    [PROCESS_SAFETY_KEY]?: boolean;
  };
  if (globals[PROCESS_SAFETY_KEY]) {
    return;
  }
  globals[PROCESS_SAFETY_KEY] = true;

  process.on("unhandledRejection", (reason) => {
    logSafeError("unhandled-rejection", reason);
  });
}
