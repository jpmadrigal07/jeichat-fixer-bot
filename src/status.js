export function createRunTracker() {
  const runs = new Map();

  return {
    start(ticketId, info = {}) {
      const id = String(ticketId ?? "").trim();
      if (!id) return;
      runs.set(id, { startedAt: Date.now(), ...info });
    },
    update(ticketId, patch) {
      const id = String(ticketId ?? "").trim();
      const current = runs.get(id);
      if (!current) return;
      runs.set(id, { ...current, ...patch });
    },
    get(ticketId) {
      return runs.get(String(ticketId ?? "").trim()) ?? null;
    },
    end(ticketId) {
      runs.delete(String(ticketId ?? "").trim());
    },
  };
}

export function cursorAgentUrl(agentId) {
  const id = String(agentId ?? "").trim();
  if (!id) return null;
  return `https://cursor.com/agents/${id}`;
}

export function formatElapsed(startedAt, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function formatFixStatus({
  run,
  busy,
  queued,
  opened,
  botName,
  now = Date.now(),
} = {}) {
  if (run?.startedAt) {
    const lines = [
      `Yes — Cursor is still running (started ${formatElapsed(run.startedAt, now)} ago).`,
    ];
    const url = cursorAgentUrl(run.agentId);
    if (url) lines.push(`Agent: ${url}`);
    return lines.join("\n");
  }
  if (busy) {
    return "Yes — I am starting a Cursor run on this ticket.";
  }
  if (queued) {
    return "Not started yet — I will begin shortly after the assign delay.";
  }
  if (opened?.url) {
    const tag = String(botName ?? "").trim();
    const how = tag ? `\`@${tag} retry\`` : "`retry`";
    return `Not running. Last PR: ${opened.url}. Tag me with ${how} to run again.`;
  }
  return "Not running a fix on this ticket right now.";
}
