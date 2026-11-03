import type {
  Branch,
  LedgerEntry,
  NodeStrand,
  TimelineNode,
  Timeline,
} from "./types";

export const PRIME_BRANCH_ID = "prime";

/**
 * The Sacred Timeline as it stands before anyone interferes with it.
 *
 * Three strands, all of them shown: recorded history, the saga this project
 * is a homage to, and the absurdities the archive has quietly let through.
 * They interleave by year, which is the joke - the TVA files a world war and
 * a unionised pigeon on the same branch, in the same hand.
 *
 * Everything here is text. No official logo, title font or film asset is
 * reproduced anywhere in this project; the saga strand is a list of events a
 * fan can name from memory, written in this app's own voice.
 */

/** Recorded history, wars included. */
const REAL_EVENTS: Array<[number, string]> = [
  [1215, "Magna Carta is sealed at Runnymede"],
  [1347, "The Black Death reaches Europe"],
  [1440, "Movable type printing press"],
  [1453, "Constantinople falls"],
  [1492, "Landfall in the Americas"],
  [1517, "The Ninety-five Theses"],
  [1588, "The Spanish Armada is scattered"],
  [1618, "The Thirty Years' War begins"],
  [1687, "Principia Mathematica published"],
  [1756, "The Seven Years' War begins"],
  [1776, "The American Declaration of Independence"],
  [1783, "First manned balloon flight"],
  [1789, "The French Revolution begins"],
  [1804, "Napoleon crowns himself emperor"],
  [1815, "Napoleon is defeated at Waterloo"],
  [1833, "Slavery abolished across the British Empire"],
  [1859, "On the Origin of Species published"],
  [1861, "The American Civil War begins"],
  [1869, "The Suez Canal opens"],
  [1876, "Telephone patented"],
  [1885, "The motor car is patented"],
  [1903, "First powered flight at Kitty Hawk"],
  [1914, "The First World War begins"],
  [1918, "The armistice ends the First World War"],
  [1928, "Penicillin discovered"],
  [1929, "The Wall Street Crash"],
  [1939, "The Second World War begins"],
  [1944, "The Normandy landings"],
  [1945, "The Second World War ends"],
  [1945, "The United Nations is founded"],
  [1947, "India and Pakistan gain independence"],
  [1950, "The Korean War begins"],
  [1955, "The Vietnam War begins"],
  [1957, "Sputnik reaches orbit"],
  [1962, "The Cuban Missile Crisis"],
  [1969, "Moon landing"],
  [1975, "Saigon falls and the Vietnam War ends"],
  [1989, "The Berlin Wall falls"],
  [1991, "The Soviet Union dissolves"],
  [1991, "Public World Wide Web"],
  [2008, "Smartphone era begins"],
  [2020, "A pandemic closes the world"],
];

/**
 * The saga strand - the homage this whole project is.
 *
 * Years are the in-universe ones, so they file correctly alongside recorded
 * history, which is the point: on the Sacred Timeline there is only one
 * sequence and everything is in it.
 */
const SAGA_EVENTS: Array<[number, string]> = [
  [1943, "A frail recruit is made a super-soldier"],
  [1945, "The first Avenger goes into the ice"],
  [1991, "The Starks are killed on a back road"],
  [1995, "A pilot remembers who she was"],
  [2008, "A billionaire builds a suit in a cave"],
  [2010, "A rival arrives with electric whips"],
  [2011, "A thunder god is exiled to New Mexico"],
  [2012, "The Battle of New York"],
  [2013, "A ten-ringed liar is unmasked"],
  [2014, "The spy agency falls to its own HYDRA"],
  [2014, "A band of outlaws saves Xandar"],
  [2015, "A peacekeeping programme rises over Sokovia"],
  [2016, "The Accords split the Avengers"],
  [2016, "A surgeon finds Kamar-Taj"],
  [2017, "Asgard burns and its people sail on"],
  [2018, "Half of all life is snapped away"],
  [2023, "A snap undoes the Snap"],
  [2023, "The man in the iron suit does not come home"],
  [2024, "A grieving witch rewrites a small town"],
  [2024, "A variant is taken by the Time-Variance Authority"],
  [2025, "He Who Remains falls and the timeline branches"],
];

/** The absurdities the archive has quietly let through. */
const ABSURD_EVENTS: Array<[number, string]> = [
  [1289, "A monastery files the same Tuesday twice"],
  [1512, "Venice briefly outlaws Tuesdays"],
  [1665, "A cat is appointed harbourmaster"],
  [1794, "Trousers achieve legal personhood"],
  [1848, "The Atlantic is declared 'provisional'"],
  [1902, "Pigeons unionise"],
  [1957, "Denmark misplaces a decade"],
  [1994, "Cats achieve object permanence"],
  [2011, "Bees invent small talk"],
  [2019, "Gravity files a complaint"],
  [2022, "The sea is asked to keep the noise down"],
];

export function makeId(prefix: string): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

/**
 * Builds the prime timeline: every recorded event, in year order.
 *
 * It used to shuffle and take nine, so no two visits showed the same tree.
 * The archive is the subject now - the whole sequence is on the boughs, and
 * where two events share a year the order they are declared in breaks the
 * tie, which keeps a cause ahead of its consequence.
 */
export function createSeedTimeline(): Timeline {
  const tag = (list: Array<[number, string]>, strand: NodeStrand) =>
    list.map(([year, title]) => ({ year, title, strand }));

  const picked = [
    ...tag(REAL_EVENTS, "recorded"),
    ...tag(SAGA_EVENTS, "saga"),
    ...tag(ABSURD_EVENTS, "anomaly"),
  ].sort((a, b) => a.year - b.year);

  const now = Date.now();
  const nodes: TimelineNode[] = [];
  let parentId: string | null = null;

  for (const { year, title, strand } of picked) {
    const node: TimelineNode = {
      id: makeId("n"),
      parentId,
      branchId: PRIME_BRANCH_ID,
      year,
      title,
      status: "alive",
      origin: "seed",
      strand,
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
