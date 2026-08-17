// Behavioral regression tests for the SourceResult envelope refactor
// (F-1, F-3, F-4, C-4 in docs/SECURITY-ARCHITECTURE-GAP-ANALYSIS.md).
//
// These tests load the real web/index.html into a jsdom window, execute the
// real web/dune-addon-bridge.js, web/data-providers.js, and web/addon.js
// against it (not reimplemented copies), replace the active provider with a
// test double that returns controlled SourceResult envelopes, trigger a
// refresh, and assert on the actual rendered DOM text — this is what
// directly proves the false-zero and "all sources online" defects are
// fixed, not just that the underlying functions return the right shape.
//
// This replaces C-4's substring check (`js.includes('"unavailable"')`),
// which only proved the string existed somewhere in the source file, not
// that any renderer actually consumed it correctly — which is exactly why
// F-1 shipped and went undetected for as long as it did.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function readWeb(path) {
  return readFileSync(join(ROOT, "web", path), "utf8");
}

// Builds a fresh addon DOM + real scripts for each test, so no state leaks
// between tests (module-scope variables like lastSuccessfulReadAt in
// addon.js are otherwise shared across the whole process).
function loadAddon() {
  const html = readWeb("index.html").replace(
    /<script src="([^"]+)"><\/script>/g,
    "" // strip the real <script> tags; we eval the files ourselves below so
       // we can control load order and inject the mock provider in between.
  );

  const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.invalid/" });
  const { window } = dom;

  // web/dune-addon-bridge.js and web/data-providers.js are IIFEs that only
  // touch `window`/`document` — safe to eval directly in the jsdom context.
  window.eval(readWeb("dune-addon-bridge.js"));
  window.eval(readWeb("data-providers.js"));

  return { dom, window };
}

// Replaces window.DuneOpsProviders.currentProvider() with a test double
// that returns exactly the SourceResult envelopes the test wants, then
// evals the real addon.js (which calls getProvider() -> currentProvider()
// itself, both on initial load and on every refresh).
function installMockProvider(window, methods) {
  const provider = {
    name: "bridge",
    label: "Mock bridge provider (test)",
    actions: [],
    ...methods
  };
  window.DuneOpsProviders.currentProvider = () => provider;
}

function unavailable(reason = "not_implemented", source = "ops.test.mock") {
  return { status: "unavailable", data: null, reason, source };
}

function live(data) {
  return { status: "live", data, reason: null, source: null };
}

function text(window, selector) {
  const el = window.document.querySelector(selector);
  return el ? el.textContent : null;
}

function runAddon(window) {
  window.eval(readWeb("addon.js"));
}

async function flushAsync() {
  // refreshAll() is async; addon.js's module-scope `refreshAll()` call and
  // any button-click handler both need microtasks (Promise.allSettled,
  // several `await`s) to resolve before the DOM reflects the result.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ── F-1: unsupported/errored bridge data must never render as a false zero ──

test("renderActivity shows 'Not available', not 0, when the source is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getActivity: async () => unavailable("not_implemented", "ops.activity.summary")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#act-total"), "—", "act-total must show a dash, not 0 or a stale value");
  assert.equal(text(window, "#act-online"), "—");
  assert.notEqual(text(window, "#act-total"), "0", "must never render the literal string 0 for an unavailable source");

  const note = window.document.querySelector("#act-availability-note");
  assert.ok(note, "availability note element must exist");
  assert.equal(note.hidden, false, "availability note must be shown when the source is unavailable");
  assert.match(note.textContent, /not available/i);
});

test("renderCombat shows 'Not available', not 0, when the source is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getCombat: async () => unavailable("bridge_error", "ops.combat.deaths")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#cmb-total"), "—");
  assert.equal(text(window, "#cmb-kd"), "—");
  assert.notEqual(text(window, "#cmb-total"), "0");
  assert.equal(window.document.querySelector("#cmb-availability-note").hidden, false);
});

test("renderInventory shows 'Not available', not 0, for a not-yet-implemented Core route", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getInventory: async () => unavailable("not_implemented", "ops.inventory.summary")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#inv-items"), "—");
  assert.equal(text(window, "#inv-invs"), "—");
  assert.equal(text(window, "#inv-crafted"), "—");
  assert.notEqual(text(window, "#inv-items"), "0");
});

// F-1-style false-zero regression: totalCrafted has no real data source
// anywhere in Core's schema (duneDb.js's addonOpsInventorySummary always
// returns totalCrafted: null, explicitly, by design). Previously
// setText(invCraftedEl, d.totalCrafted ?? 0) coalesced that real null to
// a fabricated-looking 0 even when the rest of the inventory source was
// genuinely live -- this is the exact false-zero anti-pattern already
// fixed elsewhere in this file for other sources, just not caught here
// since the whole-source-unavailable case (above) happened to also
// render "—" for a different reason, masking the gap.
test("Total Crafted never renders a fabricated 0 even when the rest of the inventory source is genuinely live", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getInventory: async () => live({ totalItems: 42, totalInventories: 7, totalCrafted: null, itemsByTemplate: [], storageUsage: [] })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#inv-items"), "42", "totalItems is real and live, must render normally");
  assert.equal(text(window, "#inv-crafted"), "—", "totalCrafted has no real source and must never render a fabricated 0");
  assert.notEqual(text(window, "#inv-crafted"), "0");
});

// ── ops.health.prometheus: "not implemented" vs. "stack not running" ──
//
// Core distinguishes these two real, honest, but different states: a
// route that genuinely has no integration at all (location) vs. one that
// has a real integration but the optional Prometheus stack isn't running
// on this deployment (a bare opsPlaceholder()-shaped {status:"planned"}
// response has no `reason` field; Core's real
// addonOpsPrometheusHealth() adds reason:"metrics_stack_not_running" to
// the same shape). This exercises the REAL provider/data-providers.js
// code path (not just a hand-built SourceResult mock) to prove
// fetchLiveOrUnavailable() actually reads and passes through that
// specific reason, rather than collapsing every {status:"planned"}
// response to the same generic "not_implemented" label.

test("ops.health.prometheus's real provider passes through Core's specific 'metrics_stack_not_running' reason, distinct from generic 'not_implemented'", async () => {
  const { window } = loadAddon();
  window.DuneAddon = {
    request: async (action) => {
      if (action === "ops.health.prometheus") {
        return { status: "planned", domain: "prometheus", reason: "metrics_stack_not_running", message: "...", summary: {} };
      }
      throw new Error(`unexpected action in test: ${action}`);
    }
  };

  const result = await window.DuneOpsProviders.providers.bridge.getPrometheusHealth();
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "metrics_stack_not_running", "must pass through Core's specific reason, not collapse to a generic one");
  assert.equal(result.data, null);
});

test("a bare {status:'planned'} response with no reason field (e.g. location, genuinely not implemented) still falls back to 'not_implemented'", async () => {
  const { window } = loadAddon();
  window.DuneAddon = {
    request: async () => ({ status: "planned", domain: "location", message: "...", summary: {} })
  };

  const result = await window.DuneOpsProviders.providers.bridge.getLocation();
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "not_implemented");
});

test("renderPrometheus shows a specific 'metrics stack not running' message, and never renders a false 0 for totalRestarts", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getPrometheusHealth: async () => unavailable("metrics_stack_not_running", "ops.health.prometheus")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#mtr-restarts"), "—");
  assert.notEqual(text(window, "#mtr-restarts"), "0");
  const note = window.document.querySelector("#mtr-availability-note");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /metrics stack is not running/i);
});

