import DefaultShaper from './DefaultShaper';
import GlyphInfo from '../GlyphInfo';

/**
 * Myanmar shaper, ported from HarfBuzz's hb-ot-shaper-myanmar.cc.
 *
 *   - Identifies syllables using a state machine that mirrors HarfBuzz's
 *     Ragel grammar (consonant_syllable, broken_cluster,
 *     non_myanmar_cluster).
 *   - Inserts a dotted circle at the start of each broken cluster so the
 *     cluster has a base to attach to. Matches HarfBuzz, which inserts
 *     at index 0 regardless of any leading kinzi-shaped prefix.
 *   - Runs `initial_reordering_consonant_syllable` per syllable: detects
 *     the kinzi prefix (Ra + Asat + Halant), finds the base consonant,
 *     assigns POS_PRE_C / POS_BASE_C / POS_AFTER_MAIN / POS_PRE_M /
 *     POS_BELOW_C / POS_BEFORE_SUB / POS_AFTER_SUB to every glyph, sorts
 *     by position, then reverses runs of left matras so VPre-preceding
 *     VS marks land in the right order.
 *   - Drives the same GSUB feature pipeline HarfBuzz does: locl + ccmp
 *     (pre-reorder), then rphf, pref, blwf, pstf each as its own pause,
 *     then pres + abvs + blws + psts globally.
 *
 * Categorization is derived from Unicode's IndicSyllabicCategory /
 * IndicPositionalCategory plus the Myanmar-specific overrides from the
 * Microsoft Myanmar spec, applied inline below. Only the codepoints that
 * are actually used by Myanmar shaping (U+1000..U+109F, U+A9E0..U+A9FF,
 * U+AA60..U+AA7F, plus a handful of generic placeholders / variation
 * selectors) are covered — anything else falls through as GB or X.
 */

// Categories — values match the M_Cat enum in HarfBuzz's
// hb-ot-shaper-myanmar-machine.rl. The numeric IDs aren't load-bearing
// (we treat them as opaque tags), but keeping them in sync makes the
// port easier to compare.
const CAT = {
  C: 1,
  IV: 2,
  DB: 3,
  H: 4,
  ZWNJ: 5,
  ZWJ: 6,
  SM: 8,
  A: 9,
  GB: 10,
  DOTTEDCIRCLE: 11,
  Ra: 15,
  CS: 18,
  VAbv: 20,
  VBlw: 21,
  VPre: 22,
  VPst: 23,
  As: 32,
  MH: 35,
  MR: 36,
  MW: 37,
  MY: 38,
  PT: 39,
  VS: 40,
  ML: 41,
  SMPst: 57,
  X: 0
};

// Positions — sort order for the post-reordering glyph sequence. Values
// match the relevant subset of HarfBuzz's ot_position_t enum so the
// reordering rules in initial_reordering_consonant_syllable transcribe
// directly. Note that BEFORE_SUB < BELOW_C — anusvara-like A marks
// (categorized as BEFORE_SUB) sort before below-base vowels.
const POS = {
  PRE_M: 2,
  PRE_C: 3,
  BASE_C: 4,
  AFTER_MAIN: 5,
  BEFORE_SUB: 7,
  BELOW_C: 8,
  AFTER_SUB: 9
};

// Per-codepoint category for the Myanmar block + its extensions. Built
// from the Unicode IndicSyllabicCategory + IndicPositionalCategory plus
// the Microsoft Myanmar overrides; see HarfBuzz's gen-indic-table.py for
// the source of truth. Generated once and inlined here — the data is
// stable across Unicode revisions for the Myanmar blocks.
const CATEGORY_DATA = buildCategoryData();

