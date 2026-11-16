/**
 * The "Pro" feature this sample app sells: condense a block of notes into its
 * key sentences.
 *
 * Plain extractive scoring, no model and no API key: each sentence is scored
 * by how many of the text's most frequent meaningful words it contains, and
 * the best ones are returned in their original order. It runs on the server
 * so the gate in front of it is real -- there is nothing in the browser to
 * unlock by editing the page.
 */

const STOP = new Set(
  "a an and are as at be been but by for from had has have he her his i if in into is it its of on or our she so that the their them then there these they this to was we were what when which who will with you your not no do does did can could should would than too very just about over also more most some any each".split(
    " ",
  ),
);

const words = (s: string) => s.toLowerCase().match(/[a-z0-9']+/g) ?? [];

export type Summary = {
  keyPoints: string[];
  words: number;
  sentences: number;
  /** At 200 words a minute. */
  readingMinutes: number;
};

export function summarise(text: string, maxPoints = 3): Summary {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => words(s).length >= 4);

  const frequency = new Map<string, number>();
  for (const w of words(text)) {
    if (!STOP.has(w) && w.length > 2) frequency.set(w, (frequency.get(w) ?? 0) + 1);
  }

  const ranked = sentences
    .map((sentence, index) => {
      const ws = words(sentence).filter((w) => frequency.has(w));
      const score = ws.reduce((sum, w) => sum + (frequency.get(w) ?? 0), 0);
      // Normalised by length so a long sentence does not win just by being long.
      return { sentence, index, score: ws.length ? score / Math.sqrt(ws.length) : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPoints)
    .sort((a, b) => a.index - b.index);

  const count = words(text).length;
  return {
    keyPoints: ranked.map((r) => r.sentence),
    words: count,
    sentences: sentences.length,
    readingMinutes: Math.max(1, Math.round(count / 200)),
  };
}
