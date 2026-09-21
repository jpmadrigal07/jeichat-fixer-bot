import { expect, test } from "bun:test";
import { formatTicketDisplayId, ticketPageUrl } from "./ticket-link.js";

test("builds a JeiChat ticket URL", () => {
  expect(
    ticketPageUrl(
      { workspaceId: "ws-1", id: "ticket-1" },
      "http://localhost:3000/",
    ),
  ).toBe("http://localhost:3000/w/ws-1/c/ticket-1");
});

test("formats GEN-12 when prefix and number exist", () => {
  expect(
    formatTicketDisplayId({ ticketPrefix: "gen", ticketNumber: 12, id: "abc" }),
  ).toBe("GEN-12");
});

test("falls back to #number then id slice", () => {
  expect(formatTicketDisplayId({ ticketNumber: 12, id: "abcdefghij" })).toBe(
    "#12",
  );
  expect(formatTicketDisplayId({ id: "abcdefghij" })).toBe("abcdefgh");
});
