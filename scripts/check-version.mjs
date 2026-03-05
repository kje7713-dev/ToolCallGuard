#!/usr/bin/env node
/**
 * Release safety check: verifies that the git tag matches the version in package.json.
 * Exits with code 1 if they do not match.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const packageVersion = pkg.version;

// GITHUB_REF looks like "refs/tags/v0.3.0"
const ref = process.env.GITHUB_REF ?? '';
const tagMatch = ref.match(/^refs\/tags\/v?(.+)$/);

if (!tagMatch) {
  console.error(`ERROR: Could not extract version from GITHUB_REF="${ref}"`);
  console.error('Expected format: refs/tags/v<version>');
  process.exit(1);
}

const tagVersion = tagMatch[1];

if (tagVersion !== packageVersion) {
  console.error(
    `ERROR: Tag version "${tagVersion}" does not match package.json version "${packageVersion}"`,
  );
  process.exit(1);
}

console.log(`✓ Tag version "${tagVersion}" matches package.json version "${packageVersion}"`);
