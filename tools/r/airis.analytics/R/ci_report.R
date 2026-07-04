#' CI failure report from GitHub Actions or build logs
#'
#' Parses CI/build output lines and extracts failure summaries.
#'
#' @param log_path Character. Path to CI log file.
#' @return list with total_steps, passed, failed, failures.
#' @export
parse_ci_log <- function(log_path) {
  if (!file.exists(log_path)) {
    stop("CI log not found: ", log_path)
  }

  lines <- readLines(log_path, warn = FALSE)
  steps <- list()

  current_step <- NULL
  for (line in lines) {
    # Detect step headers: "##[group]Step Name" or "::group::Step Name"
    group_match <- regmatches(line, regexec(
      "(##\\[group\\]|::group::)(.+)", line
    ))[[1]]
    if (length(group_match) >= 3) {
      if (!is.null(current_step)) {
        steps <- append(steps, list(current_step))
      }
      current_step <- list(
        name   = trimws(group_match[3]),
        status = "running",
        errors = character()
      )
      next
    }

    # Detect failure markers
    if (!is.null(current_step)) {
      if (grepl("(FAIL|ERROR|Error:|failed|FAILED)", line)) {
        current_step$errors <- c(current_step$errors, trimws(line))
      }
      if (grepl("(##\\[error\\]|::error::)", line)) {
        current_step$status <- "failed"
        err_msg <- sub("(##\\[error\\]|::error::)\\s*", "", line)
        current_step$errors <- c(current_step$errors, trimws(err_msg))
      }
    }
  }
  if (!is.null(current_step)) {
    steps <- append(steps, list(current_step))
  }

  # Classify each step
  passed <- 0
  failed <- 0
  fail_details <- list()

  for (s in steps) {
    if (s$status == "failed" || length(s$errors) > 0) {
      failed <- failed + 1
      fail_details <- append(fail_details, list(s))
    } else {
      passed <- passed + 1
    }
  }

  list(
    total_steps  = length(steps),
    passed       = passed,
    failed       = failed,
    failures     = fail_details
  )
}


#' Summarize CI failures in a readable format
#'
#' @param ci_result list from parse_ci_log().
#' @return Character string summary.
#' @export
summarize_ci_failures <- function(ci_result) {
  if (ci_result$failed == 0) {
    return(sprintf("All %d CI steps passed.", ci_result$passed))
  }

  parts <- sprintf("CI: %d/%d steps failed:\n", ci_result$failed, ci_result$total_steps)
  for (f in ci_result$failures) {
    parts <- paste0(parts, sprintf("  - %s\n", f$name))
    for (e in head(f$errors, 5)) {
      parts <- paste0(parts, sprintf("      %s\n", e))
    }
    if (length(f$errors) > 5) {
      parts <- paste0(parts, sprintf("      ... and %d more errors\n",
                                     length(f$errors) - 5))
    }
  }
  parts
}
