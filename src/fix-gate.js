export function fixBlockedReason({
  assigneeId,
  botUserId,
  check,
  baseRef,
  isFixing,
}) {
  if (isFixing) return "already_fixing";
  if (!botUserId || assigneeId !== botUserId) return "not_assigned";
  if (!baseRef?.trim()) return "missing_base";
  if (!check) return "missing_confirm";
  if (check.verdict === "REFUTE") return "refuted";
  return null;
}

export const WAITING_FOR_CONFIRM_MESSAGE =
  "Base branch saved. I will start the fix when the checker posts Verdict: CONFIRM.";

export const WAITING_FOR_BASE_MESSAGE =
  "Checker CONFIRMED. Set the base branch with `@Fix Bot base <branch>` before I can run Cursor.";
