# Blocker Priority Map

## Priority order

| Rank | Blocker | Class | Why this rank | Repair first? |
|---|---|---|---|---|
| 1 | Inspector UX | Trust + core-loop blocker | The product cannot defend evidence-backed understanding if the central evidence view is unreadable, state-replacing, and hard to correct. | Yes |
| 2 | Decisions flow | State-honesty blocker | It can record outcomes without collecting them and exposes dead decision actions, which creates misleading object state. | After Inspector |
| 3 | Today action routing | Re-entry blocker | Today is the main re-entry surface, but its action links route users into wrong or unfinished flows. | After Decisions honesty is defined |
| 4 | Capture Life Data UX contract | Entry-point blocker | The app cannot reliably enter the loop if capture types collapse into one generic chat/journal surface. | After Today routing semantics are fixed |
| 5 | Watch For / Fieldwork architecture | Route and contract blocker | Fieldwork naming, discoverability, and back behavior are inconsistent, which breaks downstream loop continuity. | After Today and Capture semantics |
| 6 | Map object presentation | Readability blocker | The map exposes under-formed object states, but its cleanup should build on stable inspector behavior rather than precede it. | After Inspector |
| 7 | Explore grounding | Secondary loop blocker | Explore is directionally usable, but it is not the first trust or state-risk surface to repair. | Later |
| 8 | Timeline continuity | Secondary continuity blocker | Timeline loads, but its remaining issues are weaker than Today, Capture, and Decisions. | Later |
| 9 | Voice input coverage | Cross-cutting requirement | Important for launch readiness, but not before state honesty and route correctness. | Defer |
| 10 | Import button | MVP-decision item | Broken, but lower leverage than the core loop blockers unless imports become MVP-critical. | Defer |

## Why Inspector is first

- It is the main trust surface.
- It sits between evidence and object understanding.
- Map cleanup depends on it.
- Explore and Timeline continuity become easier to judge after it is stable.

## What is not first

Not first:
- broad visual polish
- typography or brand work
- voice coverage
- import repair
- profile/settings cleanup

