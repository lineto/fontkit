import * as fontkit from 'fontkit';
import assert from 'assert';

describe('metadata', function () {
  let font = fontkit.openSync(
    new URL('data/NotoSans/NotoSans.ttc', import.meta.url),
    'NotoSans',
  );

  it('has metadata properties', function () {
    assert.equal(font.fullName, 'Noto Sans');
    assert.equal(font.postscriptName, 'NotoSans');
    assert.equal(font.familyName, 'Noto Sans');
    assert.equal(font.subfamilyName, 'Regular');
    assert.equal(
      font.copyright,
      'Copyright 2012 Google Inc. All Rights Reserved.',
    );
    return assert.equal(font.version, 'Version 1.05 uh');
  });

  it('exposes some metrics', function () {
    assert.equal(font.unitsPerEm, 2048);
    assert.equal(font.ascent | 0, 2189);
    assert.equal(font.descent | 0, -600);
    assert.equal(font.lineGap, 0);
    assert.equal(font.underlinePosition, -154);
    assert.equal(font.underlineThickness, 102);
    assert.equal(font.italicAngle, 0);
    assert.equal(font.capHeight, 1462);
    assert.equal(font.xHeight, 1098);
    assert.equal(font.numGlyphs, 8708);
    assert.equal(font.bbox.minX, -1268);
    assert.equal(font.bbox.minY, -600);
    assert.equal(font.bbox.maxX, 2952);
    assert.equal(font.bbox.maxY, 2189);
  });

  it('reads the vertical metrics from vhea', function () {
    // The 32-bit version comes first, so the vertical ascender and the number
    // of vmtx metrics follow it, and the advance matches hb-shape's:
    let font = fontkit.openSync(
      new URL('data/fonttest/TestGVAROne.ttf', import.meta.url),
    );
    assert.equal(font.vhea.ascent, 500);
    assert.equal(font.vhea.numberOfMetrics, 3);
    assert.equal(font.glyphsForString('彌')[0].advanceHeight, 1000);
  });

  it('gives empty CFF glyphs an empty box', function () {
    let font = fontkit.openSync(
      new URL('data/SourceSansPro/SourceSansPro-Regular.otf', import.meta.url),
    );
    let { cbox, bbox } = font.glyphForCodePoint(0x20).path;
    for (let box of [cbox, bbox]) {
      assert.deepEqual([box.minX, box.minY, box.maxX, box.maxY], [0, 0, 0, 0]);
    }
  });

  it('exposes tables directly', function () {
    let iterable = ['head', 'hhea', 'OS/2', 'post'];
    for (let i = 0; i < iterable.length; i++) {
      let table = iterable[i];
      assert.equal(typeof font[table], 'object');
    }
  });
});
