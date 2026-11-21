# Installer Troubleshooting

## `error: release vX publishes no checksums.txt ...`

Working as designed. That release cannot be verified. Either install a release
that publishes `checksums.txt`, or accept the risk explicitly:

```sh
sh install.sh --version 0.79.9 --allow-unverified
```

## `error: checksum mismatch`

The downloaded archive does not match the published hash. Nothing was installed
and any existing installation is untouched. Retry; if it persists, treat it as a
supply-chain warning and report it rather than overriding.

## `error: Alpine/musl is not supported`

The published Linux binary is glibc-linked. Install `gcompat`, or use a source
install. Alpine builds are not published, and the installer will not pretend
otherwise.

## `error: Termux/Android is not yet supported`

No Android binary is published. The desktop Linux binary will not run on
Termux. Use the source installation documented in the repository.

## `error: unsupported platform`

The OS/architecture combination has no published build. Run `uname -s` and
`uname -m` and compare against `docs/install/PLATFORM-MATRIX.md`.

## `could not resolve the latest release (rate limited?)`

GitHub's API is rate-limited for unauthenticated requests. Pass the version
explicitly: `--version 0.79.9`.

## `airis: command not found` after installing

The launcher directory is not on your PATH. Either open a new terminal, or run:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

`sh install.sh doctor` reports whether PATH contains the launcher directory.

## The installer added a PATH line I do not want

Re-run with `--no-modify-path`, and delete the `# AIRIS-CLI installer` block from
your `~/.profile` or `~/.zshrc`.

## Diagnosing any installation

```sh
sh install.sh doctor     # or: airis doctor
```