function buildCategoryData() {
  const data = Object.create(null);
  const set = (cp, cat) => { data[cp] = cat; };
  const range = (start, end, cat) => {
    for (let cp = start; cp <= end; cp++) data[cp] = cat;
  };

  // ---------- U+1000..U+109F (Myanmar) ----------
  range(0x1000, 0x1003, CAT.C);            // KA..GHA
  set(0x1004, CAT.Ra);                     // NGA — forms kinzi
  range(0x1005, 0x1013, CAT.C);            // CA..DHA
  range(0x1014, 0x101A, CAT.C);            // NA..YA
  set(0x101B, CAT.Ra);                     // RA
  range(0x101C, 0x1020, CAT.C);            // LA..LLA
  range(0x1021, 0x102A, CAT.IV);           // A..AU (independent vowels)
  range(0x102B, 0x102C, CAT.VPst);         // VOWEL SIGN TALL AA / AA
  range(0x102D, 0x102E, CAT.VAbv);         // VOWEL SIGN I / II
  range(0x102F, 0x1030, CAT.VBlw);         // VOWEL SIGN U / UU
  set(0x1031, CAT.VPre);                   // VOWEL SIGN E (left)
  set(0x1032, CAT.A);                      // VOWEL SIGN AI (HB override)
  range(0x1033, 0x1035, CAT.VAbv);         // MON II / MON O / E ABOVE
  set(0x1036, CAT.A);                      // ANUSVARA (HB override)
  set(0x1037, CAT.A);                      // DOT BELOW (Tone_Mark)
  set(0x1038, CAT.SM);                     // VISARGA
  set(0x1039, CAT.H);                      // VIRAMA
  set(0x103A, CAT.As);                     // ASAT
  set(0x103B, CAT.MY);                     // MEDIAL YA
  set(0x103C, CAT.MR);                     // MEDIAL RA (pre-base reordering)
  set(0x103D, CAT.MW);                     // MEDIAL WA
  set(0x103E, CAT.MH);                     // MEDIAL HA
  set(0x103F, CAT.C);                      // GREAT SA
  range(0x1040, 0x1049, CAT.GB);           // DIGIT ZERO..NINE
  set(0x104A, CAT.GB);                     // LITTLE SECTION (HB override)
  // U+104B (SECTION) has no override in HB's gen-indic-table.py and falls
  // through to X — leave it un-set so the syllable matcher classifies a
  // bare section sign as non_myanmar_cluster.
  set(0x104E, CAT.C);                      // AFOREMENTIONED (HB override)
  range(0x1050, 0x1051, CAT.C);            // SHA / SSA
  range(0x1052, 0x1055, CAT.IV);           // VOCALIC R..LL
  range(0x1056, 0x1057, CAT.VPst);         // VOCALIC R / RR (right)
  range(0x1058, 0x1059, CAT.VBlw);         // VOCALIC L / LL (bottom)
  set(0x105A, CAT.Ra);                     // MON NGA
  range(0x105B, 0x105D, CAT.C);            // MON JHA / BBA / BBE
  range(0x105E, 0x105F, CAT.MY);           // MON MEDIAL NA / MA
  set(0x1060, CAT.ML);                     // MON MEDIAL LA
  set(0x1061, CAT.C);                      // SGAW KAREN SHA
  set(0x1062, CAT.VPst);                   // SGAW KAREN EU
  range(0x1063, 0x1064, CAT.PT);           // SGAW KAREN tones
  range(0x1065, 0x1066, CAT.C);            // WESTERN PWO KAREN THA / PWA
  range(0x1067, 0x1068, CAT.VPst);         // WESTERN PWO KAREN EU / UE
  range(0x1069, 0x106D, CAT.PT);           // WESTERN PWO KAREN tones
  range(0x106E, 0x1070, CAT.C);            // EASTERN PWO KAREN consonants
  range(0x1071, 0x1074, CAT.VAbv);         // GEBA / KAYAH vowels
  range(0x1075, 0x1081, CAT.C);            // SHAN consonants
  set(0x1082, CAT.MW);                     // SHAN MEDIAL WA
  set(0x1083, CAT.VPst);                   // SHAN AA
  set(0x1084, CAT.VPre);                   // SHAN E (left)
  range(0x1085, 0x1086, CAT.VAbv);         // SHAN E ABOVE / FINAL Y
  range(0x1087, 0x108D, CAT.SM);           // SHAN tones (HB override)
  set(0x108E, CAT.C);                      // RUMAI PALAUNG FA
  set(0x108F, CAT.SM);                     // RUMAI PALAUNG TONE-5 (HB override)
  range(0x1090, 0x1099, CAT.GB);           // SHAN DIGIT ZERO..NINE
  range(0x109A, 0x109C, CAT.SM);           // KHAMTI / AITON tones (HB override)
  set(0x109D, CAT.VAbv);                   // AITON AI

  // ---------- U+A9E0..U+A9FF (Myanmar Extended-B) ----------
  range(0xA9E0, 0xA9E4, CAT.C);            // SHAN GHA..BHA
  set(0xA9E5, CAT.VAbv);                   // SHAN SAW
  range(0xA9E7, 0xA9EF, CAT.C);            // TAI LAING NYA..NNA
  range(0xA9F0, 0xA9F9, CAT.GB);           // TAI LAING DIGIT ZERO..NINE
  range(0xA9FA, 0xA9FE, CAT.C);            // TAI LAING LLA..BHA

  // ---------- U+AA60..U+AA7F (Myanmar Extended-A) ----------
  range(0xAA60, 0xAA6F, CAT.C);            // KHAMTI GA..FA
  range(0xAA71, 0xAA73, CAT.C);            // KHAMTI XA / ZA / RA
  range(0xAA74, 0xAA76, CAT.GB);           // KHAMTI logograms
  set(0xAA7A, CAT.C);                      // AITON RA
  set(0xAA7B, CAT.PT);                     // PAO KAREN TONE
  range(0xAA7C, 0xAA7D, CAT.SM);           // TAI LAING tones (per HB)
  range(0xAA7E, 0xAA7F, CAT.C);            // SHWE PALAUNG CHA / SHA

  // Myanmar Extended-C (U+116D0..U+116E3, Unicode 16) covers PAO KAREN
  // letters/marks. HarfBuzz includes the block in its ALLOWED_BLOCKS for
  // Myanmar categorization (gen-indic-table.py). The codepoints aren't
  // mapped here yet because the unicode-properties package shipped with
  // fontkit predates Unicode 16 and can't categorise them — PAO KAREN
  // runs currently fall through to non_myanmar_cluster. This is a known
  // gap; the script is rare in real text.

  // ---------- Non-Myanmar codepoints used inside Myanmar runs ----------
  set(0x00A0, CAT.GB);                     // NO-BREAK SPACE
  set(0x00D7, CAT.GB);                     // MULTIPLICATION SIGN
  range(0x2012, 0x2015, CAT.GB);           // FIGURE DASH..HORIZONTAL BAR
  set(0x2022, CAT.GB);                     // BULLET
  set(0x25CC, CAT.DOTTEDCIRCLE);           // DOTTED CIRCLE
  range(0x25FB, 0x25FE, CAT.GB);           // GEOMETRIC SHAPES placeholders

  set(0x200C, CAT.ZWNJ);
  set(0x200D, CAT.ZWJ);

  // Variation selectors (Myanmar grammar uses them as VS).
  range(0xFE00, 0xFE0F, CAT.VS);

  return data;
}

