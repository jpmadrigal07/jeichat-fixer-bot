export function cursorAgentOptions() {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "CURSOR_API_KEY is missing. Create one at https://cursor.com/dashboard/integrations",
    );
  }

  const model = { id: process.env.CURSOR_MODEL?.trim() || "composer-2.5" };
  const repoUrl = process.env.CURSOR_REPO_URL?.trim();
  const runtime =
    process.env.CURSOR_RUNTIME?.trim() || (repoUrl ? "cloud" : "local");

  if (runtime === "cloud") {
    if (!repoUrl) {
      throw new Error("CURSOR_REPO_URL is required when CURSOR_RUNTIME=cloud");
    }
    return {
      apiKey,
      model,
      cloud: {
        repos: [
          {
            url: repoUrl,
            startingRef: process.env.CURSOR_REPO_REF?.trim() || "main",
          },
        ],
        autoCreatePR: true,
        skipReviewerRequest: true,
      },
    };
  }

  const cwd = process.env.CURSOR_REPO_PATH?.trim();
  if (!cwd) {
    throw new Error("CURSOR_REPO_PATH is required when CURSOR_RUNTIME=local");
  }
  return {
    apiKey,
    model,
    local: { cwd },
  };
}

const MAX_REPLY = 3500;

export function truncateReply(text) {
  if (text.length <= MAX_REPLY) return text;
  return `${text.slice(0, MAX_REPLY)}\n\n_(truncated)_`;
}