test("renderPrometheus renders real target/service data when live, and a dash (never a false 0) for the always-null totalRestarts field", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getPrometheusHealth: async () => live({
      healthy: true,
      targets: { active: 5, inactive: 1, pending: 0, total: 6 },
      services: { "dune-prometheus": "up", "dune-cadvisor": "down" },
      summary: { avgCpuPercent: 13.6, avgMemoryMb: 15613, totalRestarts: null }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#mtr-health"), "Healthy");
  assert.equal(text(window, "#mtr-targets"), "5 / 6");
  assert.equal(text(window, "#mtr-cpu"), "13.6%");
  assert.equal(text(window, "#mtr-mem"), "15613 MB");
  // The real, verified-live reason this is always null today: Core's
  // cAdvisor configuration doesn't expose per-container restart counts
  // on this system (see addonOpsPrometheusHealth's own comment in
  // dune-awakening-selfhost-docker). Rendering "0" here would be exactly
  // the false-zero anti-pattern this whole addon's SourceResult refactor
  // exists to prevent.
  assert.equal(text(window, "#mtr-restarts"), "—");
  assert.notEqual(text(window, "#mtr-restarts"), "0");
});

// ── #133: NOC Overview rebuild — per-container metrics grid ──

test("renderContainerGrid shows an unavailable note, not an empty grid pretending to be a real zero-container result, when the source is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => unavailable("request_failed", "ops.health.containers")
  });
  runAddon(window);
  await flushAsync();

  const grid = window.document.querySelector("#container-grid");
  const note = window.document.querySelector("#container-grid-availability-note");
  assert.equal(grid.hidden, true, "grid must be hidden, not rendered empty, when unavailable");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /not available/i);
});

test("renderContainerGrid renders one tile per real container, with real metric text, when live", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [
        { name: "dune-postgres", cpu: "3.40%", mem: "412MiB", memLimit: "2GiB", netIO: "12kB / 4kB", blockIO: "1.2MB / 340kB", status: "Up 2 hours (healthy)" },
        { name: "dune-rmq-game", cpu: "71.00%", mem: "1.2GiB", memLimit: "1.5GiB", netIO: "340kB / 88kB", blockIO: "4.1MB / 900kB", status: "Up 2 hours" }
      ]
    })
  });
  runAddon(window);
  await flushAsync();

  const grid = window.document.querySelector("#container-grid");
  assert.equal(grid.hidden, false);
  const tiles = grid.querySelectorAll(".container-tile");
  assert.equal(tiles.length, 2, "must render exactly one tile per returned container");

  const names = Array.from(tiles).map((t) => t.querySelector(".container-tile-name").textContent);
  assert.deepEqual(names, ["dune-postgres", "dune-rmq-game"]);

  const firstTile = tiles[0];
  assert.match(firstTile.textContent, /3\.40%/, "must show the real CPU value from Core, not a reformatted/rounded one");
  assert.match(firstTile.textContent, /412MiB/, "must show the real mem value from Core");
});

test("renderContainerGrid shows a real empty-state note (not a fabricated 'all healthy') when Core returns zero containers", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({ containers: [] })
  });
  runAddon(window);
  await flushAsync();

  const grid = window.document.querySelector("#container-grid");
  assert.equal(grid.hidden, false, "the grid itself is shown (this is a real, live, empty result -- not an unavailable one)");
  assert.match(grid.textContent, /no containers were reported/i);
});

test("renderContainerGrid tiles never show the literal string 0% for a container's CPU when Core reports 0.00%", async () => {
  // Distinguishes a real, live "0.00%" (idle container, genuinely zero
  // load) from this addon's usual false-zero anti-pattern (an
  // unavailable/missing field silently rendering as 0) -- 0.00% here
  // must render as-is, verbatim from Core, not collapse to a dash.
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [{ name: "dune-idle", cpu: "0.00%", mem: "4MiB", memLimit: "256MiB", netIO: "0B / 0B", blockIO: "0B / 0B", status: "Up 1 hour" }]
    })
  });
  runAddon(window);
  await flushAsync();

  const tile = window.document.querySelector(".container-tile");
  assert.match(tile.textContent, /0\.00%/, "a real, live 0.00% must render verbatim, not as a dash or omitted");
});

// ── #133 PR 3: fleet-level rollup strip ──

test("renderFleetRollup shows real combined fleet CPU/memory and host CPU/memory, derived arithmetically from the same per-container data the grid below it shows", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [
        { name: "dune-postgres", cpu: "10.00%", mem: "500MB", memLimit: "2GB", netIO: "0B", blockIO: "0B", status: "Up 1 hour" },
        { name: "dune-rmq-game", cpu: "5.00%", mem: "300MB", memLimit: "1GB", netIO: "0B", blockIO: "0B", status: "Up 1 hour" }
      ]
    }),
    getPrometheusHealth: async () => live({
      healthy: true,
      targets: { active: 6, inactive: 0, pending: 0, total: 6 },
      services: {},
      summary: { avgCpuPercent: 22.5, avgMemoryMb: 16384, totalRestarts: null }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#fleet-containers-up"), "2 / 2");
  assert.equal(text(window, "#fleet-cpu"), "15%", "must be the real sum of both containers' CPU (10.00 + 5.00), not a separately-computed value");
  assert.equal(text(window, "#fleet-mem"), "800.0 MB", "must be the real sum of both containers' memory (500MB + 300MB)");
  assert.equal(text(window, "#fleet-host-cpu"), "22.5%");
  // 16384 MB must be scaled to GB, fixing the real, previously-reported
  // bloat finding of showing raw unformatted MB integers (e.g.
  // "16384 MB" instead of "16.4 GB").
  assert.equal(text(window, "#fleet-host-mem"), "17.2 GB");
});

test("renderFleetRollup shows dashes, not 0, when both container and host sources are unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => unavailable("request_failed", "ops.health.containers"),
    getPrometheusHealth: async () => unavailable("metrics_stack_not_running", "ops.health.prometheus")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#fleet-containers-up"), "—");
  assert.equal(text(window, "#fleet-cpu"), "—");
  assert.equal(text(window, "#fleet-mem"), "—");
  assert.equal(text(window, "#fleet-host-cpu"), "—");
  assert.equal(text(window, "#fleet-host-mem"), "—");
});

// ── #133 PR 3: removed "Bridge & Data Sources" panel (issue #77 fix) ──

test("the removed 'Bridge & Data Sources' table no longer exists in the DOM (issue #77 -- replaced by real per-container data)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  assert.equal(window.document.querySelector("#noc-service-body"), null, "the old bookkeeping table (OPS Health Bridge/Player Aggregate/Farm Aggregate rows unrelated to its own 'named services' promise) must be gone, not just relabeled");
});

// ── #133 PR 3: scoped auto-refresh (never runs in this test harness's non-iframe jsdom window) ──

test("the auto-refresh timer never starts outside a real Console iframe (window.parent === window in this harness, same as direct-browser preview mode)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  assert.ok(window.DuneOpsAutoRefresh, "the auto-refresh control object must always be exposed, even when the timer itself is not running");
  assert.equal(window.DuneOpsAutoRefresh.isRunning(), false, "must not start a real setInterval in a non-iframe context (this test harness has no parent window, exactly like direct-browser preview mode)");
});

