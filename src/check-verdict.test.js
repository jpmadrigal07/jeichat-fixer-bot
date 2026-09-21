import { expect, test } from "bun:test";
import {
  checkReportFromMessage,
  latestCheckVerdict,
  parseCheckVerdict,
} from "./check-verdict.js";

test("parses CONFIRM even when bolded", () => {
  expect(parseCheckVerdict("**Verdict:** **CONFIRM**\nBroken save.")).toBe(
    "CONFIRM",
  );
});

test("parses REFUTE", () => {
  expect(parseCheckVerdict("Verdict: REFUTE\nCould not reproduce.")).toBe(
    "REFUTE",
  );
});

test("returns null when there is no verdict", () => {
  expect(parseCheckVerdict("Got it — I will try to reproduce this.")).toBe(
    null,
  );
});

const checker = {
  id: "msg-confirm",
  senderId: "checker-user",
  content: "Verdict: CONFIRM\nSave name is a no-op.",
  sender: { name: "Bug Checker", isBot: true },
  attachments: [{ filename: "settings.png" }],
};

const refute = {
  id: "msg-refute",
  senderId: "checker-user",
  content: "Verdict: REFUTE\nWorks for me.",
  sender: { name: "Bug Checker", isBot: true },
};

test("uses the newest bot verdict and skips humans and the fixer", () => {
  const found = latestCheckVerdict(
    [
      {
        senderId: "fixer-user",
        content: "Verdict: CONFIRM\nI am the fixer",
        sender: { isBot: true },
      },
      {
        senderId: "human",
        content: "Verdict: CONFIRM\nI agree",
        sender: { isBot: false },
      },
      checker,
    ],
    { fixerUserId: "fixer-user" },
  );
  expect(found?.verdict).toBe("CONFIRM");
  expect(found?.message.id).toBe("msg-confirm");
});

test("pins to CHECKER_BOT_USER_ID when set", () => {
  const otherBot = {
    senderId: "sample-bot",
    content: "Verdict: CONFIRM\nfrom sample",
    sender: { isBot: true },
  };
  expect(
    latestCheckVerdict([otherBot, checker], {
      checkerUserId: "checker-user",
      fixerUserId: "fixer-user",
    })?.message.id,
  ).toBe("msg-confirm");
  expect(
    latestCheckVerdict([otherBot], {
      checkerUserId: "checker-user",
      fixerUserId: "fixer-user",
    }),
  ).toBe(null);
});

test("newest verdict wins when checker posted twice", () => {
  expect(
    latestCheckVerdict([refute, checker], {
      checkerUserId: "checker-user",
    })?.verdict,
  ).toBe("REFUTE");
});

test("extracts report text and screenshot names", () => {
  expect(checkReportFromMessage(checker)).toEqual({
    content: "Verdict: CONFIRM\nSave name is a no-op.",
    screenshotNames: ["settings.png"],
  });
});
