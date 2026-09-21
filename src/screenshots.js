export const MAX_SCREENSHOTS = 5;

const IMAGE_EXT = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
]);

export function contentTypeForFilename(name) {
  const ext = String(name ?? "")
    .slice(String(name ?? "").lastIndexOf("."))
    .toLowerCase();
  return IMAGE_EXT.get(ext) ?? null;
}

export function isImageAttachment(attachment) {
  const type = attachment?.contentType?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return true;
  return Boolean(contentTypeForFilename(attachment?.filename ?? ""));
}

function safeFilename(name, fallbackId) {
  const cleaned = String(name ?? "")
    .split(/[\\/]/)
    .pop()
    .replace(/[^A-Za-z0-9._-]/g, "_");
  return cleaned || `${fallbackId ?? "screenshot"}.png`;
}

export function imageAttachments(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .filter(isImageAttachment)
    .slice(0, MAX_SCREENSHOTS);
}

export async function downloadCheckerImages(client, attachments) {
  const images = imageAttachments(attachments);
  const files = [];

  for (const attachment of images) {
    const { url } = await client.get(
      `/attachments/${attachment.id}/download-url`,
    );
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Could not download ${attachment.filename ?? attachment.id} (${response.status})`,
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const filename = safeFilename(attachment.filename, attachment.id);
    const contentType =
      attachment.contentType ||
      contentTypeForFilename(filename) ||
      "image/png";
    files.push({ filename, contentType, bytes });
  }

  return files;
}

export function toSdkImages(files) {
  return files.map((file) => ({
    data: Buffer.from(file.bytes).toString("base64"),
    mimeType: file.contentType || "image/png",
  }));
}
