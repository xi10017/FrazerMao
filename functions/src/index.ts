import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';

initializeApp();

/** Keep in sync with ANSWER_KEY_ARCHIVE_DAYS in src/lib/answer-key-reports.ts */
const ANSWER_KEY_ARCHIVE_DAYS = 30;
const BATCH_SIZE = 500;

async function deleteExpiredReports(
  status: 'approved' | 'rejected',
  cutoff: Timestamp
): Promise<number> {
  const db = getFirestore();
  let totalDeleted = 0;

  // Paginate until no more expired closed reports for this status.
  while (true) {
    const snap = await db
      .collection('answer_key_reports')
      .where('status', '==', status)
      .where('reviewedAt', '<', cutoff)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snap.size;

    if (snap.size < BATCH_SIZE) break;
  }

  return totalDeleted;
}

/**
 * Deletes closed answer_key_reports older than ANSWER_KEY_ARCHIVE_DAYS.
 * Does not touch answer_key_overrides (live grading corrections stay).
 */
export const cleanupAnswerKeyReports = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'America/New_York',
  },
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ANSWER_KEY_ARCHIVE_DAYS);
    const cutoffTs = Timestamp.fromDate(cutoff);

    const [approvedDeleted, rejectedDeleted] = await Promise.all([
      deleteExpiredReports('approved', cutoffTs),
      deleteExpiredReports('rejected', cutoffTs),
    ]);

    logger.info('Answer key report cleanup complete', {
      approvedDeleted,
      rejectedDeleted,
      archiveDays: ANSWER_KEY_ARCHIVE_DAYS,
      cutoff: cutoff.toISOString(),
    });
  }
);
