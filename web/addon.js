const statusEl = document.querySelector("#status");
const outputEl = document.querySelector("#output");
const buttonEl = document.querySelector("#refresh-players");

(function initFaction() {
  try {
    var faction = parent.document.documentElement.getAttribute("data-faction");
    if (faction) document.documentElement.setAttribute("data-tagged-faction", faction);
  } catch (e) {}
})();

// ── Tab-aware lazy loading (Phase 0, Requirement 20 L1 design) ──
// Maps each tab to its required provider methods. When a tab is activated
// for the first time, or its cached data is older than TAB_CACHE_TTL_MS,
// only that tab's providers are dispatched — not all 9 at once.
var TAB_CACHE_TTL_MS = 60000;
var _tabCache = new Map();
var _activeProvider = null; // set by refreshAll(), read by _refreshTab()
var _tabProviders = {
  overview: ["opsHealth", "prometheus", "containerHealth", "postgresHealth", "rabbitmqHealth"],
  players:  ["opsHealth"],
  activity: ["activity"],
  combat:   ["combat"],
  spice:    ["resources"],
  economy:  ["economy"],
  inventory:["inventory"],
  location: ["location"],
  soc:      ["soc", "prometheus"],
  grafana:  [],
  diag:     [],
  // Phase 0 placeholder tabs — will dispatch real providers when Core R3 lands
  aaa:      [],
  "noc-infra": [],
  audit:    []
};

// Returns the provider method name for a given source key
function _providerMethod(source) {
  var map = {
    opsHealth: "getOpsHealth",
    activity: "getActivity",
    combat: "getCombat",
    resources: "getResources",
    economy: "getEconomy",
    inventory: "getInventory",
    location: "getLocation",
    soc: "getSoc",
    prometheus: "getPrometheusHealth",
    containerHealth: "getContainerHealth",
    postgresHealth: "getPostgresHealth",
    rabbitmqHealth: "getRabbitmqHealth"
  };
  return map[source];
}

// Refreshes just the providers needed for a given tab. Uses cached results
// if available and fresh; otherwise dispatches only that tab's providers.
async function _refreshTab(tabName) {
  if (!_activeProvider) {
    try { _activeProvider = getProvider(); } catch (e) { return; }
  }

  var sources = _tabProviders[tabName] || [];
  if (!sources.length) return;

  var now = Date.now();
  var results = [];

  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];
    var cached = _tabCache.get(source);
    if (cached && (now - cached.at < TAB_CACHE_TTL_MS)) {
      results.push(cached.result);
      continue;
    }
    var method = _providerMethod(source);
    if (!method || !_activeProvider[method]) {
      results.push(window.DuneOpsProviders.unavailableResult("request_failed", null));
      continue;
    }
    try {
      var result = await _activeProvider[method]();
      _tabCache.set(source, { result: result, at: now });
      results.push(result);
    } catch (e) {
      var unavailable = window.DuneOpsProviders.unavailableResult("request_failed", null);
      _tabCache.set(source, { result: unavailable, at: now });
      results.push(unavailable);
    }
  }

  _renderTabData(tabName, results);
}

// Routes tab-specific data to the correct render functions
function _renderTabData(tabName, results) {
  var get = function (source) {
    var idx = (_tabProviders[tabName] || []).indexOf(source);
    return idx >= 0 ? results[idx] : null;
  };

  switch (tabName) {
    case "overview":
      var opsHealth = get("opsHealth");
      var prom = get("prometheus");
      var containerHealth = get("containerHealth");
      var postgresHealth = get("postgresHealth");
      var rabbitmqHealth = get("rabbitmqHealth");
      if (opsHealth) {
        var snap = normalizeOpsHealth(opsHealth);
        renderOpsAggregate(snap, new Date());
      }
      renderSystemServicesTable(prom);
      if (prom) renderPrometheus(prom);
      renderContainerGrid(containerHealth, postgresHealth, rabbitmqHealth);
      renderFleetRollup(containerHealth, prom);
      break;
    case "players":
      var oh = get("opsHealth");
      if (oh) {
        var s = normalizeOpsHealth(oh);
        renderOpsAggregate(s, new Date());
      }
      break;
    case "activity":  renderActivity(get("activity")); break;
    case "combat":    renderCombat(get("combat")); break;
    case "spice":     renderResources(get("resources")); break;
    case "economy":   renderEconomy(get("economy")); break;
    case "inventory": renderInventory(get("inventory")); break;
    case "location":  renderLocation(get("location")); break;
    case "soc":
      var socData = get("soc");
      var promData = get("prometheus");
      if (socData) renderSoc(socData);
      if (promData) renderPrometheus(promData);
      break;
  }
}

// #137: activateTab() is shared by every clickable "go to this tab" control
// -- primary #tab-nav buttons AND the secondary Diag link (moved out of
// primary nav, see initDiagLink() below) -- so both paths stay in sync
// with exactly one tab-switching implementation instead of two
// independently-maintained click handlers.
function activateTab(tabName) {
  var tabs = document.querySelectorAll("#tab-nav .tab, .secondary-tab-link");
  var panels = document.querySelectorAll(".tab-content");
  tabs.forEach(function (t) { t.classList.remove("active"); });
  var activeControl = document.querySelector('[data-tab="' + tabName + '"].tab, [data-tab="' + tabName + '"].secondary-tab-link');
  if (activeControl) activeControl.classList.add("active");
  panels.forEach(function (p) { p.classList.remove("active"); });
  var target = document.querySelector('.tab-content[data-tab="' + tabName + '"]');
  if (target) target.classList.add("active");
  _refreshTab(tabName);
}

(function initTabs() {
  var tabs = document.querySelectorAll("#tab-nav .tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () { activateTab(tab.dataset.tab); });
  });
})();

// #137: Diag was previously a first-class button in primary #tab-nav,
// shown to every operator on every install even though it is an
// explicit dev-debugging tool ("may contain raw bridge data, do not
// share screenshots"). Moved to a small secondary link near the status
// banner instead -- same underlying tab-content panel, same
// activateTab()/refresh behavior, just out of the primary navigation
// an operator scans on every visit.
(function initDiagLink() {
  var link = document.querySelector("#diag-link");
  if (!link) return;
  link.addEventListener("click", function (e) {
    e.preventDefault();
    activateTab("diag");
  });
})();

// ── Grafana tab: time-range selector + mixed-content fix ──
(function initGrafanaTimeRange() {
  var rangeBtns = document.querySelectorAll(".grafana-time-btn");
  if (!rangeBtns.length) return;
  var frames = document.querySelectorAll(".grafana-frame");
  var embedsEl = document.getElementById("grafana-embeds");
  var mixedEl = document.getElementById("grafana-mixed-content");

  var isHttps = window.location.protocol === "https:";
  if (!isHttps && window.parent !== window) {
    try { isHttps = window.parent.location.protocol === "https:"; } catch (e) {}
  }

  if (isHttps) {
    // HTTPS: show explanation, hide embeds
    if (mixedEl) mixedEl.style.display = "";
    if (embedsEl) embedsEl.style.display = "none";
    return;
  }

  // HTTP: show embeds, hide explanation, populate iframe src from data-src
  if (mixedEl) mixedEl.style.display = "none";
  if (embedsEl) embedsEl.style.display = "";
  frames.forEach(function (f) {
    var ds = f.getAttribute("data-src");
    if (ds) { f.src = ds; f.removeAttribute("data-src"); }
  });

  var updateRange = function (range, e) {
    var fromMap = { "1h": "now-1h", "6h": "now-6h", "24h": "now-24h", "7d": "now-7d", "30d": "now-30d", "90d": "now-90d", "6M": "now-6M", "1y": "now-1y" };
    var from = fromMap[range] || "now-1h";
    rangeBtns.forEach(function (b) { b.classList.remove("active"); });
    if (e && e.target) e.target.classList.add("active");
  frames.forEach(function (f) {
    f.src = f.src.replace(/from=[^&]+/, "from=" + from);
  });
  };
  rangeBtns.forEach(function (btn) {
    btn.addEventListener("click", function (e) { updateRange(btn.dataset.range, e); });
  });
})();
const playersBodyEl = document.querySelector("#players-body");
const providerLabelEl = document.querySelector("#provider-label");
const emptyStateEl = document.querySelector("#empty-state");
const metricTotalEl = document.querySelector("#metric-total");
const metricOnlineEl = document.querySelector("#metric-online");
const metricOfflineEl = document.querySelector("#metric-offline");
const metricFarmsEl = document.querySelector("#metric-farms");
const opsSourceHealthEl = document.querySelector("#ops-source-health");
const opsSourceHealthNoteEl = document.querySelector("#ops-source-health-note");
const opsFreshnessEl = document.querySelector("#ops-freshness");
const opsFreshnessNoteEl = document.querySelector("#ops-freshness-note");
const opsPlayerImpactEl = document.querySelector("#ops-player-impact");
const opsPlayerImpactNoteEl = document.querySelector("#ops-player-impact-note");
const opsOperatorStatusEl = document.querySelector("#ops-operator-status");
const opsOperatorStatusNoteEl = document.querySelector("#ops-operator-status-note");
const kpiActiveRateEl = document.querySelector("#kpi-active-rate");
const kpiActiveRateNoteEl = document.querySelector("#kpi-active-rate-note");
const kpiAverageLevelEl = document.querySelector("#kpi-average-level");
const kpiAverageLevelNoteEl = document.querySelector("#kpi-average-level-note");
const kpiTopFactionEl = document.querySelector("#kpi-top-faction");
const kpiTopFactionNoteEl = document.querySelector("#kpi-top-faction-note");
const kpiTopGuildEl = document.querySelector("#kpi-top-guild");
const kpiTopGuildNoteEl = document.querySelector("#kpi-top-guild-note");

const actTotalEl = document.querySelector("#act-total");
const actOnlineEl = document.querySelector("#act-online");
const actDeadEl = document.querySelector("#act-dead");
const act1hEl = document.querySelector("#act-1h");
const act24hEl = document.querySelector("#act-24h");
const act7dEl = document.querySelector("#act-7d");
const actInactiveEl = document.querySelector("#act-inactive");
const actReturningEl = document.querySelector("#act-returning");
const actNewEl = document.querySelector("#act-new");
const actGuildBodyEl = document.querySelector("#act-guild-body");
const actFactionBodyEl = document.querySelector("#act-faction-body");
const actMapBodyEl = document.querySelector("#act-map-body");
const actAvailabilityEl = document.querySelector("#act-availability-note");

const cmbTotalEl = document.querySelector("#cmb-total");
const cmbPvpEl = document.querySelector("#cmb-pvp");
const cmbPveEl = document.querySelector("#cmb-pve");
const cmbKdEl = document.querySelector("#cmb-kd");
const cmbCauseBodyEl = document.querySelector("#cmb-cause-body");
const cmbMapBodyEl = document.querySelector("#cmb-map-body");
const cmbNpcBodyEl = document.querySelector("#cmb-npc-body");
const cmbAvailabilityEl = document.querySelector("#cmb-availability-note");

