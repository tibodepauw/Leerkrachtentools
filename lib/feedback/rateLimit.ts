import { getDatabase } from "@/lib/auth/database";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_SUBMISSIONS = 5;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

interface CountRow {
  count: number;
}

export function assertFeedbackRateLimit(userId: string, now = Date.now()) {
  const db = getDatabase();
  db.prepare("DELETE FROM feedback_events WHERE created_at < ?").run(
    now - RETENTION_MS,
  );
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM feedback_events
       WHERE user_id = ? AND created_at >= ?`,
    )
    .get(userId, now - WINDOW_MS) as CountRow;

  if (row.count >= MAX_SUBMISSIONS) {
    throw new Error(
      "Je hebt recent al meerdere berichten gestuurd. Probeer het over een kwartier opnieuw.",
    );
  }

  db.prepare(
    "INSERT INTO feedback_events (user_id, created_at) VALUES (?, ?)",
  ).run(userId, now);
}
