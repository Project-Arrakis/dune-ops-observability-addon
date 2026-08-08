const statusEl = document.querySelector("#status");
const outputEl = document.querySelector("#output");
const buttonEl = document.querySelector("#refresh-players");

(function initFaction() {
  try {
    var faction = parent.document.documentElement.getAttribute("data-faction");
    if (faction) document.documentElement.setAttribute("data-faction", faction);
  } catch (e) {}
})();

(function initTabs() {
  var tabs = document.querySelectorAll("#tab-nav .tab");
  var panels = document.querySelectorAll(".tab-content");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      panels.forEach(function (p) { p.classList.remove("active"); });
      var target = document.querySelector('.tab-content[data-tab="' + tab.dataset.tab + '"]');
      if (target) target.classList.add("active");
    });
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
const invTemplateBodyEl = document.querySelector("#inv-template-body");
const invStorageBodyEl = document.querySelector("#inv-storage-body");
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

const nocServiceBodyEl = document.querySelector("#noc-service-body");
const nocCpuEl = document.querySelector("#noc-cpu");
const nocMemEl = document.querySelector("#noc-mem");
const nocDiskEl = document.querySelector("#noc-disk");
const nocUptimeEl = document.querySelector("#noc-uptime");
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
      aliveFarms
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
    renderNocService(provider, snapshot, refreshedAt);
    renderNocResources(snapshot);
  } catch (error) {
    const refreshedAt = new Date();
    const unavailableSnapshot = normalizeOpsHealth(null);
    renderOpsAggregate(unavailableSnapshot, refreshedAt);
    const opsHealth = updateOpsHealth(provider, null, refreshedAt, error);
    renderNocService(provider, unavailableSnapshot, refreshedAt);
    renderNocResources(unavailableSnapshot);
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

const INV_METRIC_ELS = [invItemsEl, invInvsEl, invCraftedEl];
const INV_TABLE_ELS = [invTemplateBodyEl, invStorageBodyEl];

function renderInventory(result) {
  if (!result || result.status === "unavailable") {
    renderUnavailablePanel(result, { noteEl: invAvailabilityEl, metricEls: INV_METRIC_ELS, tableBodyEls: INV_TABLE_ELS });
    return;
  }
  hideAvailabilityNote(invAvailabilityEl);
  const d = result.data || {};
  setText(invItemsEl, d.totalItems ?? 0);
  setText(invInvsEl, d.totalInventories ?? 0);
  // totalCrafted has no real data source anywhere in Core's schema
  // (verified: duneDb.js's addonOpsInventorySummary always returns
  // totalCrafted: null, explicitly, by design -- never estimated) --
  // `?? 0` here rendered a false, fabricated-looking zero for a field
  // that is genuinely unavailable, not genuinely zero. setText() itself
  // already renders null/undefined as a dash, so passing the real
  // value through directly (not coalesced to 0) is the fix.
  setText(invCraftedEl, d.totalCrafted);

  clearTbody(invTemplateBodyEl);
  for (const i of d.itemsByTemplate || []) {
    appendRow(invTemplateBodyEl, [i.templateId || "Unknown", i.count ?? 0, i.totalStack ?? 0]);
  }

  clearTbody(invStorageBodyEl);
  for (const s of d.storageUsage || []) {
    appendRow(invStorageBodyEl, [s.inventoryId || "Unknown", s.itemCount ?? 0, s.totalStack ?? 0]);
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

function renderNocService(provider, snapshot, refreshedAt) {
  clearTbody(nocServiceBodyEl);
  if (!nocServiceBodyEl) return;
  const isBridge = provider && provider.name === "bridge";
  const totals = (snapshot && snapshot.totals) || {};
  appendRow(nocServiceBodyEl, ["OPS Health Bridge", isBridge ? "Connected" : "Preview", isBridge ? provider.label : "sample", "—"]);
  appendRow(nocServiceBodyEl, ["Player Aggregate", totals.total > 0 ? "Populated" : "No Data", String(totals.total || "0"), String(totals.online || "0")]);
  appendRow(nocServiceBodyEl, ["Farm Aggregate", totals.farms > 0 ? "Populated" : "No Data", `${totals.readyFarms || 0} ready`, `${totals.aliveFarms || 0} alive`]);
  appendRow(nocServiceBodyEl, ["Data Freshness", lastSuccessfulReadAt ? "Current" : "Stale", lastSuccessfulReadAt ? formatRefreshTime(refreshedAt || lastSuccessfulReadAt) : "No read", lastSuccessfulReadAt && refreshedAt ? `${Math.round((new Date() - refreshedAt) / 1000)}s ago` : "—"]);
  appendRow(nocServiceBodyEl, ["Provider Mode", isBridge ? "Live Bridge" : "Sample Data", provider ? provider.label : "unknown", "—"]);
}

function renderNocResources(snapshot) {
  setText(nocCpuEl, "—");
  setText(nocMemEl, "—");
  setText(nocDiskEl, "—");
  setText(nocUptimeEl, "—");
  const totals = (snapshot && snapshot.totals) || {};
  const s2s = totals.incomingS2s !== undefined ? `${totals.incomingS2s} in / ${totals.outgoingS2s} out` : "—";
  setText(nocFarmsTotalEl, totals.farms || 0);
  setText(nocFarmsReadyEl, `${totals.readyFarms || 0} / ${totals.aliveFarms || 0}`);
  setText(nocFarmsPlayersEl, totals.connectedPlayers !== undefined ? totals.connectedPlayers : totals.online || 0);
  setText(nocFarmsS2sEl, s2s);
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
  hideAvailabilityNote(mtrAvailabilityEl);
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
  setText(mtrMemEl, summary.avgMemoryMb !== null ? `${summary.avgMemoryMb} MB` : "—");
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

const SOURCE_NAMES = ["opsHealth", "activity", "combat", "resources", "economy", "inventory", "location", "soc", "prometheus"];

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
  let provider;

  try {
    provider = getProvider();
    if (providerLabelEl) providerLabelEl.textContent = `Provider: ${provider.label}`;
    if (document.body) document.body.dataset.provider = provider.name;

    const results = await Promise.allSettled([
      provider.getOpsHealth ? provider.getOpsHealth() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getActivity ? provider.getActivity() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getCombat ? provider.getCombat() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getResources ? provider.getResources() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getEconomy ? provider.getEconomy() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getInventory ? provider.getInventory() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getLocation ? provider.getLocation() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getSoc ? provider.getSoc() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null)),
      provider.getPrometheusHealth ? provider.getPrometheusHealth() : Promise.resolve(window.DuneOpsProviders.unavailableResult("request_failed", null))
    ]);

    const [opsHealth, activity, combat, resources, economy, inventory, location, soc, prometheus] = results.map(settledToSourceResult);

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
    renderPrometheus(prometheus);
    renderNocService(provider, snapshot, refreshedAt);
    renderNocResources(snapshot);

    const opsHealthResult = updateOpsHealth(provider, snapshot.available ? summary.totals : null, refreshedAt, snapshot.available ? null : new Error("ops.health.* unavailable"));

    if (previousTotals === null) previousTotals = summary.totals;

    // F-4 fix: compute a real per-source live/unavailable count instead of
    // unconditionally claiming "All observability sources online" whenever
    // the provider happens to be "bridge" — that message was previously
    // shown even when every single one of the 9 sources had failed.
    const sourceResults = [opsHealth, activity, combat, resources, economy, inventory, location, soc, prometheus];
    const liveCount = sourceResults.filter(r => r && (r.status === "live" || r.status === "preview")).length;
    const totalCount = sourceResults.length;

    let statusMsg;
    let statusClassName;
    if (provider.name === "bridge") {
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

    writeOutput({
      provider: provider.name,
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
