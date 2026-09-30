#!/usr/bin/env bash
# Installs the agent skills this project was reviewed with into ./.claude/skills
# (Claude Code layout; Codex/Cursor users can point their tool at the same folders).
# Usage: bash scripts/install-skills.sh            # all five packs
#        bash scripts/install-skills.sh superpowers # one pack
set -euo pipefail

DEST="${SKILLS_DEST:-.claude/skills}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DEST"

declare -A REPOS=(
  [superpowers]="obra/superpowers"
  [taste-skill]="leonxlnx/taste-skill"
  [ui-ux-pro-max]="nextlevelbuilder/ui-ux-pro-max-skill"
  [mattpocock]="mattpocock/skills"
  [vercel]="vercel-labs/agent-skills"
)
# folder inside each repo that contains <skill>/SKILL.md directories
declare -A PATHS=(
  [superpowers]="skills"
  [taste-skill]="skills"
  [ui-ux-pro-max]=".claude/skills"
  [mattpocock]="skills/engineering skills/productivity skills/misc"
  [vercel]="skills"
)

want=("$@"); [ ${#want[@]} -eq 0 ] && want=("${!REPOS[@]}")
for name in "${want[@]}"; do
  repo="${REPOS[$name]:?unknown pack: $name}"
  echo "→ $name ($repo)"
  git clone --quiet --depth 1 "https://github.com/$repo.git" "$TMP/$name"
  for sub in ${PATHS[$name]}; do
    for dir in "$TMP/$name/$sub"/*/; do
      [ -f "$dir/SKILL.md" ] || continue
      cp -R "$dir" "$DEST/$(basename "$dir")"
      echo "   + $(basename "$dir")"
    done
  done
done
echo "Installed into $DEST"