function lookupCategory(cp) {
  const cat = CATEGORY_DATA[cp];
  return cat === undefined ? CAT.X : cat;
}

class MyanmarInfo {
  constructor(category, position, syllableType, syllable) {
    this.category = category;
    this.position = position;
    this.syllableType = syllableType;
    this.syllable = syllable;
  }
}

// Consonant-like categories that act as a base.
const CONSONANT_FLAGS = new Set([
  CAT.C,
  CAT.CS,
  CAT.Ra,
  CAT.IV,
  CAT.GB,
  CAT.DOTTEDCIRCLE
]);

function isConsonant(info) {
  return CONSONANT_FLAGS.has(info.category);
}

export default class MyanmarShaper extends DefaultShaper {
  static zeroMarkWidths = 'NONE';

  static planFeatures(plan) {
    plan.addStage(setupSyllables);

    plan.addStage(['locl', 'ccmp']);

    plan.addStage(reorderMyanmar);

    // Basic features — each as its own pause so the substituted glyphs
    // are visible to the next feature. Matches HB's add_gsub_pause
    // sequence in collect_features_myanmar.
    plan.addStage('rphf', false);
    plan.addStage('pref', false);
    plan.addStage('blwf', false);
    plan.addStage('pstf', false);

    // Then the "other" features fire all at once, globally.
    plan.addStage(['pres', 'abvs', 'blws', 'psts']);
  }
}

