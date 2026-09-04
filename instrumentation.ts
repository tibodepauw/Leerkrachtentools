export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
