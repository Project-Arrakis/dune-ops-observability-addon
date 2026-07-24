# Implementation Prompt — Players tab

**Status: the defect this prompt originally targeted has been resolved, and the panel it concerned has since been removed entirely.** Read `docs/tabs/PLAYERS.md` §1.2 for the full lifecycle before assuming anything about this tab's "KPI Capability" panel — it no longer exists.

## Summary of what happened (see docs/tabs/PLAYERS.md §1.2 for detail)

1. The "KPI Capability" panel was originally entirely static/fabricated (all rows hardcoded `supported`, including a permanently-false "Location & Territory" claim).
2. It was fixed to be dynamic and honest (Tier 2.1, PR #71) — real per-source status, Location row removed, SOC/Metrics rows added.
3. On further review the same day, the panel itself was judged low-value even once honest — it showed cross-tab data-source health (Combat/Economy/SOC/Metrics status) on the Players tab specifically, which doesn't belong there. It was removed entirely (Tier 2.6 follow-up), not just re-fixed.

No further action is needed on this tab related to a capability panel. If a similar "what's live right now" summary is ever wanted again, it belongs on the Diagnostics tab, not Players — see `docs/tabs/PLAYERS.md` §1.2 and §3 for the reasoning.
