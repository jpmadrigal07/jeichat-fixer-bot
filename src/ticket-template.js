const BRANCH_LINE = /^branch\s*[:\-]\s*(.+)$/im;

function trimField(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Git base branch from the ticket description (`Branch: develop`). */
export function parseBranchFromDescription(text) {
  return trimField(String(text ?? "").match(BRANCH_LINE)?.[1]);
}