function setupSyllables(font, glyphs) {
  // Categorise every glyph once, up front.
  const cats = glyphs.map(g => lookupCategory(g.codePoints[0]));

  let syllable = 0;
  let i = 0;
  while (i < glyphs.length) {
    const result = matchSyllable(cats, i);
    ++syllable;
    const end = result.end;
    for (let j = i; j < end; j++) {
      glyphs[j].shaperInfo = new MyanmarInfo(cats[j], 0, result.type, syllable);
    }
    i = end;
  }
}

// Hand-rolled syllable matcher mirroring the Ragel grammar in
// hb-ot-shaper-myanmar-machine.rl:
//
//   j                  = ZWJ | ZWNJ
//   k                  = Ra As H                 (kinzi)
//   sm                 = SM | SMPst
//   c                  = C | Ra
//   medial_group       = MY? As? MR? ((MW MH? ML? | MH ML? | ML) As?)?
//   main_vowel_group   = (VPre VS?)* VAbv* VBlw* A* (DB As?)?
//   post_vowel_group   = VPst MH? ML? As* VAbv* A* (DB As?)?
//   tone_group         = sm | PT A* DB? As?
//   complex_syllable_tail = As* medial_group main_vowel_group
//                           post_vowel_group* tone_group* j?
//   syllable_tail      = (H (c|IV) VS?)* (H | complex_syllable_tail)
//   consonant_syllable = (k | CS)? (c | IV | GB | DOTTEDCIRCLE) VS?
//                         syllable_tail
//   broken_cluster     = k? VS? syllable_tail
//
// We return the longest match at each starting position (Ragel's
// longest-match semantics with `|*`). The match always advances at
// least one glyph — anything that doesn't fit a syllable is its own
// non_myanmar_cluster of length 1.
function matchSyllable(cats, start) {
  const consonant = tryConsonantSyllable(cats, start);
  if (consonant !== -1) {
    return { end: consonant, type: 'consonant_syllable' };
  }

  // Ragel's main machine lists `j | SMPst => non_myanmar_cluster` BEFORE
  // `broken_cluster`. A bare ZWJ / ZWNJ / SMPst would otherwise be
  // absorbed by `broken_cluster` via the `j?` at the tail of
  // `complex_syllable_tail`, and incorrectly get a dotted-circle.
  const cat = cats[start];
  if (cat === CAT.ZWJ || cat === CAT.ZWNJ || cat === CAT.SMPst) {
    return { end: start + 1, type: 'non_myanmar_cluster' };
  }

  const broken = tryBrokenCluster(cats, start);
  if (broken !== -1) {
    return { end: broken, type: 'broken_cluster' };
  }

  return { end: start + 1, type: 'non_myanmar_cluster' };
}

// All match* helpers below take the category array and a starting
// position `p`, and return the position after the longest match (or
// `p` if the sub-pattern matched empty). They never fail — empty
// matches are valid for `?` / `*` sub-rules.