const resLoadingEl = document.querySelector("#res-loading-note");
const resAvailabilityEl = document.querySelector("#res-availability-note");
const ddSectionEl = document.querySelector("#res-deep-desert-section");
const ddActiveFieldsEl = document.querySelector("#dd-active-fields");
const ddRemainingSpiceEl = document.querySelector("#dd-remaining-spice");
const ddPvpInstancesEl = document.querySelector("#dd-pvp-instances");
const ddPveInstancesEl = document.querySelector("#dd-pve-instances");
const ddEmptyStateEl = document.querySelector("#dd-empty-state");
const ddInstancesEl = document.querySelector("#dd-instances");
const ddInstanceCountEl = document.querySelector("#dd-instance-count");
const hbSectionEl = document.querySelector("#res-hagga-basin-section");
const hbActiveFieldsEl = document.querySelector("#hb-active-fields");
const hbRemainingSpiceEl = document.querySelector("#hb-remaining-spice");
const hbPvpInstancesEl = document.querySelector("#hb-pvp-instances");
const hbPveInstancesEl = document.querySelector("#hb-pve-instances");
const hbEmptyStateEl = document.querySelector("#hb-empty-state");
const hbInstancesEl = document.querySelector("#hb-instances");
const hbInstanceCountEl = document.querySelector("#hb-instance-count");

const ecoHoldersEl = document.querySelector("#eco-holders");
const ecoSupplyEl = document.querySelector("#eco-supply");
const ecoOrdersEl = document.querySelector("#eco-orders");
const ecoFulfilledEl = document.querySelector("#eco-fulfilled");
const ecoTaxEl = document.querySelector("#eco-tax");
const ecoCurrencyBodyEl = document.querySelector("#eco-currency-body");
const ecoTradeBodyEl = document.querySelector("#eco-trade-body");
const ecoAvailabilityEl = document.querySelector("#eco-availability-note");

const invItemsEl = document.querySelector("#inv-items");
const invInvsEl = document.querySelector("#inv-invs");
const invCraftedEl = document.querySelector("#inv-crafted");
const invStorageUsedEl = document.querySelector("#inv-storage-used");
const invTemplateBodyEl = document.querySelector("#inv-template-body");
const invStorageBodyEl = document.querySelector("#inv-storage-body");
const invEmptyStateEl = document.querySelector("#inv-empty-state");
const invAvailabilityEl = document.querySelector("#inv-availability-note");

const locMapCountEl = document.querySelector("#loc-map-count");
const locMarkersEl = document.querySelector("#loc-markers");
const locDensityBodyEl = document.querySelector("#loc-density-body");
const locMarkersBodyEl = document.querySelector("#loc-markers-body");
const locAvailabilityEl = document.querySelector("#loc-availability-note");

const socHealthEl = document.querySelector("#soc-health");
const socRequestsEl = document.querySelector("#soc-requests");
const socErrorsEl = document.querySelector("#soc-errors");
const socSuccessEl = document.querySelector("#soc-success");
const socAvailabilityEl = document.querySelector("#soc-availability-note");

const mtrHealthEl = document.querySelector("#mtr-health");
const mtrTargetsEl = document.querySelector("#mtr-targets");
const mtrCpuEl = document.querySelector("#mtr-cpu");
const mtrMemEl = document.querySelector("#mtr-mem");
const mtrRestartsEl = document.querySelector("#mtr-restarts");
const mtrServiceBodyEl = document.querySelector("#mtr-service-body");
const mtrAvailabilityEl = document.querySelector("#mtr-availability-note");

const nocSystemServiceBodyEl = document.querySelector("#noc-system-service-body");
const nocMetricsCtaEl = document.querySelector("#noc-metrics-cta");
const containerGridEl = document.querySelector("#container-grid");
const containerGridLoadingNoteEl = document.querySelector("#container-grid-loading-note");
const containerGridAvailabilityNoteEl = document.querySelector("#container-grid-availability-note");
const fleetContainersUpEl = document.querySelector("#fleet-containers-up");
const fleetCpuEl = document.querySelector("#fleet-cpu");
const fleetMemEl = document.querySelector("#fleet-mem");
const fleetHostCpuEl = document.querySelector("#fleet-host-cpu");
const fleetHostMemEl = document.querySelector("#fleet-host-mem");
const nocFarmsTotalEl = document.querySelector("#noc-farms-total");
const nocFarmsReadyEl = document.querySelector("#noc-farms-ready");
const nocFarmsPlayersEl = document.querySelector("#noc-farms-players");
const nocFarmsS2sEl = document.querySelector("#noc-farms-s2s");

const STALE_READ_THRESHOLD_MS = 5 * 60 * 1000;
let lastSuccessfulReadAt = null;
let previousTotals = null;

function writeStatus(text, className) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = className || "";
}

// Preview mode warning — show a prominent status-bar alert when running in
// sample/preview mode (not connected to a live console). The warning element
// exists in index.html and is hidden by default; this function shows it when
// the active provider is the sample/fixture provider.
var _previewWarningEl = document.querySelector("#preview-warning");
function _showPreviewWarning(provider) {
  if (!_previewWarningEl) return;
  if (provider && provider.name === "sample") {
    _previewWarningEl.style.display = "";
  } else {
    _previewWarningEl.style.display = "none";
  }
}

function writeOutput(value) {
  if (!outputEl) return;
  outputEl.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setText(element, value) {
  if (!element) return;
  element.textContent = value == null ? "—" : String(value);
}

// ── SourceResult consumption ──
//
// Every render*(result) function below receives the SourceResult envelope
// from web/data-providers.js ({status, data, reason, source}), not a raw
// payload. This is the fix for the false-zero rendering defect: a panel
// can only render numeric fields when status is "live" or "preview" — an
// "unavailable" result always clears the panel's numbers to "—" and shows
// an explanatory note, and can never fall through to a numeric fallback
// like `?? 0`.

const UNAVAILABLE_REASON_TEXT = {
  not_implemented: "This data source is not yet implemented in Dune Docker Console.",
  bridge_error: "The Console bridge returned an error for this data source.",
  request_failed: "The request to the Console bridge failed or timed out.",
  metrics_stack_not_running: "The optional Prometheus metrics stack is not running on this server. An operator can enable it with `dune metrics start`.",
};

function unavailableMessage(result) {
  const reasonText = UNAVAILABLE_REASON_TEXT[result && result.reason] || "This data source is not currently available.";
  const source = result && result.source ? ` (${result.source})` : "";
  return `Not available — ${reasonText}${source}`;
}

// Shows the shared "not available" note for a panel and clears every
// metric/table element passed in, so a panel can never show a mix of a
// numeric card update, e.g. `0`, and unavailable, e.g. dashes elsewhere.
function renderUnavailablePanel(result, { noteEl, metricEls = [], tableBodyEls = [] } = {}) {
  if (noteEl) {
    noteEl.hidden = false;
    noteEl.textContent = unavailableMessage(result);
  }
  for (const el of metricEls) setText(el, null);
  for (const el of tableBodyEls) clearTbody(el);
}

function hideAvailabilityNote(noteEl) {
  if (noteEl) noteEl.hidden = true;
}

function getProvider() {
  if (!window.DuneOpsProviders) {
    throw new Error("Addon data providers failed to load.");
  }
  return window.DuneOpsProviders.currentProvider();
}

function clearTable() {
  if (!playersBodyEl) return;
  while (playersBodyEl.firstChild) {
    playersBodyEl.removeChild(playersBodyEl.firstChild);
  }
}

function appendCell(row, value, className) {
  const cell = document.createElement("td");
  cell.textContent = String(value);
  if (className) cell.className = className;
  row.appendChild(cell);
}

function statusClass(status) {
  return String(status).toLowerCase() === "online" ? "pill pill-online" : "pill";
}

function formatRefreshTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatAge(milliseconds) {
  if (milliseconds < 1000) return "now";
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function freshnessBadgeClass() {
  if (!lastSuccessfulReadAt) return "stale-critical";
  const age = Date.now() - lastSuccessfulReadAt.getTime();
  if (age < 60000) return "fresh";
  if (age < 300000) return "stale";
  return "stale-critical";
}

// #140: headings inside a [data-no-freshness-badge] tab-content wrapper
// (AAA/NOC-Infra/Audit -- permanently pending a Core R3 release with no
// ETA -- and Location -- permanently out of scope by design) never get
// a freshness badge. A green "fresh · Ns ago" badge on any of these
// would directly contradict that same panel's own "Planned — requires
// Core R3" or "will always report unavailable" copy a few lines below
// it -- these panels never actually refresh, regardless of how recently
// the rest of the addon successfully read live data.
function updateFreshnessBadges() {
  var ageText = lastSuccessfulReadAt ? formatAge(Date.now() - lastSuccessfulReadAt.getTime()) : "never";
  var badgeClass = freshnessBadgeClass();
  var headings = document.querySelectorAll(".section-heading h2, .section-heading h3, .res-map-heading h3");
  headings.forEach(function (h) {
    if (h.closest("[data-no-freshness-badge]")) return;
    var existing = h.querySelector(".freshness-badge");
    if (existing) existing.remove();
    var badge = document.createElement("span");
    badge.className = "freshness-badge " + badgeClass;
    badge.textContent = ageText;
    h.appendChild(badge);
  });
}

function asNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function valueFromKeys(source, keys, fallback = 0) {
  if (!source || typeof source !== "object") return fallback;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return asNumber(source[key], fallback);
    }
  }
  return fallback;
}

function countFromObject(source, targetKey) {
  if (!source || typeof source !== "object") return null;
  const normalizedTarget = String(targetKey).toLowerCase();
  for (const [key, value] of Object.entries(source)) {
    if (String(key).toLowerCase() === normalizedTarget) return asNumber(value, 0);
  }
  return null;
}

function topCountLabel(source) {
  if (!source || typeof source !== "object") return { name: "—", count: 0 };
  let topName = "—";
  let topCount = 0;
  for (const [name, value] of Object.entries(source)) {
    const count = asNumber(value, 0);
    if (name && count > topCount) {
      topName = name;
      topCount = count;
    }
  }
  return { name: topName, count: topCount };
}

