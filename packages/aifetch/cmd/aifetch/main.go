package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

func main() {
	// Check for help flag early
	for _, arg := range os.Args[1:] {
		if arg == "-h" || arg == "--help" {
			printHelp()
			os.Exit(0)
		}
	}

	if len(os.Args) < 2 {
		printHelp()
		os.Exit(0)
	}

	opts := defaultOptions()

	var positional []string
	for i := 1; i < len(os.Args); i++ {
		arg := os.Args[i]
		switch {
		case arg == "-X" || arg == "--method":
			i++
			if i < len(os.Args) {
				opts.method = os.Args[i]
			}
		case arg == "-d" || arg == "--data":
			i++
			if i < len(os.Args) {
				opts.body = os.Args[i]
			}
		case arg == "-H" || arg == "--header":
			i++
			if i < len(os.Args) {
				parts := strings.SplitN(os.Args[i], ":", 2)
				if len(parts) == 2 {
					opts.rawHeaders = append(opts.rawHeaders, os.Args[i])
				}
			}
		case arg == "--timeout":
			i++
			if i < len(os.Args) {
				if n, err := strconv.Atoi(os.Args[i]); err == nil {
					opts.timeout = time.Duration(n) * time.Second
				}
			}
		case arg == "--max-size":
			i++
			if i < len(os.Args) {
				if n, err := strconv.Atoi(os.Args[i]); err == nil && n > 0 {
					opts.maxSize = int64(n) * 1024
				}
			}
		case arg == "-A" || arg == "--user-agent":
			i++
			if i < len(os.Args) {
				opts.userAgent = os.Args[i]
			}
		case arg == "--follow-redirects":
			opts.followRedirects = true
		case arg == "--no-follow-redirects":
			opts.followRedirects = false
		case arg == "--max-redirects":
			i++
			if i < len(os.Args) {
				if n, err := strconv.Atoi(os.Args[i]); err == nil {
					opts.maxRedirects = n
				}
			}
		case arg == "-s" || arg == "--status-only":
			opts.statusOnly = true
		case arg == "-o" || arg == "--output":
			i++
			if i < len(os.Args) {
				opts.outputFile = os.Args[i]
			}
		case arg == "--json":
			opts.jsonOutput = true
		case arg == "--insecure":
			opts.insecure = true
		default:
			if strings.HasPrefix(arg, "-") {
				fmt.Fprintf(os.Stderr, "Unknown flag: %s\n", arg)
				os.Exit(1)
			}
			positional = append(positional, arg)
		}
	}

	if len(positional) == 0 {
		fmt.Fprintf(os.Stderr, "Error: URL is required\n")
		os.Exit(1)
	}

	targetURL := positional[0]
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "https://" + targetURL
	}

	if _, err := url.Parse(targetURL); err != nil {
		fmt.Fprintf(os.Stderr, "Error: invalid URL: %v\n", err)
		os.Exit(1)
	}

	// Build transport
	transport := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: opts.insecure},
	}

	client := &http.Client{
		Timeout: opts.timeout,
		Transport: transport,
	}

	if opts.followRedirects {
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			if len(via) >= opts.maxRedirects {
				return fmt.Errorf("too many redirects (max %d)", opts.maxRedirects)
			}
			return nil
		}
	} else {
		// Don't follow redirects
		client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	req, err := http.NewRequest(opts.method, targetURL, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if opts.body != "" {
		req.Body = io.NopCloser(strings.NewReader(opts.body))
		req.ContentLength = int64(len(opts.body))
	}

	// Set headers
	if opts.userAgent != "" {
		req.Header.Set("User-Agent", opts.userAgent)
	} else {
		req.Header.Set("User-Agent", "AIRIS-CLI/aifetch")
	}

	for _, raw := range opts.rawHeaders {
		parts := strings.SplitN(raw, ":", 2)
		if len(parts) == 2 {
			req.Header.Set(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
		}
	}

	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	// Limit reader
	var bodyReader io.Reader = resp.Body
	if opts.maxSize > 0 {
		bodyReader = io.LimitReader(resp.Body, opts.maxSize)
	}

	body, err := io.ReadAll(bodyReader)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading body: %v\n", err)
		os.Exit(1)
	}

	bodySize := len(body)
	duration := time.Since(start)

	if opts.jsonOutput {
		// JSON output
		statusText := http.StatusText(resp.StatusCode)
		fmt.Printf(`{"status":%d,"statusText":%q,"url":%q,"contentType":%q,"bodySize":%d,"duration":%q`,
			resp.StatusCode, statusText, resp.Request.URL.String(),
			resp.Header.Get("Content-Type"), bodySize, duration.Round(time.Millisecond).String())

		if !opts.statusOnly {
			// Escape body for JSON
			escapedBody := strings.ReplaceAll(string(body), "\\", "\\\\")
			escapedBody = strings.ReplaceAll(escapedBody, "\"", "\\\"")
			escapedBody = strings.ReplaceAll(escapedBody, "\n", "\\n")
			escapedBody = strings.ReplaceAll(escapedBody, "\r", "\\r")
			escapedBody = strings.ReplaceAll(escapedBody, "\t", "\\t")
			fmt.Printf(`,"body":%q`, escapedBody)
		}
		fmt.Println("}")
	} else if opts.statusOnly {
		statusText := http.StatusText(resp.StatusCode)
		fmt.Printf("%d %s", resp.StatusCode, statusText)
		if bodySize > 0 {
			fmt.Printf(" (%d bytes)", bodySize)
		}
		fmt.Println()
	} else if opts.outputFile != "" {
		if err := os.WriteFile(opts.outputFile, body, 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Error writing output: %v\n", err)
			os.Exit(1)
		}
		fmt.Fprintf(os.Stderr, "Wrote %d bytes to %s (HTTP %d, %s)\n", bodySize, opts.outputFile, resp.StatusCode, duration.Round(time.Millisecond))
	} else {
		// Normal output: status line to stderr, body to stdout
		fmt.Fprintf(os.Stderr, "HTTP %d %s (%d bytes, %s)\n",
			resp.StatusCode, http.StatusText(resp.StatusCode), bodySize, duration.Round(time.Millisecond))
		os.Stdout.Write(body)
	}
}

func printHelp() {
	fmt.Fprintf(os.Stderr, "Usage: aifetch <url> [flags]\n")
	fmt.Fprintf(os.Stderr, "\nFlags:\n")
	fmt.Fprintf(os.Stderr, "  -X, --method METHOD    HTTP method (default GET)\n")
	fmt.Fprintf(os.Stderr, "  -d, --data BODY        Request body (for POST/PUT)\n")
	fmt.Fprintf(os.Stderr, "  -H, --header K:V       Custom header (repeatable)\n")
	fmt.Fprintf(os.Stderr, "  --timeout SECONDS      Timeout (default 30)\n")
	fmt.Fprintf(os.Stderr, "  --max-size KB          Max response size KB (default 1024)\n")
	fmt.Fprintf(os.Stderr, "  -A, --user-agent UA    User-Agent header\n")
	fmt.Fprintf(os.Stderr, "  --follow-redirects     Follow redirects (default true)\n")
	fmt.Fprintf(os.Stderr, "  --max-redirects N      Max redirects (default 5)\n")
	fmt.Fprintf(os.Stderr, "  -s, --status-only      Only print status line\n")
	fmt.Fprintf(os.Stderr, "  -o, --output FILE      Write body to file\n")
	fmt.Fprintf(os.Stderr, "  --json                 Output JSON metadata + body\n")
	fmt.Fprintf(os.Stderr, "  --insecure             Skip TLS verification\n")
	fmt.Fprintf(os.Stderr, "  -h, --help             Show help\n")
}

type options struct {
	method          string
	body            string
	rawHeaders      []string
	timeout         time.Duration
	maxSize         int64
	userAgent       string
	followRedirects bool
	maxRedirects    int
	statusOnly      bool
	outputFile      string
	jsonOutput      bool
	insecure        bool
}

func defaultOptions() options {
	return options{
		method:          "GET",
		timeout:         30 * time.Second,
		maxSize:         1024 * 1024, // 1MB
		followRedirects: true,
		maxRedirects:    5,
	}
}
