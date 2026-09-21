export function parseFixResult(text) {
  const plain = text.replace(/\*/g, "");
  if (/\bresult\s*:\s*not\s+a\s+bug\b/i.test(plain)) return "NOT_A_BUG";
  if (/\bresult\s*:\s*failed\b/i.test(plain)) return "FAILED";
  if (/\bresult\s*:\s*fixed\b/i.test(plain)) return "FIXED";
  return null;
}

/** Ticket status after a started fix run. Only FIXED stays in the pipeline. */
export function statusAfterFix(result) {
  return result === "FIXED" ? "in_review" : "todo";
}

export function formatGitReply(git) {
  const branches = Array.isArray(git?.branches) ? git.branches : [];
  const lines = [];
  const seen = new Set();

  for (const row of branches) {
    if (row?.prUrl && !seen.has(`pr:${row.prUrl}`)) {
      seen.add(`pr:${row.prUrl}`);
      lines.push(`PR: ${row.prUrl}`);
    }
    if (row?.branch && !seen.has(`branch:${row.branch}`)) {
      seen.add(`branch:${row.branch}`);
      lines.push(`Branch: ${row.branch}`);
    }
  }

  return lines.join("\n");
}

const MAX_BODY = 3500;

export function composeFixReply(modelText, git) {
  const body = String(modelText ?? "").trim();
  const gitBlock = formatGitReply(git);
  if (!body && !gitBlock) {
    return "The fix run finished but returned no explanation.";
  }
  if (!gitBlock) {
    if (body.length <= MAX_BODY) return body;
    return `${body.slice(0, MAX_BODY)}\n\n_(truncated)_`;
  }
  if (!body) return gitBlock;
  const budget = Math.max(0, MAX_BODY - gitBlock.length - 2);
  const trimmed =
    body.length <= budget ? body : `${body.slice(0, budget)}\n\n_(truncated)_`;
  return `${trimmed}\n\n${gitBlock}`;
}
