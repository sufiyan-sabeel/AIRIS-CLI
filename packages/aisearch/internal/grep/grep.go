package grep

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/sufiyan-sabeel/AIRIS-CLI/packages/aisearch/internal/gitignore"
)

// Options configures the grep command.
type Options struct {
	Pattern     string
	SearchPath  string
	IgnoreCase  bool
	Literal     bool
	Hidden      bool
	NoRequireGit bool
	FileGlob    string
	ContextLines int
	MaxResults  int
}

func DefaultOptions() Options {
	return Options{
		SearchPath: ".",
		MaxResults: 100,
	}
}

// MatchLine represents a single matching line.
type MatchLine struct {
	Number int
	Text   string
}

// FileMatch represents matching lines in a file.
type FileMatch struct {
	File  string
	Lines []MatchLine
}

// Run executes the grep operation.
func Run(opts Options) ([]FileMatch, error) {
	searchPath := opts.SearchPath
	if searchPath == "" {
		searchPath = "."
	}

	absPath, err := filepath.Abs(searchPath)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return nil, err
	}

	// Single file mode
	if !info.IsDir() {
		searchRe, err := compilePattern(opts.Pattern, opts.Literal, opts.IgnoreCase)
		if err != nil {
			return nil, err
		}
		matches, err := grepFileWithRegex(absPath, searchRe, opts)
		if err != nil {
			return nil, err
		}
		if len(matches) > 0 {
			return []FileMatch{{File: absPath, Lines: matches}}, nil
		}
		return nil, nil
	}

	// Directory mode with optional file glob filter
	var globRe *regexp.Regexp
	if opts.FileGlob != "" {
		globPattern := globToRegex(opts.FileGlob)
		globRe, err = regexp.Compile(globPattern)
		if err != nil {
			return nil, err
		}
	}

	matcher := gitignore.NewMatcher(absPath)

	// Compile the search pattern once
	searchRe, err := compilePattern(opts.Pattern, opts.Literal, opts.IgnoreCase)
	if err != nil {
		return nil, err
	}

	var results []FileMatch
	totalMatches := 0

	err = filepath.Walk(absPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if path == absPath {
			return nil
		}

		rel, _ := filepath.Rel(absPath, path)
		rel = strings.ReplaceAll(rel, "\\", "/")

		// Skip hidden
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

		if info.IsDir() {
			return nil
		}

		// Check file glob filter
		if globRe != nil && !globRe.MatchString(info.Name()) {
			return nil
		}

		// Grep the file using the pre-compiled regex
		matches, err := grepFileWithRegex(path, searchRe, opts)
		if err != nil {
			return nil // skip unreadable files
		}

		if len(matches) > 0 {
			results = append(results, FileMatch{File: path, Lines: matches})
			totalMatches += len(matches)
		}

		if opts.MaxResults > 0 && totalMatches >= opts.MaxResults {
			return filepath.SkipAll
		}

		return nil
	})

	if err != nil && err != filepath.SkipAll {
		return nil, err
	}

	return results, nil
}

func compilePattern(pattern string, literal bool, ignoreCase bool) (*regexp.Regexp, error) {
	if literal {
		p := regexp.QuoteMeta(pattern)
		if ignoreCase {
			p = "(?i)" + p
		}
		return regexp.Compile(p)
	}
	if ignoreCase {
		return regexp.Compile("(?i)" + pattern)
	}
	return regexp.Compile(pattern)
}

func grepFileWithRegex(path string, searchRe *regexp.Regexp, opts Options) ([]MatchLine, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Check if file is likely binary
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	if n > 0 {
		if isBinary(buf[:n]) {
			return nil, nil
		}
	}
	f.Seek(0, 0)

	// Read all lines
	var allLines []string
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 1<<20), 1<<20)
	for scanner.Scan() {
		allLines = append(allLines, scanner.Text())
	}

	var matches []MatchLine
	matchedLines := make(map[int]bool)

	// Find matching lines
	for i, line := range allLines {
		if searchRe.MatchString(line) {
			// Add context lines
			start := i - opts.ContextLines
			if start < 0 {
				start = 0
			}
			end := i + opts.ContextLines + 1
			if end > len(allLines) {
				end = len(allLines)
			}

			for j := start; j < end; j++ {
				if !matchedLines[j] {
					matchedLines[j] = true
					prefix := ""
					if j == i {
						prefix = ""
					}
					_ = prefix
					matches = append(matches, MatchLine{Number: j + 1, Text: allLines[j]})
				}
			}
		}
	}

	return matches, nil
}

// isBinary checks if a byte buffer looks like binary content.
func isBinary(buf []byte) bool {
	for _, b := range buf {
		if b == 0 {
			return true
		}
	}
	return false
}

// globToRegex converts a simple glob pattern to a regex pattern.
func globToRegex(pattern string) string {
	var result strings.Builder
	result.WriteString("^")
	for i := 0; i < len(pattern); i++ {
		switch pattern[i] {
		case '*':
			if i+1 < len(pattern) && pattern[i+1] == '*' {
				result.WriteString(".*")
				i++
				if i+1 < len(pattern) && pattern[i+1] == '/' {
					result.WriteString("/?")
					i++
				}
			} else {
				result.WriteString("[^/]*")
			}
		case '?':
			result.WriteString("[^/]")
		case '.':
			result.WriteString("\\.")
		case '/':
			result.WriteString("/")
		default:
			result.WriteByte(pattern[i])
		}
	}
	result.WriteString("$")
	return result.String()
}
