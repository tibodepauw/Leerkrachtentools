const PROCESS_SAFETY_KEY = Symbol.for(
  "leerkrachtentools.processSafetyNets",
);

function installProcessSafetyNets() {
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

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  installProcessSafetyNets();

  try {
    const { validateProductionEnvironment } = await import("@/lib/auth/env");
    validateProductionEnvironment();
  } catch (error) {
    const { terminateInvalidProductionStartup } = await import(
      "@/lib/auth/fatalStartup"
    );
    terminateInvalidProductionStartup(error);
  }
}
