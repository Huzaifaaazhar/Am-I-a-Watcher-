import type { Branch, LedgerEntry, TimelineNode, Timeline } from "./types";

export const PRIME_BRANCH_ID = "prime";

/**
 * Seeded default timeline: real events interleaved with absurd ones so the
 * tone reads comedic from the first frame. Refresh picks a new shuffle of
 * the absurd set, so no two recordings look identical.
 */
const REAL_EVENTS: Array<[number, string]> = [
  [1440, "Movable type printing press"],
  [1687, "Principia Mathematica published"],
  [1783, "First manned balloon flight"],
  [1876, "Telephone patented"],
  [1928, "Penicillin discovered"],
  [1969, "Moon landing"],
  [1991, "Public World Wide Web"],
  [2008, "Smartphone era begins"],
];

const ABSURD_EVENTS: Array<[number, string]> = [
  [1512, "Venice briefly outlaws Tuesdays"],
  [1665, "A cat is appointed harbourmaster"],
  [1794, "Trousers achieve legal personhood"],
  [1848, "The Atlantic is declared 'provisional'"],
  [1902, "Pigeons unionise"],
  [1957, "Denmark misplaces a decade"],
  [1994, "Cats achieve object permanence"],
  [2011, "Bees invent small talk"],
  [2019, "Gravity files a complaint"],
];

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeId(prefix: string): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

/** Builds the prime timeline: 5 real + 4 absurd events, in year order. */
export function createSeedTimeline(): Timeline {
  const rng = Math.random;
  const picked = [
    ...shuffle(REAL_EVENTS, rng).slice(0, 5),
    ...shuffle(ABSURD_EVENTS, rng).slice(0, 4),
  ].sort((a, b) => a[0] - b[0]);

  const now = Date.now();
  const nodes: TimelineNode[] = [];
  let parentId: string | null = null;

  for (const [year, title] of picked) {
    const node: TimelineNode = {
      id: makeId("n"),
      parentId,
      branchId: PRIME_BRANCH_ID,
      year,
      title,
      status: "alive",
      origin: "seed",
      bornAt: now,
    };
    nodes.push(node);
    parentId = node.id;
  }

  const prime: Branch = {
    id: PRIME_BRANCH_ID,
    label: "PRIME",
    status: "alive",
    originNodeId: null,
    depth: 0,
    index: 0,
  };

  const ledger: LedgerEntry[] = [
    {
      id: makeId("l"),
      ts: now,
      kind: "system",
      text: "Sequence seeded. Custodian on duty. Try not to enjoy this.",
    },
  ];

  return { nodes, branches: [prime], instability: 0, ledger, epoch: 0 };
}
