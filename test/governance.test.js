import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CHECKER = join(ROOT, "scripts", "check-bridge-action-drift.js");
const VERSION_CHECKER = join(ROOT, "scripts", "check-version-consistency.js");
const VALIDATE_SCRIPT = join(ROOT, "scripts", "validate.js");

// These tests exercise the checker itself against disposable fixture
// repos, per docs/prompts/PHASE-4-GOVERNANCE-AUTOMATION.md's own
// verification standard ("test the checker itself, not just run it
// once and trust it forever") -- they must fail if a 10th bridge
// action is added to data-providers.js without updating README.md,
// and vice versa. They never touch this repository's real
// README.md/web/data-providers.js.

function makeFixture({
  dataProvidersSrc,
  readmeSrc,
  addonJsonVersion,
  packageJsonVersion,
  indexHtmlVersion,
}) {
  const dir = mkdtempSync(join(tmpdir(), "governance-test-"));
  const webDir = join(dir, "web");
  execFileSync("mkdir", ["-p", webDir]);
  writeFileSync(join(webDir, "data-providers.js"), dataProvidersSrc, "utf8");
  writeFileSync(join(dir, "README.md"), readmeSrc, "utf8");
  if (addonJsonVersion !== undefined) {
    writeFileSync(
      join(dir, "addon.json"),
      JSON.stringify({ version: addonJsonVersion }),
      "utf8"
    );
  }
  if (packageJsonVersion !== undefined) {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ version: packageJsonVersion }),
      "utf8"
    );
  }
  if (indexHtmlVersion !== undefined) {
    writeFileSync(
      join(webDir, "index.html"),
      `<h1>Test <span class="release-version">r${indexHtmlVersion}</span></h1>`,
      "utf8"
    );
  }
  return dir;
}

