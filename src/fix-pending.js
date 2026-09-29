export function createFixPendingStore() {
  /** @type {Map<string, { baseRef: string, repoUrl: string }>} */
  const byTicket = new Map();

  return {
    get(ticketId) {
      const id = String(ticketId ?? "").trim();
      return byTicket.get(id) ?? null;
    },
    setBase(ticketId, baseRef, repoUrl) {
      const id = String(ticketId ?? "").trim();
      if (!id) return;
      byTicket.set(id, {
        baseRef: String(baseRef ?? "").trim(),
        repoUrl: String(repoUrl ?? "").trim(),
      });
    },
    clear(ticketId) {
      byTicket.delete(String(ticketId ?? "").trim());
    },
    hasBase(ticketId) {
      return Boolean(this.get(ticketId)?.baseRef);
    },
  };
}
