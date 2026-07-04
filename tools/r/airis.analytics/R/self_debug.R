#' Analyze AIRIS self-debug history logs
#'
#' Parses the JSONL self-debug history file (typically at
#' ~/.airis/agent/self-debug-history.jsonl) and produces trend reports.
#'
#' @param path Character. Path to the self-debug JSONL history file.
#' @return list with trend report data.
#' @export
analyze_self_debug_history <- function(path) {
  if (!file.exists(path)) {
    stop("Self-debug history not found: ", path)
  }

  lines <- readLines(path, warn = FALSE)
  if (length(lines) == 0) {
    return(list(
      total_entries = 0,
      by_category = list(),
      by_severity = list(),
      resolution_rate = NA_real_,
      recurring_patterns = data.frame(),
      trend = "No self-debug entries found"
    ))
  }

  entries <- do.call(rbind, lapply(lines, function(line) {
    parsed <- tryCatch(jsonlite::fromJSON(line, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (is.null(parsed)) return(NULL)
    data.frame(
      timestamp = parsed$timestamp %||% NA_character_,
      category  = parsed$category %||% "unknown",
      severity  = parsed$severity %||% "unknown",
      tool      = parsed$tool %||% "unknown",
      error     = parsed$error %||% "",
      resolved  = isTRUE(parsed$resolved),
      stringsAsFactors = FALSE
    )
  }))

  if (is.null(entries) || nrow(entries) == 0) {
    return(list(
      total_entries = 0,
      by_category = list(),
      by_severity = list(),
      resolution_rate = NA_real_,
      recurring_patterns = data.frame(),
      trend = "No parseable entries found"
    ))
  }

  by_category <- sort(table(entries$category), decreasing = TRUE)
  by_severity <- sort(table(entries$severity), decreasing = TRUE)
  by_tool <- sort(table(entries$tool), decreasing = TRUE)

  resolution_rate <- mean(entries$resolved, na.rm = TRUE) * 100

  # Recurring patterns: same normalized error text appearing 3+ times
  entries$normalized <- tolower(trimws(gsub("[0-9]+", "N", entries$error)))
  error_counts <- sort(table(entries$normalized), decreasing = TRUE)
  recurring <- error_counts[error_counts >= 3]

  recurring_df <- data.frame()
  if (length(recurring) > 0) {
    recurring_df <- data.frame(
      pattern = names(recurring),
      count   = as.integer(recurring),
      stringsAsFactors = FALSE
    )
    # Add category for each recurring pattern
    recurring_df$category <- vapply(recurring_df$pattern, function(p) {
      matched <- entries$category[entries$normalized == p]
      if (length(matched) > 0) names(sort(table(matched), decreasing = TRUE))[1] else "unknown"
    }, character(1))
  }

  # Time-based trend: errors per day
  trend_df <- data.frame()
  if (sum(!is.na(entries$timestamp)) > 5) {
    ts_valid <- entries[!is.na(entries$timestamp) &
                          nchar(entries$timestamp) > 0, , drop = FALSE]
    if (nrow(ts_valid) > 0) {
      days <- format(as.Date(ts_valid$timestamp, format = "%Y-%m-%d",
                             optional = TRUE), "%Y-%m-%d")
      day_counts <- as.data.frame(table(days))
      colnames(day_counts) <- c("date", "count")
      trend_df <- day_counts
    }
  }

  list(
    total_entries     = nrow(entries),
    by_category       = as.list(by_category),
    by_severity       = as.list(by_severity),
    by_tool           = as.list(by_tool),
    resolution_rate   = round(resolution_rate, 1),
    recurring_patterns = recurring_df,
    trend             = trend_df
  )
}


#' Generate a human-readable self-debug health report
#'
#' @param analysis list from analyze_self_debug_history().
#' @return Character string.
#' @export
format_self_debug_report <- function(analysis) {
  parts <- sprintf("Self-Debug History Report\n")
  parts <- paste0(parts, sprintf("  Total entries:     %d\n", analysis$total_entries))
  parts <- paste0(parts, sprintf("  Resolution rate:   %.1f%%\n", analysis$resolution_rate))

  if (length(analysis$by_category) > 0) {
    parts <- paste0(parts, "\nBy category:\n")
    for (nm in names(analysis$by_category)) {
      parts <- paste0(parts, sprintf("  %-15s %d\n", nm, analysis$by_category[[nm]]))
    }
  }

  if (length(analysis$by_severity) > 0) {
    parts <- paste0(parts, "\nBy severity:\n")
    for (nm in names(analysis$by_severity)) {
      parts <- paste0(parts, sprintf("  %-15s %d\n", nm, analysis$by_severity[[nm]]))
    }
  }

  if (nrow(analysis$recurring_patterns) > 0) {
    parts <- paste0(parts, sprintf("\nRecurring patterns (%d):\n", nrow(analysis$recurring_patterns)))
    for (i in seq_len(min(5, nrow(analysis$recurring_patterns)))) {
      parts <- paste0(parts, sprintf("  [%dx] %s (%s)\n",
                                     analysis$recurring_patterns$count[i],
                                     substr(analysis$recurring_patterns$pattern[i], 1, 60),
                                     analysis$recurring_patterns$category[i]))
    }
  }

  if (nrow(analysis$trend) > 0) {
    parts <- paste0(parts, "\nDaily trend (last 5 days):\n")
    last5 <- tail(analysis$trend, 5)
    for (i in seq_len(nrow(last5))) {
      parts <- paste0(parts, sprintf("  %s: %d entries\n", last5$date[i], last5$count[i]))
    }
  }

  parts
}


#' Export self-debug analysis to JSON
#'
#' @param analysis list from analyze_self_debug_history().
#' @param output_path Character. Path to write JSON file.
#' @export
export_self_debug_report <- function(analysis, output_path) {
  jsonlite::write_json(analysis, output_path, pretty = TRUE, auto_unbox = TRUE)
  message("Self-debug report written to ", output_path)
}
