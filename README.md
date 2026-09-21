# JeiChat fixer bot

Standalone bot that **fixes a ticket when it is assigned as the assignee**. It talks to a local [JeiChat](https://github.com/jpmadrigal07/jeichat) API over REST + Socket.IO, then runs a Cursor **cloud** agent against the JeiChat GitHub repo and opens a PR.

The tester bot lives in `jeichat-sample-bot`. The live-site QA bot is `jeichat-bug-checker-bot`. This repo is the fixer only.

Coding rules live in this bot (`src/repo-rules.js`) and are injected into every Cursor fix prompt. They are not stored in the JeiChat app.

## Prerequisites

- [Bun](https://bun.sh)
- JeiChat API at `http://localhost:3001`
- Workspace **owner** (to create the bot)
- [Cursor API key](https://cursor.com/dashboard/integrations)
- GitHub access for that Cursor account on `jpmadrigal07/jeichat` (clone + open PRs)

## Run

1. In JeiChat: **Settings → Bots → Create** a bot named something like `Fix Bot`. Copy the `jei_live_...` token (shown once). Keep it in `.env`, not in git. Use a **fixer** token, not the checker or tester token.
2. In this folder:

```bash
bun install
cp .env.example .env
```

3. Fill `.env`:

```
JEICHAT_BOT_TOKEN=jei_live_...
JEICHAT_API_URL=http://localhost:3001
CURSOR_API_KEY=cursor_...
CURSOR_RUNTIME=cloud
CURSOR_REPO_URL=https://github.com/jpmadrigal07/jeichat
CURSOR_REPO_REF=main
```

4. Confirm Cursor cloud can clone and open PRs on that repo (GitHub app / repo access for the Cursor account). Without that, the agent starts then fails at clone or PR.
5. Start:

```bash
bun run start
```

6. Open a ticket, set **Assignee** to the fixer bot. After a PR exists, tag the bot in the ticket (`@Fix Bot retry`) to run again. Tag `@Fix Bot status` anytime to ask if Cursor is still running.

The bot waits **15 seconds** so a mis-assign can be undone (no reply if you unassign in time). On connect it also scans tickets already assigned to it (reconnect backfill) and runs those after the same delay. Then it looks at ticket messages (newest first) for a **bot** `Verdict: CONFIRM` or `Verdict: REFUTE` (same parser as the checker). Humans and this fixer’s own messages are ignored. If `CHECKER_BOT_USER_ID` is set, only that bot counts.

- No verdict → comments that it needs a CONFIRM, does not start a fix
- **REFUTE** → comments and stops
- **CONFIRM** → uses that message as the reproduction brief, downloads its screenshots and sends them to Cursor, comments that it is working, sets status to **In progress**, and replies with the result. The reply always ends with `PR:` / `Branch:` from Cursor git metadata when a PR was opened. If this bot already posted a `PR:` line, it skips a new run and points at that URL. Tag `@Fix Bot retry` in the ticket to run again without unassigning. Tag `@Fix Bot status` to check whether a Cursor run is still in flight (elapsed time + agent URL when known). On **FIXED** it sets status to **In review**. On **FAILED**, **NOT A BUG**, a crash, or an unreadable result it sets status back to **Todo** so the ticket does not look like a fix in flight. It does not unassign itself.

Cloud runtime opens a PR (`autoCreatePR`) and skips the reviewer-request step (`skipReviewerRequest`) so unattended PRs stay quiet. The PR title is whatever Cursor generates. The agent is told to put the ticket id and JeiChat URL in the body. Two tickets can run at once; a ticket already being fixed is skipped.

Local runtime is optional (`CURSOR_RUNTIME=local` + `CURSOR_REPO_PATH`): it creates a `fix/<ticket>-<slug>` or `feat/<ticket>-<slug>` branch and commits instead of opening a PR. The prefix is `fix/` for Bug-labeled / broken behavior, `feat/` for Feature or Enhancement. Cloud agents are told to use that same name (and to rename off `cursor/` if the VM starts there). Cursor’s cloud API still auto-generates `cursor/...` unless the agent successfully renames; the ticket reply always prints the branch Cursor actually pushed.

## Deploy (Coolify)

This bot is one long-running process. It is **not** a website, so it does not need a domain or `docker compose` with Postgres/web.

1. Push this repo to GitHub.
2. In Coolify: **New resource → Application** → this repo.
3. Build pack: **Dockerfile** (`Dockerfile` at the repo root).
4. Do **not** assign a domain. Do not enable the HTTP proxy.
5. Set env vars (same as `.env.example`, with the live API URL).

Use **Docker Compose** in Coolify only if that is how you create workers there — `docker-compose.yml` is a one-service wrapper around the same Dockerfile.

## Env

| Variable | Purpose |
|---|---|
| `JEICHAT_BOT_TOKEN` | Fixer bot token from JeiChat |
| `JEICHAT_API_URL` | API origin (`http://localhost:3001`) |
| `JEICHAT_WEB_ORIGIN` | Web origin for ticket links in PR bodies (`http://localhost:3000`) |
| `CHECKER_BOT_USER_ID` | Optional. Checker `userId` from that bot’s `GET /bots/@me`. Pins CONFIRM/REFUTE to that bot |
| `CURSOR_API_KEY` | Cursor user or service-account key |
| `CURSOR_RUNTIME` | `cloud` (default in `.env.example`) or `local` |
| `CURSOR_REPO_URL` | GitHub URL for cloud (`https://github.com/jpmadrigal07/jeichat`) |
| `CURSOR_REPO_REF` | Branch / SHA for cloud (`main` default) |
| `CURSOR_REPO_PATH` | JeiChat checkout for local runtime |
| `CURSOR_MODEL` | Model id (`composer-2.5` default) |
