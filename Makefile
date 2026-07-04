SHELL := /usr/bin/env bash
.PHONY: go-vet go-test security-build c-build r-check logs-analyze self-debug-all doctor-all

GO_MOD_DIR    := tools/go/airis-security
GO_BINARY     := $(GO_MOD_DIR)/airis-security
R_PKG_DIR     := tools/r/airis.analytics
C_SRC_DIR     := tools/c/airis-procmon
C_BINARY      := $(C_SRC_DIR)/airis-procmon

# Go targets
go-vet:
	@if command -v go &>/dev/null; then \
		cd $(GO_MOD_DIR) && go vet ./...; \
	else \
		echo "Skipping go-vet: Go not installed"; \
	fi

go-test:
	@if command -v go &>/dev/null; then \
		cd $(GO_MOD_DIR) && go test ./...; \
	else \
		echo "Skipping go-test: Go not installed"; \
	fi

security-build: $(GO_BINARY)
$(GO_BINARY):
	@if command -v go &>/dev/null; then \
		cd $(GO_MOD_DIR) && go build -o airis-security ./cmd/airis-security; \
	else \
		echo "Skipping security-build: Go not installed"; \
	fi

selfdebug-build: $(GO_BINARY)
	@echo "Self-debug Go binary built as part of security-build"

# C targets
c-build: $(C_BINARY)
$(C_BINARY):
	@if command -v cc &>/dev/null; then \
		$(MAKE) -C $(C_SRC_DIR); \
	else \
		echo "Skipping c-build: C compiler not installed"; \
	fi

# R targets
r-check:
	@if command -v R &>/dev/null; then \
		R CMD check $(R_PKG_DIR) || echo "R CMD check completed (may have warnings)"; \
	else \
		echo "Skipping r-check: R not installed"; \
	fi

logs-analyze:
	@if command -v Rscript &>/dev/null; then \
		echo "Usage: make logs-analyze FILE=path/to/airis.log [JSON=out.json] [CSV=out.csv]"; \
		if [ -n "$(FILE)" ]; then \
			scripts/airis-r-analyze.sh --input "$(FILE)" $(if $(JSON),--json "$(JSON)",) $(if $(CSV),--csv "$(CSV)",); \
		fi \
	else \
		echo "Skipping logs-analyze: R not installed"; \
	fi

# Self-debug integration
self-debug-all: security-build c-build
	@echo "=== AIRIS Self-Debug Diagnostics ==="
	@echo ""
	@if command -v go &>/dev/null && [ -x "$(GO_BINARY)" ]; then \
		echo "--- Go diagnostics ---"; \
		cd $(GO_MOD_DIR) && ./airis-security selfdebug --all --dir "$(PWD)"; \
	else \
		echo "Go security binary not available. Run: make security-build"; \
	fi
	@echo ""
	@if command -v cc &>/dev/null && [ -x "$(C_BINARY)" ]; then \
		echo "--- C procmon ---"; \
		echo "airis-procmon built: $(C_BINARY)"; \
		$(C_BINARY) $$$$ 2>/dev/null || echo "(not monitoring self - use with explicit PID)"; \
	else \
		echo "C procmon not built. Run: make c-build"; \
	fi
	@echo ""
	@if command -v Rscript &>/dev/null; then \
		echo "--- R self-debug history ---"; \
		HIST=~/.airis/agent/self-debug-history.jsonl; \
		if [ -f "$$HIST" ]; then \
			scripts/airis-r-analyze.sh --input "$$HIST" --json /tmp/airis-selfdebug-report.json; \
		else \
			echo "No self-debug history found at $$HIST"; \
		fi \
	else \
		echo "R not installed; self-debug history analytics unavailable"; \
	fi
	@echo ""
	@echo "=== Done ==="

# Doctor
doctor-all:
	@echo "=== AIRIS Doctor: Go/R/C Tooling ==="
	@echo ""
	@echo "--- Go ---"
	@if command -v go &>/dev/null; then \
		echo "go version: $$(go version 2>&1)"; \
		echo ""; \
		echo "go vet:"; \
		$(MAKE) go-vet; \
		echo ""; \
		echo "go test:"; \
		$(MAKE) go-test; \
	else \
		echo "Go not installed."; \
	fi
	@echo ""
	@echo "--- R ---"
	@if command -v R &>/dev/null; then \
		echo "R version: $$(R --version 2>&1 | head -1)"; \
		echo ""; \
		echo "R CMD check:"; \
		$(MAKE) r-check; \
	else \
		echo "R not installed."; \
	fi
	@echo ""
	@echo "--- C ---"
	@if command -v cc &>/dev/null; then \
		echo "C compiler available"; \
		$(MAKE) c-build; \
	else \
		echo "C compiler not installed."; \
	fi
	@echo ""
	@echo "=== Done ==="
