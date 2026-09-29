import { expect, test } from "bun:test";
import { fixBlockedReason } from "./fix-gate.js";

test("requires assignee, base, and CONFIRM", () => {
  expect(
    fixBlockedReason({
      assigneeId: "bot-1",
      botUserId: "bot-1",
      check: { verdict: "CONFIRM" },
      baseRef: "develop",
      isFixing: false,
    }),
  ).toBeNull();

  expect(
    fixBlockedReason({
      assigneeId: "bot-1",
      botUserId: "bot-1",
      check: null,
      baseRef: "develop",
      isFixing: false,
    }),
  ).toBe("missing_confirm");

  expect(
    fixBlockedReason({
      assigneeId: "bot-1",
      botUserId: "bot-1",
      check: { verdict: "CONFIRM" },
      baseRef: "",
      isFixing: false,
    }),
  ).toBe("missing_base");
});
