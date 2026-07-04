package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/sufiyan-sabeel/AIRIS-CLI/tools/go/airis-security/internal/audit"
	"github.com/sufiyan-sabeel/AIRIS-CLI/tools/go/airis-security/internal/crypto"
	"github.com/sufiyan-sabeel/AIRIS-CLI/tools/go/airis-security/internal/doctor"
	"github.com/sufiyan-sabeel/AIRIS-CLI/tools/go/airis-security/internal/integrity"
	"github.com/sufiyan-sabeel/AIRIS-CLI/tools/go/airis-security/internal/selfdebug"
)

type command struct {
	name string
	desc string
	run  func(args []string) error
}

var commands = []command{
	{
		name: "hash",
		desc: "Compute SHA-256 hash of a file",
		run:  runHash,
	},
	{
		name: "manifest",
		desc: "Create or verify a file integrity manifest",
		run:  runManifest,
	},
	{
		name: "audit",
		desc: "Append an audit log entry (JSONL)",
		run:  runAudit,
	},
	{
		name: "encrypt",
		desc: "Encrypt a file with AES-GCM",
		run:  runEncrypt,
	},
	{
		name: "decrypt",
		desc: "Decrypt a file with AES-GCM",
		run:  runDecrypt,
	},
	{
		name: "doctor",
		desc: "Run health checks on the security module itself",
		run:  runDoctor,
	},
	{
		name: "selfdebug",
		desc: "Run self-diagnostics (tsc, go vet, biome, R CMD check)",
		run:  runSelfDebug,
	},
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	for _, c := range commands {
		if c.name == cmd {
			if err := c.run(os.Args[2:]); err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}
			return
		}
	}

	fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", cmd)
	usage()
	os.Exit(1)
}

func usage() {
	fmt.Fprintf(os.Stderr, "Usage: airis-security <command> [args]\n\nCommands:\n")
	for _, c := range commands {
		fmt.Fprintf(os.Stderr, "  %-10s %s\n", c.name, c.desc)
	}
}

func runHash(args []string) error {
	if len(args) < 1 {
		return errors.New("usage: airis-security hash <file>")
	}
	path := args[0]
	hash, err := integrity.HashFile(path)
	if err != nil {
		return fmt.Errorf("hash failed: %w", err)
	}
	fmt.Printf("SHA-256 (%s) = %s\n", filepath.Base(path), hash)
	return nil
}

func runManifest(args []string) error {
	if len(args) < 2 {
		return errors.New("usage: airis-security manifest <create|verify> ...")
	}

	sub := args[0]
	switch sub {
	case "create":
		return runManifestCreate(args[1:])
	case "verify":
		return runManifestVerify(args[1:])
	default:
		return fmt.Errorf("unknown manifest subcommand: %s (use create or verify)", sub)
	}
}

func runManifestCreate(args []string) error {
	if len(args) < 1 {
		return errors.New("usage: airis-security manifest create <dir> --out <manifest.json>")
	}

	dir := args[0]
	outPath := "airis-manifest.json"
	for i := 1; i < len(args); i++ {
		if args[i] == "--out" && i+1 < len(args) {
			outPath = args[i+1]
			break
		}
	}

	manifest, err := integrity.CreateManifest(dir)
	if err != nil {
		return fmt.Errorf("manifest creation failed: %w", err)
	}

	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("json marshal failed: %w", err)
	}
	if err := os.WriteFile(outPath, data, 0644); err != nil {
		return fmt.Errorf("write failed: %w", err)
	}
	fmt.Printf("Manifest written to %s (%d entries)\n", outPath, len(manifest.Entries))
	return nil
}

func runManifestVerify(args []string) error {
	if len(args) < 1 {
		return errors.New("usage: airis-security manifest verify --manifest <manifest.json>")
	}

	manifestPath := "airis-manifest.json"
	for i := 0; i < len(args); i++ {
		if args[i] == "--manifest" && i+1 < len(args) {
			manifestPath = args[i+1]
			break
		}
	}

	results, err := integrity.VerifyManifest(manifestPath)
	if err != nil {
		return fmt.Errorf("manifest verification failed: %w", err)
	}

	ok := 0
	fail := 0
	for _, r := range results {
		if r.Passed {
			ok++
		} else {
			fail++
			fmt.Fprintf(os.Stderr, "FAIL: %s: %s\n", r.Path, r.Error)
		}
	}
	fmt.Printf("Verified %d entries: %d passed, %d failed\n", len(results), ok, fail)
	if fail > 0 {
		return fmt.Errorf("integrity check failed for %d file(s)", fail)
	}
	return nil
}

