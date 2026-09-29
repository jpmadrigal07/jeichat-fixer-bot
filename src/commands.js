import { parseBranchFromDescription } from "./ticket-template.js";

export function helpText(botName) {
  const tag = `@${String(botName ?? "Fix Bot").trim() || "Fix Bot"}`;
  return [
    `Assign me to a ticket with \`Branch:\` in the description (bug template), wait for checker CONFIRM.`,
    `\`${tag} retry\` — run the fix again`,
    `\`${tag} status\` — check if a Cursor fix is still running`,
    `\`${tag} fix\` — start when Branch + CONFIRM are both set`,
    `\`${tag} help\` — this list`,
  ].join("\n");
}

export function parseFixerCommand(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return { name: "help" };

  const [head] = trimmed.split(/\s+/);
  const name = head.toLowerCase().replace(/[.,!?]+$/g, "");
  if (name === "help") return { name: "help" };
  if (name === "retry") {
    return { name: "retry" };
  }
  if (name === "status") {
    return { name: "status" };
  }
  if (name === "fix" || name === "go" || name === "start") {
    return { name: "fix" };
  }
  return { name: "unknown", raw: trimmed };
}

/** Base branch comes only from `Branch:` in the ticket description. */
export function resolveBaseBranch({ description }) {
  return parseBranchFromDescription(description);
}
