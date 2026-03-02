#!/bin/bash
# ──────────────────────────────────────────────────
# auto-pr.sh — Push current branch & create a PR
# Usage:  ./auto-pr.sh [target-branch]
#         target defaults to "main"
# ──────────────────────────────────────────────────
set -euo pipefail

TARGET="${1:-main}"
BRANCH=$(git branch --show-current)

# ── Guard rails ──────────────────────────────────
if [ -z "$BRANCH" ]; then
  echo "❌ Could not detect current branch (detached HEAD?)."
  exit 1
fi

if [ "$BRANCH" = "$TARGET" ]; then
  echo "❌ You're already on '$TARGET'. Switch to a feature branch first."
  exit 1
fi

# ── Check for gh CLI ─────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "❌ GitHub CLI (gh) is not installed. Install with: brew install gh"
  exit 1
fi

# ── Check gh authentication ─────────────────────
if ! gh auth status &>/dev/null; then
  echo "❌ Not authenticated. Run: gh auth login"
  exit 1
fi

# ── Check for existing PR ───────────────────────
EXISTING=$(gh pr list --head "$BRANCH" --base "$TARGET" --json number --jq '.[0].number' 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "⚠️  PR #$EXISTING already exists for $BRANCH → $TARGET"
  echo "   https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pull/$EXISTING"
  read -rp "Open in browser? (y/n) " ans
  if [[ "$ans" =~ ^[Yy]$ ]]; then
    gh pr view "$EXISTING" --web
  fi
  exit 0
fi

# ── Generate PR title from branch name ──────────
#    e.g. "feature/add-holidays" → "Feature/Add Holidays"
PR_TITLE=$(echo "$BRANCH" | sed 's/[-_]/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')

# ── Generate PR body from commit log ─────────────
COMMIT_LOG=$(git log "$TARGET..$BRANCH" --pretty=format:"- %s" --reverse 2>/dev/null || true)
if [ -z "$COMMIT_LOG" ]; then
  COMMIT_LOG="- *(no new commits)*"
fi

PR_BODY="## Summary
Auto-generated PR from \`$BRANCH\` → \`$TARGET\`.

## Changes
$COMMIT_LOG

---
*Created with auto-pr.sh*"

# ── Push branch ──────────────────────────────────
echo "🚀 Pushing '$BRANCH' to origin..."
git push -u origin "$BRANCH"

# ── Create PR ────────────────────────────────────
echo ""
echo "📝 Creating PR: $PR_TITLE"
echo "   $BRANCH → $TARGET"
echo ""

gh pr create \
  --base "$TARGET" \
  --head "$BRANCH" \
  --title "$PR_TITLE" \
  --body "$PR_BODY"

echo ""
echo "✅ Done! PR created successfully."