func runAudit(args []string) error {
	if len(args) < 1 {
		return errors.New("usage: airis-security audit append --event <event> --level <info|warn|error> [--log <path>]")
	}

	var event, level, logPath string
	logPath = "airis-audit.jsonl"

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--event":
			if i+1 < len(args) {
				event = args[i+1]
				i++
			}
		case "--level":
			if i+1 < len(args) {
				level = args[i+1]
				i++
			}
		case "--log":
			if i+1 < len(args) {
				logPath = args[i+1]
				i++
			}
		}
	}

	if event == "" {
		return errors.New("--event is required")
	}
	if level == "" {
		level = "info"
	}

	entry, err := audit.AppendEntry(logPath, event, level)
	if err != nil {
		return fmt.Errorf("audit failed: %w", err)
	}
	fmt.Printf("Audit entry appended: %s [%s] %s\n", entry.Timestamp, entry.Level, entry.Event)
	return nil
}

func runEncrypt(args []string) error {
	if len(args) < 1 {
		return errors.New("usage: airis-security encrypt <file> --out <file.enc>")
	}

	inPath := args[0]
	outPath := inPath + ".enc"
	for i := 1; i < len(args); i++ {
		if args[i] == "--out" && i+1 < len(args) {
			outPath = args[i+1]
			break
		}
	}

	key := loadKey("AIRIS_ENCRYPTION_KEY")
	if err := crypto.EncryptFile(inPath, outPath, []byte(key)); err != nil {
		return fmt.Errorf("encryption failed: %w", err)
	}
	fmt.Printf("Encrypted %s -> %s\n", inPath, outPath)
	return nil
}

func runDecrypt(args []string) error {
	if len(args) < 1 {
		return errors.New("usage: airis-security decrypt <file.enc> --out <file>")
	}

	inPath := args[0]
	outPath := stripExt(inPath)
	for i := 1; i < len(args); i++ {
		if args[i] == "--out" && i+1 < len(args) {
			outPath = args[i+1]
			break
		}
	}

	key := loadKey("AIRIS_ENCRYPTION_KEY")
	if err := crypto.DecryptFile(inPath, outPath, []byte(key)); err != nil {
		return fmt.Errorf("decryption failed: %w", err)
	}
	fmt.Printf("Decrypted %s -> %s\n", inPath, outPath)
	return nil
}

func runDoctor(args []string) error {
	result := doctor.CheckAll()
	out, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(out))
	if !result.Healthy {
		return fmt.Errorf("health check failed: %s", result.Summary)
	}
	return nil
}

func loadKey(envVar string) string {
	key := os.Getenv(envVar)
	if key == "" {
		fmt.Fprintf(os.Stderr, "Warning: %s not set. Using insecure default (dev only).\n", envVar)
		key = "airis-dev-key-change-in-production!!"
	}
	return key
}

func stripExt(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '.' {
			return path[:i]
		}
	}
	return path + ".dec"
}

func runSelfDebug(args []string) error {
	input := selfdebug.SelfDebugInput{}

	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--typecheck", "-t":
			input.RunTypecheck = true
		case "--govet", "-v":
			input.RunGoVet = true
		case "--biome", "-b":
			input.RunBiome = true
		case "--all", "-a":
			input.RunAll = true
		case "--dir", "-d":
			if i+1 < len(args) {
				input.ProjectRoot = args[i+1]
				i++
			}
		case "--history", "-h":
			if i+1 < len(args) {
				analysis, err := selfdebug.AnalyzeHistory(args[i+1])
				if err != nil {
					return fmt.Errorf("history analysis: %w", err)
				}
				out, _ := json.MarshalIndent(analysis, "", "  ")
				fmt.Println(string(out))
				return nil
			}
			return errors.New("--history requires a file path")
		}
	}

	result, err := selfdebug.Run(input)
	if err != nil {
		return err
	}
	out, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(out))
	return nil
}
