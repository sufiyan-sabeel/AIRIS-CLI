package gitignore

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

// Matcher checks if a path should be ignored based on .gitignore rules.
type Matcher struct {
	rules []rule
}

type rule struct {
	pattern  string
	negate   bool
	dirOnly  bool
}

// NewMatcher creates a matcher that loads .gitignore files from the given root directory
// and all parent directories up to the filesystem root.
func NewMatcher(root string) *Matcher {
	m := &Matcher{}
	m.loadRecursive(root)
	// Always ignore .git/
	m.rules = append(m.rules, rule{pattern: ".git", dirOnly: true})
	return m
}

func (m *Matcher) loadRecursive(dir string) {
	// Walk up the directory tree collecting .gitignore files
	// We collect them root-first so child rules override parent rules (standard git behavior)
	var files []string
	current := dir
	for {
		gf := filepath.Join(current, ".gitignore")
		if _, err := os.Stat(gf); err == nil {
			files = append([]string{gf}, files...) // prepend so parent rules come first
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		current = parent
	}

	for _, gf := range files {
		m.loadFile(gf)
	}
}

func (m *Matcher) loadFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		r := rule{}
		if strings.HasPrefix(line, "\\#") {
			line = line[1:] // escaped hash
		} else if strings.HasPrefix(line, "\\!") {
			line = line[1:] // escaped bang
		} else if strings.HasPrefix(line, "!") {
			r.negate = true
			line = line[1:]
		}

		if strings.HasSuffix(line, "/") {
			r.dirOnly = true
			line = strings.TrimSuffix(line, "/")
		}

		// Remove leading slash (anchored to repo root)
		if strings.HasPrefix(line, "/") {
			line = line[1:]
		}

		r.pattern = line
		m.rules = append(m.rules, r)
	}
}

// Ignored checks if the given relative path should be ignored.
// The path should be relative to the root directory the matcher was created with.
// isDir indicates if the path is a directory.
func (m *Matcher) Ignored(relPath string, isDir bool) bool {
	if relPath == "" {
		return false
	}
	// Normalize
	relPath = strings.ReplaceAll(relPath, "\\", "/")
	relPath = strings.TrimPrefix(relPath, "./")

	matched := false
	for _, r := range m.rules {
		if r.dirOnly && !isDir {
			continue
		}
		if matchGlob(relPath, r.pattern) {
			matched = !r.negate
		}
	}
	return matched
}

// matchGlob checks if a path matches a gitignore-style glob pattern.
// This handles the common cases used by gitignore.
func matchGlob(path, pattern string) bool {
	// Simple suffix match for patterns like "*.log"
	if !strings.Contains(pattern, "/") {
		// Pattern without slash matches basename
		base := filepath.Base(path)
		return matchSimple(base, pattern)
	}

	// Pattern with slash matches against full relative path
	return matchSimple(path, pattern)
}

// matchSimple checks if a string matches a gitignore glob pattern.
// Supports *, **, ? wildcards.
func matchSimple(s, pattern string) bool {
	// If pattern starts with **/, match any suffix
	if strings.HasPrefix(pattern, "**/") {
		suffix := pattern[3:]
		if matchSimple(s, suffix) {
			return true
		}
		// Try matching against each path component
		for i := 0; i < len(s); i++ {
			if s[i] == '/' {
				if matchSimple(s[i+1:], pattern[3:]) {
					return true
				}
			}
		}
		return false
	}

	// If pattern ends with /**
	if strings.HasSuffix(pattern, "/**") {
		prefix := strings.TrimSuffix(pattern, "/**")
		return strings.HasPrefix(s, prefix)
	}

	return globMatch(s, pattern)
}

// globMatch is a simple glob matcher supporting * and ?.
func globMatch(s, pattern string) bool {
	px := 0
	sx := 0
	nextP := -1
	nextS := -1

	for sx < len(s) {
		if px < len(pattern) && pattern[px] == '*' {
			// Wildcard: try matching zero or more characters
			nextP = px
			nextS = sx + 1
			px++
		} else if px < len(pattern) && (pattern[px] == '?' || pattern[px] == s[sx]) {
			px++
			sx++
		} else if nextP >= 0 {
			px = nextP
			sx = nextS
			nextS++
		} else {
			return false
		}
	}

	// Skip trailing *
	for px < len(pattern) && pattern[px] == '*' {
		px++
	}

	return px == len(pattern)
}