// `result` is a SourceResult envelope ({status, data, reason, source}) from
// provider.getOpsHealth(), not a raw payload. When status is "unavailable",
// this returns a snapshot with `available: false` and every total/kpi at a
// null-ish "no data" value — callers must check `available` before
// rendering, the same discipline every other renderXxx() now follows.
function normalizeOpsHealth(result) {
  const available = Boolean(result) && result.status !== "unavailable";
  const raw = available ? result.data : null;
  const envelope = raw && typeof raw === "object" ? raw : {};
  const summary = envelope.summary && typeof envelope.summary === "object" ? envelope.summary : envelope;
  const players = envelope.players || summary.players || {};
  const farms = envelope.farms || summary.farms || {};
  const onlineStatus = players.onlineStatus || players.online_status || {};
  const online = countFromObject(onlineStatus, "online") ?? valueFromKeys(players, ["online", "onlineCount", "online_count"], 0);
  const offlineFromStatus = countFromObject(onlineStatus, "offline");
  const total = valueFromKeys(players, ["total", "count", "playerCount", "player_count"], 0);
  const offline = offlineFromStatus ?? valueFromKeys(players, ["offline", "offlineCount", "offline_count"], Math.max(total - online, 0));
  const farmTotal = valueFromKeys(farms, ["total", "count", "farmCount", "farm_count"], 0);
  const readyFarms = valueFromKeys(farms, ["ready", "readyCount", "ready_count"], 0);
  const aliveFarms = valueFromKeys(farms, ["alive", "aliveCount", "alive_count"], 0);
  // #139: Core's real, live addonOpsHealthFarms() (duneDb.js) returns
  // connectedPlayers/incomingS2SConnections/outgoingS2SConnections
  // (capital S2S) -- these were never extracted here at all, so
  // renderFarmSummary()'s own field-name checks (lowercase "incomingS2s",
  // and a totals.connectedPlayers check that always missed since
  // `totals` never had that key either) silently fell through to their
  // fallback branches on every real deployment: S2S showed a permanent
  // dash, and "Connected Players" silently displayed totals.online (a
  // different, real number, but not what that card's label promises)
  // instead of the real per-farm connected-player count. Fixed by
  // actually reading these three fields, matching valueFromKeys()'s
  // existing multi-casing-variant convention used for every other field
  // above.
  const connectedPlayers = valueFromKeys(farms, ["connectedPlayers", "connected_players"], null);
  const incomingS2S = valueFromKeys(farms, ["incomingS2SConnections", "incoming_s2s_connections"], null);
  const outgoingS2S = valueFromKeys(farms, ["outgoingS2SConnections", "outgoing_s2s_connections"], null);
  const factions = players.factions || players.byFaction || players.factionCounts || {};
  const guilds = players.guilds || players.byGuild || players.guildCounts || {};
  const topFaction = topCountLabel(factions);
  const topGuild = topCountLabel(guilds);
  const averageLevel = valueFromKeys(players, ["averageLevel", "avgLevel", "average_level", "avg_level"], null);

  return {
    available,
    unavailableReason: available ? null : (result && result.reason) || "bridge_error",
    raw,
    summary,
    players,
    farms,
    totals: {
      total,
      online,
      offline,
      farms: farmTotal,
      readyFarms,
      aliveFarms,
      connectedPlayers,
      incomingS2SConnections: incomingS2S,
      outgoingS2SConnections: outgoingS2S
    },
    kpis: {
      activeRate: total > 0 ? Math.round((online / total) * 100) : null,
      averageLevel: averageLevel === null ? null : asNumber(averageLevel, null),
      topFaction,
      topGuild
    },
    capabilities: summary.capabilities || players.capabilities || {},
    // hasRows must be `false` (not merely "total is 0") whenever the source
    // is unavailable — this is what makes renderOpsAggregate() show the
    // empty-state note for the right reason instead of implying a
    // successful read that happened to return zero rows.
    hasRows: available && (total > 0 || farmTotal > 0)
  };
}

function playerDeltaLabel(current, previous) {
  if (!previous) return "Baseline";
  const totalDelta = current.total - previous.total;
  const onlineDelta = current.online - previous.online;
  const farmDelta = current.farms - previous.farms;
  const signedTotal = totalDelta > 0 ? `+${totalDelta}` : String(totalDelta);
  const signedOnline = onlineDelta > 0 ? `+${onlineDelta}` : String(onlineDelta);
  const signedFarms = farmDelta > 0 ? `+${farmDelta}` : String(farmDelta);

  if (totalDelta === 0 && onlineDelta === 0 && farmDelta === 0) return "No change";
  return `${signedTotal} players / ${signedOnline} online / ${signedFarms} farms`;
}

function updateOpsHealth(provider, totals, refreshedAt, error) {
  const isBridge = provider && provider.name === "bridge";
  const now = refreshedAt || new Date();
  const lastAge = lastSuccessfulReadAt ? now.getTime() - lastSuccessfulReadAt.getTime() : null;
  const isStale = lastAge !== null && lastAge > STALE_READ_THRESHOLD_MS;
  const sourceHealth = error ? "Degraded" : isBridge ? "Bridge live" : "Preview";
  const sourceNote = error
    ? "The active provider returned an error."
    : isBridge
      ? "Reading Release 0.3 OPS health aggregates through the Console bridge."
      : "Using sample OPS health aggregates because the addon is not inside the Console iframe.";
  const freshness = error
    ? lastSuccessfulReadAt ? "Stale" : "No read"
    : isStale ? "Stale" : "Fresh";
  const freshnessNote = lastSuccessfulReadAt
    ? `Last successful read: ${formatRefreshTime(lastSuccessfulReadAt)} (${formatAge(lastAge || 0)}).`
    : "No successful read has completed in this session.";
  const impactLabel = totals ? playerDeltaLabel(totals, previousTotals) : "Unavailable";
  const impactNote = totals
    ? previousTotals
      ? `Current players: ${totals.total}; online: ${totals.online}; farms: ${totals.farms}. Previous players: ${previousTotals.total}; online: ${previousTotals.online}; farms: ${previousTotals.farms}.`
      : `Baseline established with ${totals.total} players, ${totals.online} online, and ${totals.farms} farm sites.`
    : "No OPS health summary is available for comparison.";
  const operatorStatus = error
    ? "Action needed"
    : isBridge && !isStale
      ? "Healthy"
      : isBridge && isStale
        ? "Stale"
        : "Preview";
  const operatorNote = error
    ? "Provider read failed. Confirm the Console bridge, ops:read approval, and Release 0.3 Core actions."
    : isBridge
      ? "Bridge read completed through the approved ops:read boundary."
      : "Open through Dune Docker Console Addons to validate live Release 0.3 bridge data.";

  setText(opsSourceHealthEl, sourceHealth);
  setText(opsSourceHealthNoteEl, sourceNote);
  setText(opsFreshnessEl, freshness);
  setText(opsFreshnessNoteEl, freshnessNote);
  setText(opsPlayerImpactEl, impactLabel);
  setText(opsPlayerImpactNoteEl, impactNote);
  setText(opsOperatorStatusEl, operatorStatus);
  setText(opsOperatorStatusNoteEl, operatorNote);

  return {
    sourceHealth,
    freshness,
    playerImpact: impactLabel,
    operatorStatus,
    lastSuccessfulRead: lastSuccessfulReadAt ? lastSuccessfulReadAt.toISOString() : null,
    staleThresholdSeconds: STALE_READ_THRESHOLD_MS / 1000
  };
}

function renderKpis(snapshot) {
  const { totals, kpis } = snapshot;
  setText(kpiActiveRateEl, kpis.activeRate === null ? "—" : `${kpis.activeRate}%`);
  setText(kpiActiveRateNoteEl, totals.total > 0 ? `${totals.online} of ${totals.total} players are online.` : "No player aggregate rows available.");
  setText(kpiAverageLevelEl, kpis.averageLevel === null ? "—" : Math.round(kpis.averageLevel));
  setText(kpiAverageLevelNoteEl, kpis.averageLevel === null ? "Average level is not present in this aggregate payload." : "Average level returned by the OPS health aggregate.");
  setText(kpiTopFactionEl, kpis.topFaction.name);
  setText(kpiTopFactionNoteEl, kpis.topFaction.count > 0 ? `${kpis.topFaction.count} players in this faction.` : "Faction aggregate is not present in this payload.");
  setText(kpiTopGuildEl, kpis.topGuild.name);
  setText(kpiTopGuildNoteEl, kpis.topGuild.count > 0 ? `${kpis.topGuild.count} players in this guild.` : "Guild aggregate is not present in this payload.");

  return {
    activeRate: kpis.activeRate,
    averageLevel: kpis.averageLevel,
    topFaction: kpis.topFaction.name,
    topGuild: kpis.topGuild.name
  };
}

// ── KPI Capability panel ──
//
// Real inline <svg> icons, built via createElementNS -- not a data: URI
// background-image (which the addon's own CSP would block: img-src is
// 'self', and a data: URI is neither 'self' nor a same-origin file), and
// not an icon font (would add a new asset-loading dependency this
// zero-runtime-dependency addon doesn't otherwise have). Used by
// makeCombatIcon() below for the Spice Melange PvP/PvE combat badges.
const SVG_NS = "http://www.w3.org/2000/svg";

function renderOpsAggregate(snapshot, refreshedAt) {
  const { totals } = snapshot;
  clearTable();

  if (!snapshot.available) {
    // Never render the raw totals object (all zeros from normalizeOpsHealth's
    // defaults) as if it were a real reading — show dashes, and explain why
    // via the empty-state note, distinctly from the "real zero rows" case
    // below.
    setText(metricTotalEl, null);
    setText(metricOnlineEl, null);
    setText(metricOfflineEl, null);
    setText(metricFarmsEl, null);
    if (emptyStateEl) {
      emptyStateEl.hidden = false;
      emptyStateEl.textContent = unavailableMessage({ reason: snapshot.unavailableReason, source: "ops.health.*" });
    }
    return { totals, kpis: renderKpis(snapshot) };
  }

  setText(metricTotalEl, totals.total);
  setText(metricOnlineEl, totals.online);
  setText(metricOfflineEl, totals.offline);
  setText(metricFarmsEl, totals.farms);

  if (emptyStateEl) {
    emptyStateEl.hidden = snapshot.hasRows;
    emptyStateEl.textContent = snapshot.hasRows
      ? ""
      : "OPS health bridge returned zero player rows and zero farm rows. This is live aggregate data, not placeholder content.";
  }

  if (playersBodyEl) {
    const row = document.createElement("tr");
    appendCell(row, "OPS aggregate");
    appendCell(row, totals.total);
    appendCell(row, totals.online, statusClass(totals.online > 0 ? "online" : "offline"));
    appendCell(row, totals.offline);
    appendCell(row, totals.farms);
    appendCell(row, `${totals.readyFarms} ready / ${totals.aliveFarms} alive`);
    appendCell(row, formatRefreshTime(refreshedAt));
    playersBodyEl.appendChild(row);
  }

  return { totals, kpis: renderKpis(snapshot) };
}

async function refreshOpsHealth() {
  let provider;

  try {
    provider = getProvider();
    if (providerLabelEl) providerLabelEl.textContent = `Provider: ${provider.label}`;

    const opsHealthResult = await provider.getOpsHealth();
    const snapshot = normalizeOpsHealth(opsHealthResult);
    const refreshedAt = new Date();
    const previousSnapshot = previousTotals;
    const summary = renderOpsAggregate(snapshot, refreshedAt);
    lastSuccessfulReadAt = refreshedAt;
    const opsHealth = updateOpsHealth(provider, snapshot.available ? summary.totals : null, refreshedAt, snapshot.available ? null : new Error(unavailableMessage({ reason: snapshot.unavailableReason, source: "ops.health.*" })));

    if (!snapshot.available) {
      writeStatus("Unable to read OPS health data from the configured provider.", "status-warn");
    } else if (provider.name === "bridge") {
      writeStatus("Connected to Dune Docker Console. Showing live Release 0.3 OPS health bridge data.", "status-ok");
    } else {
      writeStatus("Preview mode. Showing sample OPS health aggregate data because the addon is not running inside the Console iframe.", "status-info");
    }

    writeOutput({
      provider: provider.name,
      sourceMode: !snapshot.available ? "unavailable" : provider.name === "bridge" ? "live-ops-health-bridge" : "preview-sample",
      lastRefresh: refreshedAt.toISOString(),
      actions: provider.actions || [],
      totals: summary.totals,
      previousTotals: previousSnapshot,
      opsHealth,
      kpis: summary.kpis,
      resultShape: {
        hasSummaryPlayers: Boolean(snapshot.summary && snapshot.summary.players),
        hasSummaryFarms: Boolean(snapshot.summary && snapshot.summary.farms),
        hasPlayersAggregate: Boolean(snapshot.players && Object.keys(snapshot.players).length),
        hasFarmsAggregate: Boolean(snapshot.farms && Object.keys(snapshot.farms).length)
      },
      raw: snapshot.raw
    });

    previousTotals = summary.totals;
    renderFarmSummary(snapshot);
  } catch (error) {
    const refreshedAt = new Date();
    const unavailableSnapshot = normalizeOpsHealth(null);
    renderOpsAggregate(unavailableSnapshot, refreshedAt);
    const opsHealth = updateOpsHealth(provider, null, refreshedAt, error);
    renderFarmSummary(unavailableSnapshot);
    writeStatus("Unable to read Release 0.3 OPS health data from the configured provider.", "status-warn");
    writeOutput({
      provider: provider ? provider.name : "unknown",
      sourceMode: "unavailable",
      lastRefresh: refreshedAt.toISOString(),
      opsHealth,
      error: error.message || String(error)
    });
  }
}

