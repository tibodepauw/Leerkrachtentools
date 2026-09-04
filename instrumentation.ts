export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateProductionEnvironment } = await import("@/lib/auth/env");
  validateProductionEnvironment();
}
