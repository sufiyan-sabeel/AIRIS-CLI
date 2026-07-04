#' Parse AIRIS log file into a structured data frame
#'
#' Supports standard AIRIS JSONL logs and GitHub Actions log formats.
#' Returns a data frame with columns: timestamp, level, message, source.
#'
#' @param path Character. Path to the log file.
#' @return data.frame with parsed log entries.
#' @export
parse_airis_logs <- function(path) {
  if (!file.exists(path)) {
    stop("Log file not found: ", path)
  }

  lines <- readLines(path, warn = FALSE)
  if (length(lines) == 0) {
    return(data.frame(
      timestamp = character(),
      level = character(),
      message = character(),
      source = character(),
      stringsAsFactors = FALSE
    ))
  }

  entries <- lapply(lines, function(line) {
    line <- trimws(line)
    if (nchar(line) == 0) return(NULL)

    # Try JSONL parse for AIRIS audit format
    parsed <- tryCatch(jsonlite::fromJSON(line, simplifyVector = FALSE),
                       error = function(e) NULL)
    if (!is.null(parsed) && !is.null(parsed$event)) {
      return(data.frame(
        timestamp = parsed$timestamp %||% NA_character_,
        level     = parsed$level %||% "info",
        message   = parsed$event,
        source    = parsed$hostname %||% "airis-audit",
        stringsAsFactors = FALSE
      ))
    }

    # Fallback: parse structured text log
    # Format: [timestamp] LEVEL: message
    ts <- NA_character_
    lvl <- "info"
    msg <- line

    m <- regmatches(line, regexec(
      "^\\[([^]]+)\\]\\s+(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\\s*[:\\-]\\s*(.+)$",
      line, ignore.case = TRUE
    ))[[1]]
    if (length(m) >= 4) {
      ts <- m[2]
      lvl <- tolower(m[3])
      msg <- m[4]
    } else {
      # Try GitHub Actions log format
      # Format: YYYY-MM-DDTHH:MM:SS.sssZ <level> message
      m2 <- regmatches(line, regexec(
        "^(\\d{4}-\\d{2}-\\d{2}T\\S+)\\s+(\\w+)\\s+(.+)$",
        line
      ))[[1]]
      if (length(m2) >= 4) {
        ts <- m2[2]
        lvl <- tolower(m2[3])
        msg <- m2[4]
      }
    }

    # Normalize level
    if (lvl %in% c("warn", "warning")) lvl <- "warning"
    if (lvl %in% c("fatal")) lvl <- "error"

    data.frame(
      timestamp = ts,
      level     = lvl,
      message   = msg,
      source    = "airis-log",
      stringsAsFactors = FALSE
    )
  })

  do.call(rbind, Filter(Negate(is.null), entries))
}

`%||%` <- function(a, b) if (is.null(a)) b else a


#' Summarize error and warning counts from parsed log data
#'
#' @param data data.frame from parse_airis_logs().
#' @return list with total, error_count, warning_count, top_errors, spike_windows.
#' @export
summarize_errors <- function(data) {
  if (nrow(data) == 0) {
    return(list(
      total_lines = 0,
      error_count = 0,
      warning_count = 0,
      top_errors = character(),
      spike_windows = data.frame()
    ))
  }

  error_lines <- data[data$level == "error", , drop = FALSE]
  warning_lines <- data[data$level == "warning", , drop = FALSE]

  # Top repeated error messages
  if (nrow(error_lines) > 0) {
    msg_freq <- sort(table(error_lines$message), decreasing = TRUE)
    top_errors <- head(msg_freq, 10)
  } else {
    top_errors <- setNames(integer(0), character(0))
  }

  # Timestamp spike detection: count errors per minute
  spike_windows <- data.frame()
  if (nrow(error_lines) > 0 && sum(!is.na(error_lines$timestamp)) > 0) {
    ts_valid <- error_lines[!is.na(error_lines$timestamp) &
                              nchar(error_lines$timestamp) > 0, , drop = FALSE]
    if (nrow(ts_valid) > 0) {
      # Round to minute-level windows
      minute_bins <- format(as.POSIXct(ts_valid$timestamp, format = "%Y-%m-%dT%H:%M:%S",
                                       tz = "UTC", optional = TRUE), "%Y-%m-%d %H:%M")
      minute_freq <- as.data.frame(table(minute_bins))
      colnames(minute_freq) <- c("window", "error_count")
      spike_windows <- minute_freq[minute_freq$error_count > 2, , drop = FALSE]
    }
  }

  list(
    total_lines   = nrow(data),
    error_count   = nrow(error_lines),
    warning_count = nrow(warning_lines),
    top_errors    = top_errors,
    spike_windows = spike_windows
  )
}


