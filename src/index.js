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

  parseCheckVerdict,

  REFUTED_MESSAGE,

} from "./check-verdict.js";

import { ticketsAssignedToBot } from "./backfill.js";

import {

  parseFixerCommand,

  resolveBaseBranch,

  helpText,

} from "./commands.js";

import { createAssigneeDebouncer } from "./debounce.js";

import { fixTicket } from "./fix.js";

import {

  fixBlockedReason,

  WAITING_FOR_BASE_MESSAGE,

  WAITING_FOR_CONFIRM_MESSAGE,

} from "./fix-gate.js";

import { createFixPendingStore } from "./fix-pending.js";

import {

  formatRepoPrompt,

  resolveRepoUrl,

  validateBaseBranch,

} from "./fix-target.js";

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

const pending = createFixPendingStore();



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

  console.log(

    "Assign me to a ticket with Branch: in the description, then wait for checker CONFIRM.",

  );

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

    pending.clear(ticketId);

    return;

  }

  if (!isAssignedToBot(event, botUserId)) return;



  debouncer.schedule(ticketId, () => {

    void promptForBase(ticketId);

  });

});



client.on("messageCreate", (message) => {

  void handleMention(message);

  void handleCheckerConfirm(message);

});



async function handleCheckerConfirm(message) {

  if (!message?.sender?.isBot) return;

  const botUserId = client.user?.userId;

  const workspaceId = client.user?.workspaceId;

  if (!botUserId || !workspaceId) return;

  if (message.senderId === botUserId) return;



  const checkerUserId = process.env.CHECKER_BOT_USER_ID?.trim();

  if (checkerUserId && message.senderId !== checkerUserId) return;



  const verdict = parseCheckVerdict(message.content);

  if (verdict !== "CONFIRM") return;



  const channelId = message.channelId;

  if (!channelId) return;



  try {

    const channel = await client.get(

      `/workspaces/${workspaceId}/channels/${channelId}`,

    );

    if (!channel.parentId) return;

    if (channel.assigneeId !== botUserId) return;

    await maybeStartFix(channelId, { notifyMissing: true });

  } catch (error) {

    console.error("checker CONFIRM handler failed", error);

  }

}



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



    if (command.name === "fix") {

      await maybeStartFix(channelId, { notifyMissing: true });

      return;

    }

  } catch (error) {

    const detail = error instanceof Error ? error.message : "unknown error";

    console.error("mention command failed", error);

    await client.send(channelId, `I could not handle that: ${detail}`);

  }

}



async function restorePendingBase(ticketId, ticket) {
  const workspaceId = client.user?.workspaceId;
  if (!workspaceId) return;

  const restored = resolveBaseBranch({ description: ticket.description });
  if (!restored) {
    pending.clear(ticketId);
    return;
  }

  const validated = validateBaseBranch(restored);
  if (!validated.ok) {
    pending.clear(ticketId);
    return;
  }

  const boardId = ticket.parentId;
  if (!boardId) return;

  const repoUrl = await resolveRepoUrl(client, workspaceId, boardId);
  pending.setBase(ticketId, validated.branch, repoUrl);
}

async function promptForBase(ticketId) {

  const botUserId = client.user?.userId;

  const workspaceId = client.user?.workspaceId;

  if (!botUserId || !workspaceId) return;



  try {

    const ticket = await loadTicket(ticketId);

    if (ticket.assigneeId !== botUserId) return;



    const boardId = ticket.parentId;

    if (!boardId) return;



    await restorePendingBase(ticketId, ticket);



    if (pending.hasBase(ticketId)) {

      await maybeStartFix(ticketId, { notifyMissing: false });

      return;

    }



    const repoUrl = await resolveRepoUrl(client, workspaceId, boardId);

    await client.send(ticketId, formatRepoPrompt(repoUrl));

  } catch (error) {

    const detail = error instanceof Error ? error.message : "unknown error";

    console.error("promptForBase failed", error);

    await client.send(ticketId, `I could not resolve the repo: ${detail}`);

  }

}



async function maybeStartFix(ticketId, options = {}) {

  const notifyMissing = Boolean(options.notifyMissing);

  const botUserId = client.user?.userId;

  if (!botUserId) return;



  const ticket = await loadTicket(ticketId);

  await restorePendingBase(ticketId, ticket);

  const check = latestCheckVerdict(ticket.messageRows, {

    checkerUserId: process.env.CHECKER_BOT_USER_ID,

    fixerUserId: botUserId,

  });

  const state = pending.get(ticketId);



  const blocked = fixBlockedReason({

    assigneeId: ticket.assigneeId,

    botUserId,

    check,

    baseRef: state?.baseRef,

    isFixing: fixing.has(ticketId),

  });



  if (blocked === "already_fixing" || blocked === "not_assigned") return;



  if (blocked === "refuted") {

    if (notifyMissing) await client.send(ticketId, REFUTED_MESSAGE);

    return;

  }

  if (blocked === "missing_confirm") {

    if (notifyMissing) await client.send(ticketId, WAITING_FOR_CONFIRM_MESSAGE);

    return;

  }

  if (blocked === "missing_base") {

    if (notifyMissing) await client.send(ticketId, WAITING_FOR_BASE_MESSAGE);

    return;

  }



  void runFix(ticketId);

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

    const botUserId = client.user?.userId;

    if (!botUserId || ticket.assigneeId !== botUserId) return;



    await restorePendingBase(ticketId, ticket);

    const check = latestCheckVerdict(ticket.messageRows, {

      checkerUserId: process.env.CHECKER_BOT_USER_ID,

      fixerUserId: botUserId,

    });



    const state = pending.get(ticketId);

    const blocked = fixBlockedReason({

      assigneeId: ticket.assigneeId,

      botUserId,

      check,

      baseRef: state?.baseRef,

      isFixing: false,

    });



    if (blocked === "missing_confirm") {

      await client.send(ticketId, MISSING_CONFIRM_MESSAGE);

      return;

    }

    if (blocked === "refuted") {

      await client.send(ticketId, REFUTED_MESSAGE);

      return;

    }

    if (blocked === "missing_base") {

      await client.send(ticketId, WAITING_FOR_BASE_MESSAGE);

      if (ticket.parentId) {

        void promptForBase(ticketId);

      }

      return;

    }



    const opened = forceRetry

      ? null

      : alreadyOpenedPr(ticket.messageRows, botUserId);

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

    ticket.baseRef = state.baseRef;

    ticket.repoUrl = state.repoUrl;



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

      `Got it — checker CONFIRMED, base \`${state.baseRef}\`. I will try to fix it and reply here.`,

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

    parentId: ticket.parentId,

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

  const state = pending.get(ticketId);

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



  const baseLine = state?.baseRef

    ? `Base branch: \`${state.baseRef}\` (\`${state.repoUrl ?? "repo"}\`).`

    : "Base branch: not set yet — use `@Fix Bot base <branch>`.";



  await client.send(

    ticketId,

    `${baseLine}\n${formatFixStatus({

      busy: fixing.has(ticketId),

      queued: debouncer.has(ticketId),

      opened,

      botName: client.user?.name,

    })}`,

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

        void promptForBase(id);

      });

    }

  } catch (error) {

    console.error("assigned-ticket backfill failed", error);

  }

}



await client.login(token);


