import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const writeMode = process.argv.includes("--write");

function assertReleaseVersion(value) {
  const version = String(value || "").trim();
  if (!/^\d+\.\d+\.\d+[0-9A-Za-z.-]*$/.test(version)) {
    throw new Error(`[VERSIONING] invalid release version in VERSION: '${version}'`);
  }
  return version;
}

async function readUtf8(relPath) {
  return await readFile(path.join(root, relPath), "utf8");
}

async function writeUtf8(relPath, content) {
  await writeFile(path.join(root, relPath), content, "utf8");
}

async function readJson(relPath) {
  return JSON.parse(await readUtf8(relPath));
}

async function findReleaseDoc() {
  const dir = path.join(root, "docs", "V2");
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /^RELEASE_.+\.md$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en"));
  if (files.length === 0) {
    throw new Error("[VERSIONING] missing docs/V2/RELEASE_*.md");
  }
  return files[0];
}

function applyCommonReplacements(content, { releaseVersion, releaseDocRel, releaseDocName, fromVersion }) {
  let next = content;
  if (fromVersion && fromVersion !== releaseVersion) {
    const escaped = fromVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(escaped, "g"), releaseVersion);
  }
  next = next.replace(/RELEASE_[^)` \n]+\.md/g, releaseDocName);
  next = next.replace(/\[Release [^\]]+\]\(\.\/docs\/V2\/RELEASE_[^)]+\)/g, `[Release ${releaseVersion}](./${releaseDocRel})`);
  next = next.replace(
    /\[..\s*\/..\s*\/V2\/RELEASE_[^)]+\]\(\.\.\/\.\.\/V2\/RELEASE_[^)]+\)/g,
    `[../../V2/${releaseDocName}](../../V2/${releaseDocName})`
  );
  return next;
}

function normalizeReleaseDoc(content, releaseVersion) {
  let next = content;
  next = next.replace(/^#\s+Release\s+.+$/m, `# Release ${releaseVersion}`);
  if (!/^#\s+Release\s+.+$/m.test(content)) {
    next = `# Release ${releaseVersion}\n\n${next}`;
  }
  next = next.replace(/^Release\s+.+$/m, `Release ${releaseVersion}`);
  return next;
}

async function syncOrVerify(relPath, expected, drift) {
  const current = await readUtf8(relPath);
  if (current === expected) {
    return;
  }
  drift.push(relPath);
  if (writeMode) {
    await writeUtf8(relPath, expected);
  }
}

async function main() {
  const releaseVersion = assertReleaseVersion(await readUtf8("VERSION"));
  const releaseDocName = await findReleaseDoc();
  const releaseDocRel = `docs/V2/RELEASE_${releaseVersion}.md`;
  const expectedReleaseDocName = path.basename(releaseDocRel);
  const currentReleaseDocRel = `docs/V2/${releaseDocName}`;
  const releaseDocAbs = path.join(root, currentReleaseDocRel);

  const fromVersionMatch = /^RELEASE_(.+)\.md$/.exec(releaseDocName);
  const fromVersion = fromVersionMatch ? fromVersionMatch[1] : releaseVersion;

  const releaseDir = path.join(root, "docs", "V2");
  let releaseEntries = (await readdir(releaseDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^RELEASE_.+\.md$/.test(entry.name))
    .map((entry) => entry.name);
  if (releaseDocName !== expectedReleaseDocName) {
    if (!writeMode) {
      throw new Error(`[VERSIONING] drift detected: expected ${expectedReleaseDocName}, found ${releaseDocName}`);
    }
    if (releaseEntries.length !== 1) {
      throw new Error(
        `[VERSIONING] ambiguous release mapping. expected ${expectedReleaseDocName}, candidates: ${releaseEntries.join(", ")}`
      );
    }
    await rename(releaseDocAbs, path.join(root, releaseDocRel));
    releaseEntries = [expectedReleaseDocName];
  }

  if (releaseEntries.length !== 1 || releaseEntries[0] !== expectedReleaseDocName) {
    throw new Error(
      `[VERSIONING] canonical release source violated. expected exactly '${expectedReleaseDocName}', found: ${releaseEntries.join(", ")}`
    );
  }

  const drift = [];
  const targets = [
    "README.md",
    "docs/MANUEL/wiki/Home.md",
    "docs/V2/LAST_20_COMMITS.md",
    "docs/V2/ARCHITECTURE_MAP.md",
    releaseDocRel
  ];

  const pkg = await readJson("package.json");
  const expectedPackage = { ...pkg, version: releaseVersion };
  const expectedPackageText = `${JSON.stringify(expectedPackage, null, 2)}\n`;
  const currentPackageText = await readUtf8("package.json");
  if (currentPackageText !== expectedPackageText) {
    drift.push("package.json");
    if (writeMode) {
      await writeUtf8("package.json", expectedPackageText);
    }
  }

  for (const relPath of targets) {
    const current = await readUtf8(relPath);
    let expected = applyCommonReplacements(current, {
      releaseVersion,
      releaseDocRel,
      releaseDocName: expectedReleaseDocName,
      fromVersion
    });
    if (relPath === "README.md") {
      expected = expected.replace(/^Aktueller Release-Stand: `[^`]+`$/m, `Aktueller Release-Stand: \`${releaseVersion}\``);
    }
    if (relPath === releaseDocRel) {
      expected = normalizeReleaseDoc(expected, releaseVersion);
    }
    await syncOrVerify(relPath, expected, drift);
  }

  if (drift.length > 0 && !writeMode) {
    console.error("[VERSIONING] DRIFT");
    for (const item of drift) {
      console.error(`[VERSIONING] - ${item}`);
    }
    console.error("[VERSIONING] FIX: npm run versioning:sync");
    process.exit(1);
  }

  console.log(
    `[VERSIONING] ${writeMode ? "WRITTEN" : "VERIFIED"} release=${releaseVersion} files=${targets.length + 1}`
  );
}

await main();