function matchOpt(cats, p, cat) {
  return cats[p] === cat ? p + 1 : p;
}

function matchStar(cats, p, cat) {
  while (cats[p] === cat) p++;
  return p;
}

function matchKinzi(cats, p) {
  // k = Ra As H
  if (cats[p] === CAT.Ra && cats[p + 1] === CAT.As && cats[p + 2] === CAT.H) {
    return p + 3;
  }
  return -1;
}

function matchMedialGroup(cats, p) {
  // MY? As? MR? ((MW MH? ML? | MH ML? | ML) As?)?
  p = matchOpt(cats, p, CAT.MY);
  p = matchOpt(cats, p, CAT.As);
  p = matchOpt(cats, p, CAT.MR);

  // ((MW MH? ML? | MH ML? | ML) As?)?
  let q = p;
  if (cats[q] === CAT.MW) {
    q++;
    q = matchOpt(cats, q, CAT.MH);
    q = matchOpt(cats, q, CAT.ML);
    q = matchOpt(cats, q, CAT.As);
    p = q;
  } else if (cats[q] === CAT.MH) {
    q++;
    q = matchOpt(cats, q, CAT.ML);
    q = matchOpt(cats, q, CAT.As);
    p = q;
  } else if (cats[q] === CAT.ML) {
    q++;
    q = matchOpt(cats, q, CAT.As);
    p = q;
  }

  return p;
}

function matchMainVowelGroup(cats, p) {
  // (VPre VS?)* VAbv* VBlw* A* (DB As?)?
  while (cats[p] === CAT.VPre) {
    p++;
    p = matchOpt(cats, p, CAT.VS);
  }
  p = matchStar(cats, p, CAT.VAbv);
  p = matchStar(cats, p, CAT.VBlw);
  p = matchStar(cats, p, CAT.A);
  if (cats[p] === CAT.DB) {
    p++;
    p = matchOpt(cats, p, CAT.As);
  }
  return p;
}

function matchPostVowelGroup(cats, p) {
  // VPst MH? ML? As* VAbv* A* (DB As?)?
  if (cats[p] !== CAT.VPst) return -1;
  p++;
  p = matchOpt(cats, p, CAT.MH);
  p = matchOpt(cats, p, CAT.ML);
  p = matchStar(cats, p, CAT.As);
  p = matchStar(cats, p, CAT.VAbv);
  p = matchStar(cats, p, CAT.A);
  if (cats[p] === CAT.DB) {
    p++;
    p = matchOpt(cats, p, CAT.As);
  }
  return p;
}

function matchToneGroup(cats, p) {
  // sm | PT A* DB? As?
  if (cats[p] === CAT.SM || cats[p] === CAT.SMPst) {
    return p + 1;
  }
  if (cats[p] === CAT.PT) {
    p++;
    p = matchStar(cats, p, CAT.A);
    p = matchOpt(cats, p, CAT.DB);
    p = matchOpt(cats, p, CAT.As);
    return p;
  }
  return -1;
}

function matchComplexSyllableTail(cats, p) {
  // As* medial_group main_vowel_group post_vowel_group* tone_group* j?
  p = matchStar(cats, p, CAT.As);
  p = matchMedialGroup(cats, p);
  p = matchMainVowelGroup(cats, p);

  let q;
  while ((q = matchPostVowelGroup(cats, p)) !== -1) {
    p = q;
  }
  while ((q = matchToneGroup(cats, p)) !== -1) {
    p = q;
  }

  if (cats[p] === CAT.ZWJ || cats[p] === CAT.ZWNJ) {
    p++;
  }

  return p;
}

function matchSyllableTail(cats, p) {
  // (H (c|IV) VS?)* (H | complex_syllable_tail)
  while (cats[p] === CAT.H && isCOrIV(cats[p + 1])) {
    p += 2;
    p = matchOpt(cats, p, CAT.VS);
  }

  if (cats[p] === CAT.H) {
    return p + 1;
  }

  return matchComplexSyllableTail(cats, p);
}

