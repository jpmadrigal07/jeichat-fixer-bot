import { expect, test } from "bun:test";
import { branchNameForTicket, branchPrefix, branchSlug } from "./branch.js";

test("uses fix/ for Bug-labeled tickets", () => {
  expect(
    branchPrefix({
      name: "Add retry",
      labels: [{ name: "Bug" }],
    }),
  ).toBe("fix");
});

test("uses feat/ for Feature or Enhancement labels", () => {
  expect(
    branchPrefix({
      name: "Export markdown",
      labels: [{ name: "Feature" }],
    }),
  ).toBe("feat");
  expect(branchPrefix({ name: "Export", labels: [{ name: "Enhancement" }] })).toBe(
    "feat",
  );
});

test("defaults confirmed bugs to fix/", () => {
  expect(
    branchPrefix({
      name: "Save name does nothing",
      description: "Clicking Save fails.",
    }),
  ).toBe("fix");
});

test("uses feat/ when the title is a new capability without bug language", () => {
  expect(
    branchPrefix({
      name: "Add workspace export",
      description: "Support downloading a zip of the channel.",
    }),
  ).toBe("feat");
});

test("builds a kebab slug from ticket id and name", () => {
  expect(
    branchSlug({ displayId: "#12", name: "Stop persisting profile name" }),
  ).toBe("12-stop-persisting-profile-name");
});

test("joins prefix and slug", () => {
  expect(
    branchNameForTicket({
      displayId: "GEN-12",
      name: "Save name does nothing",
      labels: [{ name: "Bug" }],
    }),
  ).toBe("fix/gen-12-save-name-does-nothing");
});
