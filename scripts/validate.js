#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
  // Match only actual <script src="..."> tags, not any element with a
  // src-like attribute (e.g. <iframe data-src="http://..."> for lazily-
  // loaded, cross-origin Grafana embeds — those are never local files and
  // must not be checked for local existence). A previous, broader
  // /src="([^"]+)"/ regex incorrectly matched the "src=" substring inside
  // "data-src=", reporting Grafana dashboard URLs as missing local scripts.
  const scriptMatches = html.matchAll(/<script[^>]+\bsrc="([^"]+)"/g);
  for (const [, src] of scriptMatches) {
    const srcPath = src.split('?')[0];
    const fullPath = path.join(path.dirname(manifest.entry.path), srcPath);
    check(fs.existsSync(fullPath), `referenced script "${src}" does not exist`);
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