function clearTbody(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

function appendRow(el, cells) {
  if (!el) return;
  const row = document.createElement("tr");
  for (const c of cells) {
    const cell = document.createElement("td");
    cell.textContent = String(c);
    row.appendChild(cell);
  }
  el.appendChild(row);
}

const ACT_METRIC_ELS = [actTotalEl, actOnlineEl, actDeadEl, act1hEl, act24hEl, act7dEl, actInactiveEl, actReturningEl, actNewEl];
const ACT_TABLE_ELS = [actGuildBodyEl, actFactionBodyEl, actMapBodyEl];

function renderActivity(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: actAvailabilityEl, metricEls: ACT_METRIC_ELS, tableBodyEls: ACT_TABLE_ELS });
    return;
  }
  hideAvailabilityNote(actAvailabilityEl);
  const d = result.data || {};
  setText(actTotalEl, d.totalPlayers ?? 0);
  setText(actOnlineEl, d.onlinePlayers ?? 0);
  setText(actDeadEl, d.playersDead ?? 0);
  setText(act1hEl, d.activeLast1h !== null ? d.activeLast1h : "—");
  setText(act24hEl, d.activeLast24h !== null ? d.activeLast24h : "—");
  setText(act7dEl, d.activeLast7d !== null ? d.activeLast7d : "—");
  setText(actInactiveEl, d.inactivePlayers !== null ? d.inactivePlayers : "—");
  setText(actReturningEl, d.returningPlayers !== null ? d.returningPlayers : "—");
  setText(actNewEl, d.newPlayers !== null ? d.newPlayers : "—");

  clearTbody(actGuildBodyEl);
  for (const g of d.guildActivity || []) {
    appendRow(actGuildBodyEl, [g.guild || "Unknown", g.members ?? 0, g.online ?? 0]);
  }

  clearTbody(actFactionBodyEl);
  for (const f of d.factionActivity || []) {
    appendRow(actFactionBodyEl, [f.faction || "Unknown", f.members ?? 0, f.online ?? 0]);
  }

  clearTbody(actMapBodyEl);
  for (const m of d.mapActivity || []) {
    appendRow(actMapBodyEl, [m.map || "Unknown", m.actors ?? 0, m.online ?? 0]);
  }
}

const CMB_METRIC_ELS = [cmbTotalEl, cmbPvpEl, cmbPveEl, cmbKdEl];
const CMB_TABLE_ELS = [cmbCauseBodyEl, cmbMapBodyEl, cmbNpcBodyEl];

function renderCombat(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: cmbAvailabilityEl, metricEls: CMB_METRIC_ELS, tableBodyEls: CMB_TABLE_ELS });
    return;
  }
  hideAvailabilityNote(cmbAvailabilityEl);
  const d = result.data || {};
  setText(cmbTotalEl, d.totalDeaths ?? 0);
  setText(cmbPvpEl, d.pvpDeaths ?? 0);
  setText(cmbPveEl, d.pveDeaths ?? 0);
  setText(cmbKdEl, d.kdRatio ?? 0);

  clearTbody(cmbCauseBodyEl);
  for (const c of d.deathsByCause || []) {
    appendRow(cmbCauseBodyEl, [c.cause || "Unknown", c.count ?? 0]);
  }

  clearTbody(cmbMapBodyEl);
  for (const m of d.deathsByMap || []) {
    appendRow(cmbMapBodyEl, [m.map || "Unknown", m.count ?? 0]);
  }

  clearTbody(cmbNpcBodyEl);
  for (const n of d.topHostileNpcs || []) {
    appendRow(cmbNpcBodyEl, [n.name || "Unknown", n.count ?? 0]);
  }
}

// ── Spice Melange (Resources) rendering ──
//
// ops.resources.summary's real shape (see duneDb.js's addonOpsResourcesSummary):
//   { deepDesert: { summary, instances }, haggaBasin: { summary, instances } }
// where each section's `summary` is
//   { totalActiveFields, totalRemainingSpice, pvpInstances, pveInstances, bySize }
// and each `instances[]` entry is
//   { partitionId, dimensionIndex, name, runtimeStatus, combatState,
//     activeFields, remainingSpice, sizes: [{size, activeFields, remainingSpice}] }
//
// Deep Desert with zero instances (nothing currently spawned) is a real,
// valid state for this autoscaled map -- shown via its own empty-state
// note, never as an error or as fabricated zero-instance rows.

const RES_SECTION_METRIC_ELS = [
  ddActiveFieldsEl, ddRemainingSpiceEl, ddPvpInstancesEl, ddPveInstancesEl,
  hbActiveFieldsEl, hbRemainingSpiceEl, hbPvpInstancesEl, hbPveInstancesEl
];

// Locale-formatted numbers per the tab's display requirements; null/undefined
// render as a dash, never as "0" or "null" -- distinguishing "genuinely zero"
// from "no real value for this field" (e.g. per-size remaining spice, which
// has no real data source -- see duneDb.js's own comment on why).
function formatCount(value) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function combatBadgeClass(state) {
  switch (String(state || "").toUpperCase()) {
    case "PVP": return "pvp";
    case "PVE": return "pve";
    case "CONFLICT": return "conflict";
    case "MIXED": return "mixed";
    default: return "unknown";
  }
}

function combatBadgeLabel(state) {
  const s = String(state || "").toUpperCase();
  return s || "UNKNOWN";
}

// Crossed-swords for PvP, a shield for PvE/CONFLICT/MIXED/UNKNOWN --
// distinct iconography from the checkmark/exclamation/x used for
// capability status (a different semantic domain: this is about a real
// game-mode designation, not a data-availability state), matching the
// same real, resolver-backed combatState value already used for the
// badge's text/color -- the icon is purely decorative reinforcement,
// never a second, independently-computed signal.
function makeCombatIcon(kind) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("status-icon");

  if (kind === "pvp") {
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke", "currentColor");
    g.setAttribute("stroke-width", "1.6");
    g.setAttribute("stroke-linecap", "round");
    const blade1 = document.createElementNS(SVG_NS, "path");
    blade1.setAttribute("d", "M2.5 2.5L13.5 13.5");
    const blade2 = document.createElementNS(SVG_NS, "path");
    blade2.setAttribute("d", "M13.5 2.5L2.5 13.5");
    g.appendChild(blade1);
    g.appendChild(blade2);
    svg.appendChild(g);
  } else {
    const shield = document.createElementNS(SVG_NS, "path");
    shield.setAttribute("d", "M8 2L13 4V8C13 11 10.8 12.8 8 14C5.2 12.8 3 11 3 8V4L8 2Z");
    shield.setAttribute("fill", "none");
    shield.setAttribute("stroke", "currentColor");
    shield.setAttribute("stroke-width", "1.6");
    shield.setAttribute("stroke-linejoin", "round");
    svg.appendChild(shield);
  }
  return svg;
}

function makeCombatBadge(state) {
  const span = document.createElement("span");
  span.className = `res-combat-badge ${combatBadgeClass(state)}`;
  span.appendChild(makeCombatIcon(combatBadgeClass(state) === "pvp" ? "pvp" : "pve"));
  span.appendChild(document.createTextNode(combatBadgeLabel(state)));
  return span;
}

// Per-instance/sietch cards are visually accented by real combat state
// (PvP red / PvE green border+header, matching the addon-wide badge
// convention) -- an "accent" treatment, not a full-block background tint,
// so the size-breakdown table underneath stays neutral/readable rather
// than colored text-on-color. See combatBadgeClass() for the same
// PVP/PVE/CONFLICT/MIXED/UNKNOWN vocabulary used here.
function combatAccentClass(state) {
  return `res-instance-card--${combatBadgeClass(state)}`;
}

function renderInstanceCard(instance) {
  const card = document.createElement("article");
  card.className = `res-instance-card ${combatAccentClass(instance.combatState)}`;

  const header = document.createElement("div");
  header.className = "res-instance-header";

  const nameWrap = document.createElement("div");
  const name = document.createElement("div");
  name.className = "res-instance-name";
  name.textContent = instance.name || "Unknown instance";
  const status = document.createElement("div");
  status.className = "res-instance-status";
  status.textContent = instance.runtimeStatus || "UNKNOWN";
  nameWrap.appendChild(name);
  nameWrap.appendChild(status);

  header.appendChild(nameWrap);
  header.appendChild(makeCombatBadge(instance.combatState));
  card.appendChild(header);

  const metrics = document.createElement("div");
  metrics.className = "res-instance-metrics";

  const activeCard = document.createElement("article");
  activeCard.className = "metric-card";
  const activeLabel = document.createElement("span");
  activeLabel.className = "metric-label";
  activeLabel.textContent = "Active Fields";
  const activeVal = document.createElement("strong");
  activeVal.textContent = formatCount(instance.activeFields);
  activeCard.appendChild(activeLabel);
  activeCard.appendChild(activeVal);

  // "Potential Spice" -- a real, directly-summed total from currently
  // active fields (never estimated/apportioned), deliberately NOT called
  // "Remaining" or "Available": both of those imply a guarantee about
  // spice that either hasn't spawned yet or could already be harvested
  // by the time this is read. This is an honest live snapshot of known
  // active fields as of the last refresh, like every other number in
  // this addon -- the title attribute spells that out for anyone who
  // hovers, rather than relying on the label alone to carry the caveat.
  const remainingCard = document.createElement("article");
  remainingCard.className = "metric-card";
  remainingCard.title = "Sum of spice in currently active fields as of the last refresh. Not a fixed or guaranteed total -- fields can spawn, despawn, or be harvested between refreshes.";
  const remainingLabel = document.createElement("span");
  remainingLabel.className = "metric-label";
  remainingLabel.textContent = "Potential Spice";
  const remainingVal = document.createElement("strong");
  remainingVal.textContent = formatCount(instance.remainingSpice);
  remainingCard.appendChild(remainingLabel);
  remainingCard.appendChild(remainingVal);

  metrics.appendChild(activeCard);
  metrics.appendChild(remainingCard);
  card.appendChild(metrics);

  // Size-breakdown table: Field Size + Active Fields + Potential Spice.
  // Per-size Potential Spice comes from Core's resolvePerSizePotentialSpice()
  // (real rank-match of resourcefield_state's distinct value_remaining
  // groups against the map's known, ordered size list -- see duneDb.js's
  // own comment for the exact safety condition) -- it is only ever a
  // real, live-derived number or null, NEVER a guessed/apportioned value.
  // null renders as "--" via formatCount(), the same honest-unavailable
  // convention used everywhere else in this addon, for exactly the cases
  // where Core itself determined the rank-match would be unsafe (e.g. a
  // size with zero active fields, or harvesting having fragmented one
  // size's fields into multiple distinct values).
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-wrap";
  const table = document.createElement("table");
  table.setAttribute("aria-label", `Field sizes for ${instance.name || "instance"}`);
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Size", "Active Fields", "Potential Spice"].forEach((h) => {
    const th = document.createElement("th");
    th.setAttribute("scope", "col");
    th.textContent = h;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const s of instance.sizes || []) {
    appendRow(tbody, [s.size || "?", formatCount(s.activeFields), formatCount(s.remainingSpice)]);
  }
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);

  return card;
}

