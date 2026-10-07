import { auth } from "../auth";
import { getDiscordRuntimeStatus } from "../discord";
import { getSyncAuditSummary, listSyncAuditRuns } from "../services/sync-audit";

const basePath = "/admin/sync";
const legacyBasePath = "/admin/queues";

const escapeHtml = (value: string): string => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
};

const formatDateTime = (value: number | null): string => {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDuration = (value: number | null, emptyLabel = "In progress"): string => {
  if (value === null) {
    return emptyLabel;
  }

  if (value < 1000) {
    return `${value}ms`;
  }

  const seconds = Math.round(value / 100) / 10;
  return `${seconds}s`;
};

const requireAdmin = async (req: Request): Promise<Response | null> => {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.redirect(new URL("/dashboard", req.url), 302);
  }
  if (session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
};

const renderSyncRunsPage = async (): Promise<string> => {
  const [status, runs, summary] = await Promise.all([
    getDiscordRuntimeStatus(),
    listSyncAuditRuns(20),
    getSyncAuditSummary(),
  ]);

  const runCards = runs.length
    ? runs.map((run) => {
      const logs = run.logs.length
        ? run.logs.map((entry) =>
          `<li><span>${escapeHtml(formatDateTime(entry.timestamp))}</span><code>${escapeHtml(entry.message)}</code></li>`
        ).join("")
        : "<li><code>No log entries captured.</code></li>";

      return `
        <article class="run-card">
          <header>
            <div>
              <h2>${escapeHtml(run.mode)} sync</h2>
              <p>${escapeHtml(run.requestedBy)} · ${escapeHtml(run.status)}${run.reset ? " · reset" : ""}</p>
            </div>
            <div class="pill ${escapeHtml(run.status)}">${escapeHtml(run.status)}</div>
          </header>
          <dl class="meta">
            <div><dt>Started</dt><dd>${escapeHtml(formatDateTime(run.startedAt))}</dd></div>
            <div><dt>Finished</dt><dd>${escapeHtml(formatDateTime(run.finishedAt))}</dd></div>
            <div><dt>Duration</dt><dd>${escapeHtml(formatDuration(run.durationMs))}</dd></div>
            <div><dt>Classified</dt><dd>${run.classifiedCount}</dd></div>
          </dl>
          ${run.failureReason ? `<p class="failure">${escapeHtml(run.failureReason)}</p>` : ""}
          <ol class="logs">${logs}</ol>
        </article>
      `;
    }).join("")
    : "<article class=\"empty-state\">No sync runs captured in this process yet.</article>";

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Discord Sync Activity</title>
      <style>
        :root {
          color-scheme: light;
          --bg: #f5f3ef;
          --panel: rgba(255, 255, 255, 0.9);
          --border: rgba(29, 29, 27, 0.12);
          --text: #1d1d1b;
          --muted: #6d685f;
          --success: #1f6f43;
          --danger: #9c2f2f;
          --running: #8c6b11;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Georgia, "Iowan Old Style", serif;
          background:
            radial-gradient(circle at top, rgba(176, 157, 114, 0.16), transparent 38%),
            linear-gradient(180deg, #fbfaf7 0%, var(--bg) 100%);
          color: var(--text);
        }
        main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 40px 20px 64px;
        }
        header.page-header {
          margin-bottom: 28px;
        }
        h1 {
          margin: 0 0 10px;
          font-size: clamp(2rem, 4vw, 3.4rem);
          font-weight: 600;
          letter-spacing: -0.03em;
        }
        .subtitle, .status-line {
          margin: 0;
          color: var(--muted);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin: 24px 0 32px;
        }
        .status-card, .run-card, .empty-state {
          border: 1px solid var(--border);
          background: var(--panel);
          backdrop-filter: blur(14px);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(37, 33, 27, 0.05);
        }
        .status-card {
          padding: 16px 18px;
        }
        .status-card h2 {
          margin: 0 0 8px;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .status-card p {
          margin: 0;
          font-size: 1.4rem;
        }
        .runs {
          display: grid;
          gap: 18px;
        }
        .run-card {
          padding: 18px;
        }
        .run-card header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: start;
          margin-bottom: 16px;
        }
        .run-card h2 {
          margin: 0 0 4px;
          font-size: 1.2rem;
        }
        .run-card p {
          margin: 0;
          color: var(--muted);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .pill {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 0.78rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-family: ui-sans-serif, system-ui, sans-serif;
          border: 1px solid currentColor;
        }
        .pill.completed { color: var(--success); }
        .pill.failed { color: var(--danger); }
        .pill.running { color: var(--running); }
        .meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin: 0 0 16px;
        }
        .meta div {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.03);
        }
        dt {
          margin-bottom: 6px;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        dd {
          margin: 0;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .failure {
          margin: 0 0 16px;
          color: var(--danger);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .logs {
          margin: 0;
          padding-left: 18px;
          display: grid;
          gap: 8px;
        }
        .logs li {
          color: var(--muted);
        }
        .logs span {
          display: inline-block;
          min-width: 170px;
          margin-right: 10px;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 0.88rem;
        }
        .logs code {
          white-space: pre-wrap;
          font-family: ui-monospace, "SFMono-Regular", monospace;
          color: var(--text);
        }
        .empty-state {
          padding: 24px;
          color: var(--muted);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
      </style>
    </head>
    <body>
      <main>
        <header class="page-header">
          <h1>Discord sync activity</h1>
          <p class="subtitle">In-process run history for the SQLite-backed sync runtime.</p>
          <p class="status-line">Current mode: ${escapeHtml(status.executionMode)} · Client ready: ${status.clientReady ? "yes" : "no"} · In progress: ${status.inProgress ? "yes" : "no"}</p>
        </header>
        <section class="status-grid">
          <article class="status-card"><h2>Last success</h2><p>${escapeHtml(formatDateTime(status.lastSuccessAt))}</p></article>
          <article class="status-card"><h2>Last failure</h2><p>${escapeHtml(formatDateTime(status.lastFailureAt))}</p></article>
          <article class="status-card"><h2>Last duration</h2><p>${escapeHtml(formatDuration(status.lastDurationMs, "Never"))}</p></article>
          <article class="status-card"><h2>Overlap skips</h2><p>${status.overlapSkips}</p></article>
          <article class="status-card"><h2>Total runs</h2><p>${summary.totalRuns}</p></article>
          <article class="status-card"><h2>Completed</h2><p>${summary.completedRuns}</p></article>
          <article class="status-card"><h2>Failed</h2><p>${summary.failedRuns}</p></article>
          <article class="status-card"><h2>Avg duration</h2><p>${escapeHtml(formatDuration(summary.averageDurationMs, "Never"))}</p></article>
          <article class="status-card"><h2>Total messages</h2><p>${summary.totalMessagesStored}</p></article>
          <article class="status-card"><h2>Classified</h2><p>${summary.totalMessagesClassified}</p></article>
          <article class="status-card"><h2>Pending</h2><p>${summary.totalMessagesPending}</p></article>
          <article class="status-card"><h2>Members</h2><p>${summary.totalMembers}</p></article>
          <article class="status-card"><h2>Channels</h2><p>${summary.monitoredChannels}/${summary.totalChannels}</p></article>
          <article class="status-card"><h2>Guilds</h2><p>${summary.totalGuilds}</p></article>
          <article class="status-card"><h2>Classified by syncs</h2><p>${summary.totalClassifiedMessages}</p></article>
        </section>
        <section class="runs">${runCards}</section>
      </main>
    </body>
  </html>`;
};

export const handleSyncActivityRequest = async (req: Request): Promise<Response> => {
  const denied = await requireAdmin(req);
  if (denied) {
    return denied;
  }

  const url = new URL(req.url);
  if (url.pathname === legacyBasePath) {
    return Response.redirect(new URL(basePath, url), 302);
  }

  const html = await renderSyncRunsPage();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
