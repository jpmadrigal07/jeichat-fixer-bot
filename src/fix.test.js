import { expect, test } from "bun:test";
import { fixPrompt } from "./fix.js";

test("embeds fixer-bot coding rules in the prompt", () => {
  const prompt = fixPrompt({
    displayId: "GEN-12",
    name: "Archive redirect",
    description: "Inbox opens the board.",
    workspaceId: "ws-1",
    id: "ticket-1",
    pageUrl: "http://localhost:3000/w/ws-1/c/ticket-1",
    messages: ["Ada: please fix"],
    checkReport: "Verdict: CONFIRM\nSave name does nothing.",
    checkScreenshotNames: ["settings.png"],
    checkImages: [{ data: "abc", mimeType: "image/png" }],
  });
  expect(prompt).toContain("getSharedPgPool()");
  expect(prompt).not.toContain(".cursor/rules/");
  expect(prompt).toContain("Result: FIXED or NOT A BUG or FAILED");
  expect(prompt).toContain("Module → Controller → Service");
  expect(prompt).toContain("Verdict: CONFIRM\nSave name does nothing.");
  expect(prompt).toContain("1 checker screenshot(s) are attached");
  expect(prompt).toContain("Git branch (use this exact name): fix/gen-12-archive-redirect");
  expect(prompt).toContain("git branch -m fix/gen-12-archive-redirect");
  expect(prompt).toContain("Do not use a cursor/ prefix");
  expect(prompt).toContain("Leave the PR title as Cursor generates it");
  expect(prompt).toContain("Ticket: GEN-12");
  expect(prompt).toContain("http://localhost:3000/w/ws-1/c/ticket-1");
  expect(prompt).not.toContain("Set the PR title");
  expect(prompt).not.toContain("gh pr edit");
  expect(prompt).not.toContain("/opt/cursor/artifacts/");
  expect(prompt).not.toContain("after-fix");
});
