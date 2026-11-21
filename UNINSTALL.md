# Uninstall AIRIS-CLI

## Unix

```sh
curl -fsSL https://raw.githubusercontent.com/sufiyan-sabeel/AIRIS-CLI/main/install.sh | sh -s -- uninstall
```

This removes the launcher and all installed versions. Your configuration
(`~/.config/airis`) and agent data (`~/.airis`) are **kept**.

To remove those as well:

```sh
sh install.sh uninstall --purge
```

## Windows

```powershell
.\install.ps1 -Command uninstall          # keeps configuration
.\install.ps1 -Command uninstall -Purge   # removes it too
```

The installer does not remove the PATH entry it added. To remove it manually:
Settings → Environment Variables → edit your user `Path` and delete the AIRIS
bin directory (printed by `airis-install doctor` / `-Command doctor`).

## Manual removal

```sh
rm -f  ~/.local/bin/airis
rm -rf ~/.local/share/airis
# only if you want to lose settings and history:
rm -rf ~/.config/airis ~/.airis
```

## Verify

```sh
command -v airis   # should print nothing
```