// Deep Desert's real identity is numeric (dimensionIndex) -- natural sort by
// that, never alphabetical by name/label. Hagga Basin's real identity is its
// sietch name -- alphabetical by name. These are deliberately different per
// the tab's own display requirements.
function sortDeepDesertInstances(instances) {
  return [...instances].sort((a, b) => (a.dimensionIndex ?? 0) - (b.dimensionIndex ?? 0));
}

function sortHaggaBasinInstances(instances) {
  return [...instances].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function renderMapSection(section, els, sortFn) {
  const { sectionEl, activeFieldsEl, remainingSpiceEl, pvpEl, pveEl, emptyStateEl, instancesEl, instanceCountEl } = els;
  if (sectionEl) sectionEl.hidden = false;

  const summary = (section && section.summary) || { totalActiveFields: 0, totalRemainingSpice: 0, pvpInstances: 0, pveInstances: 0, bySize: [] };
  const instances = (section && section.instances) || [];

  setText(activeFieldsEl, formatCount(summary.totalActiveFields));
  setText(remainingSpiceEl, formatCount(summary.totalRemainingSpice));
  setText(pvpEl, formatCount(summary.pvpInstances));
  setText(pveEl, formatCount(summary.pveInstances));

  // A real, derived count of the instances actually being rendered below
  // -- never a separately-tracked number that could drift from what's
  // really shown (e.g. instances.length, not summary.pvpInstances +
  // summary.pveInstances, which could disagree if a combat state ever
  // resolves to CONFLICT/MIXED/UNKNOWN).
  if (instanceCountEl) {
    instanceCountEl.textContent = instances.length === 1 ? "1 instance" : `${instances.length} instances`;
  }

  if (instancesEl) while (instancesEl.firstChild) instancesEl.removeChild(instancesEl.firstChild);

  // Empty instance list: hide the section wrapper entirely (summary cards,
  // heading, instance list) to prevent stale data from a previous render
  // from showing alongside the empty-state message. Only show the empty note.
  if (!instances.length) {
    if (sectionEl) sectionEl.hidden = true;
    if (emptyStateEl) emptyStateEl.hidden = false;
    return;
  }
  // Has instances: show the section, hide any empty note, render instance cards.
  if (sectionEl) sectionEl.hidden = false;
  if (emptyStateEl) emptyStateEl.hidden = true;

  const sorted = sortFn(instances);
  if (instancesEl) {
    while (instancesEl.firstChild) instancesEl.removeChild(instancesEl.firstChild);
    for (const instance of sorted) instancesEl.appendChild(renderInstanceCard(instance));
  }
}

function clearResourcesSections() {
  for (const sectionEl of [ddSectionEl, hbSectionEl]) if (sectionEl) sectionEl.hidden = true;
  for (const emptyEl of [ddEmptyStateEl, hbEmptyStateEl]) if (emptyEl) emptyEl.hidden = true;
  for (const listEl of [ddInstancesEl, hbInstancesEl]) if (listEl) while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
  for (const countEl of [ddInstanceCountEl, hbInstanceCountEl]) if (countEl) countEl.textContent = "";
}

function renderResources(result) {
  if (resLoadingEl) resLoadingEl.hidden = true;

  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: resAvailabilityEl, metricEls: RES_SECTION_METRIC_ELS });
    clearResourcesSections();
    return;
  }
  hideAvailabilityNote(resAvailabilityEl);
  const d = result.data || {};

  renderMapSection(d.deepDesert, {
    sectionEl: ddSectionEl,
    activeFieldsEl: ddActiveFieldsEl,
    remainingSpiceEl: ddRemainingSpiceEl,
    pvpEl: ddPvpInstancesEl,
    pveEl: ddPveInstancesEl,
    emptyStateEl: ddEmptyStateEl,
    instancesEl: ddInstancesEl,
    instanceCountEl: ddInstanceCountEl
  }, sortDeepDesertInstances);

  renderMapSection(d.haggaBasin, {
    sectionEl: hbSectionEl,
    activeFieldsEl: hbActiveFieldsEl,
    remainingSpiceEl: hbRemainingSpiceEl,
    pvpEl: hbPvpInstancesEl,
    pveEl: hbPveInstancesEl,
    emptyStateEl: hbEmptyStateEl,
    instancesEl: hbInstancesEl,
    instanceCountEl: hbInstanceCountEl
  }, sortHaggaBasinInstances);
}

const ECO_METRIC_ELS = [ecoHoldersEl, ecoSupplyEl, ecoOrdersEl, ecoFulfilledEl, ecoTaxEl];
const ECO_TABLE_ELS = [ecoCurrencyBodyEl, ecoTradeBodyEl];

function renderEconomy(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: ecoAvailabilityEl, metricEls: ECO_METRIC_ELS, tableBodyEls: ECO_TABLE_ELS });
    return;
  }
  hideAvailabilityNote(ecoAvailabilityEl);
  const d = result.data || {};
  setText(ecoHoldersEl, d.totalCurrencyHolders ?? 0);
  setText(ecoSupplyEl, d.totalSupply ?? 0);
  setText(ecoOrdersEl, d.activeOrders ?? 0);
  setText(ecoFulfilledEl, d.fulfilledOrders ?? 0);
  setText(ecoTaxEl, d.totalTaxFees ?? 0);

  clearTbody(ecoCurrencyBodyEl);
  for (const c of d.currencies || []) {
    appendRow(ecoCurrencyBodyEl, [
      c.currencyId || "Unknown",
      c.holders ?? 0,
      c.totalSupply ?? 0,
      c.averageBalance ?? 0,
      c.minBalance ?? 0,
      c.maxBalance ?? 0
    ]);
  }

  clearTbody(ecoTradeBodyEl);
  for (const t of d.topTradedItems || []) {
    appendRow(ecoTradeBodyEl, [
      t.templateId || "Unknown",
      t.orders ?? 0,
      t.avgPrice ?? 0,
      t.minPrice ?? 0,
      t.maxPrice ?? 0
    ]);
  }
}

const INV_METRIC_ELS = [invItemsEl, invInvsEl, invCraftedEl, invStorageUsedEl];
const INV_TABLE_ELS = [invTemplateBodyEl, invStorageBodyEl];

function renderInventory(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: invAvailabilityEl, metricEls: INV_METRIC_ELS, tableBodyEls: INV_TABLE_ELS });
    if (invEmptyStateEl) invEmptyStateEl.hidden = true;
    return;
  }
  hideAvailabilityNote(invAvailabilityEl);
  const d = result.data || {};
  setText(invItemsEl, d.totalItems ?? 0);
  setText(invInvsEl, d.totalInventories ?? 0);
  setText(invCraftedEl, d.totalCrafted);
  setText(invStorageUsedEl, d.totalStorageUsed ?? "—");  // may be absent in current Core

  const hasTemplateData = d.itemsByTemplate && d.itemsByTemplate.length > 0;
  const hasStorageData = d.storageUsage && d.storageUsage.length > 0;
  var hasAnyData = hasTemplateData || hasStorageData;

  clearTbody(invTemplateBodyEl);
  if (hasTemplateData) {
    for (const i of d.itemsByTemplate) {
      appendRow(invTemplateBodyEl, [i.templateId || "Unknown", i.count ?? 0, i.totalStack ?? 0]);
    }
  }

  clearTbody(invStorageBodyEl);
  if (hasStorageData) {
    for (const s of d.storageUsage) {
      appendRow(invStorageBodyEl, [s.inventoryId || "Unknown", s.itemCount ?? 0, s.totalStack ?? 0]);
    }
  }

  if (invEmptyStateEl) {
    invEmptyStateEl.hidden = hasAnyData;
    invEmptyStateEl.textContent = hasAnyData ? "" : "Inventory and storage detail is not available. The bridge returned aggregate totals but no per-template or per-container breakdown. This is expected when the game server has not yet populated item data.";
  }
}

const LOC_METRIC_ELS = [locMapCountEl, locMarkersEl];
const LOC_TABLE_ELS = [locDensityBodyEl, locMarkersBodyEl];

function renderLocation(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: locAvailabilityEl, metricEls: LOC_METRIC_ELS, tableBodyEls: LOC_TABLE_ELS });
    return;
  }
  hideAvailabilityNote(locAvailabilityEl);
  const d = result.data || {};
  setText(locMapCountEl, (d.activeMaps || []).length);
  setText(locMarkersEl, d.totalMarkers ?? 0);

  clearTbody(locDensityBodyEl);
  for (const m of d.activeMaps || d.playerDensity || []) {
    appendRow(locDensityBodyEl, [m.map || "Unknown", m.players ?? 0, m.online ?? 0]);
  }

  clearTbody(locMarkersBodyEl);
  for (const m of d.markersByMap || []) {
    appendRow(locMarkersBodyEl, [m.map || "Unknown", m.markers ?? 0]);
  }
}

function renderSystemServicesTable(prometheusResult) {
  clearTbody(nocSystemServiceBodyEl);
  if (nocMetricsCtaEl) nocMetricsCtaEl.hidden = true;

  if (!prometheusResult || prometheusResult.status === "unavailable") {
    appendRow(nocSystemServiceBodyEl, ["Prometheus", "Unavailable — bridge error"]);
    return;
  }

  if (prometheusResult.data && prometheusResult.data.status === "planned") {
    if (nocMetricsCtaEl) nocMetricsCtaEl.hidden = false;
    appendRow(nocSystemServiceBodyEl, ["Prometheus", "Not started"]);
    return;
  }

  const d = prometheusResult.data || {};
  const services = d.services || {};

  if (d.error) {
    appendRow(nocSystemServiceBodyEl, ["Prometheus", d.error]);
    return;
  }

  const knownServices = ["dune-prometheus", "dune-node", "dune-postgres", "dune-rabbitmq-admin", "dune-rabbitmq-game", "dune-cadvisor"];
  const serviceLabels = {
    "dune-prometheus": "Prometheus",
    "dune-node": "Node Exporter",
    "dune-postgres": "Postgres Exporter",
    "dune-rabbitmq-admin": "RabbitMQ Admin",
    "dune-rabbitmq-game": "RabbitMQ Game",
    "dune-cadvisor": "cAdvisor"
  };

  for (const job of knownServices) {
    const status = services[job] || "unknown";
    const label = serviceLabels[job] || job;
    appendRow(nocSystemServiceBodyEl, [label, status]);
  }

  // also show any additional services not in the known list
  for (const [job, status] of Object.entries(services)) {
    if (!knownServices.includes(job)) {
      appendRow(nocSystemServiceBodyEl, [job, status]);
    }
  }
}

