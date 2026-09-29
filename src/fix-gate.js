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
  "Checker CONFIRMED. Add `Branch: <name>` to the ticket description (Edit under the title), then tag me with `retry` or `fix`.";
