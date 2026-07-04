/**
 * Build the aisearch Go binary for the current platform.
 * Run: node scripts/build-aisearch.mjs
 *
 * Also produces cross-compiled binaries when BUILD_ALL=1 is set.
 */

import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const REPO_ROOT = join(__dirname, "..");
const PACKAGE_DIR = join(REPO_ROOT, "packages", "aisearch");
const BIN_DIR = join(REPO_ROOT, "packages", "coding-agent", "bin");

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

function getBinaryName(target) {
	const ext = target.os === "windows" ? ".exe" : "";
	return `aisearch-${target.os}-${target.arch}${ext}`;
}

async function main() {
	if (!existsSync(join(PACKAGE_DIR, "go.mod"))) {
		console.error("aisearch package not found at", PACKAGE_DIR);
		process.exit(1);
	}

	mkdirSync(BIN_DIR, { recursive: true });

	const targets = getTargets();

	for (const target of targets) {
		const binaryName = getBinaryName(target);
		const outputPath = join(BIN_DIR, binaryName);

		console.log(`Building aisearch for ${target.os}/${target.arch} -> ${outputPath}`);

		try {
			const ldflags = `-ldflags=-s -w${target.os === "linux" ? " -extldflags=-static" : ""}`;
			execSync(
				`go build -o "${outputPath}" ${ldflags} ./cmd/aisearch`,
				{
					cwd: PACKAGE_DIR,
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

	// Symlink platform-specific binary to plain "aisearch" for easy access
	const nativeTarget = targets.find((t) => {
		const plat = platform();
		const cpu = arch();
		const osName = plat === "darwin" ? "darwin" : plat === "linux" ? "linux" : "windows";
		const archName = cpu === "x64" ? "amd64" : "arm64";
		return t.os === osName && t.arch === archName;
	});

	if (nativeTarget) {
		const nativeBinary = getBinaryName(nativeTarget);
		const nativePath = join(BIN_DIR, nativeBinary);
		const symlinkPath = join(BIN_DIR, platform() === "win32" ? "aisearch.exe" : "aisearch");

		if (existsSync(nativePath) && !existsSync(symlinkPath)) {
			try {
				if (platform() === "win32") {
					execSync(`copy "${nativePath}" "${symlinkPath}"`, { stdio: "pipe" });
				} else {
					execSync(`ln -s "${nativeBinary}" "${symlinkPath}"`, { cwd: BIN_DIR, stdio: "pipe" });
				}
				console.log(`  🔗 Symlinked ${nativeBinary} -> ${platform() === "win32" ? "copy" : "symlink"}`);
			} catch {
				// symlink/copy failed, not critical
			}
		}
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
