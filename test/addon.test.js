import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

// ── Manifest validation ──

test("addon.json exists and is valid JSON", () => {
  const raw = read("addon.json");
  const manifest = JSON.parse(raw);
  assert.ok(manifest, "manifest should parse");
});

test("addon.json has required fields", () => {
  const manifest = JSON.parse(read("addon.json"));
  assert.ok(manifest.id, "must have id");
  assert.ok(manifest.name, "must have name");
  assert.ok(manifest.version, "must have version");
  assert.ok(manifest.entry?.path, "must have entry.path");
  assert.ok(manifest.permissions, "must have permissions");
});

test("addon.json version is semver", () => {
  const manifest = JSON.parse(read("addon.json"));
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, "version must be semver");
});

test("addon.json permissions are read-only", () => {
  const manifest = JSON.parse(read("addon.json"));
  const perms = manifest.permissions || {};
  for (const [scope, actions] of Object.entries(perms)) {
    assert.ok(Array.isArray(actions), `${scope} actions must be array`);
    for (const action of actions) {
      assert.ok(action === "read", `${scope}:${action} must be read-only`);
    }
  }
});

// ── Entry file existence ──

test("entry.path file exists", () => {
  const manifest = JSON.parse(read("addon.json"));
  assert.ok(existsSync(join(ROOT, manifest.entry.path)), `entry file ${manifest.entry.path} must exist`);
});

test("all referenced web assets exist", () => {
  // Cache-busting query strings (e.g. "addon.js?v=0.5.1") are part of the
  // asset reference, not part of the filename on disk — strip them before
  // checking existence, or every asset with a version query string will be
  // (incorrectly) reported as missing.
  const html = read("web/index.html");
  const scriptMatches = html.matchAll(/src="([^"]+)"/g);
  for (const [, src] of scriptMatches) {
    if (src.startsWith("http://") || src.startsWith("https://")) continue;
    const srcPath = src.split("?")[0];
    assert.ok(existsSync(join(ROOT, "web", srcPath)), `script ${src} must exist`);
  }
  const linkMatches = html.matchAll(/href="([^"]+\.css)"/g);
  for (const [, href] of linkMatches) {
    if (href.startsWith("http://") || href.startsWith("https://")) continue;
    const hrefPath = href.split("?")[0];
    assert.ok(existsSync(join(ROOT, "web", hrefPath)), `stylesheet ${href} must exist`);
  }
});

// ── Security: no innerHTML usage ──

test("web/addon.js does not use innerHTML", () => {
  const js = read("web/addon.js");
  assert.ok(!js.includes(".innerHTML"), "addon.js must not use innerHTML");
});

test("web/index.html does not use inline event handlers", () => {
  const html = read("web/index.html");
  assert.ok(!/\bon\w+\s*=/i.test(html), "index.html must not use inline event handlers");
});

// ── A-1: Content-Security-Policy present and does not regress ──

test("web/index.html sets a Content-Security-Policy meta tag", () => {
  const html = read("web/index.html");
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(match, "index.html must set a Content-Security-Policy meta tag");
  const csp = match[1];
  assert.match(csp, /default-src 'self'/, "default-src must be locked to same-origin");
  assert.match(csp, /connect-src 'none'/, "connect-src must be 'none' — this addon never calls fetch/XHR itself, only postMessage");
  assert.doesNotMatch(csp, /script-src[^;]*(\*|https?:)/, "script-src must never allow a wildcard or external host");
  assert.doesNotMatch(csp, /unsafe-eval/, "CSP must never allow unsafe-eval");
});

// ── Bridge security: postMessage origin checks ──

test("dune-addon-bridge.js checks event.origin", () => {
  const js = read("web/dune-addon-bridge.js");
  assert.ok(js.includes("event.origin"), "bridge must check event.origin");
});

test("dune-addon-bridge.js rejects non-iframe usage", () => {
  const js = read("web/dune-addon-bridge.js");
  assert.ok(js.includes("window.parent"), "bridge must check window.parent");
});

test("dune-addon-bridge.js has timeout", () => {
  const js = read("web/dune-addon-bridge.js");
  assert.ok(js.includes("setTimeout") || js.includes("setInterval"), "bridge must have timeout");
});

// ── Data providers: no sample fallback in bridge mode ──

test("data-providers.js returns unavailable for unimplemented bridge actions", () => {
  const js = read("web/data-providers.js");
  // Check that bridge provider does not return sample data on error
  const bridgeProvider = js.match(/bridge:\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(bridgeProvider, "bridge provider must exist");
  // Check for unavailable pattern instead of sample fallback
  assert.ok(
    js.includes('"unavailable"') || js.includes("'unavailable'") || js.includes("status.*unavailable"),
    "bridge provider must return unavailable status for failed actions"
  );
});

// ── Version consistency ──

test("version in addon.json matches index.html", () => {
  const manifest = JSON.parse(read("addon.json"));
  const html = read("web/index.html");
  const versionMatch = html.match(/r?(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    assert.equal(manifest.version, versionMatch[1], "addon.json version must match index.html version");
  }
});

// ── No hardcoded secrets ──

test("no hardcoded secrets in web files", () => {
  const secretPatterns = [
    /gho_[A-Za-z0-9]{40}/,
    /ghp_[A-Za-z0-9]{40}/,
    /xoxb-\d+-\d+-[A-Za-z0-9]+/,
    /AKIA[0-9A-Z]{16}/,
  ];
  for (const file of ["web/addon.js", "web/data-providers.js", "web/dune-addon-bridge.js", "web/addon.css"]) {
    if (!existsSync(join(ROOT, file))) continue;
    const content = read(file);
    for (const pattern of secretPatterns) {
      assert.ok(!pattern.test(content), `${file} must not contain hardcoded secrets`);
    }
  }
});
