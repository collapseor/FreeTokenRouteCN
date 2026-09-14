const fs = require('fs');
const path = require('path');

let _instance = null;
let _memory = null;

function init() {
  if (_instance) return _instance;

  const wasmPath = path.join(__dirname, 'wasm', 'sha3_wasm_bg.7b9ca65ddd.wasm');
  const wasmBytes = fs.readFileSync(wasmPath);
  const module = new WebAssembly.Module(wasmBytes);
  const result = new WebAssembly.Instance(module, {});
  _instance = result.exports;
  _memory = _instance.memory;
  return _instance;
}

function _writeToMemory(text) {
  const encoded = Buffer.from(text, 'utf-8');
  const length = encoded.length;
  const ptr = _instance.__wbindgen_export_0(length, 1);
  const view = new Uint8Array(_memory.buffer);
  for (let i = 0; i < length; i++) {
    view[ptr + i] = encoded[i];
  }
  return { ptr, length };
}

function solveChallenge(config) {
  init();

  const prefix = `${config.salt}_${config.expire_at}_`;
  const retptr = _instance.__wbindgen_add_to_stack_pointer(-16);

  try {
    const challenge = _writeToMemory(config.challenge);
    const pref = _writeToMemory(prefix);

    _instance.wasm_solve(
      retptr,
      challenge.ptr,
      challenge.length,
      pref.ptr,
      pref.length,
      config.difficulty
    );

    const view = new DataView(_memory.buffer);
    const status = view.getInt32(retptr, true);

    if (status === 0) return null;

    const answerFloat = view.getFloat64(retptr + 8, true);
    const answer = Math.round(answerFloat);

    const result = {
      algorithm: config.algorithm,
      challenge: config.challenge,
      salt: config.salt,
      answer: answer,
      signature: config.signature,
      target_path: config.target_path,
    };

    return Buffer.from(JSON.stringify(result)).toString('base64');
  } finally {
    _instance.__wbindgen_add_to_stack_pointer(16);
  }
}

module.exports = { init, solveChallenge };
