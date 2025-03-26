import * as r from 'restructure';

let AxisRecord = new r.Struct({
  axisTag:      new r.String(4),
  axisNameID:   r.uint16,
  axisOrdering: r.uint16,
});

let AxisValue = new r.VersionedStruct(r.uint16, {
  header: {
    axisIndex:      r.uint16,
    flags:          r.uint16,
    valueNameID:    r.uint16,
  },
  1: {
    value:          r.fixed32,
  },
  2: {
    nominalValue:   r.fixed32,
    rangeMinValue:  r.fixed32,
    rangeMaxValue:  r.fixed32,
  },
  3: {
    value:          r.fixed32,
    linkedValue:    r.fixed32,
  },
});

// Wrap the array of AxisValue structs in a struct which ensures that the
// pointers are relative to the start of the array (which equals the start of
// the struct) instead of the STAT table.
// https://github.com/foliojs/restructure/issues/25#issuecomment-300372772
let AxisValueArray = new r.Struct({
  axisValues: new r.Array(new r.Pointer(r.uint16, AxisValue),
                                        parent => parent.parent.axisValueCount),
});


// Simplify the structure by moving axisValues to the top level.
class STATStruct extends r.VersionedStruct {
    decode(stream, parent) {
        let original = super.decode(stream, parent);
        original.axisValues = original.offsetToAxisValueOffsets.axisValues;
        delete original.offsetToAxisValueOffsets;
        return original;
    }

    encode(stream, value, parent) {
        value.offsetToAxisValueOffsets = { axisValues: value.axisValues };
        delete value.axisValues;
        return super.encode(stream, value, parent);
    }
}

export default new STATStruct(r.uint32, {
  header: {
    designAxisSize:           r.uint16,
    designAxisCount:          r.uint16,
    offsetToDesignAxes:       new r.Pointer(r.uint32, new r.Array(AxisRecord, 'designAxisCount')),
    axisValueCount:           r.uint16,
    offsetToAxisValueOffsets: new r.Pointer(r.uint32, AxisValueArray),
  },
  0x00010000: {},
  0x00010001: {
    elidedFallbackNameID: r.uint16,
  },
})