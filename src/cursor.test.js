import { afterEach, expect, test } from "bun:test";
import { cursorAgentOptions } from "./cursor.js";

const keys = [
  "CURSOR_API_KEY",
  "CURSOR_MODEL",
  "CURSOR_RUNTIME",
  "CURSOR_REPO_URL",
  "CURSOR_REPO_REF",
  "CURSOR_REPO_PATH",
];
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

test("cloud clones the git URL and skips reviewer request", () => {
  process.env.CURSOR_API_KEY = "cursor_test";
  process.env.CURSOR_RUNTIME = "cloud";
  process.env.CURSOR_REPO_URL = "https://github.com/jpmadrigal07/jeichat";
  process.env.CURSOR_REPO_REF = "develop";

  expect(cursorAgentOptions()).toEqual({
    apiKey: "cursor_test",
    model: { id: "composer-2.5" },
    cloud: {
      repos: [
        {
          url: "https://github.com/jpmadrigal07/jeichat",
          startingRef: "develop",
        },
      ],
      autoCreatePR: true,
      skipReviewerRequest: true,
    },
  });
});

test("local uses CURSOR_REPO_PATH", () => {
  process.env.CURSOR_API_KEY = "cursor_test";
  process.env.CURSOR_RUNTIME = "local";
  process.env.CURSOR_REPO_PATH = "C:\\zkript-solutions\\in-house\\jeichat";
  delete process.env.CURSOR_REPO_URL;

  expect(cursorAgentOptions()).toEqual({
    apiKey: "cursor_test",
    model: { id: "composer-2.5" },
    local: { cwd: "C:\\zkript-solutions\\in-house\\jeichat" },
  });
});
