import { expect, test } from "bun:test";
import {
  composeFixReply,
  formatGitReply,
  parseFixResult,
  statusAfterFix,
} from "./result.js";

test("parses FIXED even when bolded", () => {
  expect(parseFixResult("**Result:** **FIXED**\nOpened a PR.")).toBe("FIXED");
});

test("parses NOT A BUG and FAILED", () => {
  expect(parseFixResult("Result: NOT A BUG\nExpected behavior.")).toBe(
    "NOT_A_BUG",
  );
  expect(parseFixResult("Result: FAILED\nCould not reproduce in code.")).toBe(
    "FAILED",
  );
});

test("returns null when there is no result line", () => {
  expect(parseFixResult("I could not finish the fix (error).")).toBe(null);
});

test("only FIXED moves the ticket to in_review", () => {
  expect(statusAfterFix("FIXED")).toBe("in_review");
  expect(statusAfterFix("NOT_A_BUG")).toBe("todo");
  expect(statusAfterFix("FAILED")).toBe("todo");
  expect(statusAfterFix(null)).toBe("todo");
});

const git = {
  branches: [
    {
      repoUrl: "https://github.com/jpmadrigal07/jeichat",
      branch: "cursor/fix-name-save",
      prUrl: "https://github.com/jpmadrigal07/jeichat/pull/12",
    },
  ],
};

test("formats PR and branch as first-class lines", () => {
  expect(formatGitReply(git)).toBe(
    "PR: https://github.com/jpmadrigal07/jeichat/pull/12\nBranch: cursor/fix-name-save",
  );
});

test("skips duplicate PR/branch rows", () => {
  expect(formatGitReply({ branches: [...git.branches, ...git.branches] })).toBe(
    "PR: https://github.com/jpmadrigal07/jeichat/pull/12\nBranch: cursor/fix-name-save",
  );
});

test("appends git footer after the model write-up", () => {
  expect(composeFixReply("Result: FIXED\nRestored mutate.", git)).toBe(
    "Result: FIXED\nRestored mutate.\n\nPR: https://github.com/jpmadrigal07/jeichat/pull/12\nBranch: cursor/fix-name-save",
  );
});

test("returns git-only when the model wrote nothing", () => {
  expect(composeFixReply("  ", git)).toBe(
    "PR: https://github.com/jpmadrigal07/jeichat/pull/12\nBranch: cursor/fix-name-save",
  );
});

test("keeps PR/branch after a long model write-up", () => {
  const long = "x".repeat(4000);
  const reply = composeFixReply(long, git);
  expect(reply).toContain("PR: https://github.com/jpmadrigal07/jeichat/pull/12");
  expect(reply.endsWith("Branch: cursor/fix-name-save")).toBe(true);
  expect(reply).toContain("_(truncated)_");
});
