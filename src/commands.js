export function helpText(botName) {
  const tag = `@${String(botName ?? "Fix Bot").trim() || "Fix Bot"}`;
  return [
    `Assign me to a ticket, set the base branch, and wait for checker CONFIRM.`,
    `\`${tag} base <branch>\` — base branch for Cursor (required before a fix runs)`,
    `\`${tag} retry\` — run again (\`${tag} retry base <branch>\` to change base)`,
    `\`${tag} status\` — check if a Cursor fix is still running`,
    `\`${tag} fix\` — start when base + CONFIRM are both set`,
    `\`${tag} help\` — this list`,
  ].join("\n");
}

export function parseFixerCommand(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return { name: "help" };

  const retryBase = trimmed.match(/^retry\s+base\s+(.+)$/i);
  if (retryBase) {
    return { name: "retry", baseBranch: retryBase[1].trim() };
  }

  const [head, ...restParts] = trimmed.split(/\s+/);
  const name = head.toLowerCase().replace(/[.,!?]+$/g, "");
  if (name === "help") return { name: "help" };
  if (name === "retry") {
    return { name: "retry" };
  }
  if (name === "status") {
    return { name: "status" };
  }
  if (name === "base") {
    const branch = restParts.join(" ").trim();
    return { name: "base", branch };
  }
  if (name === "fix" || name === "go" || name === "start") {
    return { name: "fix" };
  }
  return { name: "unknown", raw: trimmed };
}

/** Scan ticket messages (newest first) for a saved base branch command. */
export function latestBaseBranchFromMessages(messages, botName) {
  const tag = String(botName ?? "").trim();
  if (!tag) return null;
  const mention = new RegExp(`@${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

  for (const row of messages ?? []) {
    const content = String(row?.content ?? "");
    if (!mention.test(content)) continue;
    const withoutMentions = content.replace(
      new RegExp(`@${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
      "",
    );
    const cmd = parseFixerCommand(withoutMentions.trim());
    if (cmd.name === "base" && cmd.branch) return cmd.branch;
  }
  return null;
}
