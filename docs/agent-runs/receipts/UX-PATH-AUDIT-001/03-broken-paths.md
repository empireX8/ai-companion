# Broken Paths

## 1. Buttons That Do Nothing

- `app/(root)/(routes)/references/_components/ReferenceListPanel.tsx:326-332`
- `app/(root)/(routes)/contradictions/_components/ContradictionListPanel.tsx:518-524`
- `app/(root)/(routes)/audit/_components/AuditListPanel.tsx:152-158`

These are visible overflow buttons with no handler, so they read as interactive chrome but cannot change state.

## 2. Buttons That Call Placeholder Handlers

- `components/orvek-v0/pages/decisions.tsx:137-163`

`Add outcome` returns early in production mode, so the button looks available but does not complete a user-visible action.

- `app/(root)/(routes)/journal/_components/JournalSurface.tsx:331-338`

The Media button opens a picker, but the selected files only update local state and a notice says saving media is not wired yet.

## 3. Links To Missing Routes

- None observed in the live UI tree.

Note: `/what-changed/[id]` is not present as a page route, but no current live UI element links there.

## 4. Routes That Exist But Lack Data

- None observed. The current routes either fetch data or show an explicit empty state.

## 5. Tabs That Render Wrong Content

- `components/inspector/panels/SelectedObjectEvidencePanel.tsx:454-476`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx:1217-1249`

For selected `model_update` objects, the Evidence / Context tab still carries movement-owned copy, including `What would change this`, which overlaps with the Mind Model Movement tab.

## 6. Object Cards That Do Not Open Expected Inspector/Detail Views

- None observed in the currently mounted surfaces. The object cards and row cards that are live either open a detail page or open the inspector as designed.

## 7. Duplicate Paths That Compete For The Same User Intent

- `components/layout/GlobalRail.tsx:41-194` and `components/orvek-workbench/OrvekSidebar.tsx:10-56`
- `components/layout/WorkbenchTopBar.tsx:11-69` and `components/orvek-workbench/OrvekTopBar.tsx:8-87`
- `app/(root)/(routes)/account/page.tsx:1` and `app/(root)/(routes)/settings/page.tsx:1`
- `components/inspector/panels/SelectedObjectEvidencePanel.tsx:1217-1249` and `components/inspector/panels/ModelMovementInspectorPanel.tsx:470-498`

These are not all equally severe, but they do overlap on the same intent: navigate, inspect account settings, or ask what would change a conclusion.

## 8. Empty-State CTAs That Imply Functionality That Does Not Exist

- None observed on the mounted surfaces. The current disabled copy in Today and Explore is explicit about deferred work rather than pretending the action already exists.