test("triggerNow() (the auto-refresh function itself, called directly, not via a live timer) refreshes exactly the four scoped sources and none of the manual-refresh-only ones", async () => {
  const { window } = loadAddon();
  let activityCalled = false;
  installMockProvider(window, {
    getContainerHealth: async () => live({ containers: [{ name: "dune-postgres", cpu: "1%", mem: "1MB", memLimit: "1GB", netIO: "0B", blockIO: "0B", status: "Up" }] }),
    getPostgresHealth: async () => live({ up: true, connections: { active: 1, max: 10 }, cacheHitRatioPercent: 99, deadlocksLast5m: 0 }),
    getRabbitmqHealth: async () => live({ up: true, instances: [], queueDepth: 0, memPercent: 1, fdPercent: 1 }),
    getPrometheusHealth: async () => live({ healthy: true, targets: { active: 1, inactive: 0, pending: 0, total: 1 }, services: {}, summary: { avgCpuPercent: 1, avgMemoryMb: 1, totalRestarts: null } }),
    getActivity: async () => { activityCalled = true; return live({ totalPlayers: 1 }); }
  });
  runAddon(window);
  await flushAsync();

  activityCalled = false; // reset after the initial refreshAll() full dispatch
  await window.DuneOpsAutoRefresh.triggerNow();

  assert.equal(activityCalled, false, "the auto-refresh path must never call getActivity() or any other manual-refresh-only provider method");
  assert.match(text(window, "#fleet-cpu"), /1%/, "the four scoped sources must still actually update the DOM when triggered directly");
});

// ── #133 PR 2: family-specific extra metrics on Postgres/RabbitMQ tiles ──

test("the dune-postgres tile shows real connections/cache-hit/deadlocks data when ops.health.postgres is live", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [{ name: "dune-postgres", cpu: "3.40%", mem: "412MiB", memLimit: "2GiB", netIO: "12kB / 4kB", blockIO: "1.2MB / 340kB", status: "Up 2 hours (healthy)" }]
    }),
    getPostgresHealth: async () => live({ up: true, connections: { active: 18, max: 100 }, cacheHitRatioPercent: 98.2, deadlocksLast5m: 0 })
  });
  runAddon(window);
  await flushAsync();

  const tile = window.document.querySelector(".container-tile");
  assert.match(tile.textContent, /Postgres/, "must show the family divider label");
  assert.match(tile.textContent, /18 \/ 100/, "must show real connections active/max, not a fabricated value");
  assert.match(tile.textContent, /98\.2%/, "must show the real cache hit ratio");
  assert.match(tile.textContent, /Deadlocks \(5m\)/);
});

test("a dune-rmq-* tile does not show Postgres metrics, and vice versa (family detection by container name)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [
        { name: "dune-postgres", cpu: "1%", mem: "1MiB", memLimit: "1GiB", netIO: "0B", blockIO: "0B", status: "Up" },
        { name: "dune-rmq-game", cpu: "1%", mem: "1MiB", memLimit: "1GiB", netIO: "0B", blockIO: "0B", status: "Up" },
        { name: "dune-server-survival-1", cpu: "1%", mem: "1MiB", memLimit: "1GiB", netIO: "0B", blockIO: "0B", status: "Up" }
      ]
    }),
    getPostgresHealth: async () => live({ up: true, connections: { active: 1, max: 10 }, cacheHitRatioPercent: 99, deadlocksLast5m: 0 }),
    getRabbitmqHealth: async () => live({ up: true, instances: [{ name: "rabbitmq-game", up: true }], queueDepth: 5, memPercent: 1, fdPercent: 1 })
  });
  runAddon(window);
  await flushAsync();

  const tiles = window.document.querySelectorAll(".container-tile");
  assert.equal(tiles.length, 3);
  assert.match(tiles[0].textContent, /Postgres/);
  assert.doesNotMatch(tiles[0].textContent, /RabbitMQ/);
  assert.match(tiles[1].textContent, /RabbitMQ/);
  assert.doesNotMatch(tiles[1].textContent, /Postgres/);
  assert.doesNotMatch(tiles[2].textContent, /Postgres|RabbitMQ/, "a generic tile (dune-server-*) must show neither family section");
});

test("a Postgres tile shows an honest 'unavailable' family section, not fabricated data, when ops.health.postgres itself is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [{ name: "dune-postgres", cpu: "1%", mem: "1MiB", memLimit: "1GiB", netIO: "0B", blockIO: "0B", status: "Up" }]
    }),
    getPostgresHealth: async () => unavailable("metrics_stack_not_running", "ops.health.postgres")
  });
  runAddon(window);
  await flushAsync();

  const tile = window.document.querySelector(".container-tile");
  assert.match(tile.textContent, /Postgres metrics unavailable/i);
  assert.doesNotMatch(tile.textContent, /18 \/ 100/, "must never show stale/fabricated connection data when the source is unavailable");
});

test("a RabbitMQ tile flags high memory/fd usage using the same thresholds as the real Alertmanager rules (warn >80%)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [{ name: "dune-rmq-game", cpu: "1%", mem: "1MiB", memLimit: "1GiB", netIO: "0B", blockIO: "0B", status: "Up" }]
    }),
    getRabbitmqHealth: async () => live({ up: true, instances: [{ name: "rabbitmq-game", up: true }], queueDepth: 5, memPercent: 82, fdPercent: 12 })
  });
  runAddon(window);
  await flushAsync();

  const tile = window.document.querySelector(".container-tile");
  const memValue = Array.from(tile.querySelectorAll(".container-tile-metric-value")).filter((el) => el.textContent === "82%")[0];
  assert.ok(memValue, "must show the real 82% memory value");
  assert.ok(memValue.closest(".container-tile-metric").querySelector(".meter__fill--warn"), "82% must render the warn-tier meter color, matching DuneRabbitMQHighMemory's >80% threshold");
});

test("a RabbitMQ tile shows 'Down' (not silently omitted) when its specific broker instance is down, even if the other broker is up", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getContainerHealth: async () => live({
      containers: [{ name: "dune-rmq-game", cpu: "1%", mem: "1MiB", memLimit: "1GiB", netIO: "0B", blockIO: "0B", status: "Up" }]
    }),
    getRabbitmqHealth: async () => live({
      up: false,
      instances: [
        { name: "rabbitmq-admin", up: true },
        { name: "rabbitmq-game", up: false }
      ],
      queueDepth: 0, memPercent: 5, fdPercent: 5
    })
  });
  runAddon(window);
  await flushAsync();

  const tile = window.document.querySelector(".container-tile");
  assert.match(tile.textContent, /Down/, "the dune-rmq-game tile's own instance is down and must say so");
});

test("a rejected provider promise (not just an {status:'unavailable'} envelope) also renders as unavailable, not 0", async () => {
  // This is the exact defect this session found beyond the original gap
  // analysis: Promise.allSettled's rejection branch used to collapse to a
  // bare `{}`, which every renderXxx() read as "no fields present" and
  // rendered as 0 — indistinguishable from a real empty payload.
  const { window } = loadAddon();
  installMockProvider(window, {
    getEconomy: async () => { throw new Error("network error"); }
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#eco-holders"), "—");
  assert.equal(text(window, "#eco-supply"), "—");
  assert.notEqual(text(window, "#eco-holders"), "0");
  assert.equal(window.document.querySelector("#eco-availability-note").hidden, false);
});

test("renderOpsAggregate distinguishes a real zero-row result from an unavailable source", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({ summary: { players: { total: 0 }, farms: { total: 0 } } })
  });
  runAddon(window);
  await flushAsync();

  // A genuinely empty (but real) result renders numeric 0s, not dashes —
  // this is deliberately different from the unavailable case below.
  assert.equal(text(window, "#metric-total"), "0");
  const emptyState = window.document.querySelector("#empty-state");
  assert.equal(emptyState.hidden, false, "empty-state note shows for a real empty result");
  assert.match(emptyState.textContent, /live aggregate data, not placeholder/i);
});

