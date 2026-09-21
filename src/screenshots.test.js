import { expect, test } from "bun:test";
import {
  imageAttachments,
  isImageAttachment,
  toSdkImages,
} from "./screenshots.js";

test("detects image attachments by type or filename", () => {
  expect(isImageAttachment({ contentType: "image/png", filename: "a" })).toBe(
    true,
  );
  expect(isImageAttachment({ filename: "shot.webp" })).toBe(true);
  expect(isImageAttachment({ contentType: "application/pdf" })).toBe(false);
});

test("keeps at most five images", () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({
    filename: `${i}.png`,
  }));
  expect(imageAttachments(rows)).toHaveLength(5);
});

test("encodes bytes as SDK images", () => {
  expect(
    toSdkImages([
      { bytes: Buffer.from("abc"), contentType: "image/png" },
    ]),
  ).toEqual([
    { data: Buffer.from("abc").toString("base64"), mimeType: "image/png" },
  ]);
});
