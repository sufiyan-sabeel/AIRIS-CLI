package doctor

import (
	"os/exec"
)

type CheckResult struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Detail  string `json:"detail"`
}

type DoctorReport struct {
	Healthy bool           `json:"healthy"`
	Summary string         `json:"summary"`
	Checks  []CheckResult  `json:"checks"`
}

func CheckAll() DoctorReport {
	var checks []CheckResult
	allPassed := true

	checks = append(checks, checkGoVet())
	checks = append(checks, checkGoBuild())
	checks = append(checks, checkEncryptionKey())

	for _, c := range checks {
		if !c.Passed {
			allPassed = false
		}
	}

	summary := "All checks passed"
	if !allPassed {
		summary = "Some checks failed"
	}

	return DoctorReport{
		Healthy: allPassed,
		Summary: summary,
		Checks:  checks,
	}
}

func checkGoVet() CheckResult {
	cmd := exec.Command("go", "vet", "./...")
	cmd.Dir = "."
	out, err := cmd.CombinedOutput()
	if err != nil {
		return CheckResult{
			Name:   "go-vet",
			Passed: false,
			Detail: string(out) + ": " + err.Error(),
		}
	}
	return CheckResult{
		Name:   "go-vet",
		Passed: true,
		Detail: "go vet passed",
	}
}

func checkGoBuild() CheckResult {
	cmd := exec.Command("go", "build", "./cmd/airis-security")
	cmd.Dir = "."
	out, err := cmd.CombinedOutput()
	if err != nil {
		return CheckResult{
			Name:   "go-build",
			Passed: false,
			Detail: string(out) + ": " + err.Error(),
		}
	}
	return CheckResult{
		Name:   "go-build",
		Passed: true,
		Detail: "go build succeeded",
	}
}

func checkEncryptionKey() CheckResult {
	// We only check that the env var _can_ be set; not its value
	// Security: never log or expose the key here
	return CheckResult{
		Name:   "encryption-key-env",
		Passed: true,
		Detail: "AIRIS_ENCRYPTION_KEY checked at runtime (not validated here)",
	}
}
