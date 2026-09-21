export function helpText(botName) {
  const tag = `@${String(botName ?? "Fix Bot").trim() || "Fix Bot"}`;
  return [
    `Assign me to a ticket after the checker CONFIRMs to start a fix.`,
    `\`${tag} retry\` — run again even if I already opened a PR`,
    `\`${tag} status\` — check if a Cursor fix is still running`,
    `\`${tag} fix\` — start a fix (skipped if I already posted a PR)`,
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