function isCOrIV(cat) {
  return cat === CAT.C || cat === CAT.Ra || cat === CAT.IV;
}

function tryConsonantSyllable(cats, start) {
  // (k | CS)? (c|IV|GB|DOTTEDCIRCLE) VS? syllable_tail
  let p = start;

  const k = matchKinzi(cats, p);
  if (k !== -1) {
    p = k;
  } else if (cats[p] === CAT.CS) {
    p++;
  }

  if (!isBaseConsonant(cats[p])) return -1;
  p++;
  p = matchOpt(cats, p, CAT.VS);

  return matchSyllableTail(cats, p);
}

function isBaseConsonant(cat) {
  return (
    cat === CAT.C ||
    cat === CAT.Ra ||
    cat === CAT.IV ||
    cat === CAT.GB ||
    cat === CAT.DOTTEDCIRCLE
  );
}

function tryBrokenCluster(cats, start) {
  // k? VS? syllable_tail — only valid if it consumes at least one glyph.
  let p = start;
  const k = matchKinzi(cats, p);
  if (k !== -1) p = k;
  p = matchOpt(cats, p, CAT.VS);

  const tail = matchSyllableTail(cats, p);
  return tail > start ? tail : -1;
}

function reorderMyanmar(font, glyphs, plan) {
  const dottedCircleGlyph = font.glyphForCodePoint(0x25CC);
  if (dottedCircleGlyph) {
    insertDottedCircles(font, glyphs, dottedCircleGlyph.id);
  }

  let start = 0;
  while (start < glyphs.length) {
    const end = nextSyllable(glyphs, start);
    const type = glyphs[start].shaperInfo.syllableType;
    if (type === 'consonant_syllable' || type === 'broken_cluster') {
      reorderConsonantSyllable(glyphs, start, end);
    }
    start = end;
  }
}

function insertDottedCircles(font, glyphs, dottedCircleId) {
  for (let i = 0; i < glyphs.length; i++) {
    if (glyphs[i].shaperInfo.syllableType !== 'broken_cluster') continue;

    // HarfBuzz inserts the dotted circle at the very start of the
    // broken cluster (its `hb_syllabic_insert_dotted_circles` call for
    // Myanmar passes no repha_category, so the kinzi-skipping path is
    // not taken). Insert at `start` regardless of any leading kinzi.
    const start = i;
    const insertAt = start;

    const syllable = glyphs[start].shaperInfo.syllable;
    const g = new GlyphInfo(font, dottedCircleId, [0x25CC]);
    g.shaperInfo = new MyanmarInfo(
      CAT.DOTTEDCIRCLE,
      0,
      'broken_cluster',
      syllable
    );

    glyphs.splice(insertAt, 0, g);

    // Skip past the rest of the syllable.
    i = insertAt;
    while (
      i < glyphs.length &&
      glyphs[i].shaperInfo.syllable === syllable
    ) {
      i++;
    }
    i--; // Compensate for the loop's `i++`.
  }
}

function nextSyllable(glyphs, start) {
  if (start >= glyphs.length) return start;
  const syllable = glyphs[start].shaperInfo.syllable;
  while (
    ++start < glyphs.length &&
    glyphs[start].shaperInfo.syllable === syllable
  );
  return start;
}

