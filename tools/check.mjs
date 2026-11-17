#!/usr/bin/env node
// Zero-dependency structural checks for the extension sources.
//
// This is not a test suite: there is no DOM to render and no logic worth
// mocking. It catches the failure modes that a CSS-only extension actually
// has — a broken stylesheet with no build step, a generated class selector
// sneaking in, a source file that is never registered, and the manifest
// drifting away from the host lists in background.js.
//
// Run with: node tools/check.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const failures = [];
const pass = (message) => console.log(`  ok  ${message}`);
const fail = (check, detail) => {
  failures.push({ check, detail });
  console.log(`  FAIL  ${check}`);
  for (const line of [].concat(detail)) console.log(`        ${line}`);
};

// ---- JavaScript syntax ---------------------------------------------------
const JS_FILES = ['src/background.js', 'src/content.js'];

for (const file of JS_FILES) {
  try {
    execFileSync(process.execPath, ['--check', join(ROOT, file)], { stdio: 'pipe' });
  } catch (error) {
    fail(`JS syntax: ${file}`, String(error.stderr || error).trim().split('\n').slice(0, 4));
  }
}
if (!failures.length) pass(`JS syntax (${JS_FILES.length} files)`);

// ---- JSON documents ------------------------------------------------------
const JSON_FILES = ['manifest.json', 'release-please-config.json', '.release-please-manifest.json'];
const json = {};

for (const file of JSON_FILES) {
  try {
    json[file] = JSON.parse(read(file));
  } catch (error) {
    fail(`JSON: ${file}`, error.message);
  }
}
if (!failures.length) pass(`JSON (${JSON_FILES.length} files)`);

const manifest = json['manifest.json'];
const releaseManifest = json['.release-please-manifest.json'];

// ---- CSS structure -------------------------------------------------------
// Strip comments and strings so braces inside `content: "}"` or in prose do
// not count, then balance every block and paren.
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length));
}

function stripStrings(text) {
  let out = '';
  let quote = null;
  let escaped = false;
  for (const char of text) {
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      out += ' ';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      out += ' ';
      continue;
    }
    out += char;
  }
  return out;
}

function walkFiles(dir, extension, found = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walkFiles(path, extension, found);
    else if (entry.endsWith(extension)) found.push(path);
  }
  return found;
}

const cssFiles = walkFiles(join(ROOT, 'src'), '.css').map((path) => relative(ROOT, path)).sort();
const cssProblems = [];

for (const file of cssFiles) {
  const code = stripComments(read(file));
  const stack = [];
  let quote = null;
  let escaped = false;

  for (let i = 0; i < code.length; i += 1) {
    const char = code[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, index: i });
      continue;
    }
    if (char === '}' || char === ')' || char === ']') {
      const expected = { '}': '{', ')': '(', ']': '[' }[char];
      const open = stack.pop();
      if (!open || open.char !== expected) {
        cssProblems.push(`${file}:${lineOf(code, i)} unmatched "${char}"`);
        break;
      }
    }
  }

  if (quote) cssProblems.push(`${file}: unterminated string`);
  if (stack.length) {
    const open = stack[stack.length - 1];
    cssProblems.push(`${file}:${lineOf(code, open.index)} unclosed "${open.char}"`);
  }

  const selectors = stripStrings(code);
  for (const match of selectors.matchAll(/\.(?:css|ooa|sc)-[A-Za-z0-9_-]+/g)) {
    cssProblems.push(`${file}:${lineOf(selectors, match.index)} generated class selector "${match[0]}"`);
  }
}

if (cssProblems.length) fail('CSS structure', cssProblems);
else pass(`CSS structure (${cssFiles.length} files, no generated selectors)`);

// ---- background.js registrations ----------------------------------------
const background = read('src/background.js');
const start = background.indexOf('const SITES = [');
const arrayStart = background.indexOf('[', start);
let arrayEnd = -1;
let depth = 0;
let inString = null;
let stringEscaped = false;

if (start !== -1 && arrayStart !== -1) {
  for (let i = arrayStart; i < background.length; i += 1) {
    const char = background[i];
    if (inString) {
      if (stringEscaped) stringEscaped = false;
      else if (char === '\\') stringEscaped = true;
      else if (char === inString) inString = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      inString = char;
      continue;
    }
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }
}

let sites = [];
if (arrayEnd === -1) {
  fail('background.js', 'could not locate the SITES array');
} else {
  try {
    sites = vm.runInNewContext(background.slice(arrayStart, arrayEnd + 1), Object.create(null));
  } catch (error) {
    fail('background.js', `SITES array is not a plain literal: ${error.message}`);
  }
}

if (sites.length) {
  const registered = new Set([manifest.background.service_worker]);

  for (const site of sites) {
    for (const file of [...site.css, ...site.js]) {
      registered.add(file);
      try {
        statSync(join(ROOT, file));
      } catch {
        fail(`registration: ${site.id}`, `missing file ${file}`);
      }
    }
  }

  const orphans = walkFiles(join(ROOT, 'src'), '.js')
    .concat(cssFiles)
    .map((path) => relative(ROOT, path))
    .filter((path) => !registered.has(path));

  if (orphans.length) fail('registration', `unregistered source files: ${orphans.join(', ')}`);
  else pass(`registrations (${registered.size} files, none orphaned)`);

  // Host lists: manifest.host_permissions and SITES[].hosts must be the same
  // set. Both files say so in comments; this is the check that keeps them so.
  const manifestHosts = new Set(manifest.host_permissions.map((pattern) => pattern.replace(/^\*:\/\//, '').replace(/\/\*$/, '')));
  const siteHosts = new Set(sites.flatMap((site) => site.hosts));
  const missing = [...siteHosts].filter((host) => !manifestHosts.has(host));
  const extra = [...manifestHosts].filter((host) => !siteHosts.has(host));

  if (missing.length || extra.length) {
    fail('host permissions', [
      missing.length ? `in background.js but not manifest.json: ${missing.join(', ')}` : '',
      extra.length ? `in manifest.json but not background.js: ${extra.join(', ')}` : '',
    ].filter(Boolean));
  } else {
    pass(`host permissions (${manifestHosts.size} hosts in sync)`);
  }
}

// ---- release metadata ----------------------------------------------------
if (manifest && releaseManifest) {
  const recorded = releaseManifest['.'];
  if (recorded !== manifest.version) {
    fail('version', `manifest.json is ${manifest.version} but .release-please-manifest.json records ${recorded}`);
  } else {
    pass(`version (${manifest.version})`);
  }
}

// ---- result --------------------------------------------------------------
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll checks passed.');
