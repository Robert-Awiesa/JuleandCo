const { runBackup } = require("./backup");

/**
 * Runs a backup once a day, from inside the API process.
 *
 * Deliberately not a separate Render Cron Job or a task on someone's laptop:
 * the API is already paid for and awake 24/7, a laptop is not, and a backup
 * that only runs when a particular machine happens to be on is not a backup
 * policy. No new service, no new dependency, no new bill.
 *
 * Controlled by env so it never runs from a developer's machine against the
 * live database by accident:
 *
 *   BACKUP_ENABLED=true     turn it on (set this on Render, not locally)
 *   BACKUP_HOUR=3           hour of day, server time, default 3am
 *   BACKUP_KEEP=14          how many to retain
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function msUntilNext(hour) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

async function takeBackup(keep) {
  try {
    const result = await runBackup({ keep });
    console.log(
      `[backup] stored ${result.publicId} (${(result.bytes / 1024).toFixed(1)} KB)` +
        (result.pruned.length ? `, pruned ${result.pruned.length}` : "")
    );
  } catch (err) {
    /**
     * Logged loudly and swallowed. A failed backup must never take the shop
     * down — but it must also never pass silently, because the one thing worse
     * than no backup is believing you have one.
     */
    console.error(`[backup] FAILED — the database is unprotected today: ${err.message}`);
  }
}

function startBackupSchedule() {
  if (process.env.BACKUP_ENABLED !== "true") {
    return null;
  }

  const hour = Math.min(23, Math.max(0, Number(process.env.BACKUP_HOUR) || 3));
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);

  const firstDelay = msUntilNext(hour);
  console.log(
    `[backup] scheduled daily at ${String(hour).padStart(2, "0")}:00, keeping ${keep} — ` +
      `first run in ${(firstDelay / 1000 / 60 / 60).toFixed(1)}h`
  );

  let interval;
  const timeout = setTimeout(() => {
    takeBackup(keep);
    interval = setInterval(() => takeBackup(keep), DAY_MS);
    if (interval.unref) interval.unref();
  }, firstDelay);

  // Unref'd so a pending timer never holds the process open during a deploy.
  if (timeout.unref) timeout.unref();

  return () => {
    clearTimeout(timeout);
    if (interval) clearInterval(interval);
  };
}

module.exports = { startBackupSchedule, takeBackup };
