(function () {
  const OPS_HEALTH_ACTIONS = [
    "ops.health.summary.v2",
    "ops.health.players",
    "ops.health.farms"
  ];

  const OPS_ACTIVITY_ACTIONS = [
    "ops.activity.summary"
  ];

  const OPS_COMBAT_ACTIONS = [
    "ops.combat.deaths"
  ];

  const OPS_RESOURCES_ACTIONS = [
    "ops.resources.summary"
  ];

  const OPS_ECONOMY_ACTIONS = [
    "ops.economy.summary"
  ];

  const OPS_INVENTORY_ACTIONS = [
    "ops.inventory.summary"
  ];

  const OPS_LOCATION_ACTIONS = [
    "ops.location.activity"
  ];

  const OPS_SOC_ACTIONS = [
    "ops.soc.summary"
  ];

  const OPS_PROMETHEUS_ACTIONS = [
    "ops.health.prometheus"
  ];

  // #133 (NOC Overview rebuild, per-container metrics): backed by
  // dune-awakening-selfhost-docker's addonOpsContainerHealth(), fixed
  // (async, scoped to this project's own containers via
  // com.docker.compose.project) in #240/#244 and #246/#301 before this
  // action was wired into the addon -- see docs/design/
  // noc-overview-rebuild-l1-design-2026-08-17.md for the full history,
  // including why an EARLIER attempt to wire this exact action
  // (issue #117/#118, 2026-08-10) caused a real incident and was fully
  // reverted (22ad998) before this rebuild started from a clean, tested
  // Core-side foundation.
  const OPS_CONTAINER_HEALTH_ACTIONS = [
    "ops.health.containers"
  ];

  // #133 PR 2: family-specific extra metrics for postgres/rabbitmq
  // container tiles. Backed by dune-awakening-selfhost-docker's
  // addonOpsPostgresHealth()/addonOpsRabbitmqHealth() -- pure PromQL
  // reads against the already-deployed, already-scraped
  // dune-postgres-exporter/rabbitmq_prometheus metrics (same opt-in
  // "dune metrics start" stack as ops.health.prometheus).
  const OPS_POSTGRES_HEALTH_ACTIONS = [
    "ops.health.postgres"
  ];
  const OPS_RABBITMQ_HEALTH_ACTIONS = [
    "ops.health.rabbitmq"
  ];

  const samplePrometheusHealth = {
    healthy: true,
    targets: { active: 6, inactive: 0, pending: 0, total: 6 },
    services: {
      "dune-prometheus": "up",
      "dune-node": "up",
      "dune-cadvisor": "up",
      "dune-postgres": "up",
      "dune-rabbitmq-admin": "up",
      "dune-rabbitmq-game": "up"
    },
    summary: {
      avgCpuPercent: 12.5,
      avgMemoryMb: 256,
      totalRestarts: 0
    }
  };

  // Real container names verified directly against
  // dune-awakening-selfhost-docker's own orchestration scripts (never
  // guessed) -- see docs/design/noc-overview-rebuild-l1-design-2026-08-17.md.
  // Shapes match addonOpsContainerHealth()'s real return value exactly
  // (name/cpu/mem/memLimit/netIO/blockIO/status), post-#240/#246 fix.
  const sampleContainerHealth = {
    containers: [
      { name: "dune-postgres", cpu: "3.40%", mem: "412MiB", memLimit: "2GiB", netIO: "12kB / 4kB", blockIO: "1.2MB / 340kB", status: "Up 2 hours (healthy)" },
      { name: "dune-rmq-admin", cpu: "0.80%", mem: "128MiB", memLimit: "1GiB", netIO: "2kB / 1kB", blockIO: "0B / 0B", status: "Up 2 hours" },
      { name: "dune-rmq-game", cpu: "7.10%", mem: "890MiB", memLimit: "1GiB", netIO: "340kB / 88kB", blockIO: "4.1MB / 900kB", status: "Up 2 hours" },
      { name: "dune-server-survival-1", cpu: "52.30%", mem: "3.8GiB", memLimit: "8GiB", netIO: "1.2MB / 890kB", blockIO: "12MB / 3.4MB", status: "Up 2 hours" },
      { name: "redblink-dune-docker-console", cpu: "1.20%", mem: "210MiB", memLimit: "1GiB", netIO: "8kB / 3kB", blockIO: "200kB / 40kB", status: "Up 2 hours" }
    ]
  };

  // Real shapes match addonOpsPostgresHealth()/addonOpsRabbitmqHealth()
  // exactly (see dune-awakening-selfhost-docker's duneDb.js) -- never
  // guessed field names.
  const samplePostgresHealth = {
    up: true,
    connections: { active: 18, max: 100 },
    cacheHitRatioPercent: 98.2,
    deadlocksLast5m: 0
  };
  const sampleRabbitmqHealth = {
    up: true,
    instances: [
      { name: "rabbitmq-admin", up: true },
      { name: "rabbitmq-game", up: true }
    ],
    queueDepth: 42,
    memPercent: 12.3,
    fdPercent: 4.1
  };

  const ALL_ACTIONS = [].concat(
    OPS_HEALTH_ACTIONS,
    OPS_ACTIVITY_ACTIONS,
    OPS_COMBAT_ACTIONS,
    OPS_RESOURCES_ACTIONS,
    OPS_ECONOMY_ACTIONS,
    OPS_INVENTORY_ACTIONS,
    OPS_LOCATION_ACTIONS,
    OPS_SOC_ACTIONS,
    OPS_PROMETHEUS_ACTIONS,
    OPS_CONTAINER_HEALTH_ACTIONS,
    OPS_POSTGRES_HEALTH_ACTIONS,
    OPS_RABBITMQ_HEALTH_ACTIONS
  );

  const sampleOpsHealth = {
    summary: {
      players: {
        total: 3,
        onlineStatus: {
          Online: 2,
          Offline: 1
        },
        factions: {
          Atreides: 1,
          Fremen: 1,
          Harkonnen: 1
        },
        guilds: {
          "Preview Guild": 1,
          "Sietch Patrol": 1,
          "Industrial Wing": 1
        },
        averageLevel: 44
      },
      farms: {
        total: 2,
        ready: 1,
        alive: 2
      }
    },
    players: {
      total: 3,
      onlineStatus: {
        Online: 2,
        Offline: 1
      },
      factions: {
        Atreides: 1,
        Fremen: 1,
        Harkonnen: 1
      },
      guilds: {
        "Preview Guild": 1,
        "Sietch Patrol": 1,
        "Industrial Wing": 1
      },
      averageLevel: 44
    },
    farms: {
      total: 2,
      ready: 1,
      alive: 2
    }
  };

  const sampleActivity = {
    totalPlayers: 3,
    onlinePlayers: 2,
    offlinePlayers: 1,
    activeLast1h: 1,
    activeLast24h: 3,
    activeLast7d: 3,
    sessionCount: 12,
    returningPlayers: 2,
    newPlayers: 1,
    guildActivity: [
      { guild: "Sietch Patrol", members: 2, online: 1 },
      { guild: "Industrial Wing", members: 1, online: 1 }
    ],
    factionActivity: [
      { faction: "Atreides", members: 1, online: 1 },
      { faction: "Fremen", members: 1, online: 0 },
      { faction: "Harkonnen", members: 1, online: 1 }
    ],
    mapActivity: [
      { map: "Deep Desert", actors: 5, online: 2 },
      { map: "Sietch Tabr", actors: 3, online: 1 }
    ],
    inactivePlayers: 0,
    playersDead: 1
  };

  const sampleCombat = {
    totalDeaths: 47,
    pvpDeaths: 12,
    pveDeaths: 35,
    deathsByCause: [
      { cause: "Creature Attack", count: 18 },
      { cause: "Player Kill", count: 12 },
      { cause: "Environment", count: 10 },
      { cause: "Fall", count: 5 },
      { cause: "Thirst", count: 2 }
    ],
    deathsByMap: [
      { map: "Deep Desert", count: 25 },
      { map: "Sietch Tabr", count: 12 },
      { map: "Arrakeen", count: 10 }
    ],
    topHostileNpcs: [
      { name: "Sandworm", count: 8 },
      { name: "Desert Viper", count: 5 },
      { name: "Harkonnen Guard", count: 3 }
    ],
    kdRatio: 0.26
  };

  // Sample shape matches the real addonOpsResourcesSummary() shape (Core
  // duneDb.js) exactly -- two Deep Desert instances (dimensionIndex 0 and 1,
  // deliberately out of natural-sort order here to exercise the addon's own
  // sort), one Hagga Basin sietch. Preview/sample data only -- never shown
  // as "live" (see previewResult() below).
  const sampleResources = {
    deepDesert: {
      summary: { totalActiveFields: 11, totalRemainingSpice: 54000, pvpInstances: 1, pveInstances: 1, bySize: [{ size: "Small", activeFields: 5 }, { size: "Medium", activeFields: 4 }, { size: "Large", activeFields: 2 }] },
      instances: [
        {
          partitionId: "9", dimensionIndex: 1, name: "DeepDesert 1", runtimeStatus: "RUNNING", combatState: "PVE",
          activeFields: 5, remainingSpice: 24000,
          sizes: [{ size: "Small", activeFields: 2, remainingSpice: null }, { size: "Medium", activeFields: 2, remainingSpice: null }, { size: "Large", activeFields: 1, remainingSpice: null }]
        },
        {
          partitionId: "8", dimensionIndex: 0, name: "DeepDesert 0", runtimeStatus: "RUNNING", combatState: "PVP",
          activeFields: 6, remainingSpice: 30000,
          sizes: [{ size: "Small", activeFields: 3, remainingSpice: null }, { size: "Medium", activeFields: 2, remainingSpice: null }, { size: "Large", activeFields: 1, remainingSpice: null }]
        }
      ]
    },
    haggaBasin: {
      summary: { totalActiveFields: 5, totalRemainingSpice: 25000, pvpInstances: 1, pveInstances: 0, bySize: [{ size: "Small", activeFields: 5 }] },
      instances: [
        {
          partitionId: "1", dimensionIndex: 0, name: "Sietch Tabr", runtimeStatus: "RUNNING", combatState: "PVP",
          activeFields: 5, remainingSpice: 25000,
          sizes: [{ size: "Small", activeFields: 5, remainingSpice: null }]
        }
      ]
    }
  };

  const sampleEconomy = {
    totalCurrencyHolders: 45,
    totalSupply: 250000,
    currencies: [
      { currencyId: "Solaris", holders: 40, totalSupply: 150000, averageBalance: 3750, minBalance: 50, maxBalance: 50000 },
      { currencyId: "Spice Tokens", holders: 25, totalSupply: 75000, averageBalance: 3000, minBalance: 10, maxBalance: 20000 },
      { currencyId: "Guild Credits", holders: 12, totalSupply: 25000, averageBalance: 2083, minBalance: 0, maxBalance: 10000 }
    ],
    activeOrders: 28,
    fulfilledOrders: 156,
    topTradedItems: [
      { templateId: "spice_ore_001", orders: 12, avgPrice: 250, minPrice: 200, maxPrice: 300 },
      { templateId: "water_001", orders: 8, avgPrice: 150, minPrice: 100, maxPrice: 200 },
      { templateId: "rifle_mk1", orders: 5, avgPrice: 1200, minPrice: 1000, maxPrice: 1500 }
    ],
    totalTaxFees: 12500
  };

  const sampleInventory = {
    totalItems: 342,
    totalInventories: 18,
    itemsByTemplate: [
      { templateId: "water_flask", count: 45, totalStack: 90 },
      { templateId: "spice_portion", count: 32, totalStack: 64 },
      { templateId: "rifle_ammo", count: 28, totalStack: 140 },
      { templateId: "bandage", count: 20, totalStack: 40 },
      { templateId: "canteen", count: 15, totalStack: 30 }
    ],
    totalCrafted: 23,
    storageUsage: [
      { inventoryId: "player_001_inv", itemCount: 24, totalStack: 48 },
      { inventoryId: "guild_001_storage", itemCount: 18, totalStack: 60 },
      { inventoryId: "player_003_inv", itemCount: 12, totalStack: 24 }
    ]
  };

  const sampleLocation = {
    activeMaps: [
      { map: "Deep Desert", players: 4, online: 2 },
      { map: "Sietch Tabr", players: 3, online: 1 },
      { map: "Arrakeen", players: 2, online: 1 }
    ],
    totalMarkers: 87,
    markersByMap: [
      { map: "Deep Desert", markers: 35 },
      { map: "Sietch Tabr", markers: 28 },
      { map: "Arrakeen", markers: 24 }
    ],
    playerDensity: [
      { map: "Deep Desert", players: 4, online: 2 },
      { map: "Sietch Tabr", players: 3, online: 1 },
      { map: "Arrakeen", players: 2, online: 1 }
    ],
    territoryPressure: []
  };

  const sampleSoc = {
    platformHealth: "Healthy",
    bridgeRequests: 47,
    bridgeErrors: 1,
    bridgeSuccessRate: 97.9,
    dataFreshness: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    health: {
      players: sampleOpsHealth.players,
      farms: sampleOpsHealth.farms
    },
    activity: sampleActivity,
    economy: sampleEconomy,
    combat: sampleCombat,
    resources: sampleResources,
    inventory: sampleInventory,
    location: sampleLocation
  };

  function isConsoleIframe() {
    return window.parent !== window && Boolean(window.DuneAddon);
  }

  async function bridgeRequest(action) {
    return await window.DuneAddon.request(action);
  }

  // ── SourceResult envelope ──
  //
  // Every provider method returns this shape unconditionally, on success or
  // failure alike, so every renderXxx() in addon.js can switch on `.status`
  // before ever touching `.data`. This is the fix for the false-zero
  // rendering defect (a provider's honest "no data" response was silently
  // treated as if it were a real payload with all-zero fields once it
  // reached the DOM).
  //
  // `status` is one of:
  //   "live"        — real bridge data, successfully fetched.
  //   "preview"     — sample/fixture data (non-production; not real).
  //   "unavailable" — no real data available; `reason` explains why, `data`
  //                   is always null. Never render a number derived from an
  //                   "unavailable" result — that is exactly the anti-pattern
  //                   this envelope exists to prevent.
  //
  // `reason` (only set when status is "unavailable") is one of:
  //   "not_implemented" — Core returned {status: "planned"} for this action.
  //   "bridge_error"     — Core returned a response with `.error` set, or an
  //                         empty/falsy response.
  //   "request_failed"   — the bridge request itself rejected (network
  //                         failure, timeout, addon not running inside the
  //                         Console iframe). Previously this rejection
  //                         propagated unhandled out of the provider method
  //                         entirely; refreshAll()'s Promise.allSettled then
  //                         silently collapsed it to `{}`, which every
  //                         renderXxx() read as "all fields absent" and
  //                         rendered as 0 — the same false-zero defect as
  //                         the already-handled "planned" case, just via a
  //                         different code path.
  function liveResult(data) {
    return { status: "live", data, reason: null, source: null };
  }

  function previewResult(data) {
    return { status: "preview", data, reason: null, source: null };
  }

  function unavailableResult(reason, source) {
    return { status: "unavailable", data: null, reason, source };
  }

  // #82: a partial SourceResult — used when getOpsHealth()'s 3 sub-calls
  // (ops.health.summary.v2/.players/.farms) don't all succeed or all fail.
  // `status` stays "live" (some real data is present and safe to render),
  // but `partial: true` and `failedSources` let addon.js show an honest
  // "some sources unavailable" note alongside the data that IS live,
  // instead of the previous all-or-nothing behavior where a single failed
  // sub-call took down the whole Overview/Players tab.
  function partialResult(data, failedSources) {
    return { status: "live", data, reason: null, source: null, partial: true, failedSources };
  }

  async function fetchLiveOrUnavailable(action) {
    let data;
    try {
      data = await bridgeRequest(action);
    } catch (err) {
      return unavailableResult("request_failed", action);
    }
    if (!data || data.error) return unavailableResult("bridge_error", action);
    if (data.status === "planned") {
      // Core sometimes reports a more specific reason than "this route
      // isn't implemented" — e.g. ops.health.prometheus's
      // "metrics_stack_not_running", meaning the integration exists but
      // the operator hasn't opted into the optional metrics stack
      // (`dune metrics start`). That's a materially different, more
      // actionable state than "not implemented at all" (location, which
      // has no reason field), so pass it through when Core provides one
      // instead of collapsing every "planned" response to the same
      // generic reason.
      return unavailableResult(data.reason || "not_implemented", action);
    }
    return liveResult(data);
  }

  const providers = {
    sample: {
      name: "sample",
      label: "Preview sample data (all sources)",
      actions: ALL_ACTIONS,
      async getOpsHealth() {
        return previewResult(sampleOpsHealth);
      },
      async getActivity() {
        return previewResult(sampleActivity);
      },
      async getCombat() {
        return previewResult(sampleCombat);
      },
      async getResources() {
        return previewResult(sampleResources);
      },
      async getEconomy() {
        return previewResult(sampleEconomy);
      },
      async getInventory() {
        return previewResult(sampleInventory);
      },
      async getLocation() {
        return previewResult(sampleLocation);
      },
      async getSoc() {
        return previewResult(sampleSoc);
      },
      async getPrometheusHealth() {
        return previewResult(samplePrometheusHealth);
      },
      async getContainerHealth() {
        return previewResult(sampleContainerHealth);
      },
      async getPostgresHealth() {
        return previewResult(samplePostgresHealth);
      },
      async getRabbitmqHealth() {
        return previewResult(sampleRabbitmqHealth);
      }
    },
    bridge: {
      name: "bridge",
      label: "Dune Docker Console bridge (all sources)",
      actions: ALL_ACTIONS,
      // #82 (H-1): previously used Promise.all, so a single failed
      // sub-call (summary/players/farms) took down the entire composite
      // result as {status:"unavailable"} — collapsing the NOC Overview,
      // Players tab, and KPIs even when 2 of 3 sub-sources were genuinely
      // live. Promise.allSettled lets each sub-call fail independently:
      // if all 3 succeed, behaves exactly as before (liveResult, no
      // `partial` flag); if some-but-not-all fail, returns a partial
      // liveResult with `failedSources` naming which action(s) failed, so
      // callers can render the live sub-sources normally and show an
      // honest "unavailable" note only for the failed ones; if all 3
      // fail, still returns the original unavailableResult (nothing to
      // render at all).
      async getOpsHealth() {
        // NOTE: these 3 literal bridgeRequest calls are matched by
        // scripts/check-bridge-action-drift.js's static regex scan against
        // README.md's action table -- do not refactor these into an array
        // + .map() (a prior draft of this fix did exactly that and broke
        // drift detection silently, since the checker only matches the
        // literal call-site pattern, not derived/computed action strings).
        const [summarySettled, playersSettled, farmsSettled] = await Promise.allSettled([
          bridgeRequest("ops.health.summary.v2"),
          bridgeRequest("ops.health.players"),
          bridgeRequest("ops.health.farms")
        ]);

        const bySource = [
          ["ops.health.summary.v2", summarySettled],
          ["ops.health.players", playersSettled],
          ["ops.health.farms", farmsSettled]
        ];
        const failedSources = bySource.filter(([, s]) => s.status === "rejected").map(([action]) => action);

        if (failedSources.length === bySource.length) {
          return unavailableResult("request_failed", "ops.health.*");
        }

        const summary = summarySettled.status === "fulfilled" ? summarySettled.value : null;
        const players = playersSettled.status === "fulfilled" ? playersSettled.value : null;
        const farms = farmsSettled.status === "fulfilled" ? farmsSettled.value : null;

        if (failedSources.length === 0) {
          return liveResult({ summary, players, farms });
        }

        return partialResult({ summary, players, farms }, failedSources);
      },
      async getActivity() {
        return fetchLiveOrUnavailable("ops.activity.summary");
      },
      async getCombat() {
        return fetchLiveOrUnavailable("ops.combat.deaths");
      },
      async getResources() {
        return fetchLiveOrUnavailable("ops.resources.summary");
      },
      async getEconomy() {
        return fetchLiveOrUnavailable("ops.economy.summary");
      },
      async getInventory() {
        return fetchLiveOrUnavailable("ops.inventory.summary");
      },
      async getLocation() {
        return fetchLiveOrUnavailable("ops.location.activity");
      },
      async getSoc() {
        return fetchLiveOrUnavailable("ops.soc.summary");
      },
      async getPrometheusHealth() {
        return fetchLiveOrUnavailable("ops.health.prometheus");
      },
      async getContainerHealth() {
        return fetchLiveOrUnavailable("ops.health.containers");
      },
      async getPostgresHealth() {
        return fetchLiveOrUnavailable("ops.health.postgres");
      },
      async getRabbitmqHealth() {
        return fetchLiveOrUnavailable("ops.health.rabbitmq");
      }
    }
  };

  function currentProvider() {
    return isConsoleIframe() ? providers.bridge : providers.sample;
  }

  window.DuneOpsProviders = {
    currentProvider,
    providers,
    // Exposed for tests and for any future provider implementation that
    // needs to construct a SourceResult envelope consistently.
    liveResult,
    previewResult,
    unavailableResult,
    partialResult
  };
}());