test("renderOpsAggregate shows dashes (not fabricated 0s) when ops health itself is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => unavailable("request_failed", "ops.health.*")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#metric-total"), "—");
  assert.equal(text(window, "#metric-online"), "—");
  const emptyState = window.document.querySelector("#empty-state");
  assert.equal(emptyState.hidden, false);
  assert.match(emptyState.textContent, /not available/i);
});

// ── F-3: preview/sample data must be visually distinguishable from live data ──

test("preview mode sets a distinct data-provider attribute on <body>", async () => {
  const { window } = loadAddon();
  // Do not install a mock "bridge" provider — leave currentProvider() at
  // its real default, which resolves to the sample provider outside an
  // iframe (window.parent === window in this jsdom context).
  runAddon(window);
  await flushAsync();

  assert.equal(window.document.body.dataset.provider, "sample", "preview mode must be identifiable via a body attribute the CSS watermark keys off");
});

test("live bridge mode does not set the preview data-provider attribute", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getActivity: async () => live({ totalPlayers: 5 })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(window.document.body.dataset.provider, "bridge");
});

// ── F-4: the status banner must reflect real per-source success, not a hardcoded claim ──

test("status banner reports a degraded source count instead of claiming all sources are online", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({ summary: { players: { total: 3 }, farms: { total: 1 } } }),
    getActivity: async () => live({ totalPlayers: 3 }),
    getCombat: async () => unavailable("not_implemented", "ops.combat.deaths"),
    getResources: async () => unavailable("not_implemented", "ops.resources.summary"),
    getEconomy: async () => live({ totalCurrencyHolders: 1 }),
    getInventory: async () => unavailable("not_implemented", "ops.inventory.summary"),
    getLocation: async () => unavailable("not_implemented", "ops.location.activity"),
    getSoc: async () => unavailable("not_implemented", "ops.soc.summary"),
    getPrometheusHealth: async () => unavailable("not_implemented", "ops.health.prometheus"),
    getContainerHealth: async () => unavailable("not_implemented", "ops.health.containers"),
    getPostgresHealth: async () => unavailable("not_implemented", "ops.health.postgres"),
    getRabbitmqHealth: async () => unavailable("not_implemented", "ops.health.rabbitmq")
  });
  runAddon(window);
  await flushAsync();

  const status = text(window, "#status");
  assert.doesNotMatch(status, /all .* sources online/i, "must not claim all sources are online when 8 of 12 are unavailable");
  assert.match(status, /3 of 12/, "must report the real live/total source count");
});

test("status banner correctly claims all sources online only when every source truly is", async () => {
  const { window } = loadAddon();
  const okData = { status: "live", data: {}, reason: null, source: null };
  installMockProvider(window, {
    getOpsHealth: async () => live({ summary: { players: { total: 1 }, farms: { total: 1 } } }),
    getActivity: async () => okData,
    getCombat: async () => okData,
    getResources: async () => okData,
    getEconomy: async () => okData,
    getInventory: async () => okData,
    getLocation: async () => okData,
    getSoc: async () => okData,
    getPrometheusHealth: async () => okData,
    getContainerHealth: async () => okData,
    getPostgresHealth: async () => okData,
    getRabbitmqHealth: async () => okData
  });
  runAddon(window);
  await flushAsync();

  assert.match(text(window, "#status"), /all 12 observability sources online/i);
});

// ── Non-fabrication guardrail: unavailable sources must not appear in the diagnostics output as if they were real ──

test("diagnostics output records unavailable sources by status, not by omission", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getEconomy: async () => unavailable("not_implemented", "ops.economy.summary")
  });
  runAddon(window);
  await flushAsync();

  const output = JSON.parse(text(window, "#output"));
  assert.ok(output.sources, "diagnostics output must include a per-source status breakdown");
  assert.equal(output.sources.economy.status, "unavailable");
  assert.equal(output.sources.economy.reason, "not_implemented");
});

// ── Spice Melange (Deep Desert / Hagga Basin per-instance resources) ──
//
// ops.resources.summary's real shape (see duneDb.js's
// addonOpsResourcesSummary): { deepDesert: {summary, instances}, haggaBasin:
// {summary, instances} }, each instance real-PvP/PvE-annotated via
// services/mapCombatState.js. These tests exercise the real
// renderResources()/renderMapSection() code path in web/addon.js end to end
// through the DOM, not a reimplementation of its logic.

function deepDesertInstance(overrides = {}) {
  return {
    partitionId: "8", dimensionIndex: 0, name: "DeepDesert 0", runtimeStatus: "RUNNING", combatState: "PVE",
    activeFields: 3, remainingSpice: 15000,
    sizes: [{ size: "Small", activeFields: 1, remainingSpice: null }, { size: "Medium", activeFields: 1, remainingSpice: null }, { size: "Large", activeFields: 1, remainingSpice: null }],
    ...overrides
  };
}

function haggaBasinInstance(overrides = {}) {
  return {
    partitionId: "1", dimensionIndex: 0, name: "Sietch Abbir", runtimeStatus: "RUNNING", combatState: "PVP",
    activeFields: 5, remainingSpice: 25000,
    sizes: [{ size: "Small", activeFields: 5, remainingSpice: null }],
    ...overrides
  };
}

function emptySection() {
  return { summary: { totalActiveFields: 0, totalRemainingSpice: 0, pvpInstances: 0, pveInstances: 0, bySize: [] }, instances: [] };
}

test("renderResources hides the loading note after the first refresh settles, for both live and unavailable results", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({ deepDesert: emptySection(), haggaBasin: emptySection() })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(window.document.querySelector("#res-loading-note").hidden, true);
});

test("Spice Melange shows 'Not available', clears both sections, and hides instance lists when the source is unavailable", async () => {
  const { window } = loadAddon();
  // Seed a prior successful render so we can prove the unavailable branch
  // actually clears stale data rather than merely failing to overwrite it.
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: { summary: { totalActiveFields: 3, totalRemainingSpice: 15000, pvpInstances: 0, pveInstances: 1, bySize: [{ size: "Small", activeFields: 1 }] }, instances: [deepDesertInstance()] },
      haggaBasin: { summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5 }] }, instances: [haggaBasinInstance()] }
    })
  });
  runAddon(window);
  await flushAsync();
  assert.equal(window.document.querySelectorAll("#dd-instances .res-instance-card").length, 1);

  installMockProvider(window, {
    getResources: async () => unavailable("bridge_error", "ops.resources.summary")
  });
  window.document.querySelector("#refresh-players").click();
  await flushAsync();

  const note = window.document.querySelector("#res-availability-note");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /not available/i);
  assert.equal(window.document.querySelector("#res-deep-desert-section").hidden, true);
  assert.equal(window.document.querySelector("#res-hagga-basin-section").hidden, true);
  assert.equal(window.document.querySelectorAll("#dd-instances .res-instance-card").length, 0, "stale Deep Desert instance cards must be cleared, not left rendered");
  assert.equal(window.document.querySelectorAll("#hb-instances .res-instance-card").length, 0, "stale Hagga Basin instance cards must be cleared, not left rendered");
});

