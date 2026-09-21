import { expect, test } from "bun:test";
import {
  createRunTracker,
  cursorAgentUrl,
  formatElapsed,
  formatFixStatus,
} from "./status.js";

test("tracks a running fix and clears it", () => {
  const runs = createRunTracker();
  runs.start("t1");
  expect(runs.get("t1")?.startedAt).toBeGreaterThan(0);
  runs.update("t1", { agentId: "bc-abc" });
  expect(runs.get("t1")?.agentId).toBe("bc-abc");
  runs.end("t1");
  expect(runs.get("t1")).toBe(null);
});

test("builds a Cursor agent URL", () => {
  expect(cursorAgentUrl("bc-abc")).toBe("https://cursor.com/agents/bc-abc");
  expect(cursorAgentUrl("")).toBe(null);
});

test("formats elapsed time", () => {
  const now = 1_000_000;
  expect(formatElapsed(now - 12_000, now)).toBe("12s");
  expect(formatElapsed(now - 180_000, now)).toBe("3m");
  expect(formatElapsed(now - 3_600_000, now)).toBe("1h 0m");
});

test("says Cursor is still running", () => {
  const now = 1_000_000;
  expect(
    formatFixStatus({
      run: { startedAt: now - 90_000, agentId: "bc-abc" },
      now,
    }),
  ).toBe(
    "Yes — Cursor is still running (started 1m ago).\nAgent: https://cursor.com/agents/bc-abc",
  );
});

test("explains queued, busy, last PR, and idle", () => {
  expect(formatFixStatus({ busy: true })).toBe(
    "Yes — I am starting a Cursor run on this ticket.",
  );
  expect(formatFixStatus({ queued: true })).toContain("assign delay");
  expect(
    formatFixStatus({
      opened: { url: "https://github.com/org/repo/pull/1" },
      botName: "Fix Bot",
    }),
  ).toContain("@Fix Bot retry");
  expect(formatFixStatus({})).toBe(
    "Not running a fix on this ticket right now.",
  );
});
