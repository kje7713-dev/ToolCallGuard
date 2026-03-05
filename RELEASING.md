# Releasing toolcallguard

## Requirements

- npm account with publish access to the `toolcallguard` package
- GitHub repository secret `NPM_TOKEN` set to an npm **Automation** token (not a Publish token — automation tokens bypass 2FA)

### Setting NPM_TOKEN

1. Go to [npmjs.com](https://www.npmjs.com) → **Access Tokens** → **Generate New Token** → choose **Automation**.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `NPM_TOKEN`
   - Value: the token from step 1.

---

## Cutting a release

1. **Bump the version** in `package.json` (follow semver):

   ```bash
   npm version patch   # 0.3.0 → 0.3.1
   # or: npm version minor / npm version major
   git push origin main
   ```

2. **Create and push the tag** (must match `package.json` version exactly):

   ```bash
   git tag v0.3.1
   git push origin v0.3.1
   ```

3. The `Release` GitHub Actions workflow triggers automatically on the `v*` tag.

---

## Manual Release (GitHub UI)

You can also trigger a release manually without pushing a tag:

1. Go to the repository on GitHub.
2. Click **Actions**.
3. Select the **Release** workflow.
4. Click **Run workflow**.

> **Note:** When triggering manually, the tag/version consistency check is skipped (it only applies to tag-based releases). Ensure `package.json` is already bumped and pushed to the correct branch before running manually.

---

## What the workflow does

`.github/workflows/release.yml`:

1. Checks out the repository.
2. Configures Node.js with the npm registry (`https://registry.npmjs.org`).
3. Runs `npm ci` to install dependencies.
4. Verifies the git tag version matches `package.json` (`scripts/check-version.mjs`) — **tag-based releases only**.
5. Runs `npm run build` to produce the `dist/` output.
6. Verifies the `dist/` folder exists — exits with an error if the build produced no artifacts.
7. Checks `NODE_AUTH_TOKEN` is set (`scripts/verify-release-env.mjs`) — exits early with a clear error if not.
8. Runs `npm publish --access public` authenticated via `NODE_AUTH_TOKEN`.

---

## Verifying the publish

After the workflow completes:

```bash
npm view toolcallguard versions --json
```

Or visit: https://www.npmjs.com/package/toolcallguard

---

## Common failure modes

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Token missing, expired, or wrong type | Regenerate an Automation token and update the secret |
| `403 Forbidden` | Token does not have publish access to this package | Ensure the npm account owns the package and the token has write scope |
| `E403 — You cannot publish over the previously published versions` | Version already exists on npm | Bump `package.json` version before tagging |
| `E404 — Package name not available` | Package name is taken on npm | Rename the package in `package.json` |
| `Cannot find module dist/...` | Build failed or `dist/` not produced | Check `npm run build` locally; ensure `tsup` config is correct |
| `Tag version "X" does not match package.json version "Y"` | Tag and `package.json` are out of sync | Re-tag after bumping the version |
| `NODE_AUTH_TOKEN is not set` | Secret not configured or not wired | Add `NPM_TOKEN` secret and ensure `env: NODE_AUTH_TOKEN` is in the workflow |
