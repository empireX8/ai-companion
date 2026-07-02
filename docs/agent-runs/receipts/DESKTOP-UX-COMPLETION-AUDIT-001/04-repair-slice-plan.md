# Repair Slice Plan

Do not create one large `DESKTOP-UX-COMPLETION-001` PR.

Recommended repair slices:

## 1. `DESKTOP-INSPECTOR-TRUST-REPAIR-001`

Target:
- Inspector readability
- section hierarchy
- evidence grouping
- safe back-path behavior
- unavailable-detail fallback honesty

Explicitly avoid:
- schema changes
- new evidence generation logic
- map rail redesign
- broad styling or brand polish

## 2. `DESKTOP-DECISIONS-STATE-HONESTY-001`

Target:
- stop fake outcome recording
- make decision actions truthful
- ensure selected decision state matches the object the user opened
- make due/review actions either work honestly or show honest unavailability

Explicitly avoid:
- new persistence
- new decision lifecycle stages
- broad Explore redesign

## 3. `DESKTOP-TODAY-REENTRY-ACTION-REPAIR-002`

Target:
- correct Today action destinations
- preserve semantic differences between `Add what happened`, `Capture new signal`, and outcome review
- stop Today cards from opening the wrong downstream object

Explicitly avoid:
- redesigning the entire Today layout
- adding new routes
- adding voice here unless required for route truth

## 4. `DESKTOP-CAPTURE-CONTRACT-REPAIR-001`

Target:
- define and present distinct capture modes
- keep capture inside the MindLab `capture -> reveal -> understand` contract
- remove generic chat/journal ambiguity from the capture handoff

Explicitly avoid:
- schema changes
- new storage
- broad Explore chat changes
- advice-first or journaling-first product drift

## 5. `DESKTOP-WATCH-FOR-FIELDWORK-CONTRACT-001`

Target:
- settle Watch For vs Fieldwork naming and route intent
- fix back behavior
- make observation/test language truthful and understandable
- keep linked-source states honest

Explicitly avoid:
- expanding Active Questions scope
- new fieldwork generation logic
- nav expansion unless strictly required by the route contract

## 6. `DESKTOP-MAP-OBJECT-PRESENTATION-REPAIR-001`

Target:
- clean up Model Goals, Mind Context, evidence blocks, and movement presentation
- remove raw-path style exposure
- make support/conflict panels readable

Explicitly avoid:
- reopening Model Goals first-class support
- reopening Mind Context first-class support
- changing object selection contracts

## 7. `DESKTOP-EXPLORE-GROUNDING-REPAIR-001`

Target:
- strengthen model grounding
- repair update/review affordance truth
- keep Explore tied to Orvek/MindLab context

Explicitly avoid:
- turning Explore into a generic chatbot rewrite
- adding broad new chat features

## 8. `DESKTOP-TIMELINE-CONTINUITY-REPAIR-001`

Target:
- strengthen Timeline connection back into evidence and model surfaces
- remove stale labels that imply older journal/import framing

Explicitly avoid:
- media-system expansion
- timeline redesign as a new product surface

## 9. `DESKTOP-VOICE-COVERAGE-001`

Target:
- add voice entry to all text-input surfaces that survive the earlier repairs

Explicitly avoid:
- shipping voice before core route/state honesty is complete
- introducing separate voice-only flows

## Deferred

Remain deferred until after the slices above:
- Import button repair unless imports are MVP-critical
- Branding polish
- broad visual redesign
- settings/profile completion

