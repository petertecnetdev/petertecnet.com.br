#!/usr/bin/env bash
set -euo pipefail

ROOT="$(mktemp -d "${TMPDIR:-/tmp}/peter-deploy-guard-test.XXXXXX")"
trap 'rm -rf "$ROOT"' EXIT

WORKFLOW=".github/workflows/reusable-vps-deploy.yml"
test -f "$WORKFLOW"
grep -q 'git cherry "$TARGET_SHA" "$OLD_SHA"' "$WORKFLOW"
grep -q 'Local source change already preserved in target' "$WORKFLOW"
grep -q '.dist.previous.\*' "$WORKFLOW"
grep -q 'UNPRESERVED_SOURCE_CHANGES' "$WORKFLOW"

init_repo() {
  local path="$1"
  mkdir -p "$path"
  git -C "$path" init -q
  git -C "$path" config user.name 'Peter Tecnet Guard Test'
  git -C "$path" config user.email 'guard-test@petertecnet.invalid'
}

is_generated_path() {
  local path="$1"
  case "$path" in
    storage/*|bootstrap/cache/*|node_modules/*|vendor/*|dist/*|build/*|artifacts/*|.automation-evolve/*) return 0 ;;
    .dist.previous.*/*|.dist.next.*/*|.dist.failed.*/*|.build.previous.*/*|.build.next.*/*|.build.failed.*/*) return 0 ;;
    dist.rollback.*/*|build.rollback.*/*) return 0 ;;
    .env|.env.*) return 0 ;;
  esac
  [[ "$path" =~ \.bak\.[0-9]{8}-[0-9]{6}-[0-9]+$ ]] && return 0
  return 1
}

count_unpreserved() {
  local target_sha="$1"
  local unsafe=0

  while IFS= read -r -d '' change; do
    path="${change:3}"
    if is_generated_path "$path"; then
      continue
    fi

    preserved=false
    if [[ -f "$path" && ! -L "$path" ]]; then
      target_entry="$(git ls-tree "$target_sha" -- "$path" 2>/dev/null || true)"
      if [[ -n "$target_entry" ]]; then
        target_mode="$(printf '%s\n' "$target_entry" | awk '{print $1}')"
        target_blob="$(printf '%s\n' "$target_entry" | awk '{print $3}')"
        local_blob="$(git hash-object -- "$path" 2>/dev/null || true)"
        if [[ -x "$path" ]]; then local_mode='100755'; else local_mode='100644'; fi
        if [[ "$local_blob" == "$target_blob" && "$local_mode" == "$target_mode" ]]; then
          preserved=true
        fi
      fi
    elif [[ ! -e "$path" && ! -L "$path" ]]; then
      if ! git cat-file -e "$target_sha:$path" 2>/dev/null; then
        preserved=true
      fi
    fi

    [[ "$preserved" == 'true' ]] || unsafe=$((unsafe + 1))
  done < <(git status --porcelain=v1 -z --untracked-files=all --no-renames)

  printf '%s' "$unsafe"
}

init_repo "$ROOT/source"
cd "$ROOT/source"
echo v1 > app.txt
git add app.txt
git commit -qm base
BASE="$(git rev-parse HEAD)"
echo v2 > app.txt
git commit -qam target
TARGET="$(git rev-parse HEAD)"
git reset -q --hard "$BASE"

echo v2 > app.txt
[[ "$(count_unpreserved "$TARGET")" == '0' ]]
echo '✓ exact target bytes converge safely'

echo local-only > app.txt
[[ "$(count_unpreserved "$TARGET")" == '1' ]]
echo '✓ different local bytes remain blocked'

git reset -q --hard "$BASE"
git checkout -qb target-new "$BASE"
echo new > new.txt
git add new.txt
git commit -qm target-new
TARGET_NEW="$(git rev-parse HEAD)"
git checkout -q --detach "$BASE"
echo new > new.txt
[[ "$(count_unpreserved "$TARGET_NEW")" == '0' ]]
echo '✓ identical untracked target file converges safely'

mkdir -p .dist.previous.123/assets
echo old > .dist.previous.123/assets/app.js
[[ "$(count_unpreserved "$TARGET_NEW")" == '0' ]]
echo unsafe > unsafe.js
[[ "$(count_unpreserved "$TARGET_NEW")" == '1' ]]
echo '✓ atomic release artifacts are ignored while source remains protected'

init_repo "$ROOT/history"
cd "$ROOT/history"
echo base > x
git add x
git commit -qm base
BASE2="$(git rev-parse HEAD)"
git checkout -qb upstream "$BASE2"
echo change > x
git commit -qam upstream-copy
UPSTREAM="$(git rev-parse HEAD)"
git checkout -qb local "$BASE2"
echo change > x
git commit -qam local-copy
LOCAL_EQ="$(git rev-parse HEAD)"
CHERRY_EQ="$(git cherry "$UPSTREAM" "$LOCAL_EQ")"
[[ "$CHERRY_EQ" == -\ * ]]
echo '✓ patch-equivalent local commit is recognized as preserved'

echo unique >> x
git commit -qam unique-local
LOCAL_UNIQUE="$(git rev-parse HEAD)"
CHERRY_UNIQUE="$(git cherry "$UPSTREAM" "$LOCAL_UNIQUE")"
printf '%s\n' "$CHERRY_UNIQUE" | grep -q '^+'
echo '✓ unique local commit remains blocked'

echo 'Deploy safety guard contracts OK'
