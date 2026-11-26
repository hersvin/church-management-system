import { config } from "dotenv";
import path from "node:path";

/**
 * Loads database settings. A `.env` in this package wins; otherwise the API's
 * `api/.env` is used, so the backend and the migration/seed commands share one
 * DATABASE_URL. Variables already in the environment always take precedence.
 */
export function loadDatabaseEnv(packageRoot: string): void {
  config({ path: path.join(packageRoot, ".env"), quiet: true });
  config({ path: path.join(packageRoot, "..", "..", "api", ".env"), quiet: true });
}
