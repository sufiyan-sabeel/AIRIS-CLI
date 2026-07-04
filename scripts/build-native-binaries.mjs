/**
 * Build bundled Go native binaries (aisearch and aifetch) for the current platform.
 * Run: node scripts/build-native-binaries.mjs
 *
 * When BUILD_ALL=1, cross-compiles for all supported target platforms.
 */

import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const REPO_ROOT = join(__dirname, "..");
const BIN_DIR = join(REPO_ROOT, "packages", "coding-agent", "bin");

const MODULES = [
	{ name: "aisearch", dir: join(REPO_ROOT, "packages", "aisearch"), cmd: "./cmd/aisearch" },
	{ name: "aifetch", dir: join(REPO_ROOT, "packages", "aifetch"), cmd: "./cmd/aifetch" },
];

function getTargets() {
	const plat = platform();
	const cpu = arch();

	if (process.env.BUILD_ALL === "1") {
		return [
			{ os: "darwin", arch: "amd64" },
			{ os: "darwin", arch: "arm64" },
			{ os: "linux", arch: "amd64" },
			{ os: "linux", arch: "arm64" },
			{ os: "windows", arch: "amd64" },
		];
	}

	let osName;
	switch (plat) {
		case "darwin": osName = "darwin"; break;
		case "linux": osName = "linux"; break;
		case "win32": osName = "windows"; break;
		default: osName = "linux";
	}

	let archName;
	switch (cpu) {
		case "x64": archName = "amd64"; break;
		case "arm64": archName = "arm64"; break;
		default: archName = "amd64";
	}

	return [{ os: osName, arch: archName }];
}

function getBinaryName(name, target) {
	const ext = target.os === "windows" ? ".exe" : "";
	return `${name}-${target.os}-${target.arch}${ext}`;
}

async function main() {
	mkdirSync(BIN_DIR, { recursive: true });
	const targets = getTargets();

	for (const mod of MODULES) {
		if (!existsSync(join(mod.dir, "go.mod"))) {
			console.error(`${mod.name} package not found at ${mod.dir}`);
			continue;
		}

		for (const target of targets) {
			const binaryName = getBinaryName(mod.name, target);
			const outputPath = join(BIN_DIR, binaryName);

			console.log(`Building ${mod.name} for ${target.os}/${target.arch} -> ${outputPath}`);

			try {
				const ldflags = `-ldflags=-s -w${target.os === "linux" ? " -extldflags=-static" : ""}`;
				execSync(
					`go build -o "${outputPath}" ${ldflags} ${mod.cmd}`,
					{
						cwd: mod.dir,
						env: {
							...process.env,
							GOOS: target.os,
							GOARCH: target.arch,
							CGO_ENABLED: "0",
						},
						stdio: "pipe",
					},
				);

				if (target.os !== "windows") {
					chmodSync(outputPath, 0o755);
				}

				const sizeBytes = parseInt(execSync(`wc -c < "${outputPath}"`, { encoding: "utf-8" }).trim(), 10);
				console.log(`  ✅ Built (${Math.round(sizeBytes / 1024)} KB)`);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`  ❌ Failed: ${msg}`);
			}
		}

		// Symlink platform-specific binary to plain name
		const nativeTarget = targets.find((t) => {
			const plat = platform();
			const cpu = arch();
			const osName = plat === "darwin" ? "darwin" : plat === "linux" ? "linux" : "windows";
			const archName = cpu === "x64" ? "amd64" : "arm64";
			return t.os === osName && t.arch === archName;
		});

		if (nativeTarget) {
			const nativeBinary = getBinaryName(mod.name, nativeTarget);
			const nativePath = join(BIN_DIR, nativeBinary);
			const symlinkName = platform() === "win32" ? `${mod.name}.exe` : mod.name;
			const symlinkPath = join(BIN_DIR, symlinkName);

			if (existsSync(nativePath) && !existsSync(symlinkPath)) {
				try {
					if (platform() === "win32") {
						execSync(`copy "${nativePath}" "${symlinkPath}"`, { stdio: "pipe" });
					} else {
						execSync(`ln -s "${nativeBinary}" "${symlinkPath}"`, { cwd: BIN_DIR, stdio: "pipe" });
					}
					console.log(`  🔗 Symlinked ${nativeBinary} -> ${symlinkName}`);
				} catch {
					// not critical
				}
			}
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
