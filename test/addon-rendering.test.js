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
    getContainerHealth: async () => unavailable("not_implemented", "ops.health.containers")
  });
  runAddon(window);
  await flushAsync();

  const status = text(window, "#status");
  assert.doesNotMatch(status, /all .* sources online/i, "must not claim all sources are online when 6 of 10 are unavailable");
  assert.match(status, /3 of 10/, "must report the real live/total source count");
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
    getContainerHealth: async () => okData
  });
  runAddon(window);
  await flushAsync();

  assert.match(text(window, "#status"), /all 10 observability sources online/i);
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
