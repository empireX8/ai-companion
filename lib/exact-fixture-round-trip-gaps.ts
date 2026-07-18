/**
 * Exact fixture round-trip gaps: production storage/API contracts that cannot
 * currently carry the frozen reference composition without inventing fields
 * or altering canonical presentation.
 *
 * Used by the exact round-trip gate — not an excuse for approximate "twin" pass.
 */

export type ExactRoundTripGap = {
  id: string;
  fixtureContract: string;
  fixtureValue: string;
  productionPath: string;
  missingContract: string;
};

export const EXACT_FIXTURE_ROUND_TRIP_GAPS: ExactRoundTripGap[] = [
  {
    id: "report-typed-entity",
    fixtureContract: "today.reportId / objects[rep-weekly].type",
    fixtureValue: 'id="rep-weekly" type="report" title="Weekly Model Movement"',
    productionPath: "Prisma ModelUpdate + reportReady projection",
    missingContract:
      "No first-class Report / typed report row. Live reportId is a ModelUpdate id when reportReady; cannot round-trip fixture type=report identity.",
  },
  {
    id: "report-side-rail-title",
    fixtureContract: "today.reportTitle",
    fixtureValue: "Weekly Model Movement report",
    productionPath: "mapTodayDataToV0Props → report.title = TODAY_REPORT_OUTPUT_TITLE",
    missingContract:
      'Today report slot title is hardcoded to "What Changed"; no persisted field feeds "Weekly Model Movement report" through hybrid → live provider.',
  },
  {
    id: "report-side-rail-meta",
    fixtureContract: "today.reportMeta",
    fixtureValue: "Ready · 3 loops, 2 decisions, 1 context update",
    productionPath: "mapTodayDataToV0Props → report.meta from intelligenceUpdates.length",
    missingContract:
      'Live meta is "{n} published movement(s) in this window"; no storage for fixture loop/decision/context counts in report meta.',
  },
  {
    id: "today-lead-decision-with-movements",
    fixtureContract: "today.leadId + today.movements",
    fixtureValue: 'leadId="d1" (decision) alongside 3 Recent Model Movement cards',
    productionPath: "pickTodayHeroItem → first intelligence update when any exist",
    missingContract:
      "Production Today composition cannot select a decision lead while still surfacing MU movements as hero-first; fixture hardcodes both.",
  },
  {
    id: "lead-narrative-fields",
    fixtureContract: "today.leadNarrative / leadWhatChanged / leadLastEvidence / leadKicker",
    fixtureValue:
      "Outcome window closed / 2 hours ago / Most consequential now · decision outcome due + authored narrative",
    productionPath: "hero.typeLabel / formatRelativeTime(occurredAt) / laneLabel",
    missingContract:
      "Authored lead narrative and fixed relative time are composition strings, not decision columns round-tripped 1:1.",
  },
  {
    id: "now-row-authored-titles",
    fixtureContract: "today.nowRows[].title/status/kicker order",
    fixtureValue:
      "Scope-reopening pattern triggered again · Small public test… · Ship prototype… · Which features…",
    productionPath: "buildTodayAttentionRows / fieldwork / openLoopRows from live snapshot",
    missingContract:
      "NOW row titles/status/order are derived, not an authored ordered list persisted as fixture composition.",
  },
  {
    id: "briefing-meta",
    fixtureContract: "today.briefingMeta",
    fixtureValue:
      "2 reviews are due and 1 report is ready. Start where the change is most consequential.",
    productionPath: "buildTodayBriefingMeta",
    missingContract:
      "Briefing meta is generated from counts, not the fixture sentence.",
  },
  {
    id: "briefing-line-weekday",
    fixtureContract: "today.briefingLine",
    fixtureValue: "Tuesday · since your last visit",
    productionPath: "todayCopy.briefingLine from briefingDate",
    missingContract:
      "Weekday is clock/fixture authored; production uses real briefingDate.",
  },
  {
    id: "timeline-densograph",
    fixtureContract: "timelineGroups t1… authored events",
    fixtureValue: "Frozen timeline object graph",
    productionPath: "timeline production API / hybrid",
    missingContract:
      "No exact densograph timeline event table matching fixture t* identities and copy.",
  },
  {
    id: "explore-starting-state",
    fixtureContract: "exploreMovement / sample conversation",
    fixtureValue: "Fixture explore grounding + movement chips",
    productionPath: "explore hybrid surfaces",
    missingContract:
      "Explore starting conversation/chips are not an exact persisted densograph round-trip of the fixture sample.",
  },
  {
    id: "decision-densograph-fields",
    fixtureContract: "decision options / pros / cons / projection fields",
    fixtureValue: "Frozen decision object typed fields",
    productionPath: "SurfacedAction + related entities",
    missingContract:
      "Decision densograph (options/pros/cons) is thinner via SurfacedAction than fixture OrvekObject decision fields.",
  },
];

export function formatExactRoundTripGapsMarkdown(): string {
  return EXACT_FIXTURE_ROUND_TRIP_GAPS.map(
    (g) =>
      `### \`${g.id}\`\n- **Fixture:** \`${g.fixtureContract}\` = ${JSON.stringify(g.fixtureValue)}\n- **Production path:** ${g.productionPath}\n- **Missing contract:** ${g.missingContract}\n`,
  ).join("\n");
}