test("Deep Desert with zero instances shows its own real empty-state note, not an error and not fabricated rows", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: emptySection(),
      haggaBasin: { summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5 }] }, instances: [haggaBasinInstance()] }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(window.document.querySelector("#res-availability-note").hidden, true, "a real empty section is not the same as the whole source being unavailable");
  assert.equal(window.document.querySelector("#dd-empty-state").hidden, false);
  assert.match(window.document.querySelector("#dd-empty-state").textContent, /normal state/i);
  assert.equal(window.document.querySelectorAll("#dd-instances .res-instance-card").length, 0);
  assert.equal(text(window, "#dd-active-fields"), "0", "a real empty section shows real 0s in the summary, not dashes");
  // Hagga Basin, in the same response, must render normally and
  // independently of Deep Desert's empty state.
  assert.equal(window.document.querySelector("#hb-empty-state").hidden, true);
  assert.equal(window.document.querySelectorAll("#hb-instances .res-instance-card").length, 1);
});

test("each instance card shows the real, config-resolved PvP/PvE/CONFLICT/UNKNOWN combat badge, not inferred client-side", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: {
        summary: { totalActiveFields: 6, totalRemainingSpice: 30000, pvpInstances: 1, pveInstances: 1, bySize: [] },
        instances: [
          deepDesertInstance({ dimensionIndex: 0, name: "DeepDesert 0", combatState: "PVE" }),
          deepDesertInstance({ dimensionIndex: 1, name: "DeepDesert 1", combatState: "PVP" })
        ]
      },
      haggaBasin: emptySection()
    })
  });
  runAddon(window);
  await flushAsync();

  const badges = window.document.querySelectorAll("#dd-instances .res-combat-badge");
  assert.equal(badges.length, 2);
  const labels = [...badges].map((b) => b.textContent);
  assert.deepEqual(labels.sort(), ["PVE", "PVP"]);
});

test("Deep Desert instances are sorted naturally by dimensionIndex, not alphabetically by name", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: {
        summary: { totalActiveFields: 0, totalRemainingSpice: 0, pvpInstances: 0, pveInstances: 0, bySize: [] },
        // Deliberately shuffled + a name that would sort in the OPPOSITE
        // order alphabetically, to prove the sort key is dimensionIndex.
        instances: [
          deepDesertInstance({ dimensionIndex: 2, name: "Alpha Zone" }),
          deepDesertInstance({ dimensionIndex: 0, name: "Zed Zone" }),
          deepDesertInstance({ dimensionIndex: 1, name: "Middle Zone" })
        ]
      },
      haggaBasin: emptySection()
    })
  });
  runAddon(window);
  await flushAsync();

  const names = [...window.document.querySelectorAll("#dd-instances .res-instance-name")].map((n) => n.textContent);
  assert.deepEqual(names, ["Zed Zone", "Middle Zone", "Alpha Zone"], "must sort by dimensionIndex (0,1,2), which is the OPPOSITE of alphabetical order here -- proving name is not the sort key");
});

test("Hagga Basin instances are sorted alphabetically by sietch name", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: emptySection(),
      haggaBasin: {
        summary: { totalActiveFields: 0, totalRemainingSpice: 0, pvpInstances: 0, pveInstances: 0, bySize: [] },
        instances: [
          haggaBasinInstance({ partitionId: "3", name: "Sietch Tabr" }),
          haggaBasinInstance({ partitionId: "1", name: "Sietch Abbir" }),
          haggaBasinInstance({ partitionId: "2", name: "Sietch Makab" })
        ]
      }
    })
  });
  runAddon(window);
  await flushAsync();

  const names = [...window.document.querySelectorAll("#hb-instances .res-instance-name")].map((n) => n.textContent);
  assert.deepEqual(names, ["Sietch Abbir", "Sietch Makab", "Sietch Tabr"]);
});

test("per-instance size rows preserve a real zero (e.g. no active Large fields) instead of omitting the row", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: {
        summary: { totalActiveFields: 2, totalRemainingSpice: 8000, pvpInstances: 0, pveInstances: 1, bySize: [{ size: "Small", activeFields: 1 }, { size: "Medium", activeFields: 1 }, { size: "Large", activeFields: 0 }] },
        instances: [deepDesertInstance({ sizes: [{ size: "Small", activeFields: 1, remainingSpice: null }, { size: "Medium", activeFields: 1, remainingSpice: null }, { size: "Large", activeFields: 0, remainingSpice: null }] })]
      },
      haggaBasin: emptySection()
    })
  });
  runAddon(window);
  await flushAsync();

  const instanceRows = [...window.document.querySelectorAll("#dd-instances .res-instance-card table tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent));
  assert.deepEqual(instanceRows, [["Small", "1", "—"], ["Medium", "1", "—"], ["Large", "0", "—"]], "Large must still appear as a real 0 active-fields row, never omitted, with a dash (not a fabricated 0) for its unresolved Potential Spice");
});

test("per-instance size-breakdown table shows a real per-size Potential Spice value when Core resolves one", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: emptySection(),
      haggaBasin: {
        summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5, remainingSpice: 25000 }] },
        instances: [haggaBasinInstance({ sizes: [{ size: "Small", activeFields: 5, remainingSpice: 25000 }] })]
      }
    })
  });
  runAddon(window);
  await flushAsync();

  const card = window.document.querySelector("#hb-instances .res-instance-card table tbody tr");
  const cells = [...card.children].map((td) => td.textContent);
  assert.deepEqual(cells, ["Small", "5", "25,000"], "the per-size table must show the real, Core-resolved Potential Spice value for this size, locale-formatted");

  const headers = [...window.document.querySelectorAll("#hb-instances .res-instance-card table thead th")].map((th) => th.textContent);
  assert.deepEqual(headers, ["Size", "Active Fields", "Potential Spice"]);
});

test("per-instance size-breakdown table shows a dash, never a fabricated 0, when Core could not safely resolve a size's Potential Spice", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: emptySection(),
      haggaBasin: {
        summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5, remainingSpice: null }] },
        instances: [haggaBasinInstance({ sizes: [{ size: "Small", activeFields: 5, remainingSpice: null }] })]
      }
    })
  });
  runAddon(window);
  await flushAsync();

  const card = window.document.querySelector("#hb-instances .res-instance-card table tbody tr");
  const cells = [...card.children].map((td) => td.textContent);
  assert.deepEqual(cells, ["Small", "5", "—"], "null must render as a dash, never as a fabricated 0 or blank cell, when Core determined the rank-match was unsafe for this size");
});

test("the instance/sietch-level spice total is labeled 'Potential Spice', not 'Remaining' or 'Available' -- both would overclaim precision this live snapshot doesn't have", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: emptySection(),
      haggaBasin: {
        summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5 }] },
        instances: [haggaBasinInstance()]
      }
    })
  });
  runAddon(window);
  await flushAsync();

  const labels = [...window.document.querySelectorAll("#hb-instances .res-instance-metrics .metric-label")].map((el) => el.textContent);
  assert.ok(labels.includes("Potential Spice"), "instance card must label its real spice total 'Potential Spice'");
  assert.ok(!labels.includes("Spice Remaining"), "must not use the old 'Spice Remaining' label, which implied more certainty than a live snapshot can honestly claim");
});

