#' Additional anomaly detection helpers
#'
#' These supplement the inline anomaly detection in log_analysis.R.
#' They provide threshold-based and rolling-window detectors.

#' Calculate rolling error rate over N-line windows
#'
#' @param data data.frame from parse_airis_logs().
#' @param window_size Integer. Number of lines per rolling window.
#' @return data.frame with window_start, window_end, error_rate.
#' @export
rolling_error_rate <- function(data, window_size = 50) {
  if (nrow(data) < window_size) {
    return(data.frame(
      window_start = integer(),
      window_end   = integer(),
      error_rate   = numeric()
    ))
  }

  n <- nrow(data)
  starts <- seq(1, n - window_size + 1, by = floor(window_size / 2))
  result <- do.call(rbind, lapply(starts, function(s) {
    end <- min(s + window_size - 1, n)
    window <- data[s:end, , drop = FALSE]
    err_rate <- sum(window$level == "error") / nrow(window)
    data.frame(
      window_start = s,
      window_end   = end,
      error_rate   = err_rate,
      stringsAsFactors = FALSE
    )
  }))

  result
}


#' Flag windows where error rate exceeds a threshold
#'
#' @param rolling data.frame from rolling_error_rate().
#' @param threshold Numeric. Error rate threshold (default 0.15).
#' @return data.frame of flagged windows.
#' @export
flag_anomalous_windows <- function(rolling, threshold = 0.15) {
  if (nrow(rolling) == 0) return(rolling)
  rolling[rolling$error_rate > threshold, , drop = FALSE]
}
