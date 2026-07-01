#!/bin/bash

set -e

OUTPUT="knowledge/bundle.md"

# Ensure base structure exists
mkdir -p knowledge
mkdir -p knowledge/shared/decisions
mkdir -p knowledge/domains

# Reset bundle
> "$OUTPUT"

echo "# KNOWLEDGE SYSTEM BUNDLE" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "Generated: $(date)" >> "$OUTPUT"
echo "" >> "$OUTPUT"

# =========================
# SYSTEM
# =========================
echo "========================" >> "$OUTPUT"
echo "## SYSTEM" >> "$OUTPUT"
echo "========================" >> "$OUTPUT"

if [ -f knowledge/system.md ]; then
  cat knowledge/system.md >> "$OUTPUT"
else
  echo "_missing system.md_" >> "$OUTPUT"
fi

echo -e "\n" >> "$OUTPUT"

# =========================
# CORE (legacy support if exists)
# =========================
echo "========================" >> "$OUTPUT"
echo "## CORE (legacy)" >> "$OUTPUT"
echo "========================" >> "$OUTPUT"

if [ -f knowledge/core.md ]; then
  cat knowledge/core.md >> "$OUTPUT"
else
  echo "_missing core.md_" >> "$OUTPUT"
fi

echo -e "\n" >> "$OUTPUT"

# =========================
# ACTIVE WORK
# =========================
echo "========================" >> "$OUTPUT"
echo "## ACTIVE WORK" >> "$OUTPUT"
echo "========================" >> "$OUTPUT"

if [ -f knowledge/active_work.md ]; then
  cat knowledge/active_work.md >> "$OUTPUT"
else
  echo "_missing active_work.md_" >> "$OUTPUT"
fi

echo -e "\n" >> "$OUTPUT"

# =========================
# SHARED DATA MODEL
# =========================
echo "========================" >> "$OUTPUT"
echo "## SHARED DATA MODEL" >> "$OUTPUT"
echo "========================" >> "$OUTPUT"

if [ -f knowledge/shared/data_model.md ]; then
  cat knowledge/shared/data_model.md >> "$OUTPUT"
else
  echo "_missing shared/data_model.md_" >> "$OUTPUT"
fi

echo -e "\n" >> "$OUTPUT"

# =========================
# DOMAINS (supports both locations)
# =========================
echo "========================" >> "$OUTPUT"
echo "## DOMAINS" >> "$OUTPUT"
echo "========================" >> "$OUTPUT"

found_domains=false

if compgen -G "knowledge/domains/*.md" > /dev/null; then
  for file in knowledge/domains/*.md; do
    [ -e "$file" ] || continue
    found_domains=true
    echo "### $(basename "$file")" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n" >> "$OUTPUT"
  done
fi

if compgen -G "knowledge/features/*/domains/*.md" > /dev/null; then
  for file in knowledge/features/*/domains/*.md; do
    [ -e "$file" ] || continue
    found_domains=true
    echo "### $(basename "$file")" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n" >> "$OUTPUT"
  done
fi

if [ "$found_domains" = false ]; then
  echo "_no domains found_" >> "$OUTPUT"
fi

# =========================
# DECISIONS (shared + system-level + feature-level)
# =========================
echo "========================" >> "$OUTPUT"
echo "## DECISIONS" >> "$OUTPUT"
echo "========================" >> "$OUTPUT"

found_decisions=false

# shared decisions
if compgen -G "knowledge/shared/decisions/*.md" > /dev/null; then
  for file in knowledge/shared/decisions/*.md; do
    [ -e "$file" ] || continue
    found_decisions=true
    echo "### shared/$(basename "$file")" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n" >> "$OUTPUT"
  done
fi

# system-level decisions (if you later add them)
if compgen -G "knowledge/system_decisions/*.md" > /dev/null; then
  for file in knowledge/system_decisions/*.md; do
    [ -e "$file" ] || continue
    found_decisions=true
    echo "### system/$(basename "$file")" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n" >> "$OUTPUT"
  done
fi

if [ "$found_decisions" = false ]; then
  echo "_no decisions found_" >> "$OUTPUT"
fi

# =========================
# FEATURES (future-proofing)
# =========================
echo "========================" >> "$OUTPUT"
echo "## FEATURES (if any)" >> "$OUTPUT"
echo "========================" >> "$OUTPUT"

if compgen -G "knowledge/features/*/core.md" > /dev/null; then
  for file in knowledge/features/*/core.md; do
    [ -e "$file" ] || continue
    echo "### $(dirname "$file" | sed 's|knowledge/features/||')" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n" >> "$OUTPUT"
  done
else
  echo "_no feature cores found_" >> "$OUTPUT"
fi

# =========================
# DONE
# =========================
echo "========================" >> "$OUTPUT"
echo "Bundle generated at: $OUTPUT" >> "$OUTPUT"