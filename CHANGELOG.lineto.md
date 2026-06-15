# @lineto/fontkit changelog

Lineto's fork of [foliojs/fontkit](https://github.com/foliojs/fontkit), published
to the GitLab npm registry. Versions are `<upstream-base>-lineto.<n>`: the
`<upstream-base>` is the upstream release this build is based on, and `-lineto.<n>`
is our own counter on top of it (collision-proof with upstream's own releases).

## 2.0.4-lineto.3

- Rebuilt on the current foliojs/fontkit master (unreleased after **2.0.4**), which
  includes the Thai and Hebrew shapers, NFC composition, lookup continuation and
  the null anchor fix, so these are no longer Lineto patches
- Lineto patches from the open upstream PRs as of today: #294 (requested features
  apply globally), #324, #338, #370, #371, #372, #373, #377, #381, #405 (combining
  marks reordered like HarfBuzz)
- Fork-only patches: MVAR, STAT, useTypoMetrics, vhea/maxp/post versions, empty
  glyph coordinates, FeatureVariations boundary drift, GlyphInfos on the GlyphRun

## 2.0.4-lineto.2

- Compose canonical decompositions (NFC) in the default shaper
- Evaluate FeatureVariations at the default location

## 2.0.4-lineto.1

- Initial publish as `@lineto/fontkit`, based on foliojs/fontkit **2.0.4** plus
  the Lineto patches on the `lineto` branch.
