/**
 * Validates a human-chosen Cursor cloud starting ref (base branch).
 */
export function validateBaseBranch(branch) {
  const value = String(branch ?? "").trim();
  if (!value) {
    return { ok: false, reason: "Branch name is required." };
  }
  if (value.length > 200) {
    return { ok: false, reason: "Branch name is too long (max 200 characters)." };
  }
  if (!/^[\w./-]+$/.test(value)) {
    return {
      ok: false,
      reason:
        "Branch may only contain letters, numbers, dots, slashes, underscores, and hyphens.",
    };
  }

  const allowlist = process.env.CURSOR_ALLOWED_BRANCHES?.trim();
  if (allowlist) {
    const allowed = allowlist
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(value)) {
      return {
        ok: false,
        reason: `Branch must be one of: ${allowed.join(", ")}`,
      };
    }
  }

  return { ok: true, branch: value };
}
