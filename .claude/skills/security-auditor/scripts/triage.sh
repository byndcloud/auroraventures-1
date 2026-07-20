#!/usr/bin/env bash
#
# triage.sh — zero-LLM pre-pass for the security-auditor skill.
#
# Scans the working tree (or a passed path) for **smells**, not findings.
# Every hit must be confirmed by reading the code. The output is a list
# of locations to look at, ranked by smell category.
#
# Usage:
#   ./triage.sh                          # scan current directory
#   ./triage.sh path/to/dir              # scan a specific path
#   ./triage.sh --diff                   # scan files changed vs HEAD
#   ./triage.sh --diff origin/main       # scan files changed vs a branch
#
# Notes:
#  - Output to stdout, ranked by category. Empty sections are omitted.
#  - Designed to be cheap and run often; favors precision over recall.
#  - Never prints what it considers a likely-real secret value verbatim;
#    it prints the file:line and a category, but redacts the matched
#    string. (Imperfect — review the line in the file directly.)

set -euo pipefail

SCAN_PATHS=()
DIFF_BASE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --diff)
      DIFF_BASE="${2:-HEAD}"
      shift 2 || shift
      ;;
    --help|-h)
      sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      SCAN_PATHS+=("$1")
      shift
      ;;
  esac
done

if [[ -n "$DIFF_BASE" ]]; then
  if ! command -v git >/dev/null; then
    echo "error: --diff requires git" >&2
    exit 2
  fi
  mapfile -t SCAN_PATHS < <(git diff --name-only --diff-filter=AM "$DIFF_BASE" -- 2>/dev/null || true)
  if [[ ${#SCAN_PATHS[@]} -eq 0 ]]; then
    echo "(no changed files vs $DIFF_BASE)"
    exit 0
  fi
fi

if [[ ${#SCAN_PATHS[@]} -eq 0 ]]; then
  SCAN_PATHS=(".")
fi

# Common excludes: vendored code, lockfiles, minified bundles, build output.
EXCLUDE_DIRS='node_modules|\.git|\.next|\.nuxt|dist|build|target|venv|\.venv|__pycache__|coverage|vendor|third_party'
EXCLUDE_FILES='\.lock$|\.lockb$|-lock\.json$|\.min\.(js|css)$|\.map$|\.svg$|\.png$|\.jpg$|\.gif$|\.pdf$'

# Build a list of files to scan, honoring excludes.
FILES_TMP="$(mktemp)"
trap 'rm -f "$FILES_TMP"' EXIT

for p in "${SCAN_PATHS[@]}"; do
  if [[ -f "$p" ]]; then
    echo "$p"
  elif [[ -d "$p" ]]; then
    find "$p" -type f \
      | grep -Ev "(^|/)($EXCLUDE_DIRS)(/|$)" \
      | grep -Ev "$EXCLUDE_FILES" || true
  fi
done > "$FILES_TMP"

if ! [[ -s "$FILES_TMP" ]]; then
  echo "(no scannable files)"
  exit 0
fi

# Helper: run a grep across the file list, format hits as "path:line:category".
# Args: $1 = pattern, $2 = category label, $3 = optional flags ("-i" etc.)
run_grep() {
  local pattern="$1"
  local label="$2"
  local flags="${3:-}"
  # shellcheck disable=SC2086
  while IFS= read -r f; do
    grep -nE $flags -- "$pattern" "$f" 2>/dev/null \
      | awk -v file="$f" -v label="$label" -F: '{print file ":" $1 ":" label}'
  done < "$FILES_TMP"
}

print_section() {
  local title="$1"
  shift
  if [[ -n "${1:-}" ]]; then
    echo
    echo "## $title"
    printf '%s\n' "$@" | sort -u
  fi
}

# ---------- Likely secrets (high signal) ----------
SECRETS_HITS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && SECRETS_HITS+=("$line (REDACTED)")
done < <(
  run_grep 'AKIA[0-9A-Z]{16}' 'aws-access-key' ''
  run_grep 'ghp_[A-Za-z0-9]{30,}' 'github-pat'
  run_grep 'gh[oprsu]_[A-Za-z0-9]{30,}' 'github-token'
  run_grep 'sk_live_[A-Za-z0-9]{20,}' 'stripe-live-key'
  run_grep 'xox[baprs]-[A-Za-z0-9-]{10,}' 'slack-token'
  run_grep '-----BEGIN [A-Z ]*PRIVATE KEY-----' 'private-key-block'
  run_grep '"(password|secret|api[_-]?key|access[_-]?token)"\s*[:=]\s*"[A-Za-z0-9_/+=-]{16,}"' 'config-secret-shape' '-i'
)

# ---------- Dangerous APIs / sinks ----------
DANGEROUS_HITS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && DANGEROUS_HITS+=("$line")
done < <(
  run_grep '(^|[^a-zA-Z0-9_.])eval\s*\(' 'eval-call'
  run_grep 'dangerouslySetInnerHTML' 'react-dangerous-html'
  run_grep 'v-html=' 'vue-v-html'
  run_grep '\[innerHTML\]' 'angular-innerhtml'
  run_grep '\{@html ' 'svelte-html'
  run_grep 'pickle\.loads' 'python-pickle'
  run_grep 'yaml\.load\s*\(' 'python-yaml-unsafe'
  run_grep 'ObjectInputStream' 'java-objectinputstream'
  run_grep 'Marshal\.load' 'ruby-marshal-load'
  run_grep 'shell\s*=\s*True' 'subprocess-shell-true'
  run_grep '(os\.system|exec\(|execSync|spawn\(.*shell\s*:\s*true)' 'shell-exec'
)

# ---------- Likely concatenated SQL ----------
SQL_HITS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && SQL_HITS+=("$line")
done < <(
  run_grep '(SELECT|INSERT|UPDATE|DELETE)[^;]*\$\{' 'sql-template-literal' '-i'
  run_grep '(SELECT|INSERT|UPDATE|DELETE)[^;]*"\s*\+\s*' 'sql-string-concat' '-i'
  run_grep '(SELECT|INSERT|UPDATE|DELETE)[^;]*%s' 'sql-percent-format' '-i'
  run_grep '(\.raw|\$queryRawUnsafe|unsafeRaw)\s*\(' 'orm-raw-escape-hatch'
)

# ---------- Insecure randomness for security ----------
RAND_HITS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && RAND_HITS+=("$line")
done < <(
  run_grep 'Math\.random\s*\(' 'js-math-random'
  run_grep '(^|[^a-z])random\.random\s*\(' 'py-random-random'
)

# ---------- Committed env / config files (path-based, not content-based) ----------
ENVFILE_HITS=()
while IFS= read -r f; do
  case "$(basename "$f")" in
    .env|.env.*|secrets.json|credentials.json|*.pem|*.p12|*.pfx)
      [[ "$(basename "$f")" == ".env.example" ]] && continue
      [[ "$(basename "$f")" == ".env.sample" ]] && continue
      ENVFILE_HITS+=("$f::env-or-key-file")
      ;;
  esac
done < "$FILES_TMP"

# ---------- Security-tagged TODOs ----------
TODO_HITS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && TODO_HITS+=("$line")
done < <(
  run_grep '(TODO|FIXME|HACK|XXX)[^A-Za-z0-9]*.*(security|auth|authz|authn|leak|exploit|insecure|password|secret|token)' 'security-todo' '-i'
)

# ---------- CORS / Origin smells ----------
CORS_HITS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && CORS_HITS+=("$line")
done < <(
  run_grep 'Access-Control-Allow-Origin.*\*' 'cors-wildcard' '-i'
  run_grep 'Access-Control-Allow-Credentials.*true' 'cors-credentials' '-i'
  run_grep 'cors\(\s*\{[^}]*origin\s*:\s*true' 'cors-origin-true'
)

# ---------- Output ----------

echo "# triage.sh — pre-pass smells"
echo
echo "Scanned $(wc -l < "$FILES_TMP" | tr -d ' ') file(s)."
echo "Each line below is a *smell*, not a finding. Confirm by reading the code."

print_section "Likely secrets" "${SECRETS_HITS[@]:-}"
print_section "Committed env / key files" "${ENVFILE_HITS[@]:-}"
print_section "Dangerous APIs / sinks" "${DANGEROUS_HITS[@]:-}"
print_section "Possible SQL string-build" "${SQL_HITS[@]:-}"
print_section "Insecure randomness for security" "${RAND_HITS[@]:-}"
print_section "Security-tagged TODOs" "${TODO_HITS[@]:-}"
print_section "CORS smells" "${CORS_HITS[@]:-}"

if [[ ${#SECRETS_HITS[@]} -eq 0 \
   && ${#ENVFILE_HITS[@]} -eq 0 \
   && ${#DANGEROUS_HITS[@]} -eq 0 \
   && ${#SQL_HITS[@]} -eq 0 \
   && ${#RAND_HITS[@]} -eq 0 \
   && ${#TODO_HITS[@]} -eq 0 \
   && ${#CORS_HITS[@]} -eq 0 ]]; then
  echo
  echo "(no smells in this pre-pass — proceed with the manual review)"
fi
