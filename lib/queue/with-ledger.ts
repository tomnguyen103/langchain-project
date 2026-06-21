/**
 * Record a durable schedule-ledger entry, run the enqueue, and roll the ledger
 * back if the enqueue throws — so we never leave a ledger row without a job (or
 * a job without its ledger row). Rollback failures are swallowed: the original
 * enqueue error is the one worth surfacing.
 *
 * Pure orchestration (deps injected) so the rollback path is unit-testable
 * without a real queue or DB.
 */
export async function enqueueWithLedger<T>(steps: {
  record: () => Promise<unknown>;
  enqueue: () => Promise<T>;
  rollback: () => Promise<unknown>;
}): Promise<T> {
  await steps.record();
  try {
    return await steps.enqueue();
  } catch (error) {
    await Promise.resolve()
      .then(steps.rollback)
      .catch(() => {});
    throw error;
  }
}
