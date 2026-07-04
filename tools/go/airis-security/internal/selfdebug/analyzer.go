package selfdebug

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type HistoryEntry struct {
	Timestamp string `json:"timestamp"`
	Category  string `json:"category"`
	Severity  string `json:"severity"`
	Tool      string `json:"tool"`
	Error     string `json:"error"`
	Resolved  bool   `json:"resolved"`
}

type HistoryAnalysis struct {
	TotalEntries   int                    `json:"total_entries"`
	ByCategory     map[string]int         `json:"by_category"`
	BySeverity     map[string]int         `json:"by_severity"`
	ByTool         map[string]int         `json:"by_tool"`
	RecurringErrors []RecurringError      `json:"recurring_errors"`
	ResolutionRate float64                `json:"resolution_rate"`
	TopErrors      []string               `json:"top_errors"`
	Summary        string                 `json:"summary"`
}

type RecurringError struct {
	Pattern  string `json:"pattern"`
	Count    int    `json:"count"`
	Category string `json:"category"`
	FirstSeen string `json:"first_seen"`
	LastSeen  string `json:"last_seen"`
}

func AnalyzeHistory(historyPath string) (*HistoryAnalysis, error) {
	absPath, err := filepath.Abs(historyPath)
	if err != nil {
		return nil, fmt.Errorf("bad path: %w", err)
	}

	f, err := os.Open(absPath)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", absPath, err)
	}
	defer f.Close()

	analysis := &HistoryAnalysis{
		ByCategory: make(map[string]int),
		BySeverity: make(map[string]int),
		ByTool:     make(map[string]int),
	}

	var entries []HistoryEntry
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var entry HistoryEntry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}
		entries = append(entries, entry)
		analysis.TotalEntries++
		analysis.ByCategory[entry.Category]++
		analysis.BySeverity[entry.Severity]++
		analysis.ByTool[entry.Tool]++
		if entry.Resolved {
			analysis.ResolutionRate++
		}
	}

	if analysis.TotalEntries > 0 {
		analysis.ResolutionRate = float64(analysis.ResolutionRate) / float64(analysis.TotalEntries) * 100
	}

	// Find recurring errors (same normalized error text appearing 3+ times)
	errorCounts := make(map[string]*RecurringError)
	errorOrder := make([]string, 0)
	for _, e := range entries {
		normalized := normalizeErrorText(e.Error)
		if normalized == "" {
			continue
		}
		if re, ok := errorCounts[normalized]; ok {
			re.Count++
			re.LastSeen = e.Timestamp
		} else {
			ts := e.Timestamp
			if ts == "" {
				ts = time.Now().UTC().Format(time.RFC3339)
			}
			errorCounts[normalized] = &RecurringError{
				Pattern:  normalized,
				Count:    1,
				Category: e.Category,
				FirstSeen: ts,
				LastSeen:  ts,
			}
			errorOrder = append(errorOrder, normalized)
		}
	}

	for _, n := range errorOrder {
		re := errorCounts[n]
		if re.Count >= 3 {
			analysis.RecurringErrors = append(analysis.RecurringErrors, *re)
		}
	}

	// Top 5 most frequent raw error texts
	rawCounts := make(map[string]int)
	for _, e := range entries {
		if e.Error != "" {
			rawCounts[e.Error]++
		}
	}
	var freqList []errorFreq
	for text, count := range rawCounts {
		freqList = append(freqList, errorFreq{Text: text, Count: count})
	}
	sortByCount(freqList)
	for i, f := range freqList {
		if i >= 5 {
			break
		}
		analysis.TopErrors = append(analysis.TopErrors, fmt.Sprintf("[%dx] %s", f.Count, f.Text))
	}

	analysis.Summary = fmt.Sprintf(
		"Analyzed %d self-debug entries. Resolution rate: %.1f%%. %d recurring error patterns. Top categories: %s",
		analysis.TotalEntries, analysis.ResolutionRate, len(analysis.RecurringErrors),
		topNKeys(analysis.ByCategory, 3))

	return analysis, nil
}

func normalizeErrorText(text string) string {
	text = strings.ToLower(text)
	text = strings.TrimSpace(text)
	// Replace numbers with N
	result := make([]byte, 0, len(text))
	digit := false
	for i := 0; i < len(text); i++ {
		c := text[i]
		if c >= '0' && c <= '9' {
			if !digit {
				result = append(result, 'N')
				digit = true
			}
		} else {
			result = append(result, c)
			digit = false
		}
	}
	return string(result)
}

func sortByCount(list []errorFreq) {
	for i := 0; i < len(list); i++ {
		for j := i + 1; j < len(list); j++ {
			if list[j].Count > list[i].Count {
				list[i], list[j] = list[j], list[i]
			}
		}
	}
}

type errorFreq struct {
	Text  string
	Count int
}

func topNKeys(m map[string]int, n int) string {
	type kv struct {
		k string
		v int
	}
	var sorted []kv
	for k, v := range m {
		sorted = append(sorted, kv{k, v})
	}
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].v > sorted[i].v {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	var parts []string
	for i := 0; i < n && i < len(sorted); i++ {
		parts = append(parts, fmt.Sprintf("%s:%d", sorted[i].k, sorted[i].v))
	}
	return strings.Join(parts, ", ")
}
