# PROMPT: ACP Bot Alert & Monitoring Enhancements

**Severity:** HIGH | **Repo:** arrakis-control-panel  
**Dependencies:** Alertmanager (PROMPT-08) for Discord alert relay  
**Core Changes Required:** None  
**Timeout estimate:** 3-4 hours

## Context

The ACP bot already polls Core for readiness and service status every 5 minutes and
alerts to a configured Discord channel. But the alerting is minimal — only 3 check
types. A NOC/SOC dashboard needs the bot to be the **primary alert relay** from
Prometheus/Alertmanager → Discord, plus add game-level health checks.

## Task 1: Add Alertmanager → Discord Relay Endpoint

**Problem:** Alertmanager sends webhook payloads in its own format. Discord expects
`{ content, embeds }`. Need a translation layer.

**Solution:** Add a new Express route in `setupServer.js` (port 3100, already behind
Cloudflare Tunnel at `acp-setup.darkdante.org`):

```js
// POST /api/alerts/relay — receives Alertmanager webhook, reformats for Discord
app.post('/api/alerts/relay', express.json(), async (req, res) => {
  const payload = req.body;
  if (!payload || !payload.alerts) return res.status(400).json({ error: "Invalid payload" });

  const embeds = payload.alerts.map(alert => ({
    title: `${alert.status === 'firing' ? '🔥' : '✅'} ${alert.labels.alertname}`,
    description: alert.annotations.description || alert.annotations.summary || '',
    color: alert.labels.severity === 'critical' ? 0xe74c3c : 0xf39c12,
    fields: [
      { name: 'Instance', value: alert.labels.instance || 'unknown', inline: true },
      { name: 'Severity', value: alert.labels.severity || 'unknown', inline: true },
      { name: 'Started', value: alert.startsAt, inline: false }
    ],
    timestamp: alert.startsAt
  }));

  // Post to the configured alert channel
  const webhookUrl = process.env.DUNE_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return res.status(200).json({ ok: true, skipped: "no webhook configured" });

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds })
  });

  res.json({ ok: true, alerts: payload.alerts.length });
});
```

Update the Alertmanager config to point at this relay:
```yaml
receivers:
  - name: 'discord-relay'
    webhook_configs:
      - url: 'https://acp-setup.darkdante.org/api/alerts/relay'
        send_resolved: true
```

This approach means: Alertmanager → bot's Express server → Discord webhook.
The bot handles the JSON reformatting. No additional services needed.

## Task 2: Add Game-Level Health Checks to Bot Alert Subscriber

**Current state (notifications.js):** Checks `readiness` and `services` every 5 min.

**Add these checks:**

| # | Check | Source | Threshold | Alert Text |
|---|---|---|---|---|
| 1 | Population zero | `adapterClient.opsActivity()` → `onlinePlayers` | `=== 0` | "⚠️ Server has zero online players" |
| 2 | Population spike/drop | Compare `onlinePlayers` vs previous check | 50% change | "📊 Player count changed significantly: {before} → {after}" |
| 3 | Spice fields depleted | `adapterClient.opsResources()` → both maps | All instances `activeFields === 0` | "🌶️ All spice fields are depleted across all maps" |
| 4 | DB health | `adapterClient.dbHealth()` | Returns unhealthy | "🗄️ Database health check failed" |
| 5 | Bridge errors spike | `adapterClient.opsSoc()` → `bridgeErrors` | >5 in window | "🔌 Console bridge error rate elevated: {n} errors" |

Each check should:
1. Only fire when `DUNE_ALERT_CHANNEL_ID` is configured
2. Have a cooldown (don't re-alert the same condition for 30 min)
3. Log to the bot's audit log
4. Be individually disable-able via env vars

## Task 3: Add `/dune ops alerts` Slash Command

**New command:** `/dune ops alerts` — Shows current active Prometheus alerts.

**Implementation:**
1. Query Prometheus API: `GET http://dune-prometheus:9090/api/v1/alerts` (when accessible from bot container)
2. Or read from the Alertmanager API: `GET http://dune-alertmanager:9093/api/v2/alerts`
3. Format as a Discord embed with:
   - Firing alerts grouped by severity (critical first)
   - Each alert: name, instance, duration, summary
   - Footer: "22 alert rules active | Alerts refresh every 15s"

**Permissions:** `ops:read` (existing observer role)

## Task 4: Add Daily Digest Message

**New scheduled task:** Post a daily summary to the alert channel at a configurable time.

**Content:**
```
📊 Daily Server Digest — {date}

Players: {total} total, {online} online ({(online/total*100)}%)
New players (7d): {newPlayers}
Active players (24h): {active24h}

Combat: {totalDeaths} deaths in 24h
Economy: {totalSupply} Solaris in circulation ({holders} holders)

Infrastructure:
  CPU: {cpuPercent}% | Memory: {memoryPercent}%
  Postgres: {pgStatus} | RabbitMQ: {rmqStatus}
  Active alerts: {activeAlertCount}

Full dashboard: https://console.darkdante.org
Grafana: https://grafana.darkdante.org
```

## Verification

- [ ] Alertmanager webhook → Discord relay works end-to-end
- [ ] Test alert fires → Discord message appears within 30s
- [ ] Resolved alert sends follow-up message
- [ ] `/dune ops alerts` shows current Prometheus alerts
- [ ] Population zero alert fires when server empties
- [ ] Daily digest posts at configured time
- [ ] All new checks respect cooldowns and are individually disable-able
