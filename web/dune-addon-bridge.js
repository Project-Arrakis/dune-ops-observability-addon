(function () {
  const addonId = document.documentElement.dataset.addonId || "dune-ops-observability";
  const pending = new Map();

  function request(action, payload = {}) {
    if (window.parent === window) {
      return Promise.reject(new Error("Bridge unavailable outside Dune Docker Console."));
    }
    const requestId = `${Date.now()}-${crypto.randomUUID()}`;
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      window.parent.postMessage({ type: "dune-addon-request", addonId, requestId, action, payload }, window.location.origin);
      window.setTimeout(() => {
        const item = pending.get(requestId);
        if (!item) return;
        pending.delete(requestId);
        item.reject(new Error("Bridge request timed out."));
      }, 30000);
    });
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== window.parent) return;
    const message = event.data || {};
    if (message.type !== "dune-addon-response") return;
    if (message.addonId && message.addonId !== addonId) return;
    if (!message.requestId) return;
    if (typeof message.ok !== "boolean") return;
    const item = pending.get(message.requestId);
    if (!item) return;
    pending.delete(message.requestId);
    if (message.ok) item.resolve(message.result);
    else item.reject(new Error(message.error || "Bridge request failed."));
  });

  window.DuneAddon = { request };
})();
