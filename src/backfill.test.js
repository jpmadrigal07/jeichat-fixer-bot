import { expect, test } from "bun:test";
import { ticketsAssignedToBot } from "./backfill.js";

const bot = "fixer-1";

test("keeps open tickets assigned to the bot", () => {
  expect(
    ticketsAssignedToBot(
      [
        { id: "chan", parentId: null, assigneeId: bot },
        { id: "t1", parentId: "chan", assigneeId: bot },
        { id: "t2", parentId: "chan", assigneeId: "other" },
        { id: "t3", parentId: "chan", assigneeId: bot, archivedAt: "2026-01-01" },
      ],
      bot,
    ),
  ).toEqual(["t1"]);
});

test("returns nothing without a bot id", () => {
  expect(
    ticketsAssignedToBot([{ id: "t1", parentId: "chan", assigneeId: bot }], ""),
  ).toEqual([]);
});
