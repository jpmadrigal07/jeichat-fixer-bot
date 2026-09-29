import { expect, test } from "bun:test";
import { helpText, parseFixerCommand, resolveBaseBranch } from "./commands.js";

test("maps retry only, not reply or again", () => {
  expect(parseFixerCommand("retry")).toEqual({ name: "retry" });
  expect(parseFixerCommand("reply")).toEqual({ name: "unknown", raw: "reply" });
  expect(parseFixerCommand("again")).toEqual({ name: "unknown", raw: "again" });
});

test("treats base mention as unknown", () => {
  expect(parseFixerCommand("base develop")).toEqual({
    name: "unknown",
    raw: "base develop",
  });
});

test("maps fix, status, and empty mention to help/fix", () => {
  expect(parseFixerCommand("fix")).toEqual({ name: "fix" });
  expect(parseFixerCommand("status")).toEqual({ name: "status" });
  expect(parseFixerCommand("")).toEqual({ name: "help" });
  expect(parseFixerCommand("help")).toEqual({ name: "help" });
});

test("builds help with the bot's mention tag", () => {
  expect(helpText("Fix Bot")).toContain("@Fix Bot retry");
  expect(helpText("Fix Bot")).toContain("@Fix Bot status");
  expect(helpText("Fix Bot")).not.toContain("base");
});

test("resolveBaseBranch reads description Branch only", () => {
  expect(
    resolveBaseBranch({
      description: "Branch: develop\nSteps:\n1. x",
    }),
  ).toBe("develop");
  expect(resolveBaseBranch({ description: "" })).toBeNull();
});
