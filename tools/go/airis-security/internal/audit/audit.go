package audit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type Entry struct {
	Timestamp string `json:"timestamp"`
	Event     string `json:"event"`
	Level     string `json:"level"`
	Hostname  string `json:"hostname,omitempty"`
	PID       int    `json:"pid,omitempty"`
}

func AppendEntry(logPath, event, level string) (*Entry, error) {
	dir := filepath.Dir(logPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("mkdir: %w", err)
		}
	}

	hostname, _ := os.Hostname()

	entry := &Entry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Event:     event,
		Level:     level,
		Hostname:  hostname,
		PID:       os.Getpid(),
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return nil, fmt.Errorf("json marshal: %w", err)
	}

	f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("open log: %w", err)
	}
	defer f.Close()

	if _, err := f.Write(append(data, '\n')); err != nil {
		return nil, fmt.Errorf("write: %w", err)
	}

	return entry, nil
}