// Farm & Population Summary panel -- unrelated to the CPU/mem/disk/uptime
// numbers previously shown in the now-removed "Server Resources" panel
// (see renderContainerGrid() below, its real replacement). Kept as its
// own function (was previously fused into renderNocResources(), which
// this PR splits apart along with removing the dead host-resource half).
// #139: incomingS2SConnections/outgoingS2SConnections/connectedPlayers
// are real, live per-farm aggregates from Core's addonOpsHealthFarms()
// -- null (not undefined, not 0) means normalizeOpsHealth() genuinely
// had no such field in this payload (e.g. an older Core version, or an
// unavailable source falling through to normalizeOpsHealth(null)'s
// defaults) -- shown as an honest dash, never fabricated as 0 or
// silently substituted with a different, unrelated number.
function renderFarmSummary(snapshot) {
  const totals = (snapshot && snapshot.totals) || {};
  const hasS2SData = totals.incomingS2SConnections !== null && totals.incomingS2SConnections !== undefined
    && totals.outgoingS2SConnections !== null && totals.outgoingS2SConnections !== undefined;
  const s2s = hasS2SData ? `${totals.incomingS2SConnections} in / ${totals.outgoingS2SConnections} out` : "—";
  const hasConnectedPlayers = totals.connectedPlayers !== null && totals.connectedPlayers !== undefined;
  setText(nocFarmsTotalEl, totals.farms || 0);
  setText(nocFarmsReadyEl, `${totals.readyFarms || 0} / ${totals.aliveFarms || 0}`);
  setText(nocFarmsPlayersEl, hasConnectedPlayers ? totals.connectedPlayers : "—");
  setText(nocFarmsS2sEl, s2s);
}

// #133 (NOC Overview rebuild): renders one tile per container returned by
// ops.health.containers, grouped by "family" (postgres/rabbitmq/generic)
// -- base CPU/mem/net/block-IO/status on every tile; family-specific
// metrics (added in a follow-up PR, #133's PR 2) appended only to
// postgres/rabbitmq tiles. This tab-visible grid is the direct
// replacement for the removed "Server Resources" panel (which only ever
// showed 4 host-level numbers, permanently "—" for any install not
// running the optional metrics stack) -- see docs/design/
// noc-overview-rebuild-l1-design-2026-08-17.md for the full design.
// Container name -> family mapping (#133 PR 2). Name-pattern based, not
// image-tag based: container names are a stable, already-documented
// contract in dune-awakening-selfhost-docker's own orchestration
// scripts, while Funcom's image tags change on every game update.
// Anything not matching a specific pattern falls through to "generic"
// -- deliberately not special-cased further (no game-process metrics
// exist yet for dune-server-*/dune-director/dune-text-router; see the
// L1 design doc's "Out of Scope" section).
var CONTAINER_FAMILY_PATTERNS = [
  { family: "postgres", pattern: /^dune-postgres$/ },
  { family: "rabbitmq", pattern: /^dune-rmq-(admin|game)$/ }
];

function containerFamily(name) {
  var match = CONTAINER_FAMILY_PATTERNS.filter(function (p) { return p.pattern.test(name); })[0];
  return match ? match.family : "generic";
}

function renderContainerGrid(result, postgresResult, rabbitmqResult) {
  if (containerGridLoadingNoteEl) containerGridLoadingNoteEl.hidden = true;

  if (!result || result.status === "unavailable") {
    if (containerGridEl) containerGridEl.hidden = true;
    if (containerGridAvailabilityNoteEl) {
      containerGridAvailabilityNoteEl.hidden = false;
      containerGridAvailabilityNoteEl.textContent = unavailableMessage(result);
    }
    return;
  }

  const containers = (result.data && result.data.containers) || [];
  if (containerGridAvailabilityNoteEl) containerGridAvailabilityNoteEl.hidden = true;
  if (!containerGridEl) return;

  containerGridEl.hidden = false;
  containerGridEl.textContent = "";

  if (containers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No containers were reported for this project. Is Docker running?";
    containerGridEl.appendChild(empty);
    return;
  }

  // Family data is resolved once per render, not per tile -- both
  // ops.health.postgres/.rabbitmq are single aggregate results (not
  // per-container), so every dune-postgres tile shares the same
  // postgresResult, and both dune-rmq-* tiles share the same
  // rabbitmqResult (further narrowed to that specific instance's
  // up-state via .instances[]).
  const postgresData = postgresResult && postgresResult.status === "live" ? postgresResult.data : null;
  const rabbitmqData = rabbitmqResult && rabbitmqResult.status === "live" ? rabbitmqResult.data : null;

  for (const container of containers) {
    const family = containerFamily(container.name);
    const familyData = family === "postgres" ? postgresData : family === "rabbitmq" ? rabbitmqData : null;
    containerGridEl.appendChild(renderContainerTile(container, family, familyData));
  }
}

// #133 PR 3: fleet-level rollup strip. Sums CPU/mem across every
// container ops.health.containers returned (independent of family --
// this is a total, not a per-family breakdown) alongside the existing
// host-level CPU/mem from ops.health.prometheus. Deliberately reuses
// the same parseCpuPercent()/parseByteSize() helpers the per-container
// tiles already use, so the rollup's total is arithmetically
// consistent with what's shown per-tile below it -- not a separately
// computed/potentially-drifting number.
function renderFleetRollup(containerResult, prometheusResult) {
  if (!containerResult || containerResult.status !== "live") {
    setText(fleetContainersUpEl, "—");
    setText(fleetCpuEl, "—");
    setText(fleetMemEl, "—");
  } else {
    const containers = (containerResult.data && containerResult.data.containers) || [];
    const upCount = containers.filter(function (c) { return containerHealthClass(c) === "ok"; }).length;
    setText(fleetContainersUpEl, `${upCount} / ${containers.length}`);

    let cpuSum = 0;
    let cpuKnown = false;
    let memSumBytes = 0;
    let memKnown = false;
    for (const c of containers) {
      const cpu = parseCpuPercent(c.cpu);
      if (cpu !== null) { cpuSum += cpu; cpuKnown = true; }
      const mem = parseByteSize(c.mem);
      if (mem !== null) { memSumBytes += mem; memKnown = true; }
    }
    setText(fleetCpuEl, cpuKnown ? `${Math.round(cpuSum * 10) / 10}%` : "—");
    setText(fleetMemEl, memKnown ? formatBytesHuman(memSumBytes) : "—");
  }

  if (!prometheusResult || prometheusResult.status === "unavailable" ||
      (prometheusResult.data && prometheusResult.data.status === "planned")) {
    setText(fleetHostCpuEl, "—");
    setText(fleetHostMemEl, "—");
    return;
  }
  const summary = (prometheusResult.data && prometheusResult.data.summary) || {};
  setText(fleetHostCpuEl, summary.avgCpuPercent !== null && summary.avgCpuPercent !== undefined ? `${summary.avgCpuPercent}%` : "—");
  // formatBytesHuman() fixes a real, previously-reported bloat finding:
  // the old "Server Resources" panel showed avgMemoryMb as a raw
  // integer with no unit scaling (e.g. "16384 MB" instead of
  // "16.4 GB") -- see the 2026-08 addon-UX audit.
  setText(fleetHostMemEl, summary.avgMemoryMb !== null && summary.avgMemoryMb !== undefined ? formatBytesHuman(summary.avgMemoryMb * 1024 * 1024) : "—");
}

// Scales a raw byte count to the largest unit that keeps at least one
// whole digit before the decimal point (B/KB/MB/GB/TB), matching the
// same base-1000 convention docker stats' own human-readable output
// already uses elsewhere in this file (parseByteSize() parses both
// base-1000 and base-1024 suffixes on the way in; this always renders
// base-1000 on the way out, for one consistent display convention
// regardless of which suffix Core originally reported).
function formatBytesHuman(bytes) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function containerHealthClass(container) {
  const status = String((container && container.status) || "").toLowerCase();
  if (!status || status === "unknown") return "unknown";
  if (status.indexOf("unhealthy") !== -1 || status.indexOf("restarting") !== -1) return "crit";
  if (status.indexOf("(health: starting)") !== -1) return "warn";
  if (status.indexOf("up") === 0) return "ok";
  return "unknown";
}

// Splits docker stats's "12.3MiB / 512MiB" MemUsage shape (already
// pre-split into .mem/.memLimit by Core's mergeContainerHealth(), see
// addonOpsContainerHealth() in duneDb.js) into a 0-100 percent for the
// meter's width, or null if either side is missing/unparseable (a
// generic tile with no memLimit -- e.g. a container with no memory
// limit configured -- shows the raw value with no meter, never a
// fabricated percent).
function containerMemPercent(container) {
  const used = parseByteSize(container && container.mem);
  const limit = parseByteSize(container && container.memLimit);
  if (used === null || limit === null || limit === 0) return null;
  return Math.min(100, (used / limit) * 100);
}

// Parses docker's own human-readable size suffixes (B/kB/KiB/MB/MiB/GB/GiB)
// -- exactly the units docker stats emits, not a general-purpose parser.
function parseByteSize(value) {
  const match = /^([\d.]+)\s*([kKmMgG]?i?B)$/.exec(String(value || "").trim());
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return null;
  const unit = match[2].toLowerCase();
  const multipliers = { b: 1, kb: 1000, kib: 1024, mb: 1000 * 1000, mib: 1024 * 1024, gb: 1000 * 1000 * 1000, gib: 1024 * 1024 * 1024 };
  const multiplier = multipliers[unit];
  return multiplier ? num * multiplier : null;
}

function parseCpuPercent(value) {
  const match = /^([\d.]+)%$/.exec(String(value || "").trim());
  return match ? parseFloat(match[1]) : null;
}

// meterClass: which color tier a percent falls into. Thresholds are
// deliberately generic-tile defaults (matches DuneContainerHighMemory's
// 90% warn tier in runtime/metrics/rules/containers.yml -- no critical
// tier exists there either, matching this addon's own no-invented-
// thresholds rule from the L1 design doc). Family-specific meters (added
// in #133's PR 2) pass their own warn/crit thresholds instead of using
// this generic default.
function meterClass(percent, warnAt = 90, critAt = null) {
  if (percent === null || percent === undefined) return null;
  if (critAt !== null && percent > critAt) return "crit";
  if (percent > warnAt) return "warn";
  return "ok";
}

function makeMeter(percent, warnAt, critAt) {
  const wrap = document.createElement("div");
  wrap.className = "meter";
  if (percent === null || percent === undefined) {
    wrap.setAttribute("aria-hidden", "true");
    return wrap;
  }
  const fill = document.createElement("div");
  const tier = meterClass(percent, warnAt, critAt);
  fill.className = `meter__fill meter__fill--${tier || "ok"}`;
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  wrap.appendChild(fill);
  return wrap;
}

