#!/usr/bin/env bash
# Guard: no Codebuff attribution in commit messages.
#
# Codebuff stamps the commits it creates with a two-line footer:
#
#   Generated with Codebuff
#   Co-Authored-By: Codebuff <noreply@codebuff.com>
#
# Neither line describes the change - they only record which tool typed it - and
# once such a commit is pushed it cannot be tidied away without rewriting
# history. So the rule is enforced twice against this one implementation: CI
# checks the commits a push adds, and the local commit-msg hook checks the
# message before the commit exists.
#
# Usage:
#   scripts/check_commit_trailers.sh                      # the tip commit only
#   scripts/check_commit_trailers.sh <base>..<head>       # what CI checks
#   scripts/check_commit_trailers.sh --history            # every commit on HEAD
#   scripts/check_commit_trailers.sh --message-file FILE  # a pending message
#
# Exit status: 0 clean, 1 attribution found, 2 usage or git error.
set -euo pipefail

# Both patterns are anchored to the start of a line, because git applies --grep
# line by line: a subject that merely talks about the rule ("revert: drop the
# Codebuff footer") must not be mistaken for attribution. Codebuff counts in
# either position of the trailer, name or address, because this history contains
# both spellings.
TRAILER_RE='^[[:space:]]*co-authored-by:[[:space:]]*.*codebuff'
# The "Generated with" line is usually prefixed with an emoji, so allow leading
# non-alphanumerics rather than requiring it to start the line.
GENERATED_RE='^[^[:alnum:]]*generated with codebuff'

FIX_HINT='Remove the footer and amend the commit before pushing:
  git commit --amend
A commit that already reached a shared branch has to be rewritten to be cleaned.'

usage() {
  cat <<'EOF'
Usage: scripts/check_commit_trailers.sh [<rev>|<base>..<head>]
       scripts/check_commit_trailers.sh --history
       scripts/check_commit_trailers.sh --message-file <file>

Fails if the selected commits (or the pending message) carry Codebuff
attribution: a "Generated with Codebuff" line or a Co-Authored-By trailer
naming Codebuff. Exits 0 when clean, 1 when attribution is found, 2 on a usage
or git error.
EOF
}

history=0
message_file=
revargs=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --history)
      history=1
      shift
      ;;
    --message-file)
      if [ "$#" -lt 2 ]; then
        printf 'error: --message-file needs a path\n' >&2
        exit 2
      fi
      message_file=$2
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      printf 'error: unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
    *)
      revargs+=("$1")
      shift
      ;;
  esac
done

if [ "$history" -eq 1 ] && [ "${#revargs[@]}" -gt 0 ]; then
  printf 'error: --history takes no revision arguments\n' >&2
  exit 2
fi

# --- a pending message -----------------------------------------------------
# The commit-msg hook path: the commit does not exist yet, so there is nothing
# for git log to walk.
if [ -n "$message_file" ]; then
  if [ ! -r "$message_file" ]; then
    printf 'error: cannot read message file: %s\n' "$message_file" >&2
    exit 2
  fi
  # A commented line is not part of the message, so a commit template that
  # happens to mention the rule cannot trip the guard.
  body=$(git stripspace --strip-comments <"$message_file")
  hits=$(printf '%s\n' "$body" | grep -inE "$TRAILER_RE|$GENERATED_RE" || true)
  if [ -n "$hits" ]; then
    printf 'error: this commit message carries Codebuff attribution:\n' >&2
    printf '%s\n' "$hits" | sed 's/^/    /' >&2
    printf '\n%s\n' "$FIX_HINT" >&2
    exit 1
  fi
  printf 'ok: no Codebuff attribution in the pending commit message\n'
  exit 0
fi

# --- commits that already exist --------------------------------------------
if [ "$history" -eq 1 ]; then
  revargs=(HEAD)
elif [ "${#revargs[@]}" -eq 0 ]; then
  # "The tip commit" rather than bare HEAD, which would walk all of history.
  # A root commit has no parent, hence the fallback.
  if git rev-parse -q --verify 'HEAD~1' >/dev/null; then
    revargs=('HEAD~1..HEAD')
  else
    revargs=(HEAD)
  fi
fi

if ! checked=$(git rev-list --count "${revargs[@]}" 2>/dev/null); then
  printf 'error: not a commit or revision range: %s\n' "${revargs[*]}" >&2
  exit 2
fi

offenders=()
while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  offenders+=("$sha")
done < <(
  git log --regexp-ignore-case --extended-regexp \
    --grep="$TRAILER_RE" --grep="$GENERATED_RE" \
    --format='%H' "${revargs[@]}"
)

if [ "${#offenders[@]}" -eq 0 ]; then
  printf 'ok: %s commit(s) checked, no Codebuff attribution\n' "$checked"
  exit 0
fi

if [ "${#offenders[@]}" -eq 1 ]; then
  printf '\nerror: 1 commit carries Codebuff attribution:\n\n' >&2
else
  printf '\nerror: %s commits carry Codebuff attribution:\n\n' "${#offenders[@]}" >&2
fi

for sha in "${offenders[@]}"; do
  git log -1 --format='  %h %s' "$sha" >&2
  git show -s --format=%B "$sha" \
    | grep -inE "$TRAILER_RE|$GENERATED_RE" \
    | sed 's/^/      /' >&2 || true
done

printf '\n%s\n' "$FIX_HINT" >&2
exit 1
