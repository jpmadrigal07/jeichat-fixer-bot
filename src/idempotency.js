const PR_LINE = /^PR:\s*(\S+)/im;

export function parsePrUrl(text) {
  const plain = String(text ?? "").replace(/\*/g, "");
  const match = plain.match(PR_LINE);
  if (!match?.[1]) return null;
  const url = match[1].replace(/[)\]>.,]+$/g, "");
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  return url;
}

export function isRetryComment(text) {
  const plain = String(text ?? "")
    .replace(/\*/g, "")
    .trim();
  if (/^(please\s+)?retry\.?$/i.test(plain)) return true;
  return /@[\s\S]+?\s+(please\s+)?retry\.?$/i.test(plain);
}

/**
 * `messages` must be newest-first.
 * A newer human `retry` (after this bot's latest PR) clears the skip.
 */
export function alreadyOpenedPr(messages, fixerUserId) {
  const fixer = String(fixerUserId ?? "").trim();
  let sawRetry = false;

  for (const row of Array.isArray(messages) ? messages : []) {
    if (fixer && row?.senderId === fixer) {
      const url = parsePrUrl(row.content);
      if (url) return sawRetry ? null : { url, message: row };
      continue;
    }
    if (isRetryComment(row?.content)) sawRetry = true;
  }

  return null;
}

export function alreadyOpenedMessage(url, botName) {
  const tag = String(botName ?? "").trim();
  const how = tag
    ? `\`@${tag} retry\``
    : "`retry`";
  return `Already opened ${url}. Tag me with ${how} to run again.`;
}
