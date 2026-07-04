/*
 * airis-procmon -- Lightweight process resource monitor for AIRIS self-debug.
 *
 * Reads /proc/<pid>/status, /proc/<pid>/stat, and /proc/<pid>/fd/
 * to report memory, CPU, and file descriptor usage.
 *
 * Usage:
 *   airis-procmon <pid>              # One-shot report
 *   airis-procmon <pid> --watch     # Poll every 2 seconds
 *   airis-procmon <pid> --watch 5   # Poll every 5 seconds
 *
 * Compile:
 *   cc -O2 -o airis-procmon procmon.c
 *
 * This file is part of the AIRIS project (MIT license).
 * No external dependencies. Cross-platform Linux/Android ( procfs ).
 */

#define _POSIX_C_SOURCE 200809L

#include <dirent.h>
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define LINE_BUF 4096
#define PATH_BUF 256

/* ---- Data structures ---- */

typedef struct {
  long   vm_rss_kb;       /* VmRSS in kB */
  long   vm_size_kb;      /* VmSize in kB */
  long   vm_peak_kb;      /* VmPeak in kB */
  long   threads;         /* Threads count */
  long   fd_count;        /* Open file descriptors */
  double cpu_user;        /* User CPU seconds (from /proc/pid/stat) */
  double cpu_system;      /* System CPU seconds */
  long   cpu_ticks_total; /* Total CPU ticks at snapshot */
  long   uptime_ticks;    /* System uptime ticks at snapshot */
} ProcSnapshot;

/* ---- Helpers ---- */

static int read_int_from(const char *path) {
  FILE *f = fopen(path, "r");
  if (!f) return -1;
  int val = -1;
  fscanf(f, "%d", &val);
  fclose(f);
  return val;
}

static long read_long_after(const char *content, const char *prefix) {
  const char *p = strstr(content, prefix);
  if (!p) return -1;
  p += strlen(prefix);
  while (*p == ' ' || *p == '\t') p++;
  return atol(p);
}

/* Parse /proc/<pid>/status for memory info */
static int read_status(pid_t pid, ProcSnapshot *snap) {
  char path[PATH_BUF];
  snprintf(path, sizeof(path), "/proc/%d/status", pid);

  FILE *f = fopen(path, "r");
  if (!f) return -1;

  char buf[LINE_BUF];
  size_t total = 0;
  while (fgets(buf, sizeof(buf), f)) {
    total += strlen(buf);
    if (total > 65536) break; /* safety */
  }
  rewind(f);
  total = 0;
  while (fgets(buf, sizeof(buf), f)) {
    total += strlen(buf);
    if (total > 65536) break;

    if (strncmp(buf, "VmRSS:", 6) == 0)
      snap->vm_rss_kb = atol(buf + 6);
    else if (strncmp(buf, "VmSize:", 7) == 0)
      snap->vm_size_kb = atol(buf + 7);
    else if (strncmp(buf, "VmPeak:", 7) == 0)
      snap->vm_peak_kb = atol(buf + 7);
    else if (strncmp(buf, "Threads:", 8) == 0)
      snap->threads = atol(buf + 8);
  }
  fclose(f);
  return 0;
}

/* Count open file descriptors */
static int count_fds(pid_t pid) {
  char path[PATH_BUF];
  snprintf(path, sizeof(path), "/proc/%d/fd", pid);

  DIR *d = opendir(path);
  if (!d) return -1;

  int count = 0;
  struct dirent *entry;
  while ((entry = readdir(d)) != NULL) {
    if (entry->d_name[0] == '.') continue;
    count++;
  }
  closedir(d);
  return count;
}

/* Parse /proc/<pid>/stat for CPU + tick info */
static int read_stat(pid_t pid, ProcSnapshot *snap) {
  char path[PATH_BUF];
  snprintf(path, sizeof(path), "/proc/%d/stat", pid);

  FILE *f = fopen(path, "r");
  if (!f) return -1;

  /* Format: pid (comm) state ppid pgrp ... utime stime ... cutime cstime ...
   * We need fields 13 (utime) and 14 (stime) -- 0-indexed 12 and 13.
   * The comm field is in parentheses so we scan past it. */
  char buf[LINE_BUF];
  if (!fgets(buf, sizeof(buf), f)) {
    fclose(f);
    return -1;
  }
  fclose(f);

  /* Find closing paren of comm, then skip space */
  char *close_paren = strrchr(buf, ')');
  if (!close_paren) return -1;

  char *p = close_paren + 1;
  while (*p == ' ') p++;

  /* Fields 2-21 after comm (0-indexed 2 to 21), we need indices 12 and 13 */
  int field = 2;
  char *end;
  while (*p && field <= 14) {
    errno = 0;
    long val = strtol(p, &end, 10);
    if (p == end) break;

    if (field == 12) snap->cpu_user = (double)val;
    if (field == 13) snap->cpu_system = (double)val;

    snap->cpu_ticks_total += val;
    field++;
    p = end;
    while (*p == ' ') p++;
  }

  return 0;
}

