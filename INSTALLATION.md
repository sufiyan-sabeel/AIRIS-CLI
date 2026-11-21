# Installation Reference

## Commands

`install.sh` and `install.ps1` share one command set.

| Command | What it does |
|---|---|
| `install` (default) | Install the latest stable release |
| `update` / `upgrade` | Install the newest release, keeping older versions for rollback |
| `rollback` | Switch the launcher back to the previously installed version |
| `repair` | Re-create the launcher and run `doctor` |
| `doctor` | Diagnose the installation (version, paths, PATH, binary runs) |
| `version` | Print the installed version |
| `list` | List installed versions (`*` marks the active one) |
| `uninstall` | Remove the binary and versions; configuration is kept |

## Options

| Option | Meaning |
|---|---|
| `--version <v>` | Install a specific release (`0.79.9` or `v0.79.9`) |
| `--channel stable\|nightly` | Release channel (default `stable`) |
| `--prefix <dir>` | Install root (default `~/.local/share/airis`) |
| `--bin-dir <dir>` | Launcher directory (default `~/.local/bin`) |
| `--allow-unverified` | Proceed when a release publishes no checksums |
| `--no-modify-path` | Do not touch shell configuration |
| `--purge` | With `uninstall`: also delete configuration |
| `--dry-run` | Show the plan, change nothing |

## Installation layout (Unix)

```
~/.local/bin/airis                        launcher (symlink)
~/.local/share/airis/versions/<version>/  the release contents
~/.local/share/airis/current              active version
~/.config/airis/                          your configuration (never touched by install)
~/.airis/                                 agent data (memory, sessions)
```

Versions are installed side by side, which is what makes `rollback` possible.
Installation is atomic: the release is staged into `<version>.partial` and only
renamed into place once complete, so an interrupted download cannot leave a
half-installed version.

## Configuration and data are preserved

`install`, `update`, `repair` and `rollback` never modify `~/.config/airis` or
`~/.airis`. `uninstall` keeps both unless you pass `--purge`.

## Environment variables

| Variable | Purpose |
|---|---|
| `AIRIS_HOME` | Override the install root |
| `AIRIS_BIN` | Override the launcher directory |
| `AIRIS_CONFIG` | Override the configuration directory |
| `NO_COLOR` | Disable coloured output |

`AIRIS_RELEASE_BASE_URL`, `AIRIS_ALLOW_INSECURE_BASE`, `AIRIS_FORCE_OS` and
`AIRIS_FORCE_ARCH` exist **only for the test suite** and are not for normal use.