test("each instance/sietch card is visually accented (border + name color) by its real combat state, not just the small badge", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: {
        summary: { totalActiveFields: 6, totalRemainingSpice: 30000, pvpInstances: 1, pveInstances: 1, bySize: [] },
        instances: [
          deepDesertInstance({ dimensionIndex: 0, name: "DeepDesert 0", combatState: "PVE" }),
          deepDesertInstance({ dimensionIndex: 1, name: "DeepDesert 1", combatState: "PVP" })
        ]
      },
      haggaBasin: emptySection()
    })
  });
  runAddon(window);
  await flushAsync();

  const cards = [...window.document.querySelectorAll("#dd-instances .res-instance-card")];
  assert.equal(cards.length, 2);
  assert.ok(cards[0].className.includes("res-instance-card--pve"), "the PvE instance's card must carry the PvE accent class");
  assert.ok(cards[1].className.includes("res-instance-card--pvp"), "the PvP instance's card must carry the PvP accent class");
});

test("large remaining-spice totals render with locale thousands separators, not raw digit strings", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: emptySection(),
      haggaBasin: {
        summary: { totalActiveFields: 5, totalRemainingSpice: 1250000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5 }] },
        instances: [haggaBasinInstance({ remainingSpice: 1250000 })]
      }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#hb-remaining-spice"), (1250000).toLocaleString());
  const remainingCell = window.document.querySelectorAll("#hb-instances .res-instance-metrics strong")[1];
  assert.equal(remainingCell.textContent, (1250000).toLocaleString());
});

test("a refresh transition from empty to active correctly replaces the empty-state note with real instance cards, and vice versa", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({ deepDesert: emptySection(), haggaBasin: emptySection() })
  });
  runAddon(window);
  await flushAsync();
  assert.equal(window.document.querySelector("#dd-empty-state").hidden, false);

  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: {
        summary: { totalActiveFields: 3, totalRemainingSpice: 15000, pvpInstances: 0, pveInstances: 1, bySize: [{ size: "Small", activeFields: 3 }] },
        instances: [deepDesertInstance()]
      },
      haggaBasin: emptySection()
    })
  });
  window.document.querySelector("#refresh-players").click();
  await flushAsync();

  assert.equal(window.document.querySelector("#dd-empty-state").hidden, true, "empty-state note must be hidden once real instances appear");
  assert.equal(window.document.querySelectorAll("#dd-instances .res-instance-card").length, 1);

  // And back to empty again — no stale card left behind from the prior refresh.
  installMockProvider(window, {
    getResources: async () => live({ deepDesert: emptySection(), haggaBasin: emptySection() })
  });
  window.document.querySelector("#refresh-players").click();
  await flushAsync();

  assert.equal(window.document.querySelector("#dd-empty-state").hidden, false);
  assert.equal(window.document.querySelectorAll("#dd-instances .res-instance-card").length, 0, "reverting to empty must clear the previously-rendered card, not leave it stale");
});

test("consecutive refreshes replace instance cards rather than accumulating duplicates", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: emptySection(),
      haggaBasin: { summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5 }] }, instances: [haggaBasinInstance()] }
    })
  });
  runAddon(window);
  await flushAsync();
  window.document.querySelector("#refresh-players").click();
  await flushAsync();
  window.document.querySelector("#refresh-players").click();
  await flushAsync();

  assert.equal(window.document.querySelectorAll("#hb-instances .res-instance-card").length, 1, "must not accumulate duplicate cards across repeated refreshes");
});

// ── Visual redesign (Tier 2.4): combat badge icons ──
//
// Previously PvP/PvE combat badges communicated entirely through
// color-coded text, with zero iconography anywhere in the addon. This
// test asserts the new inline <svg> icon actually renders as a real DOM
// element alongside the existing text -- not just that the text itself
// is correct, which wouldn't catch a regression that silently dropped
// the icon while leaving the label intact.

test("combat badges render a real inline SVG icon alongside the PVP/PVE text label", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: {
        summary: { totalActiveFields: 3, totalRemainingSpice: 15000, pvpInstances: 1, pveInstances: 0, bySize: [] },
        instances: [deepDesertInstance({ combatState: "PVP" })]
      },
      haggaBasin: emptySection()
    })
  });
  runAddon(window);
  await flushAsync();

  const badge = window.document.querySelector("#dd-instances .res-combat-badge");
  const icon = badge.querySelector("svg.status-icon");
  assert.ok(icon, "combat badge must contain a real <svg> icon element");
  assert.equal(badge.textContent, "PVP");
});

// ── Spice Melange layout pass: per-section instance-count badge ──

test("each map section shows a real, derived instance count next to its heading, singular vs. plural worded correctly", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({
      deepDesert: {
        summary: { totalActiveFields: 6, totalRemainingSpice: 30000, pvpInstances: 1, pveInstances: 1, bySize: [] },
        instances: [
          deepDesertInstance({ dimensionIndex: 0, name: "DeepDesert 0" }),
          deepDesertInstance({ dimensionIndex: 1, name: "DeepDesert 1" })
        ]
      },
      haggaBasin: {
        summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5 }] },
        instances: [haggaBasinInstance()]
      }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#dd-instance-count"), "2 instances");
  assert.equal(text(window, "#hb-instance-count"), "1 instance");
});

test("the instance-count badge clears to empty when a map section has zero instances or the source is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getResources: async () => live({ deepDesert: emptySection(), haggaBasin: emptySection() })
  });
  runAddon(window);
  await flushAsync();
  assert.equal(text(window, "#dd-instance-count"), "0 instances");

  installMockProvider(window, {
    getResources: async () => unavailable("bridge_error", "ops.resources.summary")
  });
  window.document.querySelector("#refresh-players").click();
  await flushAsync();
  assert.equal(text(window, "#dd-instance-count"), "", "must clear the stale count, not leave a prior refresh's number visible when the source becomes unavailable");
});

// ── #137: AAA/NOC Infra/Audit hidden from primary nav; Diag moved to a secondary link ──

// ── #140: freshness badges must never appear on permanently-inert placeholder headings ──

test("no freshness badge appears on AAA/NOC-Infra/Audit/Location headings after a successful refresh (issue #140)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  for (const tabName of ["aaa", "noc-infra", "audit", "location"]) {
    const panel = window.document.querySelector(`.tab-content[data-tab="${tabName}"]`);
    assert.ok(panel, `${tabName} tab-content panel must exist`);
    assert.equal(panel.hasAttribute("data-no-freshness-badge"), true, `${tabName} must carry the data-no-freshness-badge attribute`);
    const badges = panel.querySelectorAll(".freshness-badge");
    assert.equal(badges.length, 0, `${tabName} must have zero freshness badges, even after a real successful refresh`);
  }
});

test("freshness badges still appear normally on real, functional tabs (e.g. Overview, SOC) -- the fix is scoped, not a global removal", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  const overviewPanel = window.document.querySelector('.tab-content[data-tab="overview"]');
  assert.ok(overviewPanel.querySelectorAll(".freshness-badge").length > 0, "real, functional tabs must still get freshness badges -- this fix scopes the exclusion to placeholder tabs only, not a global removal of the feature");
});

test("AAA, NOC Infra, and Audit tab buttons are hidden from primary nav (issue #137)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  for (const tab of ["aaa", "noc-infra", "audit"]) {
    const button = window.document.querySelector(`#tab-nav .tab[data-tab="${tab}"]`);
    assert.ok(button, `${tab} button must still exist in the DOM (its tab-content panel stays reachable if ever un-hidden)`);
    assert.equal(button.hidden, true, `${tab} button must be hidden from primary nav`);
  }
});