function makeMetricRow(label, valueText, percent, warnAt, critAt) {
  const row = document.createElement("div");
  row.className = "container-tile-metric";
  const labelEl = document.createElement("span");
  labelEl.className = "container-tile-metric-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "container-tile-metric-value";
  valueEl.textContent = valueText;
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  if (percent !== undefined && percent !== null) {
    row.classList.add("container-tile-metric--with-meter");
    row.appendChild(makeMeter(percent, warnAt, critAt));
  }
  return row;
}

// Family-specific metric sections (#133 PR 2). Thresholds are lifted
// directly from runtime/metrics/rules/postgres.yml and rabbitmq.yml's
// own alert expressions (see the L1 design doc's threshold table) --
// not invented separately, so a yellow/red tile here always agrees
// with what would actually page an operator via Alertmanager. Where
// the real alert rule has no critical tier (most of them -- these
// rules are deliberately warning-only), this UI has no red tier for
// that metric either.
function appendFamilyDivider(card, label) {
  const divider = document.createElement("div");
  divider.className = "container-tile-family-divider";
  divider.textContent = label;
  card.appendChild(divider);
}

function appendPostgresMetrics(card, postgresData) {
  appendFamilyDivider(card, "Postgres");
  if (!postgresData) {
    const row = document.createElement("div");
    row.className = "container-tile-metric";
    row.textContent = "Postgres metrics unavailable";
    card.appendChild(row);
    return;
  }
  const active = postgresData.connections && postgresData.connections.active;
  const max = postgresData.connections && postgresData.connections.max;
  const connPercent = (active === null || active === undefined || max === null || max === undefined || max === 0)
    ? null
    : (active / max) * 100;
  const connText = (active === null || active === undefined) ? "—" : `${active}${max ? ` / ${max}` : ""}`;
  // DunePostgresHighConnections (warn >80%) / DunePostgresCriticalConnections (crit >95%)
  card.appendChild(makeMetricRow("Connections", connText, connPercent, 80, 95));

  const cacheHit = postgresData.cacheHitRatioPercent;
  const cacheText = (cacheHit === null || cacheHit === undefined) ? "—" : `${cacheHit}%`;
  const cacheRow = document.createElement("div");
  cacheRow.className = "container-tile-metric";
  const cacheLabel = document.createElement("span");
  cacheLabel.className = "container-tile-metric-label";
  cacheLabel.textContent = "Cache hit";
  const cacheValue = document.createElement("span");
  cacheValue.className = "container-tile-metric-value";
  // DunePostgresLowCacheHitRatio fires below 95% -- this is an
  // inverted threshold (low is bad), so it's shown as plain text with
  // no meter rather than reusing makeMeter()'s "higher is worse"
  // convention, which would misleadingly fill the bar for a HEALTHY
  // high cache-hit ratio.
  cacheValue.textContent = cacheText;
  if (cacheHit !== null && cacheHit !== undefined && cacheHit < 95) {
    cacheValue.classList.add("container-tile-metric-value--warn");
  }
  cacheRow.appendChild(cacheLabel);
  cacheRow.appendChild(cacheValue);
  card.appendChild(cacheRow);

  const deadlocks = postgresData.deadlocksLast5m;
  const deadlockRow = document.createElement("div");
  deadlockRow.className = "container-tile-metric";
  const deadlockLabel = document.createElement("span");
  deadlockLabel.className = "container-tile-metric-label";
  deadlockLabel.textContent = "Deadlocks (5m)";
  const deadlockValue = document.createElement("span");
  deadlockValue.className = "container-tile-metric-value";
  deadlockValue.textContent = (deadlocks === null || deadlocks === undefined) ? "—" : String(deadlocks);
  // DunePostgresDeadlocks fires on ANY increase (> 0) -- not a percent
  // threshold, so flagged directly rather than via makeMeter().
  if (deadlocks !== null && deadlocks !== undefined && deadlocks > 0) {
    deadlockValue.classList.add("container-tile-metric-value--warn");
  }
  deadlockRow.appendChild(deadlockLabel);
  deadlockRow.appendChild(deadlockValue);
  card.appendChild(deadlockRow);
}

function appendRabbitmqMetrics(card, rabbitmqData, containerName) {
  appendFamilyDivider(card, "RabbitMQ");
  if (!rabbitmqData) {
    const row = document.createElement("div");
    row.className = "container-tile-metric";
    row.textContent = "RabbitMQ metrics unavailable";
    card.appendChild(row);
    return;
  }

  // rabbitmqData.instances[] carries the per-instance up-state for both
  // brokers; queueDepth/memPercent/fdPercent are aggregate (max/sum)
  // across whichever instances Prometheus is scraping, not split per
  // container -- shown identically on both dune-rmq-admin and
  // dune-rmq-game tiles today. A true per-instance breakdown would
  // require per-instance PromQL label filtering, deferred as a
  // possible future refinement (not scoped in the L1 design doc).
  const instanceEntry = (rabbitmqData.instances || []).filter(function (i) {
    return containerName && containerName.indexOf(i.name.replace("rabbitmq-", "rmq-")) !== -1;
  })[0];
  const instanceUpText = instanceEntry ? (instanceEntry.up ? "Up" : "Down") : (rabbitmqData.up ? "Up" : "Down");
  const upRow = document.createElement("div");
  upRow.className = "container-tile-metric";
  const upLabel = document.createElement("span");
  upLabel.className = "container-tile-metric-label";
  upLabel.textContent = "Broker";
  const upValue = document.createElement("span");
  upValue.className = "container-tile-metric-value";
  upValue.textContent = instanceUpText;
  if (instanceUpText === "Down") upValue.classList.add("container-tile-metric-value--crit");
  upRow.appendChild(upLabel);
  upRow.appendChild(upValue);
  card.appendChild(upRow);

  const queueDepth = rabbitmqData.queueDepth;
  const queueText = (queueDepth === null || queueDepth === undefined) ? "—" : String(queueDepth);
  const queueRow = document.createElement("div");
  queueRow.className = "container-tile-metric";
  const queueLabel = document.createElement("span");
  queueLabel.className = "container-tile-metric-label";
  queueLabel.textContent = "Queue depth";
  const queueValue = document.createElement("span");
  queueValue.className = "container-tile-metric-value";
  queueValue.textContent = queueText;
  // DuneRabbitMQQueueBacklog/UnackedBacklog fire above 1000 (absolute
  // count, not a percent) -- flagged directly rather than via
  // makeMeter(), which expects a 0-100 bounded value.
  if (queueDepth !== null && queueDepth !== undefined && queueDepth > 1000) {
    queueValue.classList.add("container-tile-metric-value--warn");
  }
  queueRow.appendChild(queueLabel);
  queueRow.appendChild(queueValue);
  card.appendChild(queueRow);

  // DuneRabbitMQHighMemory (warn >80%, no critical tier defined)
  card.appendChild(makeMetricRow("Mem limit", rabbitmqData.memPercent === null || rabbitmqData.memPercent === undefined ? "—" : `${rabbitmqData.memPercent}%`, rabbitmqData.memPercent, 80));
  // DuneRabbitMQHighFileDescriptors (warn >80%, no critical tier defined)
  card.appendChild(makeMetricRow("FD usage", rabbitmqData.fdPercent === null || rabbitmqData.fdPercent === undefined ? "—" : `${rabbitmqData.fdPercent}%`, rabbitmqData.fdPercent, 80));
}

function renderContainerTile(container, family, familyData) {
  const card = document.createElement("article");
  const healthTier = containerHealthClass(container);
  card.className = `container-tile container-tile--${healthTier}`;

  const header = document.createElement("div");
  header.className = "container-tile-header";
  const dot = document.createElement("span");
  dot.className = `container-tile-dot container-tile-dot--${healthTier}`;
  dot.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "container-tile-name";
  name.textContent = (container && container.name) || "unknown";
  const status = document.createElement("span");
  status.className = "container-tile-status";
  status.textContent = (container && container.status) || "unknown";
  header.appendChild(dot);
  header.appendChild(name);
  header.appendChild(status);
  card.appendChild(header);

  const cpuPercent = parseCpuPercent(container && container.cpu);
  card.appendChild(makeMetricRow("CPU", (container && container.cpu) || "—", cpuPercent, 85));

  const memPercent = containerMemPercent(container);
  const memText = container && container.mem
    ? (container.memLimit ? `${container.mem} / ${container.memLimit}` : container.mem)
    : "—";
  card.appendChild(makeMetricRow("Mem", memText, memPercent, 90));

  const netRow = document.createElement("div");
  netRow.className = "container-tile-metric";
  const netLabel = document.createElement("span");
  netLabel.className = "container-tile-metric-label";
  netLabel.textContent = "Net";
  const netValue = document.createElement("span");
  netValue.className = "container-tile-metric-value";
  netValue.textContent = (container && container.netIO) || "—";
  netRow.appendChild(netLabel);
  netRow.appendChild(netValue);
  card.appendChild(netRow);

  const blockRow = document.createElement("div");
  blockRow.className = "container-tile-metric";
  const blockLabel = document.createElement("span");
  blockLabel.className = "container-tile-metric-label";
  blockLabel.textContent = "Disk I/O";
  const blockValue = document.createElement("span");
  blockValue.className = "container-tile-metric-value";
  blockValue.textContent = (container && container.blockIO) || "—";
  blockRow.appendChild(blockLabel);
  blockRow.appendChild(blockValue);
  card.appendChild(blockRow);

  if (family === "postgres") {
    appendPostgresMetrics(card, familyData);
  } else if (family === "rabbitmq") {
    appendRabbitmqMetrics(card, familyData, container && container.name);
  }

  return card;
}

const SOC_METRIC_ELS = [socHealthEl, socRequestsEl, socErrorsEl, socSuccessEl];

function renderSoc(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: socAvailabilityEl, metricEls: SOC_METRIC_ELS, tableBodyEls: [] });
    return;
  }
  hideAvailabilityNote(socAvailabilityEl);
  const d = result.data || {};
  setText(socHealthEl, d.platformHealth || "Unknown");
  setText(socRequestsEl, d.bridgeRequests ?? 0);
  setText(socErrorsEl, d.bridgeErrors ?? 0);
  const rate = d.bridgeSuccessRate ?? (d.bridgeRequests > 0 ? (1 - d.bridgeErrors / d.bridgeRequests) * 100 : 0);
  setText(socSuccessEl, rate !== null && rate !== undefined ? `${Math.round(rate)}%` : "0%");
}

const MTR_METRIC_ELS = [mtrHealthEl, mtrTargetsEl, mtrCpuEl, mtrMemEl, mtrRestartsEl];
const MTR_TABLE_ELS = [mtrServiceBodyEl];