/* Read system uptime in ticks ( /proc/stat or /proc/uptime ) */
static long read_uptime_ticks(void) {
  FILE *f = fopen("/proc/uptime", "r");
  if (!f) return 0;
  double uptime_sec = 0.0;
  fscanf(f, "%lf", &uptime_sec);
  fclose(f);
  return (long)(uptime_sec * sysconf(_SC_CLK_TCK));
}

/* Take one snapshot of a process */
static int snapshot(pid_t pid, ProcSnapshot *snap) {
  memset(snap, 0, sizeof(*snap));
  if (read_status(pid, snap) != 0) return -1;
  snap->fd_count = count_fds(pid);
  if (read_stat(pid, snap) != 0) return -1;
  snap->uptime_ticks = read_uptime_ticks();
  return 0;
}

/* Print one snapshot as JSON */
static void print_snapshot(pid_t pid, const ProcSnapshot *snap) {
  printf("{\n");
  printf("  \"pid\": %d,\n", pid);
  printf("  \"vm_rss_kb\": %ld,\n", snap->vm_rss_kb);
  printf("  \"vm_size_kb\": %ld,\n", snap->vm_size_kb);
  printf("  \"vm_peak_kb\": %ld,\n", snap->vm_peak_kb);
  printf("  \"threads\": %ld,\n", snap->threads);
  printf("  \"fd_count\": %ld,\n", snap->fd_count);
  printf("  \"cpu_user_ticks\": %.0f,\n", snap->cpu_user);
  printf("  \"cpu_system_ticks\": %.0f,\n", snap->cpu_system);
  printf("  \"uptime_ticks\": %ld\n", snap->uptime_ticks);
  printf("}\n");
  fflush(stdout);
}

/* ---- Main ---- */

static volatile int running = 1;
static void handle_signal(int sig) {
  (void)sig;
  running = 0;
}

static void usage(const char *prog) {
  fprintf(stderr,
    "Usage: %s <pid> [--watch [interval_sec]]\n"
    "\n"
    "Monitor process %ldresources via procfs.\n"
    "  <pid>             Process ID to monitor\n"
    "  --watch [N]       Poll every N seconds (default 2)\n"
    "\n"
    "Output is JSON, one object per snapshot.\n"
    "With --watch, outputs stream of JSON objects separated by newlines.\n"
    "\n"
    "Examples:\n"
    "  %s 1234\n"
    "  %s 1234 --watch 5\n",
    prog, "", prog, prog);
}

int main(int argc, char **argv) {
  if (argc < 2) {
    usage(argv[0]);
    return 1;
  }

  pid_t pid = atoi(argv[1]);
  if (pid <= 0) {
    fprintf(stderr, "Invalid PID: %s\n", argv[1]);
    return 1;
  }

  int watch_mode = 0;
  int interval = 2;

  for (int i = 2; i < argc; i++) {
    if (strcmp(argv[i], "--watch") == 0) {
      watch_mode = 1;
      if (i + 1 < argc && argv[i + 1][0] >= '0' && argv[i + 1][0] <= '9') {
        interval = atoi(argv[++i]);
        if (interval < 1) interval = 1;
      }
    } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
      usage(argv[0]);
      return 0;
    }
  }

  /* Check process exists */
  {
    char path[PATH_BUF];
    snprintf(path, sizeof(path), "/proc/%d", pid);
    if (access(path, F_OK) != 0) {
      fprintf(stderr, "Process %d not found (check /proc/%d)\n", pid, pid);
      return 1;
    }
  }

  if (watch_mode) {
    signal(SIGINT, handle_signal);
    signal(SIGTERM, handle_signal);

    ProcSnapshot prev;
    memset(&prev, 0, sizeof(prev));

    while (running) {
      ProcSnapshot snap;
      if (snapshot(pid, &snap) != 0) {
        fprintf(stderr, "Process %d no longer available\n", pid);
        break;
      }
      print_snapshot(pid, &snap);
      sleep(interval);
    }
  } else {
    ProcSnapshot snap;
    if (snapshot(pid, &snap) != 0) {
      fprintf(stderr, "Failed to snapshot process %d\n", pid);
      return 1;
    }
    print_snapshot(pid, &snap);
  }

  return 0;
}
