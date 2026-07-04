package find

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/sufiyan-sabeel/AIRIS-CLI/packages/aisearch/internal/gitignore"
)

// Options configures the find command.
type Options struct {
	Pattern      string
	SearchPath   string
	Glob         bool
	Hidden       bool
	FullPath     bool
	NoRequireGit bool
	MaxResults   int
}

func DefaultOptions() Options {
	return Options{
		SearchPath: ".",
		Glob:       true,
		Hidden:     false,
		MaxResults: 1000,
	}
}

// Run executes the find operation.
func Run(opts Options) ([]string, error) {
	searchPath := opts.SearchPath
	if searchPath == "" {
		searchPath = "."
	}

	// Resolve to absolute path
	absPath, err := filepath.Abs(searchPath)
	if err != nil {
		return nil, err
	}

	// Check if path exists
	info, err := os.Stat(absPath)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, nil
	}

	matcher := gitignore.NewMatcher(absPath)

	var results []string
	pattern := opts.Pattern

	err = filepath.Walk(absPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip inaccessible files
		}

		// Skip the root
		if path == absPath {
			return nil
		}

		rel, _ := filepath.Rel(absPath, path)
		rel = strings.ReplaceAll(rel, "\\", "/")

		// Check hidden
		if !opts.Hidden {
			parts := strings.Split(rel, "/")
			for _, p := range parts {
				if strings.HasPrefix(p, ".") {
					if info.IsDir() {
						return filepath.SkipDir
					}
					return nil
				}
			}
		}

		// Check gitignore
		if matcher.Ignored(rel, info.IsDir()) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Pattern matching
		if opts.Glob {
			matchTarget := rel
			if opts.FullPath {
				matchTarget = path
			}
			if !opts.FullPath {
				matchTarget = info.Name()
			}
			if !globMatch(matchTarget, pattern) {
				return nil
			}
		} else {
			// Non-glob mode: the pattern is a substring match on the full rel path
			if !strings.Contains(rel, pattern) {
				return nil
			}
		}

		if !info.IsDir() {
			results = append(results, path)
		}

		// Check max results
		if opts.MaxResults > 0 && len(results) >= opts.MaxResults {
			return filepath.SkipAll
		}

		return nil
	})

	if err != nil && err != filepath.SkipAll {
		return nil, err
	}

	return results, nil
}

// globMatch matches a simple glob pattern (*, ?, character classes not supported).
func globMatch(s, pattern string) bool {
	px := 0
	sx := 0
	nextP := -1
	nextS := -1

	for sx < len(s) {
		if px < len(pattern) && pattern[px] == '*' {
			nextP = px
			nextS = sx + 1
			px++
		} else if px < len(pattern) && (pattern[px] == '?' || pattern[px] == s[sx]) {
			px++
			sx++
		} else if nextP >= 0 {
			px = nextP
			nextS++
			sx = nextS
		} else {
			return false
		}
	}

	for px < len(pattern) && pattern[px] == '*' {
		px++
	}

	return px == len(pattern)
}
