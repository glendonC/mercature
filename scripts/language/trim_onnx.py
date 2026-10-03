"""Keep only the given rows of the encoder's quantized word-embedding table.

Usage: python trim_onnx.py <model.onnx> <kept-ids.json> <out.onnx>
"""
import json
import sys

import numpy
import onnx
from onnx import numpy_helper

source, kept_path, target = sys.argv[1:4]
model = onnx.load(source)
kept = numpy.array(json.load(open(kept_path)), dtype=numpy.int64)
for index, initializer in enumerate(model.graph.initializer):
    if initializer.name == 'embeddings.word_embeddings.weight_quantized':
        table = numpy_helper.to_array(initializer)
        trimmed = numpy_helper.from_array(numpy.ascontiguousarray(table[kept]), initializer.name)
        model.graph.initializer[index].CopyFrom(trimmed)
        print(f'Embedding rows {table.shape[0]} -> {trimmed.dims[0]}')
        break
else:
    raise SystemExit('Word embedding table not found')
onnx.save(model, target)
