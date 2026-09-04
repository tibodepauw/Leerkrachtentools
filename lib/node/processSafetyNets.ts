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
    console.error(
      "[unhandledRejection] Achtergrondfout onderdrukt zodat de server blijft draaien.",
      reason,
    );
  });
}
