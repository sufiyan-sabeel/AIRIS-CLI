package selfdebug

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

type Diagnostic struct {
	Tool     string   `json:"tool"`
	Passed   bool     `json:"passed"`
	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
	Summary  string   `json:"summary"`
}

type RunResult struct {
	ProjectRoot  string        `json:"project_root"`
	Diagnostics  []Diagnostic  `json:"diagnostics"`
	AllPassed    bool          `json:"all_passed"`
}

type SelfDebugInput struct {
	ProjectRoot string `json:"project_root"`
	RunTypecheck bool   `json:"run_typecheck,omitempty"`
	RunGoVet     bool   `json:"run_go_vet,omitempty"`
	RunBiome     bool   `json:"run_biome,omitempty"`
	RunAll       bool   `json:"run_all,omitempty"`
}

func Run(input SelfDebugInput) (*RunResult, error) {
	if input.RunAll {
		input.RunTypecheck = true
		input.RunGoVet = true
		input.RunBiome = true
	}

	root := input.ProjectRoot
	if root == "" {
		root = "."
	}
	root, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("bad root: %w", err)
	}

	result := &RunResult{
		ProjectRoot: root,
	}

	if input.RunTypecheck {
		result.Diagnostics = append(result.Diagnostics, runTsc(root))
		result.Diagnostics = append(result.Diagnostics, runGoVet(root))
		result.Diagnostics = append(result.Diagnostics, runBiome(root))
		result.Diagnostics = append(result.Diagnostics, runRCheck(root))
	}

	for _, d := range result.Diagnostics {
		if !d.Passed {
			result.AllPassed = false
		}
	}
	if result.AllPassed {
		for _, d := range result.Diagnostics {
			if len(d.Errors) > 0 {
				result.AllPassed = false
				break
			}
		}
	}

	return result, nil
}

func runTsc(root string) Diagnostic {
	tsconfig := filepath.Join(root, "tsconfig.json")
	hasConfig := fileExists(tsconfig)
	if !hasConfig {
		return Diagnostic{
			Tool:    "tsc",
			Passed:  true,
			Summary: "No tsconfig.json found, skipping",
		}
	}
	cmd := exec.Command("npx", "--yes", "tsc", "--noEmit")
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	output := string(out)

	diag := Diagnostic{Tool: "tsc"}
	if err == nil {
		diag.Passed = true
		diag.Summary = "TypeScript type check passed"
		return diag
	}
	diag.Passed = false
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Contains(line, "error TS") {
			diag.Errors = append(diag.Errors, line)
		} else if strings.Contains(line, "warning") {
			diag.Warnings = append(diag.Warnings, line)
		}
	}
	if len(diag.Errors) > 0 {
		diag.Summary = fmt.Sprintf("TypeScript: %d error(s), %d warning(s)", len(diag.Errors), len(diag.Warnings))
	} else {
		diag.Summary = fmt.Sprintf("TypeScript: %d warning(s)", len(diag.Warnings))
	}
	return diag
}

func runGoVet(root string) Diagnostic {
	goMod := filepath.Join(root, "go.mod")
	hasGoMod := fileExists(goMod)
	if !hasGoMod {
		return Diagnostic{
			Tool:    "go-vet",
			Passed:  true,
			Summary: "No go.mod found, skipping",
		}
	}
	cmd := exec.Command("go", "vet", "./...")
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	output := string(out)

	diag := Diagnostic{Tool: "go-vet"}
	if err == nil {
		diag.Passed = true
		diag.Summary = "go vet passed"
		return diag
	}
	diag.Passed = false
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Contains(line, ".go:") {
			diag.Errors = append(diag.Errors, line)
		}
	}
	diag.Summary = fmt.Sprintf("go vet: %d issue(s)", len(diag.Errors))
	return diag
}

func runBiome(root string) Diagnostic {
	biomeConfig := filepath.Join(root, "biome.json")
	hasBiome := fileExists(biomeConfig)
	if !hasBiome {
		return Diagnostic{
			Tool:    "biome",
			Passed:  true,
			Summary: "No biome.json found, skipping",
		}
	}
	cmd := exec.Command("npx", "--yes", "@biomejs/biome", "check", "--error-on-warnings")
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	output := string(out)

	diag := Diagnostic{Tool: "biome"}
	if err == nil {
		diag.Passed = true
		diag.Summary = "Biome check passed"
		return diag
	}
	diag.Passed = false
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Contains(line, "error") || strings.Contains(line, "lint") || strings.Contains(line, "format") {
			if !strings.HasPrefix(line, "Checked") && !strings.HasPrefix(line, "Finished") {
				diag.Errors = append(diag.Errors, line)
			}
		}
	}
	diag.Summary = fmt.Sprintf("Biome: %d issue(s)", len(diag.Errors))
	return diag
}

func runRCheck(root string) Diagnostic {
	rDir := filepath.Join(root, "tools", "r", "airis.analytics")
	desc := filepath.Join(rDir, "DESCRIPTION")
	if !fileExists(desc) {
		return Diagnostic{
			Tool:    "r-cmd-check",
			Passed:  true,
			Summary: "No R package DESCRIPTION found, skipping",
		}
	}
	cmd := exec.Command("R", "CMD", "check", rDir, "--no-manual", "--no-vignettes")
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	output := string(out)

	diag := Diagnostic{Tool: "r-cmd-check"}
	if err == nil {
		diag.Passed = true
		diag.Summary = "R CMD check passed"
		return diag
	}
	diag.Passed = false
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Contains(line, "ERROR") || strings.Contains(line, "WARNING") {
			diag.Errors = append(diag.Errors, line)
		}
	}
	diag.Summary = fmt.Sprintf("R CMD check: %d issue(s)", len(diag.Errors))
	return diag
}

func fileExists(path string) bool {
	_, err := filepath.Glob(path)
	if err != nil {
		_, err = filepath.Abs(path)
		if err != nil {
			return false
		}
	}
	// Use exec to check existence via test command (cross-platform enough)
	cmd := exec.Command("test", "-f", path)
	return cmd.Run() == nil
}

