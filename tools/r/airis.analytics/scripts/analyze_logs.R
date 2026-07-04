#!/usr/bin/env Rscript

# AIRIS Log Analysis Script
# Usage: Rscript analyze_logs.R --input <logfile> [--json <out.json>] [--csv <out.csv>]
#
# Parses AIRIS CLI logs, summarizes errors, detects anomalies, and exports reports.

args <- commandArgs(trailingOnly = TRUE)

input_file <- NULL
output_json <- NULL
output_csv <- NULL

i <- 1
while (i <= length(args)) {
  if (args[i] == "--input" && i < length(args)) {
    input_file <- args[i + 1]
    i <- i + 2
  } else if (args[i] == "--json" && i < length(args)) {
    output_json <- args[i + 1]
    i <- i + 2
  } else if (args[i] == "--csv" && i < length(args)) {
    output_csv <- args[i + 1]
    i <- i + 2
  } else {
    stop("Unknown argument: ", args[i], "\n",
         "Usage: Rscript analyze_logs.R --input <logfile> [--json <out.json>] [--csv <out.csv>]")
  }
}

if (is.null(input_file)) {
  stop("--input is required\n",
       "Usage: Rscript analyze_logs.R --input <logfile> [--json <out.json>] [--csv <out.csv>]")
}

# Load package functions from source
pkg_dir <- Sys.getenv("AIRIS_R_PACKAGE_DIR",
                      Sys.getenv("PWD", getwd()))
pkg_dir <- normalizePath(pkg_dir, mustWork = FALSE)
r_dir <- file.path(pkg_dir, "R")
if (dir.exists(r_dir)) {
  for (f in list.files(r_dir, pattern = "\\.R$", full.names = TRUE)) {
    source(f)
  }
} else {
  # Fall back to loading installed package
  library(airis.analytics)
}

cat(sprintf("Analyzing logs: %s\n", input_file))

data <- parse_airis_logs(input_file)
summary <- summarize_errors(data)
anomaly <- detect_anomalies(data)

cat(sprintf("  Total lines:  %d\n", summary$total_lines))
cat(sprintf("  Errors:       %d\n", summary$error_count))
cat(sprintf("  Warnings:     %d\n", summary$warning_count))
cat(sprintf("  Anomaly score: %.1f/100\n", anomaly$anomaly_score))

if (length(summary$top_errors) > 0) {
  cat("\nTop repeated errors:\n")
  for (i in seq_along(summary$top_errors)) {
    cat(sprintf("  %d. [%dx] %s\n", i, summary$top_errors[i],
                names(summary$top_errors)[i]))
  }
}

if (nrow(summary$spike_windows) > 0) {
  cat("\nUnusual error spikes:\n")
  for (i in seq_len(nrow(summary$spike_windows))) {
    cat(sprintf("  %s: %s errors\n",
                summary$spike_windows$window[i],
                summary$spike_windows$error_count[i]))
  }
}

export_report(data, output_json, output_csv)

cat("\nDone.\n")
