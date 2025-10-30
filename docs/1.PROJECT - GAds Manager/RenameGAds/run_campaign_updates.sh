#!/bin/bash

# Campaign Name Update Batch Execution Script
# This script runs the campaign name updates month-by-month to avoid overwhelming the system

echo "=================================================="
echo "Campaign Name Standardization - Batch Execution"
echo "=================================================="
echo ""
echo "This script will update campaign names in monthly batches."
echo ""
echo "⚠️  IMPORTANT: Before running this script with --live:"
echo "   1. Rename campaigns in Google Ads to canonical names"
echo "   2. Test with --dry-run first"
echo "   3. Backup your database"
echo ""

# Parse mode
MODE="--dry-run"
if [[ "$1" == "--live" ]]; then
  MODE="--live"
  echo "🔴 LIVE MODE - Changes will be written to database!"
  echo ""
  read -p "Are you sure you want to proceed? (yes/no): " confirm
  if [[ "$confirm" != "yes" ]]; then
    echo "Cancelled."
    exit 0
  fi
else
  echo "🔍 DRY RUN MODE - No changes will be made"
  echo "   (use --live to actually update records)"
fi

echo ""
echo "=================================================="
echo ""

# Function to run update for a specific period
run_update() {
  local year=$1
  local month=$2
  local period_name=$3

  echo ""
  echo "📅 Processing: $period_name"
  echo "---------------------------------------------------"

  if [[ -z "$month" ]]; then
    # Year only
    node /home/hub/public_html/gads/update_campaign_names.js $MODE --year=$year
  else
    # Year and month
    node /home/hub/public_html/gads/update_campaign_names.js $MODE --year=$year --month=$month
  fi

  local exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    echo ""
    echo "❌ Error occurred during $period_name"
    echo "Exit code: $exit_code"
    read -p "Continue with next batch? (yes/no): " continue_choice
    if [[ "$continue_choice" != "yes" ]]; then
      echo "Stopping batch execution."
      exit 1
    fi
  fi

  echo ""
  echo "✅ Completed: $period_name"

  # Pause between batches (only in live mode)
  if [[ "$MODE" == "--live" ]]; then
    echo "Waiting 2 seconds before next batch..."
    sleep 2
  fi
}

# Option 1: Run by entire year (faster, larger batches)
run_by_year() {
  echo "Running updates by YEAR..."
  echo ""

  run_update 2022 "" "2022 (All Months)"
  run_update 2023 "" "2023 (All Months)"
  run_update 2024 "" "2024 (All Months)"
  run_update 2025 "" "2025 (All Months)"
}

# Option 2: Run by individual month (slower, smaller batches)
run_by_month() {
  echo "Running updates by MONTH..."
  echo ""

  # 2022
  for month in {1..12}; do
    run_update 2022 $month "2022-$(printf '%02d' $month)"
  done

  # 2023
  for month in {1..12}; do
    run_update 2023 $month "2023-$(printf '%02d' $month)"
  done

  # 2024
  for month in {1..12}; do
    run_update 2024 $month "2024-$(printf '%02d' $month)"
  done

  # 2025 (up to October)
  for month in {1..10}; do
    run_update 2025 $month "2025-$(printf '%02d' $month)"
  done
}

# Ask user which approach to use
echo ""
echo "Select batch approach:"
echo "  1) By YEAR (4 batches - faster, ~2700 contacts per year)"
echo "  2) By MONTH (46 batches - slower, ~200-300 contacts per month)"
echo ""
read -p "Choose option (1 or 2): " batch_option

case $batch_option in
  1)
    run_by_year
    ;;
  2)
    run_by_month
    ;;
  *)
    echo "Invalid option. Exiting."
    exit 1
    ;;
esac

echo ""
echo "=================================================="
echo "✅ All batches completed!"
echo "=================================================="

if [[ "$MODE" == "--dry-run" ]]; then
  echo ""
  echo "This was a DRY RUN. To apply changes, run:"
  echo "  bash run_campaign_updates.sh --live"
fi

echo ""
