package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/sufiyan-sabeel/AIRIS-CLI/packages/aisearch/internal/find"
	"github.com/sufiyan-sabeel/AIRIS-CLI/packages/aisearch/internal/grep"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: aisearch <find|grep> [flags] <pattern> [path]\n")
		os.Exit(1)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "find":
		runFind(args)
	case "grep":
		runGrep(args)
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s (use find or grep)\n", cmd)
		os.Exit(1)
	}
}

func runFind(args []string) {
	opts := find.DefaultOptions()

	var positional []string
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "--glob":
			opts.Glob = true
		case args[i] == "--no-glob":
			opts.Glob = false
		case args[i] == "--hidden":
			opts.Hidden = true
		case args[i] == "--no-hidden":
			opts.Hidden = false
		case args[i] == "--no-require-git":
			opts.NoRequireGit = true
		case args[i] == "--full-path":
			opts.FullPath = true
		case args[i] == "--color=never":
			// no-op, we never color
		case args[i] == "--max-results" || args[i] == "--max-results=":
			if i+1 < len(args) && strings.HasPrefix(args[i], "--max-results=") {
				val := strings.TrimPrefix(args[i], "--max-results=")
				if n, err := strconv.Atoi(val); err == nil {
					opts.MaxResults = n
				}
			} else if i+1 < len(args) {
				i++
				if n, err := strconv.Atoi(args[i]); err == nil {
					opts.MaxResults = n
				}
			}
		case args[i] == "--":
			// separator
			continue
		default:
			if strings.HasPrefix(args[i], "-") {
				fmt.Fprintf(os.Stderr, "Unknown flag: %s\n", args[i])
				os.Exit(1)
			}
			positional = append(positional, args[i])
		}
	}

	if len(positional) == 0 {
		fmt.Fprintf(os.Stderr, "Usage: aisearch find [flags] <pattern> [path]\n")
		os.Exit(1)
	}

	opts.Pattern = positional[0]
	if len(positional) > 1 {
		opts.SearchPath = positional[1]
	}

	results, err := find.Run(opts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	for _, r := range results {
		rel, _ := filepath.Rel(opts.SearchPath, r)
		if rel != "" {
			fmt.Println(strings.ReplaceAll(rel, "\\", "/"))
		} else {
			fmt.Println(strings.ReplaceAll(r, "\\", "/"))
		}
	}

	if opts.MaxResults > 0 && len(results) >= opts.MaxResults {
		fmt.Fprintf(os.Stderr, "Warning: result limit (%d) reached\n", opts.MaxResults)
	}
}

func runGrep(args []string) {
	opts := grep.DefaultOptions()

	var positional []string
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "--color=never":
			// no-op
		case args[i] == "--ignore-case" || args[i] == "-i":
			opts.IgnoreCase = true
		case args[i] == "--literal" || args[i] == "-F":
			opts.Literal = true
		case args[i] == "--hidden":
			opts.Hidden = true
		case args[i] == "--no-require-git":
			opts.NoRequireGit = true
		case args[i] == "--max-results" || args[i] == "--max-results=":
			if i+1 < len(args) && strings.HasPrefix(args[i], "--max-results=") {
				val := strings.TrimPrefix(args[i], "--max-results=")
				if n, err := strconv.Atoi(val); err == nil {
					opts.MaxResults = n
				}
			} else if i+1 < len(args) {
				i++
				if n, err := strconv.Atoi(args[i]); err == nil {
					opts.MaxResults = n
				}
			}
		case args[i] == "--context" || args[i] == "-C":
			if i+1 < len(args) {
				i++
				if n, err := strconv.Atoi(args[i]); err == nil {
					opts.ContextLines = n
				}
			}
		case args[i] == "--glob" || args[i] == "-g":
			if i+1 < len(args) {
				i++
				opts.FileGlob = args[i]
			}
		case args[i] == "--":
			continue
		default:
			if strings.HasPrefix(args[i], "-") {
				fmt.Fprintf(os.Stderr, "Unknown flag: %s\n", args[i])
				os.Exit(1)
			}
			positional = append(positional, args[i])
		}
	}

	if len(positional) == 0 {
		fmt.Fprintf(os.Stderr, "Usage: aisearch grep [flags] <pattern> [path]\n")
		os.Exit(1)
	}

	opts.Pattern = positional[0]
	if len(positional) > 1 {
		opts.SearchPath = positional[1]
	}

	results, err := grep.Run(opts)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	for _, r := range results {
		filePath := r.File
		// If search path is a directory, show paths relative to it
		if fi, err := os.Stat(opts.SearchPath); err == nil && fi.IsDir() {
			if rel, err := filepath.Rel(opts.SearchPath, r.File); err == nil {
				filePath = rel
			}
		} else {
			// Single file mode: just show the filename
			filePath = filepath.Base(r.File)
		}
		filePath = strings.ReplaceAll(filePath, "\\", "/")
		for _, line := range r.Lines {
			fmt.Printf("%s:%d:%s\n", filePath, line.Number, line.Text)
		}
	}

	if opts.MaxResults > 0 && len(results) >= opts.MaxResults {
		fmt.Fprintf(os.Stderr, "Warning: match limit (%d) reached\n", opts.MaxResults)
	}
}
