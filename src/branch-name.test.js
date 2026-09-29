import { afterEach, expect, test } from "bun:test";
import { validateBaseBranch } from "./branch-name.js";

const original = process.env.CURSOR_ALLOWED_BRANCHES;

afterEach(() => {
  if (original === undefined) delete process.env.CURSOR_ALLOWED_BRANCHES;
  else process.env.CURSOR_ALLOWED_BRANCHES = original;
});

test("accepts common branch names", () => {
  expect(validateBaseBranch("develop")).toEqual({
    ok: true,
    branch: "develop",
  });
  expect(validateBaseBranch("release/1.2")).toEqual({
    ok: true,
    branch: "release/1.2",
  });
});

test("rejects empty and invalid characters", () => {
  expect(validateBaseBranch("")).toMatchObject({ ok: false });
  expect(validateBaseBranch("has space")).toMatchObject({ ok: false });
});

test("honors CURSOR_ALLOWED_BRANCHES", () => {
  process.env.CURSOR_ALLOWED_BRANCHES = "main,develop";
  expect(validateBaseBranch("main").ok).toBe(true);
  expect(validateBaseBranch("feature/x").ok).toBe(false);
});
