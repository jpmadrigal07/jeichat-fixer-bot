import { expect, test } from "bun:test";
import {
  alreadyOpenedMessage,
  alreadyOpenedPr,
  isRetryComment,
  parsePrUrl,
} from "./idempotency.js";

const fixer = "fixer-1";
const pr =
  "Result: FIXED\nRestored mutate.\n\nPR: https://github.com/jpmadrigal07/jeichat/pull/12\nBranch: cursor/x";

test("parses a PR line from a fixer reply", () => {
  expect(parsePrUrl(pr)).toBe(
    "https://github.com/jpmadrigal07/jeichat/pull/12",
  );
  expect(parsePrUrl("**PR:** https://github.com/jpmadrigal07/jeichat/pull/12.")).toBe(
    "https://github.com/jpmadrigal07/jeichat/pull/12",
  );
});

test("treats retry as a dedicated comment", () => {
  expect(isRetryComment("retry")).toBe(true);
  expect(isRetryComment("Please retry.")).toBe(true);
  expect(isRetryComment("@Fix Bot retry")).toBe(true);
  expect(isRetryComment("@Fix Bot reply")).toBe(false);
  expect(isRetryComment("please retry later")).toBe(false);
});

test("skips when this bot already posted a PR", () => {
  const found = alreadyOpenedPr(
    [
      { senderId: fixer, content: pr },
      { senderId: "human", content: "please fix" },
    ],
    fixer,
  );
  expect(found?.url).toBe("https://github.com/jpmadrigal07/jeichat/pull/12");
});

test("runs again when a newer retry comment is present", () => {
  expect(
    alreadyOpenedPr(
      [
        { senderId: "human", content: "retry" },
        { senderId: fixer, content: pr },
      ],
      fixer,
    ),
  ).toBe(null);
});

test("ignores a retry that is older than the latest PR", () => {
  expect(
    alreadyOpenedPr(
      [
        { senderId: fixer, content: pr },
        { senderId: "human", content: "retry" },
      ],
      fixer,
    )?.url,
  ).toBe("https://github.com/jpmadrigal07/jeichat/pull/12");
});

test("does not treat another bot's PR line as ours", () => {
  expect(
    alreadyOpenedPr(
      [{ senderId: "other-bot", content: pr }],
      fixer,
    ),
  ).toBe(null);
});

test("explains how to retry", () => {
  expect(alreadyOpenedMessage("https://github.com/org/repo/pull/1", "Fix Bot")).toContain(
    "@Fix Bot retry",
  );
});