test("Diag button no longer appears in primary #tab-nav (issue #137)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  assert.equal(window.document.querySelector('#tab-nav .tab[data-tab="diag"]'), null, "Diag must not be a primary-nav tab button anymore");
});

test("the secondary Diag link still activates the real Diag tab-content panel and refreshes diagnostics output", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  const diagLink = window.document.querySelector("#diag-link");
  assert.ok(diagLink, "secondary Diag link must exist");

  diagLink.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
  await flushAsync();

  const diagPanel = window.document.querySelector('.tab-content[data-tab="diag"]');
  assert.ok(diagPanel.classList.contains("active"), "clicking the secondary Diag link must activate the real Diag tab-content panel");
  assert.ok(diagLink.classList.contains("active"), "the secondary link itself should reflect active state, same as a primary tab button would");

  const otherPanels = window.document.querySelectorAll(".tab-content.active");
  assert.equal(otherPanels.length, 1, "activating Diag via the secondary link must deactivate every other tab panel, same as the primary tab-nav behavior");
});

test("clicking a primary tab button still deactivates the secondary Diag link's active state (shared activateTab() logic)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {});
  runAddon(window);
  await flushAsync();

  window.document.querySelector("#diag-link").dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
  await flushAsync();

  window.document.querySelector('#tab-nav .tab[data-tab="players"]').click();
  await flushAsync();

  assert.equal(window.document.querySelector("#diag-link").classList.contains("active"), false, "switching to a primary tab must clear the secondary link's active state");
  assert.ok(window.document.querySelector('.tab-content[data-tab="players"]').classList.contains("active"));
});

// ── #138: test coverage for renderLocation, renderSoc, renderSystemServicesTable, renderFarmSummary, renderKpis ──
// (issue #114 superseded/closed in favor of #138 -- 2 of #114's 4 named
// functions, renderNocService/renderNocResources, no longer exist after
// the #133 rebuild; this section covers the real current gaps.)

test("renderLocation shows 'Not available', not 0, when the source is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getLocation: async () => unavailable("not_implemented", "ops.location.activity")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#loc-map-count"), "—");
  assert.equal(text(window, "#loc-markers"), "—");
  assert.notEqual(text(window, "#loc-map-count"), "0");
  const note = window.document.querySelector("#loc-availability-note");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /not available/i);
});

test("renderLocation renders real map count, marker count, and both tables when live", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getLocation: async () => live({
      activeMaps: [{ map: "Deep Desert", players: 4, online: 2 }, { map: "Arrakeen", players: 2, online: 1 }],
      totalMarkers: 87,
      markersByMap: [{ map: "Deep Desert", markers: 35 }, { map: "Arrakeen", markers: 24 }],
      playerDensity: [],
      territoryPressure: []
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#loc-map-count"), "2", "must count the real number of active maps, not a fabricated value");
  assert.equal(text(window, "#loc-markers"), "87");
  assert.equal(window.document.querySelectorAll("#loc-density-body tr").length, 2, "must render one density row per active map");
  assert.equal(window.document.querySelectorAll("#loc-markers-body tr").length, 2, "must render one row per map in markersByMap");
  assert.equal(window.document.querySelector("#loc-availability-note").hidden, true);
});

test("renderLocation falls back to playerDensity for the density table only when activeMaps is entirely absent, not when it's a real empty array", async () => {
  // Real, verified behavior: `d.activeMaps || d.playerDensity || []` only
  // falls back when activeMaps is falsy (undefined/null/missing) --
  // an empty array `[]` is truthy in JS, so a genuine "zero active maps"
  // result does NOT fall back to playerDensity, it correctly stays
  // empty. This test pins that real, if subtle, behavior distinction
  // rather than assuming a naive "empty means fall back" reading.
  const { window } = loadAddon();
  installMockProvider(window, {
    getLocation: async () => live({
      totalMarkers: 0,
      markersByMap: [],
      playerDensity: [{ map: "Sietch Tabr", players: 3, online: 1 }]
      // activeMaps deliberately omitted entirely (undefined), not [] --
      // this is the only shape that actually triggers the fallback.
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#loc-map-count"), "0", "(d.activeMaps || []).length is 0 when activeMaps is undefined");
  assert.equal(window.document.querySelectorAll("#loc-density-body tr").length, 1, "density table falls back to playerDensity when activeMaps is genuinely absent (undefined), not merely empty");
});

test("renderSoc shows 'Not available' metric cards, not 0, when the source is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getSoc: async () => unavailable("bridge_error", "ops.soc.summary")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#soc-health"), "—");
  assert.equal(text(window, "#soc-requests"), "—");
  assert.equal(text(window, "#soc-errors"), "—");
  assert.equal(text(window, "#soc-success"), "—");
  assert.notEqual(text(window, "#soc-requests"), "0");
  assert.equal(window.document.querySelector("#soc-availability-note").hidden, false);
});

test("renderSoc renders real platform health, request/error counts, and success rate when live", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getSoc: async () => live({ platformHealth: "Healthy", bridgeRequests: 47, bridgeErrors: 1, bridgeSuccessRate: 97.9 })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#soc-health"), "Healthy");
  assert.equal(text(window, "#soc-requests"), "47");
  assert.equal(text(window, "#soc-errors"), "1");
  assert.equal(text(window, "#soc-success"), "98%", "must round the real bridgeSuccessRate, not recompute it when Core already provides one");
  assert.equal(window.document.querySelector("#soc-availability-note").hidden, true);
});

test("renderSoc derives a real success rate from requests/errors when Core omits bridgeSuccessRate, and shows a genuine 0% (not a dash) when zero requests have occurred", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getSoc: async () => live({ platformHealth: "Healthy", bridgeRequests: 0, bridgeErrors: 0 })
  });
  runAddon(window);
  await flushAsync();

  // bridgeRequests > 0 is false here, so the derived-rate branch's own
  // ternary falls through to the literal 0 fallback -- a real, honest
  // "no requests yet" reading, not a false-zero fabrication (there is
  // no ambiguity here: zero requests genuinely means a 0% rate is the
  // only correct answer, unlike e.g. inventory's totalCrafted, which
  // has no real source at all).
  assert.equal(text(window, "#soc-success"), "0%");
  assert.equal(text(window, "#soc-requests"), "0");
});

test("renderSystemServicesTable shows an 'Unavailable' row, not an empty table, when the Prometheus source itself is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getPrometheusHealth: async () => unavailable("request_failed", "ops.health.prometheus")
  });
  runAddon(window);
  await flushAsync();

  const rows = window.document.querySelectorAll("#noc-system-service-body tr");
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /Unavailable/i);
});

test("renderSystemServicesTable shows the 'Not started' row and reveals the CTA note when the metrics stack is not running", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getPrometheusHealth: async () => live({ status: "planned", domain: "prometheus", reason: "metrics_stack_not_running", message: "not running", summary: {} })
  });
  runAddon(window);
  await flushAsync();

  const rows = window.document.querySelectorAll("#noc-system-service-body tr");
  assert.equal(rows.length, 1);
  assert.match(rows[0].textContent, /Not started/i);
  assert.equal(window.document.querySelector("#noc-metrics-cta").hidden, false, "the 'run dune metrics start' CTA must be revealed when the stack is not running");
});