function runChecker(fixtureDir, checkerScript = CHECKER) {
  try {
    const out = execFileSync("node", [checkerScript], {
      cwd: fixtureDir,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: (err.stdout || "") + (err.stderr || "") };
  }
}

// extractCodeActions/extractReadmeActions both accept an explicit
// repoRoot parameter (defaulting to this repo's real root), so tests
// can point them at a disposable fixture directory instead of this
// repository's real README.md/web/data-providers.js.
const { extractCodeActions, extractReadmeActions } = await import(CHECKER);

const VALID_README = `# Test

Current bridge-backed actions (as called by \`web/data-providers.js\`, verified against Core's \`console/api/src/server.js\` route table):

| Action | Status in Core | Panel |
|---|---|---|
| \`ops.health.summary.v2\` / \`.players\` / \`.farms\` | Live | OPS Health |
| \`ops.activity.summary\` | Live | Activity |

Some trailing prose after the table.
`;

const VALID_DATA_PROVIDERS = `
bridgeRequest("ops.health.summary.v2");
bridgeRequest("ops.health.players");
bridgeRequest("ops.health.farms");
fetchLiveOrUnavailable("ops.activity.summary");
`;

test("drift checker passes when README and code agree", () => {
  const dir = makeFixture({
    dataProvidersSrc: VALID_DATA_PROVIDERS,
    readmeSrc: VALID_README,
  });
  try {
    const code = extractCodeActions(dir);
    const readme = extractReadmeActions(dir);
    assert.deepEqual(
      [...code].sort(),
      [...readme].sort(),
      "code and README action sets must match on valid fixtures"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("drift checker's REAL invocation (via `node scripts/check-bridge-action-drift.js`) passes against this repo's actual current README.md and web/data-providers.js", () => {
  const result = runChecker(ROOT);
  assert.equal(
    result.code,
    0,
    `expected the real repo's README/code to already be in sync; got:\n${result.out}`
  );
});

test("drift checker detects a bridge action added to code but not documented in README", () => {
  const dir = makeFixture({
    dataProvidersSrc:
      VALID_DATA_PROVIDERS + '\nfetchLiveOrUnavailable("ops.fake.newaction");\n',
    readmeSrc: VALID_README,
  });
  try {
    const code = extractCodeActions(dir);
    const readme = extractReadmeActions(dir);
    const missingFromReadme = [...code].filter((a) => !readme.has(a));
    assert.deepEqual(
      missingFromReadme,
      ["ops.fake.newaction"],
      "a code-only action must be flagged as missing from README"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("drift checker detects a README row with no corresponding code call", () => {
  // Insert the extra row inside the table (immediately after the last
  // real row), not appended after the table's trailing prose -- the
  // checker deliberately stops scanning once the table ends, so a row
  // added after prose would be unreachable by design, not a real test
  // of "missing from code" detection.
  const readmeWithExtraRow = VALID_README.replace(
    "| `ops.activity.summary` | Live | Activity |\n",
    "| `ops.activity.summary` | Live | Activity |\n| `ops.fake.docsonly` | Live | Nowhere |\n"
  );
  const dir = makeFixture({
    dataProvidersSrc: VALID_DATA_PROVIDERS,
    readmeSrc: readmeWithExtraRow,
  });
  try {
    const code = extractCodeActions(dir);
    const readme = extractReadmeActions(dir);
    const missingFromCode = [...readme].filter((a) => !code.has(a));
    assert.deepEqual(
      missingFromCode,
      ["ops.fake.docsonly"],
      "a README-only action must be flagged as missing from code"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("drift checker throws a clear error if README's bridge-action section is missing entirely", () => {
  const dir = makeFixture({
    dataProvidersSrc: VALID_DATA_PROVIDERS,
    readmeSrc: "# Test\n\nNo bridge-action table here at all.\n",
  });
  try {
    assert.throws(
      () => extractReadmeActions(dir),
      /Current bridge-backed actions/,
      "should fail loudly, not silently return an empty/wrong set"
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Version consistency (Phase 4 item 2) ──

const { extractVersions, checkMutualConsistency } = await import(
  VERSION_CHECKER
);
const { updateSriHashes, sha384Base64 } = await import(
  join(ROOT, "scripts", "update-sri-hashes.js")
);

test("version checker passes when addon.json, package.json, and index.html all agree", () => {
  const dir = makeFixture({
    dataProvidersSrc: VALID_DATA_PROVIDERS,
    readmeSrc: VALID_README,
    addonJsonVersion: "1.2.3",
    packageJsonVersion: "1.2.3",
    indexHtmlVersion: "1.2.3",
  });
  try {
    const versions = extractVersions(dir);
    const errors = checkMutualConsistency(versions);
    assert.deepEqual(errors, [], "matching versions must produce no errors");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("version checker's REAL invocation passes against this repo's actual current addon.json/package.json/web/index.html", () => {
  const result = runChecker(ROOT, VERSION_CHECKER);
  assert.equal(
    result.code,
    0,
    `expected the real repo's three version sources to already agree; got:\n${result.out}`
  );
});

test("version checker detects package.json drifting from addon.json", () => {
  const dir = makeFixture({
    dataProvidersSrc: VALID_DATA_PROVIDERS,
    readmeSrc: VALID_README,
    addonJsonVersion: "1.2.3",
    packageJsonVersion: "1.2.0",
    indexHtmlVersion: "1.2.3",
  });
  try {
    const versions = extractVersions(dir);
    const errors = checkMutualConsistency(versions);
    assert.equal(errors.length, 1, "a mismatched package.json must be flagged");
    assert.match(errors[0], /1\.2\.0/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("version checker detects index.html drifting from addon.json/package.json", () => {
  const dir = makeFixture({
    dataProvidersSrc: VALID_DATA_PROVIDERS,
    readmeSrc: VALID_README,
    addonJsonVersion: "1.2.3",
    packageJsonVersion: "1.2.3",
    indexHtmlVersion: "1.0.0",
  });
  try {
    const versions = extractVersions(dir);
    const errors = checkMutualConsistency(versions);
    assert.equal(errors.length, 1, "a mismatched index.html version must be flagged");
    assert.match(errors[0], /1\.0\.0/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- SRI hash drift + <script src> vs data-src regression tests -----------
// (issue #119, issue #122). Both bugs together let 9 commits
// (6c792e9..22ad998) ship a completely non-functional addon undetected --
// these tests exist so neither class of bug can silently regress.

function makeValidateFixture({ scriptContent = "console.log('hi');", integrity, includeGrafanaDataSrc = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "validate-test-"));
  const webDir = join(dir, "web");
  execFileSync("mkdir", ["-p", webDir]);
  writeFileSync(join(webDir, "foo.js"), scriptContent, "utf8");
  writeFileSync(
    join(dir, "addon.json"),
    JSON.stringify({
      schemaVersion: 1,
      id: "test-addon",
      name: "Test",
      description: "test",
      author: "test",
      version: "1.0.0",
      type: "ui",
      entry: { navigation: "Test", path: "web/index.html" },
      permissions: { ops: ["read"] },
    }),
    "utf8"
  );
  const integrityAttr = integrity ? ` integrity="${integrity}"` : "";
  const grafanaDataSrc = includeGrafanaDataSrc
    ? `<img class="grafana-embed" data-src="http://localhost:3000/d-solo/test-dashboard?orgId=1" />`
    : "";
  // webDir is always mkdtempSync-generated above, never externally
  // controlled -- not a real XSS/script-tag-injection sink (same
  // rationale already established for the identical pattern in
  // makeFixture(), above).
  writeFileSync(
    join(webDir, "index.html"), // nosemgrep
    `<!DOCTYPE html><html><body>v1.0.0\n${grafanaDataSrc}\n<script src="foo.js"${integrityAttr}></script>\n</body></html>`,
    "utf8"
  );
  return dir;
}

function runValidate(fixtureDir) {
  try {
    const out = execFileSync("node", [VALIDATE_SCRIPT], {
      cwd: fixtureDir,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: (err.stdout || "") + (err.stderr || "") };
  }
}

test("validate.js's REAL invocation passes against this repo's actual current web/index.html (SRI hashes genuinely up to date)", () => {
  const result = runChecker(ROOT, VALIDATE_SCRIPT);
  assert.equal(
    result.code,
    0,
    `expected the real repo's SRI hashes to already be correct; got:\n${result.out}`
  );
});

test("validate.js detects SRI hash drift (issue #119 regression test)", () => {
  const dir = makeValidateFixture({ integrity: "sha384-DELIBERATELY-WRONG-HASH" });
  try {
    const realHash = sha384Base64(join(dir, "web", "foo.js"));
    const result = runValidate(dir);
    assert.equal(result.code, 1, "a mismatched SRI hash must fail validation");
    assert.match(result.out, /SRI hash drift/);
    assert.match(result.out, new RegExp(realHash.replace(/[+/]/g, "\\$&")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validate.js passes when SRI hash genuinely matches the real file content", () => {
  // Two-step: write the fixture once to learn the real hash of its own
  // script content, then rebuild it with that exact hash declared --
  // avoids hardcoding a hash literal that would silently stop being a
  // real test of "matches" the moment scriptContent's default changes.
  const probeDir = makeValidateFixture();
  const realHash = sha384Base64(join(probeDir, "web", "foo.js"));
  rmSync(probeDir, { recursive: true, force: true });

  const dir = makeValidateFixture({ integrity: realHash });
  try {
    const result = runValidate(dir);
    assert.equal(result.code, 0, `expected a correct SRI hash to pass; got:\n${result.out}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validate.js does not mistake a Grafana data-src attribute for a missing local script (issue #122 regression test)", () => {
  const probeDir = makeValidateFixture();
  const realHash = sha384Base64(join(probeDir, "web", "foo.js"));
  rmSync(probeDir, { recursive: true, force: true });

  const dir = makeValidateFixture({ integrity: realHash, includeGrafanaDataSrc: true });
  try {
    const result = runValidate(dir);
    assert.equal(
      result.code,
      0,
      `a data-src attribute pointing at an external http:// URL must not be treated as a missing local script; got:\n${result.out}`
    );
    assert.doesNotMatch(result.out, /does not exist/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("update-sri-hashes.js's REAL invocation is a no-op against this repo's actual current web/index.html", () => {
  // Confirms the real file is already fully up to date -- running the
  // updater again must report zero changes, not silently rewrite
  // something. Restores the file from its pre-test content afterward
  // in case the assertion itself is ever wrong (defense in depth --
  // updateSriHashes should already no-op when nothing changed).
  const realIndexHtml = join(ROOT, "web", "index.html");
  const before = readFileSync(realIndexHtml, "utf8");
  try {
    const updates = updateSriHashes(realIndexHtml);
    assert.deepEqual(updates, [], "expected zero SRI updates needed against the real, already-correct repo state");
  } finally {
    const after = readFileSync(realIndexHtml, "utf8");
    if (after !== before) {
      writeFileSync(realIndexHtml, before, "utf8");
    }
  }
});
