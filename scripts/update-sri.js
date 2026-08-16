#!/usr/bin/env node
// update-sri.js
//
// Regenerates web/index.html's <script src="...?v=TIMESTAMP"
// integrity="sha384-..."> tags from the real, current content of the
// files they reference, and bumps every cache-buster query string
// (`?v=<unix-seconds>`, including the <link rel="stylesheet"> tag) to
// the same "now" timestamp.
//
// This exists because these hashes were previously hand-maintained --
// which is the direct, confirmed root cause of GitHub issue #119 (the
// addon shipping completely non-functional because nine commits'
// worth of web/addon.js and web/data-providers.js edits were never
// followed by a hash regeneration). Run this any time
// web/addon.js, web/data-providers.js, web/faction-tagger.js,
// web/dune-addon-bridge.js, or web/addon.css changes, then run
// `node scripts/check-sri-integrity.js` (or `npm test`, which includes
// the equivalent governance test) to confirm.
//
// Usage: node scripts/update-sri.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(REPO_ROOT, 'web');
const INDEX_HTML_PATH = path.join(WEB_DIR, 'index.html');

function computeSha384Base64(filePath) {
  const buf = fs.readFileSync(filePath); // nosemgrep
  return crypto.createHash('sha384').update(buf).digest('base64');
}

function main() {
  let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8'); // nosemgrep
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Bump the <link rel="stylesheet"> cache-buster (no integrity attribute
  // on this tag today, so only the query string needs updating).
  html = html.replace(
    /(<link\s+rel="stylesheet"\s+href="addon\.css\?v=)\d+(")/,
    `$1${nowSeconds}$2`
  );

  // Regenerate every <script src="foo.js?v=OLD" integrity="sha384-OLD">
  // tag: recompute the real hash of web/foo.js and bump the cache-buster
  // to the same timestamp used above, so every asset on the page is
  // invalidated together (matches this project's existing convention --
  // see the "bump all cache-busters" commit history on this file).
  const scriptTagRe =
    /<script\s+src="([^"?]+)(?:\?[^"]*)?"\s+integrity="sha384-[^"]+"><\/script>/g;

  let updatedCount = 0;
  html = html.replace(scriptTagRe, (fullMatch, file) => {
    // `file` comes from parsing this repo's own committed, PR-reviewed
    // web/index.html via scriptTagRe above, never from CLI args, env
    // vars, or network/user input -- this script has no external input
    // surface at all (see the file-level comment: `node scripts/update-sri.js`
    // with no arguments).
    const filePath = path.join(WEB_DIR, file); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `update-sri.js: web/index.html references "${file}" but web/${file} does not exist -- refusing to write a hash for a nonexistent file.`
      );
    }
    const hash = computeSha384Base64(filePath);
    updatedCount += 1;
    return `<script src="${file}?v=${nowSeconds}" integrity="sha384-${hash}"></script>`;
  });

  fs.writeFileSync(INDEX_HTML_PATH, html); // nosemgrep

  console.log(
    `update-sri.js: regenerated ${updatedCount} script tag(s) and bumped cache-busters to v=${nowSeconds} in web/index.html.`
  );
}

if (require.main === module) {
  main();
}

module.exports = { computeSha384Base64 };
