#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sha384Base64 } = require('./update-sri-hashes.js');

let errors = 0;
function check(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    errors++;
  }
}

// Read and parse manifest
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync('addon.json', 'utf8'));
} catch (e) {
  console.error('FAIL: addon.json is not valid JSON');
  process.exit(1);
}

// Required fields
for (const field of ['id', 'name', 'description', 'author', 'version', 'type']) {
  check(manifest[field], `${field} is required`);
}

check(manifest.schemaVersion === 1, 'schemaVersion must be 1');
check(manifest.type === 'ui', 'type must be ui');

// Version is semver
check(/^\d+\.\d+\.\d+$/.test(manifest.version), `version "${manifest.version}" must be semver`);

// Entry path exists
check(manifest.entry && manifest.entry.path, 'entry.path is required');
if (manifest.entry && manifest.entry.path) {
  check(fs.existsSync(manifest.entry.path), `entry.path "${manifest.entry.path}" does not exist`);
}

// Permissions are read-only
if (manifest.permissions) {
  for (const [scope, actions] of Object.entries(manifest.permissions)) {
    check(Array.isArray(actions), `permissions.${scope} must be an array`);
    if (Array.isArray(actions)) {
      for (const action of actions) {
        check(action === 'read', `permissions.${scope}["${action}"] must be read-only`);
      }
    }
  }
} else {
  check(false, 'permissions is required');
}

// Referenced web assets exist
// Cache-busting query strings (e.g. "addon.js?v=0.5.1") are part of the
// asset reference, not part of the filename on disk — strip them before
// checking existence, or every asset with a version query string will be
// (incorrectly) reported as missing.
if (manifest.entry && manifest.entry.path && fs.existsSync(manifest.entry.path)) {
  const html = fs.readFileSync(manifest.entry.path, 'utf8');
  // Scoped to actual `<script ... src="...">` tags only — a bare
  // `src="([^"]+)"` regex also matches `data-src="..."` (used by the
  // Grafana tab's lazy-loaded iframes, which intentionally point at an
  // external http://localhost:3000 URL, not a local file) and would
  // incorrectly report those external URLs as missing local scripts.
  // Confirmed via direct reproduction (issue #122) before this fix.
  const scriptTags = html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g);
  for (const [fullTag, src] of scriptTags) {
    const srcPath = src.split('?')[0];
    const fullPath = path.join(path.dirname(manifest.entry.path), srcPath);
    check(fs.existsSync(fullPath), `referenced script "${src}" does not exist`);

    // SRI drift check (issue #119): recompute the real, current file's
    // SHA-384 and compare it against index.html's own declared
    // integrity= attribute -- a mechanical, deterministic check with
    // zero false-positive risk, closing the exact gap that let 9
    // commits (6c792e9..22ad998) silently ship a non-functional addon
    // (a browser's SRI check refuses to execute a mismatched script,
    // with no visible error to a typical operator).
    if (fs.existsSync(fullPath)) {
      const integrityMatch = fullTag.match(/integrity="(sha384-[^"]+)"/);
      if (integrityMatch) {
        const declaredHash = integrityMatch[1];
        const actualHash = sha384Base64(fullPath);
        check(
          declaredHash === actualHash,
          `SRI hash drift: ${src} declares "${declaredHash}" but its real content hashes to "${actualHash}". Run "node scripts/update-sri-hashes.js" to fix.`
        );
      } else {
        check(false, `${src} has no integrity= attribute -- every local script must carry SRI (run "node scripts/update-sri-hashes.js" to add one).`);
      }
    }
  }
}

// All JS files parse cleanly
const jsFiles = [];
function findJsFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    // Skip hidden directories and node_modules
    if (f.startsWith('.') || f === 'node_modules') continue;
    const full = dir + '/' + f;
    if (fs.statSync(full).isDirectory()) findJsFiles(full);
    else if (f.endsWith('.js')) jsFiles.push(full);
  }
}
findJsFiles('web');
for (const jsFile of jsFiles) {
  try {
    const content = fs.readFileSync(jsFile, 'utf8');
    new Function(content);
  } catch (e) {
    check(false, `${jsFile} has syntax error: ${e.message}`);
  }
}

// Version consistency between addon.json and index.html
if (manifest.entry && manifest.entry.path && fs.existsSync(manifest.entry.path)) {
  const html = fs.readFileSync(manifest.entry.path, 'utf8');
  const versionMatch = html.match(/r?(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    check(versionMatch[1] === manifest.version, `version in ${manifest.entry.path} (${versionMatch[1]}) does not match addon.json (${manifest.version})`);
  }
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s)`);
  process.exit(1);
}

console.log(`Addon manifest is valid: ${manifest.id} v${manifest.version}`);
