// Go token estimator for AIRIS compaction.
// Provides accurate token counts using tiktoken-go for better context window management.
//
// Build: go build -o token-estimator ./tools/go-token-estimator
// Usage: ./token-estimator < text-to-count
// Output: {"tokens": <count>}
//
// Optional: echo '{"model":"gpt-4","text":"hello world"}' | ./token-estimator

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	_ "github.com/pkoukk/tiktoken-go"
	tiktoken "github.com/pkoukk/tiktoken-go"
)

// Input formats accepted
type tokenizeRequest struct {
	Text  string `json:"text"`
	Model string `json:"model,omitempty"`
}

type tokenizeResponse struct {
	Tokens int    `json:"tokens"`
	Model  string `json:"model,omitempty"`
	Error  string `json:"error,omitempty"`
}

func main() {
	var input []byte
	var err error

	// Check if input is piped or from stdin
	stat, _ := os.Stdin.Stat()
	if (stat.Mode() & os.ModeCharDevice) == 0 {
		input, err = io.ReadAll(os.Stdin)
		if err != nil {
			writeError(fmt.Sprintf("read error: %v", err))
			os.Exit(1)
		}
	} else if len(os.Args) > 1 {
		input = []byte(strings.Join(os.Args[1:], " "))
	} else {
		// Interactive mode: read line by line
		scanner := bufio.NewScanner(os.Stdin)
		var lines []string
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		if err := scanner.Err(); err != nil {
			writeError(fmt.Sprintf("scan error: %v", err))
			os.Exit(1)
		}
		input = []byte(strings.Join(lines, "\n"))
	}

	if len(input) == 0 {
		writeError("empty input")
		os.Exit(1)
	}

	text := strings.TrimSpace(string(input))

	// Parse JSON input
	if strings.HasPrefix(text, "{") {
		var req tokenizeRequest
		if err := json.Unmarshal([]byte(text), &req); err == nil && req.Text != "" {
			count, model := tokenize(req.Text, req.Model)
			resp := tokenizeResponse{Tokens: count, Model: model}
			writeJSON(resp)
			return
		}
	}

	// Plain text input
	count, model := tokenize(text, "")
	resp := tokenizeResponse{Tokens: count, Model: model}
	writeJSON(resp)
}

func tokenize(text string, model string) (int, string) {
	if model == "" {
		model = "cl100k_base" // Default encoding for GPT-4, GPT-3.5
	}

	tkm, err := tiktoken.GetEncoding(model)
	if err != nil {
		// Fallback: try by model name
		tkm, err = tiktoken.EncodingForModel(model)
		if err != nil {
			// Fallback to cl100k_base
			tkm, err = tiktoken.GetEncoding("cl100k_base")
			if err != nil {
				// Last resort: character-based estimate
				return estimateChars(text), "heuristic"
			}
			return len(tkm.Encode(text, nil, nil)), "cl100k_base"
		}
	}
	return len(tkm.Encode(text, nil, nil)), model
}

// Character-based fallback estimation (same as TypeScript heuristic)
func estimateChars(text string) int {
	return (len(text) + 3) / 4
}

func writeJSON(v any) {
	data, _ := json.Marshal(v)
	os.Stdout.Write(data)
	os.Stdout.Write([]byte("\n"))
}

func writeError(msg string) {
	resp := tokenizeResponse{Error: msg}
	writeJSON(resp)
}
