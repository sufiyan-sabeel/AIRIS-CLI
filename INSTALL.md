# Install AIRIS-CLI

**Created by Umaiz Sufiyan.** AIRIS-CLI is a self-contained binary; Node.js is
not required to run it.

## Unix (Linux, macOS)

```sh
curl -fsSL https://raw.githubusercontent.com/sufiyan-sabeel/AIRIS-CLI/main/install.sh | sh
```

Install a specific version, or the newest prerelease:

```sh
curl -fsSL .../install.sh | sh -s -- --version 0.79.9
curl -fsSL .../install.sh | sh -s -- --channel nightly
```

## Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/sufiyan-sabeel/AIRIS-CLI/main/install.ps1 | iex
```

With options:

```powershell
.\install.ps1 -Version 0.79.9
.\install.ps1 -Command doctor
```

No administrator rights are needed on either platform: everything installs into
your home directory and PATH changes are user-level only.

## Verify the download

Every install is checksum-verified against the release's `checksums.txt`. If a
release does not publish one, the installer **refuses** to proceed unless you
pass `--allow-unverified` (or `-AllowUnverified`). Nothing is skipped silently.

## After installing

```sh
airis --version
airis doctor
airis
```

See `docs/install/PLATFORM-MATRIX.md` for exactly which platforms are supported,
and `INSTALLATION.md` for the full reference.
