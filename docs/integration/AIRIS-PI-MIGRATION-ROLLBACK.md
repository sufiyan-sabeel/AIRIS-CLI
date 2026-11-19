# AIRIS × Pi — Migration and Rollback

## 1. Current state: nothing to migrate

The Pi runtime is **not** the default engine. `airis` still runs the existing AIRIS engine end to end. This milestone added a separate, opt-in layer:

```
vendor/pi/                 vendored runtime (not an AIRIS workspace member)
integration/airis-runtime  the adapter (outside packages/*)
.github/workflows/pi-runtime.yml   verifies the runtime + adapter
```

Consequences for users:

- `npm ci` in AIRIS installs the same packages as before; **AIRIS's lockfile is unchanged**.
- No CLI command, flag or configuration default changed.
- No user data, session or config format changed.

## 2. Migration path (when the Pi engine is enabled)

Deliberately staged so a user can always fall back:

1. **Opt-in flag.** Enable the Pi path with an environment variable (e.g. `AIRIS_ENGINE=pi`), defaulting to the existing engine until the end-to-end test passes with a real credential.
2. **Build prerequisite.** The Pi path requires `vendor/pi` installed *and built*. Provide `npm run setup:pi-runtime` (documented as: `cd vendor/pi && npm ci && npm run hydrate:model-data && build in topological order`).
3. **Credentials.** Pi resolves credentials from its own agent dir; AIRIS uses `~/.airis`. Until a migration exists, users must configure credentials for the Pi path separately. This is a known gap (see the security report §3).
4. **Sessions.** Existing AIRIS sessions are untouched. Pi sessions live in Pi's session store. No conversion is attempted or claimed.
5. **Rollback for users.** Unset the flag — the existing engine is still present and unchanged.

## 3. Rollback for this repository

Every piece is independently removable:

| Remove | Effect |
|---|---|
| `integration/airis-runtime/` | Adapter gone. AIRIS unaffected — it was never imported by AIRIS code. |
| `vendor/pi/` | Runtime gone. AIRIS unaffected — not a workspace member, not in AIRIS's lockfile. |
| `.github/workflows/pi-runtime.yml` | Runtime/adapter verification stops. AIRIS's own CI is independent. |
| `vendor` entries in `scripts/check-*.mjs` | Only meaningful while `vendor/` exists. |
| `docs/integration/**` | Documentation only. |

**Full rollback** = revert the integration commits on `integration/pi-runtime` (or close PR #64). Nothing in `main` has changed, because no integration PR has been merged.

**What must not be rolled back:** nothing. No AIRIS source file was modified by any milestone on this branch — verified by diffing the branch against its base for `packages/` and `src/`.

## 4. PR dependency graph

```
main
 └── #62  ci/step-0-reliability      (CI repair)
      └── #63  remediation/baseline  (Zod 4, tests, type coverage)
           └── #64  integration/pi-runtime  (Pi runtime + adapter)
```

Merge order, if approved: #62 → #63 → #64. Each is independently reviewable; #64 must not be merged before the end-to-end test passes with a real credential.