function renderPrometheus(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: mtrAvailabilityEl, metricEls: MTR_METRIC_ELS, tableBodyEls: MTR_TABLE_ELS });
    return;
  }
  // Show prominent call-to-action when metrics stack is not running
  if (result.data && result.data.status === "planned") {
    for (const el of MTR_METRIC_ELS) setText(el, null);
    for (const el of MTR_TABLE_ELS) clearTbody(el);
    if (mtrAvailabilityEl) {
      mtrAvailabilityEl.hidden = false;
      mtrAvailabilityEl.textContent = unavailableMessage(result);
      mtrAvailabilityEl.classList.add("cta-note");
    }
    return;
  }
  hideAvailabilityNote(mtrAvailabilityEl);
  if (mtrAvailabilityEl) mtrAvailabilityEl.classList.remove("cta-note");
  const d = result.data || {};
  if (d.healthy === false && d.error) {
    setText(mtrHealthEl, "Unreachable");
    setText(mtrTargetsEl, "—");
    setText(mtrCpuEl, "—");
    setText(mtrMemEl, "—");
    setText(mtrRestartsEl, "—");
    clearTbody(mtrServiceBodyEl);
    appendRow(mtrServiceBodyEl, ["Prometheus API", d.error || "error"]);
    return;
  }
  setText(mtrHealthEl, d.healthy ? "Healthy" : "Degraded");
  const targets = d.targets || {};
  setText(mtrTargetsEl, `${targets.active || 0} / ${targets.total || 0}`);
  const summary = d.summary || {};
  setText(mtrCpuEl, summary.avgCpuPercent !== null ? `${summary.avgCpuPercent}%` : "—");
  // #142: use the same formatBytesHuman() scaling as the Overview tab's
  // Fleet Overview panel for this identical underlying field
  // (summary.avgMemoryMb, from the same ops.health.prometheus source) --
  // previously showed a raw unformatted MB integer here (e.g.
  // "16384 MB") while Overview already scaled the same number to
  // "16.4 GB", an inconsistency flagged in the 2026-08-17 eight-hats
  // review (Finding M-6).
  setText(mtrMemEl, summary.avgMemoryMb !== null && summary.avgMemoryMb !== undefined ? formatBytesHuman(summary.avgMemoryMb * 1024 * 1024) : "—");
  // totalRestarts is a real "not currently obtainable" null on every
  // known deployment today (Core's cAdvisor configuration doesn't expose
  // per-container metrics — see dune-awakening-selfhost-docker's
  // addonOpsPrometheusHealth for the verified reason) — `?? 0` would
  // render a false zero indistinguishable from a real zero-restart
  // count, exactly the anti-pattern the SourceResult refactor exists to
  // prevent elsewhere in this file.
  setText(mtrRestartsEl, summary.totalRestarts !== null && summary.totalRestarts !== undefined ? summary.totalRestarts : "—");
  clearTbody(mtrServiceBodyEl);
  const services = d.services || {};
  for (const [job, status] of Object.entries(services)) {
    appendRow(mtrServiceBodyEl, [job, status]);
  }
}

const SOURCE_NAMES = ["opsHealth", "activity", "combat", "resources", "economy", "inventory", "location", "soc", "prometheus", "containerHealth", "postgresHealth", "rabbitmqHealth"];

// Promise.allSettled's rejection branch previously collapsed to a bare `{}`
// (F-1/F-4's root cause for this call site): a rejected getXxx() call (e.g.
// the addon isn't running inside the Console iframe, so bridgeRequest()
// rejects synchronously) produced an object with no `status` field, which
// every renderXxx() then read as "no fields present" and rendered as 0 —
// indistinguishable from a real empty result. Converting the rejection into
// a proper unavailableResult() here ensures every renderXxx() takes the
// same "unavailable" branch it would for a same-shaped bridge-side failure.
function settledToSourceResult(settled) {
  if (settled.status === "fulfilled" && settled.value && typeof settled.value === "object" && "status" in settled.value) {
    return settled.value;
  }
  return window.DuneOpsProviders.unavailableResult("request_failed", null);
}

async function refreshAll() {
  _activeProvider = null;

  try {
    _activeProvider = getProvider();
    if (providerLabelEl) providerLabelEl.textContent = `Provider: ${_activeProvider.label}`;
    if (document.body) document.body.dataset.provider = _activeProvider.name;
    _showPreviewWarning(_activeProvider);

    const results = await Promise.allSettled([
      _activeProvider.getOpsHealth ? _activeProvider.getOpsHealth() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getActivity ? _activeProvider.getActivity() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getCombat ? _activeProvider.getCombat() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getResources ? _activeProvider.getResources() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getEconomy ? _activeProvider.getEconomy() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getInventory ? _activeProvider.getInventory() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getLocation ? _activeProvider.getLocation() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getSoc ? _activeProvider.getSoc() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getPrometheusHealth ? _activeProvider.getPrometheusHealth() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getContainerHealth ? _activeProvider.getContainerHealth() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getPostgresHealth ? _activeProvider.getPostgresHealth() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      _activeProvider.getRabbitmqHealth ? _activeProvider.getRabbitmqHealth() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null))
    ]);

    const sourceResults = results.map(settledToSourceResult);
    const [opsHealth, activity, combat, resources, economy, inventory, location, soc, prometheus, containerHealth, postgresHealth, rabbitmqHealth] = sourceResults;

    // Populate _tabCache so tab switches don't re-fetch data already loaded
    var cacheAt = Date.now();
    SOURCE_NAMES.forEach(function(name, i) {
      _tabCache.set(name, { result: sourceResults[i], at: cacheAt });
    });

    const snapshot = normalizeOpsHealth(opsHealth);
    const refreshedAt = new Date();
    const summary = renderOpsAggregate(snapshot, refreshedAt);
    lastSuccessfulReadAt = refreshedAt;

    renderActivity(activity);
    renderCombat(combat);
    renderResources(resources);
    renderEconomy(economy);
    renderInventory(inventory);
    renderLocation(location);
    renderSoc(soc);
    renderSystemServicesTable(prometheus);
    renderPrometheus(prometheus);
    renderFarmSummary(snapshot);
    renderContainerGrid(containerHealth, postgresHealth, rabbitmqHealth);
    renderFleetRollup(containerHealth, prometheus);

    const opsHealthResult = updateOpsHealth(_activeProvider, snapshot.available ? summary.totals : null, refreshedAt, snapshot.available ? null : new Error("ops.health.* unavailable"));

    if (previousTotals === null) previousTotals = summary.totals;

    // F-4 fix: compute a real per-source live/unavailable count instead of
    // unconditionally claiming "All observability sources online" whenever
    // the provider happens to be "bridge" — that message was previously
    // shown even when every single one of the 9 sources had failed.
    const liveCount = sourceResults.filter(r => r && (r.status === "live" || r.status === "preview")).length;
    const totalCount = sourceResults.length;

    let statusMsg;
    let statusClassName;
    if (_activeProvider.name === "bridge") {
      if (liveCount === totalCount) {
        statusMsg = `Connected to Dune Docker Console. All ${totalCount} observability sources online.`;
        statusClassName = "status-ok";
      } else if (liveCount === 0) {
        statusMsg = "Connected to Dune Docker Console, but no observability sources returned data.";
        statusClassName = "status-warn";
      } else {
        statusMsg = `Connected to Dune Docker Console. ${liveCount} of ${totalCount} observability sources online.`;
        statusClassName = "status-warn";
      }
    } else {
      statusMsg = "Preview mode. Sample data shown for all panels.";
      statusClassName = "status-info";
    }
    writeStatus(statusMsg, statusClassName);
    updateFreshnessBadges();

    writeOutput({
      provider: _activeProvider.name,
      lastRefresh: refreshedAt.toISOString(),
      totals: summary.totals,
      opsHealth: opsHealthResult,
      sourcesLive: liveCount,
      sourcesTotal: totalCount,
      sources: Object.fromEntries(SOURCE_NAMES.map((name, i) => [name, { status: sourceResults[i].status, reason: sourceResults[i].reason }]))
    });
  } catch (error) {
    writeStatus("Error reading observability data.", "status-warn");
    writeOutput({ error: error.message || String(error) });
  }
}

writeStatus(
  window.parent === window
    ? "Preview mode. Sample data shown for all panels."
    : "Console iframe mode. Ready to read live bridge data.",
  window.parent === window ? "status-info" : "status-ok"
);

if (buttonEl) buttonEl.addEventListener("click", refreshAll);
refreshAll();

// ── Scoped auto-refresh (#133 PR 3) ──
//
// Explicitly, ONLY the container/postgres/rabbitmq/prometheus sources
// auto-refresh, and ONLY while the Overview tab is the active/visible
// tab. Every other tab's providers (activity, combat, resources,
// economy, inventory, location, soc) remain manual-refresh-only,
// exactly as they were before this change and exactly as M-3's design
// constraint requires (see docs/design/
// noc-overview-rebuild-l1-design-2026-08-17.md's "Auto-Refresh Scope"
// section) -- several of those existing queries are full-table-scan/
// multi-join against dune.* game tables, and were only ever safe
// because nothing calls them on a timer. This timer's four sources are
// Docker (docker ps/docker stats, async+scoped since #240/#246) and
// Prometheus PromQL reads against already-aggregated time-series data
// -- never the live game database -- so adding a timer to THESE four
// specifically does not reintroduce that risk.
//
// Bypasses _tabCache's 60s TTL entirely (calls the provider methods
// directly, not via _refreshTab()) -- a fixed 15s interval is more
// predictable to reason about here than layering a second cache TTL
// on top of the existing one.
var AUTO_REFRESH_INTERVAL_MS = 15000;
var _autoRefreshTimer = null;

async function _autoRefreshOverview() {
  if (!_activeProvider) return;
  var overviewTab = document.querySelector('.tab-content[data-tab="overview"]');
  if (!overviewTab || !overviewTab.classList.contains("active")) return;

  var methods = ["getContainerHealth", "getPostgresHealth", "getRabbitmqHealth", "getPrometheusHealth"];
  var results = await Promise.allSettled(methods.map(function (method) {
    return _activeProvider[method]
      ? _activeProvider[method]()
      : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null));
  }));
  var sourceResults = results.map(settledToSourceResult);
  var containerHealth = sourceResults[0];
  var postgresHealth = sourceResults[1];
  var rabbitmqHealth = sourceResults[2];
  var prometheus = sourceResults[3];

  // Keep _tabCache in sync so a manual tab-switch away and back doesn't
  // immediately re-fetch data this timer just refreshed.
  var now = Date.now();
  _tabCache.set("containerHealth", { result: containerHealth, at: now });
  _tabCache.set("postgresHealth", { result: postgresHealth, at: now });
  _tabCache.set("rabbitmqHealth", { result: rabbitmqHealth, at: now });
  _tabCache.set("prometheus", { result: prometheus, at: now });

  renderSystemServicesTable(prometheus);
  renderPrometheus(prometheus);
  renderContainerGrid(containerHealth, postgresHealth, rabbitmqHealth);
  renderFleetRollup(containerHealth, prometheus);
}

// Only runs inside the real Console iframe (window.parent !== window) --
// never in direct-browser preview mode, and never in this repo's own
// jsdom-based test harness (test/addon-rendering.test.js's loadAddon()
// creates a standalone jsdom window with no parent, so window.parent
// === window there too, exactly like preview mode -- a real setInterval
// running in that harness would leak a live timer across tests, since
// nothing in that harness tears down a loaded window between tests).
// window.DuneOpsAutoRefresh.stop() is exposed as an explicit escape
// hatch for any future test that DOES need to exercise this path.
if (window.parent !== window) {
  _autoRefreshTimer = setInterval(_autoRefreshOverview, AUTO_REFRESH_INTERVAL_MS);
}

window.DuneOpsAutoRefresh = {
  stop: function () {
    if (_autoRefreshTimer) {
      clearInterval(_autoRefreshTimer);
      _autoRefreshTimer = null;
    }
  },
  isRunning: function () { return _autoRefreshTimer !== null; },
  triggerNow: _autoRefreshOverview
};
