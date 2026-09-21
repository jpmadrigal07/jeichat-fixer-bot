import { Agent, CursorAgentError } from "@cursor/sdk";
import { branchNameForTicket } from "./branch.js";
import { cursorAgentOptions } from "./cursor.js";
import { composeFixReply } from "./result.js";
import { REPO_RULES } from "./repo-rules.js";
import { ticketPageUrl } from "./ticket-link.js";

function formatCheckReport(ticket) {
  const report = ticket.checkReport?.trim();
  if (!report) return "(none)";
  const attached = ticket.checkImages?.length
    ? `\n${ticket.checkImages.length} checker screenshot(s) are attached to this message. Look at them.`
    : ticket.checkScreenshotNames?.length
      ? `\nChecker screenshots on the JeiChat ticket (could not attach bytes): ${ticket.checkScreenshotNames.join(", ")}`
      : "";
  return `${report}${attached}`;
}

export function fixPrompt(ticket) {
  const messages =
    ticket.messages.length > 0
      ? ticket.messages.map((line) => `- ${line}`).join("\n")
      : "(none)";
  const branch = ticket.branch || branchNameForTicket(ticket);
  const pageUrl = ticket.pageUrl || ticketPageUrl(ticket);

  return `You were assigned a JeiChat ticket. Fix it in this repository.

Match existing patterns. Do not invent a parallel architecture.

Coding rules (follow these; they live in the fixer bot, not the app repo):
${REPO_RULES}

Ticket: ${ticket.displayId} ${ticket.name}
Git branch (use this exact name): ${branch}
Description:
${ticket.description?.trim() || "(empty)"}

Checker report (Verdict: CONFIRM — treat this as the reproduction brief; prefer it over older chat if they disagree):
${formatCheckReport(ticket)}

Recent messages:
${messages}

Instructions:
1. Inspect the relevant code and tests. Use the checker report as the source of truth for what is broken. If screenshots are attached, look at them.
2. If this is not a real product bug, do not change files. Reply with Result: NOT A BUG and why.
3. If it is a bug or missing feature:
   - Create or rename the git branch to exactly ${branch} before you commit. Use fix/ for bugs and feat/ for new capabilities. Do not use a cursor/ prefix. If you are already on a cursor/... branch, run git branch -m ${branch}.
   - Local runtime: implement the smallest correct fix, add or update tests if that area already has them, and commit on that branch. Do not push unless the working tree already tracks a remote and you can do so safely. Do not commit unrelated dirty files.
   - Cloud runtime: implement the fix on that branch (a pull request is created for you). Leave the PR title as Cursor generates it. PR body must include:
     Ticket: ${ticket.displayId}${pageUrl ? `\n     ${pageUrl}` : ""}
4. Reply with a short Markdown report that includes:
   - Result: FIXED or NOT A BUG or FAILED
   - What you changed
   Do not include a PR URL; it is appended automatically when Cursor opens one.`;
}

async function disposeAgent(agent) {
  if (!agent) return;
  if (typeof agent[Symbol.asyncDispose] === "function") {
    await agent[Symbol.asyncDispose]();
    return;
  }
  agent.close();
}

export async function fixTicket(ticket, options = {}) {
  let agent;
  try {
    agent = await Agent.create(cursorAgentOptions());
    if (typeof options.onAgent === "function") {
      options.onAgent(agent);
    }
    const text = fixPrompt(ticket);
    const images = ticket.checkImages ?? [];
    const run = await agent.send(
      images.length > 0 ? { text, images } : text,
    );
    const result = await run.wait();
    if (result.status !== "finished") {
      return `I could not finish the fix (${result.status}${
        result.error?.message ? `: ${result.error.message}` : ""
      }).`;
    }
    return composeFixReply(result.result, result.git);
  } catch (error) {
    if (error instanceof CursorAgentError) {
      return `I could not start a Cursor fix: ${error.message}`;
    }
    throw error;
  } finally {
    await disposeAgent(agent);
  }
}
