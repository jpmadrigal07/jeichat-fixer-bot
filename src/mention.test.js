import { expect, test } from "bun:test";
import { isBotMentioned, stripBotMentions } from "./mention.js";

test("detects @Name and @First mentions", () => {
  expect(isBotMentioned("hey @Fix Bot retry", "Fix Bot")).toBe(true);
  expect(isBotMentioned("@fix retry", "Fix Bot")).toBe(true);
  expect(isBotMentioned("Fix Bot without an at", "Fix Bot")).toBe(false);
  expect(isBotMentioned("@Fixture retry", "Fix Bot")).toBe(false);
});

test("strips the mention so the command remains", () => {
  expect(stripBotMentions("@Fix Bot retry", "Fix Bot")).toBe("retry");
  expect(stripBotMentions("@Fix Bot help", "Fix Bot")).toBe("help");
});