// Direct port of HarfBuzz's initial_reordering_consonant_syllable.
function reorderConsonantSyllable(glyphs, start, end) {
  let base = end;
  let hasReph = false;
  let limit = start;

  // 1. Detect a kinzi prefix Ra+As+H and exclude it from base search.
  if (
    start + 3 <= end &&
    glyphs[start].shaperInfo.category === CAT.Ra &&
    glyphs[start + 1].shaperInfo.category === CAT.As &&
    glyphs[start + 2].shaperInfo.category === CAT.H
  ) {
    limit += 3;
    base = start;
    hasReph = true;
  }

  // 2. Find the first consonant in [limit, end) — that's the base.
  if (!hasReph) base = limit;
  for (let i = limit; i < end; i++) {
    if (isConsonant(glyphs[i].shaperInfo)) {
      base = i;
      break;
    }
  }

  // 3. Assign positions. The kinzi prefix goes AFTER_MAIN; anything
  //    else before base is PRE_C; base is BASE_C.
  let i = start;
  for (; i < start + (hasReph ? 3 : 0); i++) {
    glyphs[i].shaperInfo.position = POS.AFTER_MAIN;
  }
  for (; i < base; i++) {
    glyphs[i].shaperInfo.position = POS.PRE_C;
  }
  if (i < end) {
    glyphs[i].shaperInfo.position = POS.BASE_C;
    i++;
  }

  // 4. Walk forward from base, assigning positions for everything
  //    after the base. This loop implements the entirety of HarfBuzz's
  //    Myanmar reordering — the position transitions encode the spec.
  let pos = POS.AFTER_MAIN;
  for (; i < end; i++) {
    const info = glyphs[i].shaperInfo;

    if (info.category === CAT.MR) {
      info.position = POS.PRE_C; // pre-base reordering
      continue;
    }
    if (info.category === CAT.VPre) {
      info.position = POS.PRE_M; // left matra
      continue;
    }
    if (info.category === CAT.VS) {
      info.position = glyphs[i - 1].shaperInfo.position;
      continue;
    }

    if (pos === POS.AFTER_MAIN && info.category === CAT.VBlw) {
      pos = POS.BELOW_C;
      info.position = pos;
      continue;
    }

    if (pos === POS.BELOW_C && info.category === CAT.A) {
      info.position = POS.BEFORE_SUB;
      continue;
    }
    if (pos === POS.BELOW_C && info.category === CAT.VBlw) {
      info.position = pos;
      continue;
    }
    if (pos === POS.BELOW_C && info.category !== CAT.A) {
      pos = POS.AFTER_SUB;
      info.position = pos;
      continue;
    }

    info.position = pos;
  }

  // 5. Stable sort the syllable by position. Stable so that equal
  //    positions preserve their relative order.
  const slice = glyphs.slice(start, end);
  const indexed = slice.map((g, idx) => ({ g, idx }));
  indexed.sort((a, b) => {
    const d = a.g.shaperInfo.position - b.g.shaperInfo.position;
    return d !== 0 ? d : a.idx - b.idx;
  });
  for (let j = 0; j < indexed.length; j++) {
    glyphs[start + j] = indexed[j].g;
  }

  // 6. Flip the left-matra run. If multiple VPre marks ended up
  //    adjacent (with possible VS interleaved), they need to be in
  //    reversed input order — but each VPre's trailing VS should still
  //    follow the VPre, so we re-reverse each VPre..VPre slice.
  //    See https://github.com/harfbuzz/harfbuzz/issues/3863.
  let firstLeftMatra = end;
  let lastLeftMatra = end;
  for (let j = start; j < end; j++) {
    if (glyphs[j].shaperInfo.position === POS.PRE_M) {
      if (firstLeftMatra === end) firstLeftMatra = j;
      lastLeftMatra = j;
    }
  }

  if (firstLeftMatra < lastLeftMatra) {
    reverseRange(glyphs, firstLeftMatra, lastLeftMatra + 1);
    let k = firstLeftMatra;
    for (let j = k; j <= lastLeftMatra; j++) {
      if (glyphs[j].shaperInfo.category === CAT.VPre) {
        reverseRange(glyphs, k, j + 1);
        k = j + 1;
      }
    }
  }
}

function reverseRange(glyphs, start, end) {
  for (let i = start, j = end - 1; i < j; i++, j--) {
    const tmp = glyphs[i];
    glyphs[i] = glyphs[j];
    glyphs[j] = tmp;
  }
}
