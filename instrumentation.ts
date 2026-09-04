export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { validateProductionEnvironment } = await import("@/lib/auth/env");
    validateProductionEnvironment();
  } catch (error) {
    console.error("Fatale fout in de productieconfiguratie.", error);
    process.exit(1);
  }
}
