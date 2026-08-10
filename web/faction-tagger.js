// Uses data-tagged-* to avoid conflict with :root theme data-faction
(function initFactionTagger() {
  const FACTION_KEYWORDS = {
    atreides: /atreides/i,
    harkonnen: /harkonnen/i,
  };
  const SPICE_KEYWORDS = /spice|melange/i;

  function tagElement(el, attr) {
    if (!el || el.nodeType !== 1) return;
    if (!el.hasAttribute(attr)) el.setAttribute(attr, "");
  }

  function tagRow(row, text) {
    if (!text || !row) return;
    const lower = text.toLowerCase();
    for (const [faction, re] of Object.entries(FACTION_KEYWORDS)) {
      if (re.test(lower)) {
        row.setAttribute("data-tagged-faction", faction);
        return;
      }
    }
    if (SPICE_KEYWORDS.test(lower)) row.setAttribute("data-tagged-spice", "");
  }

  function scanTableRows() {
    document.querySelectorAll("tr, .metric-card, .summary-grid, .card, article").forEach(function(row) {
      if (row.hasAttribute("data-tagged-faction") || row.hasAttribute("data-tagged-spice")) return;
      const text = (row.textContent || "").slice(0, 200);
      tagRow(row, text);
    });

    document.querySelectorAll("td, th, span, .section-heading, h2, h3, .panel-title").forEach(function(cell) {
      if (cell.hasAttribute("data-tagged-faction") || cell.hasAttribute("data-tagged-spice")) return;
      const lower = (cell.textContent || "").slice(0, 100).toLowerCase();

      if (SPICE_KEYWORDS.test(lower)) {
        cell.setAttribute("data-tagged-spice", "");
        const parentRow = cell.closest("tr");
        if (parentRow && !parentRow.hasAttribute("data-tagged-spice")) parentRow.setAttribute("data-tagged-spice", "");
      }
      for (const [faction, re] of Object.entries(FACTION_KEYWORDS)) {
        if (re.test(lower)) {
          cell.setAttribute("data-tagged-faction", faction);
          const parentRow = cell.closest("tr");
          if (parentRow && !parentRow.hasAttribute("data-tagged-faction")) parentRow.setAttribute("data-tagged-faction", faction);
          break;
        }
      }
    });
  }

  function inheritFromParent() {
    try {
      var faction = parent.document.documentElement.getAttribute("data-faction");
      if (faction) document.documentElement.setAttribute("data-tagged-faction", faction);
    } catch (e) {}
  }

  inheritFromParent();
  scanTableRows();

  var observer = new MutationObserver(function(mutations) {
    var hasNewNodes = mutations.some(function(m) { return m.addedNodes.length > 0; });
    if (hasNewNodes) setTimeout(scanTableRows, 100);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-tab"] });
})();
