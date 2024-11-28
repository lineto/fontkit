import * as fontkit from 'fontkit';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('variations', function () {
  describe('Skia', function () {
    let font;
    if (fs.existsSync('/Library/Fonts/Skia.ttf')) {
      font = fontkit.openSync('/Library/Fonts/Skia.ttf');
    }

    beforeEach(function () {
      if (!font) {
        this.skip();
      }
    });

    it('should get available variation axes', function () {
      let axes = font.variationAxes;
      assert.deepEqual(Object.keys(axes), ['wght', 'wdth']);
      assert.equal(axes.wght.name, 'Weight');
      assert.equal(axes.wdth.name, 'Width');
      assert.equal(Math.round(axes.wght.min * 100) / 100, 0.48);
      assert.equal(axes.wght.default, 1);
      return assert.equal(Math.round(axes.wght.max * 100) / 100, 3.2);
    });

    it('should get named variation instances', function () {
      let named = font.namedVariations;
      assert.deepEqual(Object.keys(named), [
        'Black', 'Extended', 'Condensed', 'Light', 'Regular',
        'Black Extended', 'Light Extended', 'Black Condensed',
        'Light Condensed', 'Bold'
      ]);

      assert.equal(Math.round(named.Bold.wght * 100) / 100, 1.95);
      return assert.equal(named.Bold.wdth, 1);
    });

    it('should get a variation by name', function () {
      let variation = font.getVariation('Bold');
      assert.equal(variation.constructor.name, 'TTFFont');

      let glyph = variation.getGlyph(68); // D
      return assert.equal(glyph.path.toSVG(), 'M1438 662Q1438 486 1351.5 353Q1265 220 1127 139Q1007 68 857 31Q707 -6 508 -6Q415 -6 303.5 -3.5Q192 -1 179 -1Q179 9 181 211Q183 413 183 683Q183 795 182 963Q181 1131 179 1339Q195 1339 312 1340Q429 1341 476 1341Q695 1341 859.5 1304Q1024 1267 1150 1187Q1296 1094 1367 963Q1438 832 1438 662ZM1098 673Q1098 773 1053.5 856Q1009 939 915 996Q831 1047 731.5 1066.5Q632 1086 543 1086Q533 1086 521.5 1086Q510 1086 507 1086Q506 984 506 892Q506 800 506 741Q506 689 506 572.5Q506 456 507 254Q516 254 523 254Q530 254 540 254Q630 254 730.5 276.5Q831 299 896 337Q997 395 1047.5 479Q1098 563 1098 673Z');
    });

    it('should get a variation by settings', function () {
      let variation = font.getVariation({ wght: 0.5 });
      assert.equal(variation.constructor.name, 'TTFFont');

      let glyph = variation.getGlyph(68); // D
      return assert.equal(glyph.path.toSVG(), 'M1259 662Q1259 496 1181.5 361.5Q1104 227 967 138Q848 64 716 29.5Q584 -5 408 -5Q365 -5 305.5 -4Q246 -3 220 -2Q220 42 221 207.5Q222 373 222 668Q222 853 221 1043.5Q220 1234 220 1339Q243 1340 288 1340Q333 1340 372 1340Q567 1340 721.5 1301.5Q876 1263 988 1188Q1125 1098 1192 964.5Q1259 831 1259 662ZM1175 662Q1175 813 1115 933.5Q1055 1054 922 1139Q813 1208 678 1240.5Q543 1273 371 1273Q355 1273 333.5 1273Q312 1273 303 1273Q303 1189 302 1047.5Q301 906 301 760Q301 510 301.5 351Q302 192 303 62Q320 62 337.5 62Q355 62 371 62Q532 62 665.5 89.5Q799 117 901 180Q1038 266 1106.5 388.5Q1175 511 1175 662Z');
    });

    it('interpolates points without delta values', function () {
      let variation = font.getVariation('Bold');
      let glyph = variation.glyphForCodePoint('Q'.charCodeAt());

      return assert.equal(glyph.path.toSVG(), 'M799 -39Q662 -39 538 4Q414 47 320 131Q213 227 152 365Q91 503 91 670Q91 825 141.5 952.5Q192 1080 295 1182Q389 1276 517 1326Q645 1376 795 1376Q942 1376 1067.5 1329.5Q1193 1283 1288 1193Q1395 1092 1448.5 957.5Q1502 823 1502 669Q1502 514 1434.5 366Q1367 218 1240 114Q1141 32 1030 -3.5Q919 -39 799 -39ZM1162 654Q1162 755 1128.5 856.5Q1095 958 1024 1024Q980 1066 923 1090Q866 1114 796 1114Q727 1114 669 1089.5Q611 1065 562 1017Q500 955 465.5 859Q431 763 431 665Q431 556 465.5 463Q500 370 566 307Q610 265 669 240Q728 215 797 215Q847 215 908 232.5Q969 250 1023 299Q1088 360 1125 457Q1162 554 1162 654ZM789 452L955 596Q1004.9 537.73 1170.53 350.36Q1336.15 163 1540 -53L1358 -210Q1146.97 32.91 994.12 211.7Q841.27 390.49 789 452Z');
    });

    it('recomputes cbox and advance width', function () {
      let variation = font.getVariation('Bold');
      let glyph = variation.getGlyph(68); // D

      assert.equal(Math.round(glyph.advanceWidth * 100) / 100, 1540);
      return assert.equal(Math.round(glyph.cbox.minX * 100) / 100, 179);
    });
  });

  describe('truetype variations', function () {
    it('should support sharing all points', function () {
      let font = fontkit.openSync(new URL('data/fonttest/TestGVAROne.ttf', import.meta.url));

      assert.equal(
        font.getVariation({ wght: 300 }).glyphsForString("彌")[0].path.toSVG(),
        'M371 -102L371 539L914 539L914 -27Q914 -102 840 -102Q796 -102 755 -98L742 -59Q790 -66 836 -66Q871 -66 871 -31L871 504L414 504L414 -102ZM203 -94Q138 -94 86 -90L74 -52Q137 -59 188 -59Q211 -59 222 -46.5Q233 -34 235.5 12Q238 58 240 134.5Q242 211 242 262L74 262L94 527L242 527L242 719L63 719L63 754L285 754L285 492L133 492L117 297L285 297Q285 241 284 185Q284 104 281 46Q278 -20 269 -49Q260 -78 241.5 -86Q223 -94 203 -94ZM461 12L434 43Q473 73 503 115Q478 150 441 188L469 211Q501 179 525 147Q538 172 559 230L594 211Q571 152 551 117Q577 84 602 43L566 20Q544 64 528 86Q500 44 461 12ZM465 258L438 285Q474 316 501 351Q474 388 445 418L473 441Q500 414 523 381Q546 413 563 453L598 434Q571 382 549 352Q576 320 598 285L563 262Q546 294 525 322Q491 280 465 258ZM707 12L680 43Q717 68 753 115Q731 147 691 188L719 211Q739 190 754 172Q769 154 774 147Q793 185 809 230L844 211Q822 155 801 117Q828 82 852 43L820 20Q798 58 778 87Q747 43 707 12ZM621 -94L621 730L664 730L664 -94ZM348 570L324 605Q425 629 527 688L555 656Q491 621 438.5 601Q386 581 348 570ZM715 258L688 285Q727 318 753 351Q733 378 695 418L723 441Q754 410 775 381Q794 407 813 453L848 434Q826 387 801 352Q823 321 848 281L813 262Q791 301 775 323Q749 288 715 258ZM348 719L348 754L941 754L941 719ZM936 570Q870 602 817 621.5Q764 641 727 652L749 688Q852 655 957 605Z'
      );
    });

    it('should support sharing enumerated points', function () {
      let font = fontkit.openSync(new URL('data/fonttest/TestGVARTwo.ttf', import.meta.url));

      assert.equal(
        font.getVariation({ wght: 300 }).glyphsForString("彌")[0].path.toSVG(),
        'M371 -102L371 539L914 539L914 -27Q914 -102 840 -102Q796 -102 755 -98L742 -59Q790 -66 836 -66Q871 -66 871 -31L871 504L414 504L414 -102ZM203 -94Q138 -94 86 -90L74 -52Q137 -59 188 -59Q211 -59 222 -46.5Q233 -34 235.5 12Q238 58 240 134.5Q242 211 242 262L74 262L94 527L242 527L242 719L63 719L63 754L285 754L285 492L133 492L117 297L285 297Q285 241 284 185Q284 104 281 46Q278 -20 269 -49Q260 -78 241.5 -86Q223 -94 203 -94ZM461 12L434 43Q473 73 503 115Q478 150 441 188L469 211Q501 179 525 147Q538 172 559 230L594 211Q571 152 551 117Q577 84 602 43L566 20Q544 64 528 86Q500 44 461 12ZM465 258L438 285Q474 316 501 351Q474 388 445 418L473 441Q500 414 523 381Q546 413 563 453L598 434Q571 382 549 352Q576 320 598 285L563 262Q546 294 525 322Q491 280 465 258ZM707 12L680 43Q717 68 753 115Q731 147 691 188L719 211Q739 190 754 172Q769 154 774 147Q793 185 809 230L844 211Q822 155 801 117Q828 82 852 43L820 20Q798 58 778 87Q747 43 707 12ZM621 -94L621 730L664 730L664 -94ZM348 570L324 605Q425 629 527 688L555 656Q491 621 438.5 601Q386 581 348 570ZM715 258L688 285Q727 318 753 351Q733 378 695 418L723 441Q754 410 775 381Q794 407 813 453L848 434Q826 387 801 352Q823 321 848 281L813 262Q791 301 775 323Q749 288 715 258ZM348 719L348 754L941 754L941 719ZM936 570Q870 602 817 621.5Q764 641 727 652L749 688Q852 655 957 605Z'
      );
    });

    it('should support sharing no points', function () {
      let font = fontkit.openSync(new URL('data/fonttest/TestGVARThree.ttf', import.meta.url));

      assert.equal(
        font.getVariation({ wght: 300 }).glyphsForString("彌")[0].path.toSVG(),
        'M371 -102L371 539L914 539L914 -27Q914 -102 840 -102Q796 -102 755 -98L742 -59Q790 -66 836 -66Q871 -66 871 -31L871 504L414 504L414 -102ZM203 -94Q138 -94 86 -90L74 -52Q137 -59 188 -59Q211 -59 222 -46.5Q233 -34 235.5 12Q238 58 240 134.5Q242 211 242 262L74 262L94 527L242 527L242 719L63 719L63 754L285 754L285 492L133 492L117 297L285 297Q285 241 284 185Q284 104 281 46Q278 -20 269 -49Q260 -78 241.5 -86Q223 -94 203 -94ZM461 12L434 43Q473 73 503 115Q478 150 441 188L469 211Q501 179 525 147Q538 172 559 230L594 211Q571 152 551 117Q577 84 602 43L566 20Q544 64 528 86Q500 44 461 12ZM465 258L438 285Q474 316 501 351Q474 388 445 418L473 441Q500 414 523 381Q546 413 563 453L598 434Q571 382 549 352Q576 320 598 285L563 262Q546 294 525 322Q491 280 465 258ZM707 12L680 43Q717 68 753 115Q731 147 691 188L719 211Q739 190 754 172Q769 154 774 147Q793 185 809 230L844 211Q822 155 801 117Q828 82 852 43L820 20Q798 58 778 87Q747 43 707 12ZM621 -94L621 730L664 730L664 -94ZM348 570L324 605Q425 629 527 688L555 656Q491 621 438.5 601Q386 581 348 570ZM715 258L688 285Q727 318 753 351Q733 378 695 418L723 441Q754 410 775 381Q794 407 813 453L848 434Q826 387 801 352Q823 321 848 281L813 262Q791 301 775 323Q749 288 715 258ZM348 719L348 754L941 754L941 719ZM936 570Q870 602 817 621.5Q764 641 727 652L749 688Q852 655 957 605Z'
      );
    });

    it('should use the HVAR table when available for variation metrics', function () {
      let font = fontkit.openSync(new URL('data/fonttest/TestGVARFour.ttf', import.meta.url));

      assert.equal(
        Math.round(font.getVariation({ wght: 150 }).glyphsForString('O')[0].advanceWidth),
        706
      );
    });

    it('should fall back to the last entry in an HVAR table', function () {
      let font = fontkit.openSync(new URL('data/fonttest/TestHVARTwo.ttf', import.meta.url));

      assert.equal(
        Math.round(font.getVariation({ wght: 400 }).glyphsForString('A')[0].advanceWidth),
        584
      );
    });

    it('should support adjusting GPOS mark anchor points for variations', function () {
      let font = fontkit.openSync(new URL('data/Mada/Mada-VF.ttf', import.meta.url), { wght: 900 });
      let run = font.layout('ف');
      assert.equal(Math.floor(run.positions[0].xOffset), 639);
      assert.equal(Math.floor(run.positions[0].yOffset), 542);
    });
  });

  describe('CFF2 variations', function () {
    let font = fontkit.openSync(new URL('data/fonttest/AdobeVFPrototype-Subset.otf', import.meta.url));

    it('applies variations to CFF2 glyphs', function () {
      assert.equal(
        font.getVariation({ wght: 100 }).glyphsForString('$')[0].path.toSVG(),
        'M245.82 14.61C187.88 14.61 147.25 26.89 101.25 68.2L141.87 23.46L116.86 116.93C110.69 142.99 95.97 149.44 81.44 149.44C65.26 149.44 55.63 141.35 52.46 125.72C71.02 40.17 137.46 -13 244.46 -13C347.69 -13 435.51 46.25 435.51 156.16C435.51 229.42 405.44 295.15 271.16 349.44L247 358.79C159.98 393.45 118.52 438.64 118.52 505.55C118.52 592.21 177.71 637.22 261.9 637.22C310.84 637.22 346.11 625.66 389.56 584.63L347.76 628.64L372.77 535.16C380.4 510.11 394.48 502.66 408.47 502.66C423.83 502.66 434.27 510.48 437.17 526.38C418.07 613.84 347.53 665.1 258.91 665.1C160.66 665.1 78.39 606.22 78.39 499.85C78.39 414.41 128.01 361.14 223.54 320.5L260.54 304.59C366.66 258.56 395.38 216.91 395.38 152.46C395.38 65.35 333.64 14.61 245.82 14.61ZM267.35 330.74L267.35 758.74L240.46 758.74L240.46 330.74L267.35 330.74ZM240.18 -115L267.08 -115L267.08 330.74L240.18 330.74L240.18 -115Z'
      );

      assert.equal(
        font.getVariation({ wght: 500 }).glyphsForString('$')[0].path.toSVG(),
        'M250.51 35.84C206.08 35.84 164.63 42.09 118 61.34L176.22 21.37L161.1 99.25C150.56 152.04 128.56 166.51 100.6 166.51C77.76 166.51 61.04 154.88 51 131.12C54.16 43.49 133.08 -13.63 246.76 -13.63C388.4 -13.63 473.95 64.04 473.95 171.25C473.95 258.48 429.82 321.18 294.19 370.06L257.44 383.06C188.12 406.48 150.2 437.92 150.2 498.58C150.2 571.08 204.28 605.57 275.56 605.57C308.07 605.57 342.19 600.78 386.28 582.32L327.39 620.61L342.92 546.49C354.72 489.69 382.22 475.69 407.77 475.69C428.24 475.69 447.74 486.73 455.12 511.91C450.37 597.49 369.53 655.82 264.36 655.82C140.37 655.82 56.96 575.82 56.96 473.61C56.96 372.57 119.37 318.36 226.88 278.85L262.63 265.85C344.91 235.85 379.24 208.15 379.24 145.15C379.24 76.37 329.16 35.84 250.51 35.84ZM288.61 320.33L288.61 746.03L242.13 746.03L242.13 320.33L288.61 320.33ZM239.67 -115L286.15 -115L286.15 320.33L239.67 320.33L239.67 -115Z'
      );
    });

    it('substitutes GSUB features depending on variations', function () {
      let glyph = font.getVariation({ wght: 900 }).layout('$').glyphs[0];
      assert.equal(glyph.name, 'dollar.nostroke');
      assert.equal(glyph.path.toSVG(), 'M258.1 38.37C197.22 38.37 166.53 48.42 118 71.47L192.04 19.47L182.62 103.05C176.51 155.21 154.51 174.1 114.52 174.1C89.15 174.1 64.21 160.58 51 125.42C51.63 35.9 124.22 -15.53 258.15 -15.53C416.88 -15.53 513.19 67.21 513.19 175.05C513.19 278.1 457.04 327.94 322.04 388.41L289.09 403.1C231.56 428.62 203.34 451.84 203.34 499.84C203.34 562.22 244.35 589.11 300.67 589.11C341.61 589.11 370.04 584.96 420.46 562.06L340.68 607.32L351.78 538.9C362.94 467.54 398.04 453.54 434.35 453.54C459.25 453.54 486.35 467.75 491.82 505.58C490.87 589.9 407.51 643.16 289.67 643.16C141 643.16 57.16 563.16 57.16 460.32C57.16 356.96 121.68 307.16 232.58 255.85L264.53 241.17C333.53 209.49 362.8 186.22 362.8 129.96C362.8 77 319.9 38.37 258.1 38.37ZM317.72 615.64L317.72 734.01L251.63 734.01L251.63 615.64L317.72 615.64ZM253.15 -115L319.25 -115L319.25 13.68L253.15 13.68L253.15 -115Z');
    });
  });

  describe('RuderPlakatLLVar', function () {
    let font;
    let fontPath = path.join(os.homedir(), 'Library', 'Fonts', 'RuderPlakatLLVar.ttf');
    let getFeatureName = nameID => font.name.records.fontFeatures[nameID]['en'];

    if (fs.existsSync(fontPath)) {
      font = fontkit.openSync(fontPath);
    }

    beforeEach(function () {
      if (!font) {
        this.skip();
      }
    });

    it('should have correct STAT table structure', function() {
      let stat = font.STAT;
      assert.equal(stat.designAxisSize, 8);
      assert.equal(stat.designAxisCount, 3);
      assert.equal(stat.axisValueCount, 9);
      assert.equal(getFeatureName(stat.elidedFallbackNameID), 'Regular');

      let axes = font.STAT.offsetToDesignAxes;
      assert.equal(axes.length, 3);
      assert.equal(axes[0].axisTag, 'YTUC');
      assert.equal(getFeatureName(axes[0].axisNameID), 'Uppercase Height');
      assert.equal(axes[0].axisOrdering, 1);

      let values = font.STAT.axisValues;
      assert.equal(values.length, 9);
      assert.equal(values[0].version, 1);
      assert.equal(values[0].axisIndex, 0);
      assert.equal(values[0].flags, 0);
      assert.equal(getFeatureName(values[0].valueNameID), 'Low');
      assert.equal(values[0].value, 100);
    });

    it('should use the MVAR table for variation metrics', function() {
      let variation = font.getVariation('High 900 Descender')

      const adjustments = variation._metricsVariationAdjustments;
      assert.equal(Math.round(adjustments.cpht * 100) / 100, 161.54);
      assert.equal(Math.round(adjustments.hasc * 100) / 100, 161.54);
      assert.equal(Math.round(adjustments.hdsc * 100) / 100, -104.46);
      assert.equal(Math.round(adjustments.xhgt * 100) / 100, 184.54);

      const metrics = variation._getMetrics();
      assert.equal(Math.round(metrics.ascent * 100) / 100, 1157.54);
      assert.equal(Math.round(metrics.descent * 100) / 100, -308.46);
      assert.equal(metrics.lineGap, 0);
      assert.equal(metrics.lineHeight, 1466);
      assert.equal(Math.round(metrics.capHeight * 100) / 100, 953.54);
      assert.equal(Math.round(metrics.xHeight * 100) / 100, 812.54);
    });
  });
});

