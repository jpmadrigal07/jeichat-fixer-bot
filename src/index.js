import { JeiChat } from "./client.js";
import {
  isAssignedToBot,
  isUnassignedFromBot,
  ticketIdFromEvent,
} from "./assignee.js";
import { branchNameForTicket } from "./branch.js";
import {
  checkReportFromMessage,
  latestCheckVerdict,
  MISSING_CONFIRM_MESSAGE,
  REFUTED_MESSAGE,
} from "./check-verdict.js";
import { ticketsAssignedToBot } from "./backfill.js";
import { parseFixerCommand, helpText } from "./commands.js";
import { createAssigneeDebouncer } from "./debounce.js";
import { fixTicket } from "./fix.js";
import {
  alreadyOpenedMessage,
  alreadyOpenedPr,
} from "./idempotency.js";
import { isBotMentioned, stripBotMentions } from "./mention.js";
import { parseFixResult, statusAfterFix } from "./result.js";
import { createRunTracker, formatFixStatus } from "./status.js";
import { downloadCheckerImages, toSdkImages } from "./screenshots.js";
import { formatTicketDisplayId, ticketPageUrl } from "./ticket-link.js";

const token = process.env.JEICHAT_BOT_TOKEN?.trim();
if (!token) {
  console.error("Set JEICHAT_BOT_TOKEN (create a bot in JeiChat Settings → Bots).");
  process.exit(1);
}

const client = new JeiChat({
  apiUrl: process.env.JEICHAT_API_URL ?? "http://localhost:3001",
});

const fixing = new Set();
const runs = createRunTracker();
const debouncer = createAssigneeDebouncer();

client.on("ready", () => {
  console.log(
    `Fixer ready as ${client.user?.name} in workspace ${client.user?.workspaceId}`,
  );
  const checkerId = process.env.CHECKER_BOT_USER_ID?.trim();
  console.log(
    checkerId
      ? `Using checker bot userId ${checkerId}.`
      : "CHECKER_BOT_USER_ID is unset — any bot Verdict (except me) counts.",
  );
  console.log("Assign me to a ticket to start a fix (15s delay).");
  console.log(
    `Or tag me in the ticket: @${client.user?.name} retry | status | fix | help`,
  );
  void backfillAssignedTickets();
});

client.on("ticketUpdate", (event) => {
  const botUserId = client.user?.userId;
  if (!botUserId) return;
  const ticketId = ticketIdFromEvent(event);

  if (isUnassignedFromBot(event, botUserId)) {
    debouncer.cancel(ticketId);
    return;
  }
  if (!isAssignedToBot(event, botUserId)) return;

  debouncer.schedule(ticketId, () => {
    void runFix(ticketId);
  });
});

client.on("messageCreate", (message) => {
  void handleMention(message);
});

