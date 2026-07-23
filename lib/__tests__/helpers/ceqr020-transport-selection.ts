/**
 * Test-only helpers for CEQR-020 boundary-index transport fixtures.
 * Not a production API.
 */

import {
  boundarySelectionForFullSource,
  boundarySelectionForOffsets,
  type EvidenceSpanSelection,
} from "../../orvek-intelligence-kernel";

export function transportSelectionForOffsets(
  sourceText: string,
  startOffset: number,
  endOffset: number,
): EvidenceSpanSelection {
  const selection = boundarySelectionForOffsets(
    sourceText,
    startOffset,
    endOffset,
  );
  if (!selection) {
    throw new Error(
      `test fixture offsets ${startOffset}-${endOffset} are not valid lexical boundaries for ${JSON.stringify(sourceText)}`,
    );
  }
  return selection;
}

export function transportSelectionForFullSource(
  sourceText: string,
): EvidenceSpanSelection {
  return boundarySelectionForFullSource(sourceText);
}

export function transportSelectionForSubstring(
  sourceText: string,
  exactQuote: string,
): EvidenceSpanSelection {
  const startOffset = sourceText.indexOf(exactQuote);
  if (startOffset < 0) {
    throw new Error(`substring not found: ${JSON.stringify(exactQuote)}`);
  }
  return transportSelectionForOffsets(
    sourceText,
    startOffset,
    startOffset + exactQuote.length,
  );
}
