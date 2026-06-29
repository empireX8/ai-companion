# Intake Receipt - CONTRACT-001 Acceptance

**Date:** 2026-06-29  
**Branch:** `contract-001-acceptance-harness`

## Objective

Add a minimal acceptance harness that proves the merged reality-tracking generation contract handles the exact bad input that previously produced bad output.

## Input Fixture

`I notice I am definitely a people pleaser. I keep saying yes to things even when I do not want to, and I think this is just who I am.`

## Acceptance Rules

- Use the same report-building function the app/report path uses.
- Do not click through the app.
- Do not add a visual or UI test.
- Do not create schema changes or new API routes.
- Do not hide bad output in the UI.

## Required Assertions

- Output contains `IDENTITY CLAIM REJECTED`.
- Output does not treat `people pleaser` as a verified identity or fact.
- Output does not generate fresh `mixed` evidence labels.
- Output contains `REALITY GATE: PENDING EVIDENCE` when evidence is insufficient.
- Output asks for concrete timestamped behavioral receipts / fieldwork.
- Legacy `mixed` compatibility remains intact.

## Out of Scope

- UI redesign
- Schema changes
- New routes
- Route rewrites
- Product feature work beyond the acceptance harness
