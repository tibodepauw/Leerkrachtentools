import { logSafeError } from "@/lib/security/safeLog";
import { ProductionConfigurationError } from "./env";
export function terminateInvalidProductionStartup(error: unknown): never {
  // This class contains only fixed validation descriptions, never supplied env values.
  if (error instanceof ProductionConfigurationError) console.error("invalid-production-config", { type: "Error", issues: error.issues });
  else logSafeError("invalid-production-config", error);
  process.exit(1);
}
