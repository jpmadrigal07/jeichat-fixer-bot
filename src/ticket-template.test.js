import { expect, test } from "bun:test";
import { parseBranchFromDescription } from "./ticket-template.js";

test("parses Branch from ticket description", () => {
  expect(
    parseBranchFromDescription(`
Website: https://app.test
Branch: feat/my-fix
Steps:
1. click
`),
  ).toBe("feat/my-fix");
});

test("returns null when branch is missing", () => {
  expect(parseBranchFromDescription("Website: https://app.test")).toBeNull();
});
