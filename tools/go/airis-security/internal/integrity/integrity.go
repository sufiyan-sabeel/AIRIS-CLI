package integrity

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
)

type ManifestEntry struct {
	Path string `json:"path"`
	Hash string `json:"sha256"`
}

type Manifest struct {
	Version int             `json:"version"`
	Entries []ManifestEntry `json:"entries"`
}

type VerifyResult struct {
	Path   string `json:"path"`
	Passed bool   `json:"passed"`
	Error  string `json:"error,omitempty"`
}

var defaultSkipDirs = map[string]bool{
	".git":     true,
	"node_modules": true,
	".airis":   true,
	"dist":     true,
	"target":   true,
}

func HashFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", path, err)
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

func CreateManifest(root string) (*Manifest, error) {
	root, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("abs: %w", err)
	}

	var entries []ManifestEntry
	err = filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if defaultSkipDirs[info.Name()] && path != root {
				return filepath.SkipDir
			}
			return nil
		}
		if !info.Mode().IsRegular() {
			return nil
		}

		rel, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}

		hash, err := HashFile(path)
		if err != nil {
			return err
		}

		entries = append(entries, ManifestEntry{
			Path: rel,
			Hash: hash,
		})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk %s: %w", root, err)
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Path < entries[j].Path
	})

	return &Manifest{Version: 1, Entries: entries}, nil
}

func VerifyManifest(manifestPath string) ([]VerifyResult, error) {
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}

	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}

	manifestDir := filepath.Dir(manifestPath)
	var results []VerifyResult

	for _, entry := range m.Entries {
		absPath := filepath.Join(manifestDir, entry.Path)
		actualHash, err := HashFile(absPath)
		if err != nil {
			results = append(results, VerifyResult{
				Path:   entry.Path,
				Passed: false,
				Error:  fmt.Sprintf("cannot read: %v", err),
			})
			continue
		}

		if actualHash != entry.Hash {
			results = append(results, VerifyResult{
				Path:   entry.Path,
				Passed: false,
				Error:  fmt.Sprintf("hash mismatch: expected %s, got %s", entry.Hash, actualHash),
			})
			continue
		}

		results = append(results, VerifyResult{
			Path:   entry.Path,
			Passed: true,
		})
	}

	return results, nil
}
