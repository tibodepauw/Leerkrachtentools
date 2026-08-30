import type Database from "better-sqlite3";

/**
 * SQLite performance indexes for auth/session tables.
 *
 * Active lessons and pinned modules are persisted client-side (localStorage
 * via useLessonStore), not in SQLite.
 */
export function ensureDatabaseIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS sessions_user_id_created_at
      ON sessions(user_id, created_at);

    CREATE INDEX IF NOT EXISTS user_ai_usage_user_id
      ON user_ai_usage(user_id);

    CREATE INDEX IF NOT EXISTS user_ai_usage_created_at
      ON user_ai_usage(created_at);

    CREATE INDEX IF NOT EXISTS users_created_at
      ON users(created_at);
  `);
}
