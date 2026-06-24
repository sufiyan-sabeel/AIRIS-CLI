# Release Checklist

Use this checklist when preparing a new AIRIS release.

## Pre-Release

- [ ] All planned features for this milestone are complete
- [ ] All tests pass: `./test.sh`
- [ ] Formatting and type checks pass: `npm run check`
- [ ] Build succeeds: `npm run build`
- [ ] CHANGELOG.md updated for each package under `[Unreleased]`
- [ ] Version bumped consistently across all packages
- [ ] No uncommitted changes (clean working tree)
- [ ] No API keys, tokens, or private data in commits

## Release Steps

1. **Update CHANGELOGs**
   - Run `/cl` prompt on latest commit to audit entries
   - Ensure `[Unreleased]` sections are accurate

2. **Local smoke test**
   ```bash
   npm run release:local -- --out /tmp/airis-local-release --force
   cd /tmp
   /tmp/airis-local-release/node/airis --help
   /tmp/airis-local-release/node/airis --version
   /tmp/airis-local-release/node/airis -p "Say exactly: ok"
   /tmp/airis-local-release/bun/airis --help
   /tmp/airis-local-release/bun/airis --version
   ```

3. **Run release script**
   ```bash
   PI_ALLOW_LOCKFILE_CHANGE=1 npm_config_min_release_age=0 npm run release:patch
   ```

4. **Verify tag was pushed**
   ```bash
   git log --oneline -5
   git tag -l 'v*'
   ```

## Post-Release

- [ ] CI build-binaries workflow succeeds
- [ ] npm packages published (OIDC trusted publishing)
- [ ] GitHub Release created with changelog
- [ ] Binary downloads available for all platforms
- [ ] Verify `npm install -g @sufiyan-sabeel/airis-cli` works
- [ ] Update documentation site if needed

## Rollback Plan

If CI publish fails:
1. Inspect the failed `publish-npm` job
2. Fix the issue
3. Rerun the tag workflow (publish helper is idempotent)
4. Do NOT rerun `npm run release:patch` for the same version

## GitHub Release Checklist

- [ ] Release title: `vX.Y.Z`
- [ ] Release notes from CHANGELOG
- [ ] Binary assets attached:
  - `airis-darwin-arm64.tar.gz`
  - `airis-darwin-x64.tar.gz`
  - `airis-linux-x64.tar.gz`
  - `airis-linux-arm64.tar.gz`
  - `airis-windows-x64.zip`
  - `airis-windows-arm64.zip`
- [ ] Mark as latest (if appropriate)

## Social Preview

- Size: 1280x640 pixels
- Orange AIRIS emblem on dark background
- Version number visible
- Tagline: "AI coding agent for your terminal"