async function handleMention(message) {
  if (!message || message.sender?.isBot) return;
  const botName = client.user?.name;
  const botUserId = client.user?.userId;
  const workspaceId = client.user?.workspaceId;
  if (!botName || !botUserId || !workspaceId) return;
  if (!isBotMentioned(message.content, botName)) return;

  const command = parseFixerCommand(stripBotMentions(message.content, botName));
  const channelId = message.channelId;
  if (!channelId) return;

  try {
    if (command.name === "help" || command.name === "unknown") {
      await client.send(channelId, helpText(botName));
      return;
    }

    const channel = await client.get(
      `/workspaces/${workspaceId}/channels/${channelId}`,
    );
    if (!channel.parentId) {
      await client.send(channelId, "Tag me inside a ticket.");
      return;
    }
    if (command.name === "status") {
      await replyStatus(channelId);
      return;
    }

    if (channel.assigneeId !== botUserId) {
      await client.send(
        channelId,
        "Assign me to this ticket first, then tag me with `retry` or `fix`.",
      );
      return;
    }

    if (command.name === "retry") {
      void runFix(channelId, { forceRetry: true });
      return;
    }
    void runFix(channelId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("mention command failed", error);
    await client.send(channelId, `I could not handle that: ${detail}`);
  }
}

async function runFix(ticketId, options = {}) {
  const forceRetry = Boolean(options.forceRetry);
  if (fixing.has(ticketId)) {
    await client.send(
      ticketId,
      "I am already fixing this ticket. I will skip this extra run.",
    );
    return;
  }

  fixing.add(ticketId);
  let started = false;
  try {
    const ticket = await loadTicket(ticketId);
    if (ticket.assigneeId !== client.user?.userId) return;

    const check = latestCheckVerdict(ticket.messageRows, {
      checkerUserId: process.env.CHECKER_BOT_USER_ID,
      fixerUserId: client.user.userId,
    });
    if (!check) {
      await client.send(ticketId, MISSING_CONFIRM_MESSAGE);
      return;
    }
    if (check.verdict === "REFUTE") {
      await client.send(ticketId, REFUTED_MESSAGE);
      return;
    }

    const opened = forceRetry
      ? null
      : alreadyOpenedPr(ticket.messageRows, client.user.userId);
    if (opened) {
      await client.send(
        ticketId,
        alreadyOpenedMessage(opened.url, client.user.name),
      );
      return;
    }

    const report = checkReportFromMessage(check.message);
    ticket.branch = branchNameForTicket(ticket);
    ticket.pageUrl = ticketPageUrl(ticket);
    ticket.checkReport = report.content;
    ticket.checkScreenshotNames = report.screenshotNames;
    ticket.checkImages = [];
    try {
      const files = await downloadCheckerImages(
        client,
        check.message.attachments,
      );
      ticket.checkImages = toSdkImages(files);
      if (files.length > 0) {
        ticket.checkScreenshotNames = files.map((file) => file.filename);
      }
    } catch (error) {
      console.error("could not download checker screenshots", error);
    }

    await client.send(
      ticketId,
      "Got it — the checker CONFIRMED this. I will try to fix it and reply here.",
    );
    await setTicketStatus(ticketId, "in_progress");
    started = true;
    runs.start(ticketId);

    const summary = await fixTicket(ticket, {
      onAgent(agent) {
        runs.update(ticketId, { agentId: agent.agentId });
      },
    });
    await client.send(ticketId, summary);
    await setTicketStatus(ticketId, statusAfterFix(parseFixResult(summary)));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("fix failed", error);
    await client.send(ticketId, `Fix failed: ${detail}`);
    if (started) await setTicketStatus(ticketId, "todo");
  } finally {
    runs.end(ticketId);
    fixing.delete(ticketId);
  }
}

async function loadTicket(ticketId) {
  const workspaceId = client.user.workspaceId;
  const ticket = await client.get(
    `/workspaces/${workspaceId}/channels/${ticketId}`,
  );

  let ticketPrefix = ticket.ticketKey ?? null;
  if (!ticketPrefix && ticket.parentId) {
    try {
      const parent = await client.get(
        `/workspaces/${workspaceId}/channels/${ticket.parentId}`,
      );
      ticketPrefix = parent.ticketKey ?? null;
    } catch (error) {
      console.error("could not load parent channel for ticket prefix", error);
    }
  }

  const page = await client.get(`/channels/${ticketId}/messages?limit=100`);
  const messageRows = page.data ?? [];

  const messages = messageRows
    .slice()
    .reverse()
    .map((row) => `${row.sender?.name ?? "Unknown"}: ${row.content}`.trim())
    .filter(Boolean);

  return {
    id: ticket.id,
    workspaceId,
    ticketNumber: ticket.ticketNumber ?? null,
    ticketPrefix,
    displayId: formatTicketDisplayId({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketPrefix,
    }),
    name: ticket.name,
    description: ticket.description,
    labels: ticket.labels ?? [],
    messages,
    messageRows,
    assigneeId: ticket.assigneeId,
  };
}

async function setTicketStatus(ticketId, status) {
  try {
    await client.patch(
      `/workspaces/${client.user.workspaceId}/channels/${ticketId}`,
      { status },
    );
  } catch (error) {
    console.error(`could not set ticket status to ${status}`, error);
  }
}

async function replyStatus(ticketId) {
  const run = runs.get(ticketId);
  if (run) {
    await client.send(ticketId, formatFixStatus({ run }));
    return;
  }

  let opened = null;
  try {
    const page = await client.get(`/channels/${ticketId}/messages?limit=100`);
    opened = alreadyOpenedPr(page.data ?? [], client.user?.userId);
  } catch (error) {
    console.error("could not load messages for status", error);
  }

  await client.send(
    ticketId,
    formatFixStatus({
      busy: fixing.has(ticketId),
      queued: debouncer.has(ticketId),
      opened,
      botName: client.user?.name,
    }),
  );
}

async function backfillAssignedTickets() {
  const workspaceId = client.user?.workspaceId;
  const botUserId = client.user?.userId;
  if (!workspaceId || !botUserId) return;

  try {
    const channels = await client.get(`/workspaces/${workspaceId}/channels`);
    const ids = ticketsAssignedToBot(channels, botUserId);
    console.log(
      ids.length > 0
        ? `Backfill: ${ids.length} ticket(s) already assigned to me.`
        : "Backfill: no tickets assigned to me.",
    );
    for (const id of ids) {
      debouncer.schedule(id, () => {
        void runFix(id);
      });
    }
  } catch (error) {
    console.error("assigned-ticket backfill failed", error);
  }
}

await client.login(token);
