const FEAT_WORD = /\b(feat|feature|enhancement)\b/i;
const BUG_WORD = /\b(bug|defect|broken|crash|fail(?:ed|s|ure)?|does\s+not|doesn't|not\s+working)\b/i;
const FEAT_INTENT = /\b(add|support|implement|introduce|new)\b/i;

function labelNames(ticket) {
  return (Array.isArray(ticket?.labels) ? ticket.labels : []).map((label) =>
    String(label?.name ?? label ?? "")
      .trim()
      .toLowerCase(),
  );
}

export function branchPrefix(ticket) {
  const names = labelNames(ticket);
  if (names.some((name) => FEAT_WORD.test(name))) return "feat";
  if (names.some((name) => name === "bug" || name === "defect")) return "fix";

  const text = `${ticket?.name ?? ""} ${ticket?.description ?? ""}`;
  if (FEAT_WORD.test(text) && !BUG_WORD.test(text)) return "feat";
  if (FEAT_INTENT.test(text) && !BUG_WORD.test(text)) return "feat";
  return "fix";
}

export function branchSlug(ticket) {
  const id = String(ticket?.displayId ?? "")
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const name = String(ticket?.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const slug = [id, name].filter(Boolean).join("-") || "ticket";
  return slug.slice(0, 50).replace(/-+$/g, "");
}

/** `fix/gen-12-save-name` or `feat/gen-12-add-export`. */
export function branchNameForTicket(ticket) {
  return `${branchPrefix(ticket)}/${branchSlug(ticket)}`;
}