#' Detect anomalous log patterns using statistical thresholds
#'
#' Calculates a simple anomaly score based on error rate deviation.
#'
#' @param data data.frame from parse_airis_logs().
#' @return list with anomaly_score, anomaly_details, flagged_windows.
#' @export
detect_anomalies <- function(data) {
  if (nrow(data) < 10) {
    return(list(
      anomaly_score   = 0,
      anomaly_details = "Insufficient data (<10 lines)",
      flagged_windows = data.frame()
    ))
  }

  error_rate <- sum(data$level == "error") / nrow(data)
  warn_rate  <- sum(data$level == "warning") / nrow(data)

  # Baseline: typical healthy rate <5% errors, <10% warnings
  error_score <- ifelse(error_rate > 0.05, (error_rate - 0.05) / 0.05 * 50, 0)
  warn_score  <- ifelse(warn_rate > 0.10, (warn_rate - 0.10) / 0.10 * 25, 0)
  anomaly_score <- min(100, round(error_score + warn_score, 1))

  # Per-minute anomaly detection
  flagged <- data.frame()
  if (sum(!is.na(data$timestamp)) > 10) {
    valid <- data[!is.na(data$timestamp) & nchar(data$timestamp) > 0, , drop = FALSE]
    if (nrow(valid) > 0) {
      minute_bins <- format(as.POSIXct(valid$timestamp,
                                       format = "%Y-%m-%dT%H:%M:%S",
                                       tz = "UTC", optional = TRUE), "%Y-%m-%d %H:%M")
      per_min <- stats::aggregate(
        level == "error" ~ minute_bins,
        data = valid,
        FUN = function(x) sum(x) / length(x)
      )
      colnames(per_min) <- c("window", "error_rate")
      per_min$anomaly <- per_min$error_rate > 0.2
      flagged <- per_min[per_min$anomaly, , drop = FALSE]
    }
  }

  detail <- sprintf(
    "Error rate: %.1f%%, Warning rate: %.1f%%, Anomaly score: %.1f/100",
    error_rate * 100, warn_rate * 100, anomaly_score
  )

  list(
    anomaly_score   = anomaly_score,
    anomaly_details = detail,
    flagged_windows = flagged
  )
}


#' Export log report to JSON and/or CSV
#'
#' @param data data.frame from parse_airis_logs().
#' @param output_json Character. Path to JSON output file, or NULL.
#' @param output_csv  Character. Path to CSV output file, or NULL.
#' @return Invisibly returns the report list.
#' @export
export_report <- function(data, output_json = NULL, output_csv = NULL) {
  summary <- summarize_errors(data)
  anomaly <- detect_anomalies(data)

  report <- list(
    report_generated = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3Z", tz = "UTC"),
    total_lines      = summary$total_lines,
    error_count      = summary$error_count,
    warning_count    = summary$warning_count,
    top_errors       = as.list(summary$top_errors),
    anomaly_score    = anomaly$anomaly_score,
    anomaly_details  = anomaly$anomaly_details,
    spike_windows    = summary$spike_windows,
    flagged_windows  = anomaly$flagged_windows
  )

  if (!is.null(output_json)) {
    jsonlite::write_json(report, output_json, pretty = TRUE, auto_unbox = TRUE)
    message("Report written to ", output_json)
  }

  if (!is.null(output_csv)) {
    # Flatten top errors to CSV
    err_df <- data.frame(
      message = names(summary$top_errors),
      count   = as.integer(summary$top_errors),
      stringsAsFactors = FALSE
    )
    utils::write.csv(err_df, output_csv, row.names = FALSE)
    message("Report written to ", output_csv)
  }

  invisible(report)
}
