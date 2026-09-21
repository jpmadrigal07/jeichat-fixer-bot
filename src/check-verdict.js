export function parseCheckVerdict(text) {
  const plain = String(text ?? "").replace(/\*/g, "");
  if (/\bverdict\s*:\s*refute\b/i.test(plain)) return "REFUTE";
  if (/\bverdict\s*:\s*confirm\b/i.test(plain)) return "CONFIRM";
  return null;
}

export const MISSING_CONFIRM_MESSAGE =
  "The checker has not posted a CONFIRM yet. Add the Bug label so it can reproduce this, then assign me again.";

export const REFUTED_MESSAGE =
  "The checker REFUTED this bug. I will not change code. Unassign me or get a CONFIRM first.";

/**
 * `messages` must be newest-first (JeiChat list default).
 * Skips humans, the fixer itself, and (when set) any bot other than the checker.
 */
export function latestCheckVerdict(messages, options = {}) {
  const checkerUserId = options.checkerUserId?.trim() || "";
  const fixerUserId = options.fixerUserId?.trim() || "";

  for (const row of messages) {
    if (!row?.sender?.isBot) continue;
    if (fixerUserId && row.senderId === fixerUserId) continue;
    if (checkerUserId && row.senderId !== checkerUserId) continue;
    const verdict = parseCheckVerdict(row.content);
    if (verdict) return { verdict, message: row };
  }
  return null;
}

export function checkReportFromMessage(message) {
  const attachments = Array.isArray(message?.attachments)
    ? message.attachments
    : [];
  const screenshotNames = attachments
    .map((file) => file?.filename)
    .filter(Boolean);
  return {
    content: String(message?.content ?? "").trim(),
    screenshotNames,
  };
}