test("renderSystemServicesTable renders a real row per known service plus any additional unknown service, with real up/down status", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getPrometheusHealth: async () => live({
      healthy: true,
      targets: { active: 5, inactive: 2, pending: 0, total: 7 },
      services: {
        "dune-prometheus": "up", "dune-node": "up", "dune-postgres": "down",
        "dune-rabbitmq-admin": "up", "dune-rabbitmq-game": "up", "dune-cadvisor": "up",
        "dune-alertmanager": "up"
      },
      summary: { avgCpuPercent: 12.5, avgMemoryMb: 256, totalRestarts: null }
    })
  });
  runAddon(window);
  await flushAsync();

  const rows = Array.from(window.document.querySelectorAll("#noc-system-service-body tr"));
  assert.equal(rows.length, 7, "6 known services + 1 additional unknown service (dune-alertmanager) not in the known-services list");
  const postgresRow = rows.find((r) => r.textContent.includes("Postgres Exporter"));
  assert.match(postgresRow.textContent, /down/i, "must show the real down status, not a fabricated up");
  const unknownRow = rows.find((r) => r.textContent.includes("dune-alertmanager"));
  assert.ok(unknownRow, "an additional service not in the known-services label map must still get its own row, keyed by its raw job name");
});

test("renderFarmSummary shows real farm/ready/alive counts, and an honest dash (never a fallback to a different number) for Connected Players when connectedPlayers is absent from the payload", async () => {
  // #139 fix: previously this silently fell back to totals.online (a
  // real, but DIFFERENT, unrelated number -- total online players
  // addon-wide, not the per-farm connected-player count the "Connected
  // Players" label actually promises) whenever connectedPlayers was
  // absent. Now shows an honest "--", matching every other field in
  // this addon that distinguishes "no real data for this field" from
  // "substitute a different field that happens to also be a number."
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({ summary: { players: { total: 5, onlineStatus: { Online: 3, Offline: 2 } }, farms: { total: 4, ready: 3, alive: 4 } } })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#noc-farms-total"), "4");
  assert.equal(text(window, "#noc-farms-ready"), "3 / 4");
  assert.equal(text(window, "#noc-farms-players"), "—", "must show a dash, not silently substitute totals.online, when connectedPlayers is genuinely absent from this payload");
});

// #139: real fix -- incomingS2SConnections/outgoingS2SConnections/
// connectedPlayers are real, live fields from Core's own
// addonOpsHealthFarms() (verified directly against
// dune-awakening-selfhost-docker's duneDb.js, which computes these via
// a real SQL sum over dune.farm_state). This test uses the correct
// capital-S2S field-name casing Core actually returns -- the bug this
// issue fixed was addon.js reading the wrong casing entirely, not a
// missing backend feature.
test("renderFarmSummary renders real S2S connection counts and connected-player count when Core's payload includes them (issue #139 fix)", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({
      summary: {
        players: { total: 5, onlineStatus: { Online: 3, Offline: 2 } },
        farms: { total: 4, ready: 3, alive: 4, connectedPlayers: 9, incomingS2SConnections: 12, outgoingS2SConnections: 7 }
      }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#noc-farms-players"), "9", "must show the real, live per-farm connected-player count, not totals.online (3)");
  assert.equal(text(window, "#noc-farms-s2s"), "12 in / 7 out", "must show the real, live S2S connection counts, not a permanent dash");
});

test("renderFarmSummary shows a genuine 0 (not a dash) for S2S connections when Core reports zero active connections", async () => {
  // A real 0 (server genuinely has zero S2S connections right now) must
  // render as 0, not collapse to the same dash used for "field absent
  // from this payload entirely" -- the same honest-zero-vs-absent
  // distinction already enforced elsewhere in this addon.
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({
      summary: {
        players: { total: 1 },
        farms: { total: 1, ready: 1, alive: 1, connectedPlayers: 0, incomingS2SConnections: 0, outgoingS2SConnections: 0 }
      }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#noc-farms-players"), "0");
  assert.equal(text(window, "#noc-farms-s2s"), "0 in / 0 out");
});

// Regression pin for issue #139: incomingS2s/outgoingS2s are never
// actually populated by normalizeOpsHealth() (a real field-name
// mismatch against Core's actual incomingS2SConnections/
// outgoingS2SConnections casing) -- this test documents the CURRENT,
// known-broken behavior (always "—") rather than asserting a fix that
// does not exist yet. If/when #139 is fixed, this test's expected value
// must change to a real number, not stay "—" -- do not "fix" this test
// by leaving it expecting a dash forever.
test("renderFarmSummary's S2S Connections field shows an honest dash when Core's payload genuinely omits the S2S fields entirely (e.g. an older Core version)", async () => {
  // Fixed by issue #139 (see the dedicated live-value test above): this
  // used to always show "--" on EVERY deployment, live or not, due to a
  // field-name casing bug in normalizeOpsHealth(). Now it correctly
  // shows "--" only in the genuinely-absent case (this test) and real
  // numbers when Core's payload actually includes them (the test above).
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({ summary: { players: { total: 1 }, farms: { total: 1, ready: 1, alive: 1 } } })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#noc-farms-s2s"), "—", "must show a dash when Core's payload genuinely has no S2S fields, distinct from the real-value case above");
});

test("renderFarmSummary shows honest zero/dash defaults, not a throw, when the snapshot has no totals at all", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => unavailable("request_failed", "ops.health.*")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#noc-farms-total"), "0");
  assert.equal(text(window, "#noc-farms-ready"), "0 / 0");
});

test("renderKpis shows dashes, not 0/NaN, for active rate and average level when the OPS health source is unavailable", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => unavailable("request_failed", "ops.health.*")
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#kpi-active-rate"), "—");
  assert.equal(text(window, "#kpi-average-level"), "—");
  assert.equal(text(window, "#kpi-top-faction"), "—");
  assert.equal(text(window, "#kpi-top-guild"), "—");
});

test("renderKpis computes a real active rate and shows the real top faction/guild when live", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({
      summary: {
        players: {
          total: 10,
          onlineStatus: { Online: 7, Offline: 3 },
          factions: { Atreides: 6, Fremen: 4 },
          guilds: { "Sietch Patrol": 5, "Industrial Wing": 5 },
          averageLevel: 42.6
        },
        farms: { total: 1, ready: 1, alive: 1 }
      }
    })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#kpi-active-rate"), "70%", "must compute the real online/total ratio (7/10), not a fabricated rate");
  assert.equal(text(window, "#kpi-average-level"), "43", "must round the real average level, not truncate or fabricate it");
  assert.equal(text(window, "#kpi-top-faction"), "Atreides", "must pick the real highest-count faction (6 > 4), not the first key");
  assert.equal(text(window, "#kpi-top-guild"), "Sietch Patrol", "when tied (5 vs 5), must pick the first-encountered key deterministically, not throw or pick randomly");
});

test("renderKpis shows a dash for average level (never a fabricated 0) when Core's aggregate omits it entirely", async () => {
  const { window } = loadAddon();
  installMockProvider(window, {
    getOpsHealth: async () => live({ summary: { players: { total: 3, onlineStatus: { Online: 1, Offline: 2 } }, farms: { total: 1, ready: 1, alive: 1 } } })
  });
  runAddon(window);
  await flushAsync();

  assert.equal(text(window, "#kpi-average-level"), "—", "averageLevel has no real source in this payload and must never render a fabricated 0");
  assert.notEqual(text(window, "#kpi-average-level"), "0");
});
