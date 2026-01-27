const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'public', 'wasm', 'psddiff_wasm.js');
const wasmPath = path.join(__dirname, 'public', 'wasm', 'psddiff_wasm.wasm');

const jsCode = fs.readFileSync(jsPath, 'utf8');
eval(jsCode);

(async () => {
  try {
    console.log('Loading WASM...');
    const wasmBinary = fs.readFileSync(wasmPath);

    const Module = await psddiff_wasm_entry({
      wasmBinary: wasmBinary,
    });

    console.log('WASM loaded!');

    const psdPath = '/home/tasuku/Downloads/選挙の投票端末_241115.psd';
    const psdData = fs.readFileSync(psdPath);
    console.log('File size:', psdData.length);

    Module.allocateBuffer(psdData.length);
    const bufferView = Module.getBufferView();
    bufferView.set(psdData);

    console.log('Parsing...');
    const result = Module.parsePsd(psdData.length);
    if (result.error) {
      console.error('Parse error:', result.error);
      return;
    }
    console.log('Parsed! Size:', result.width, 'x', result.height);

    console.log('Rendering composite...');
    const composite = Module.renderComposite(result.handle);
    if (composite.error) {
      console.error('Render error:', composite.error);
    } else {
      console.log('Rendered! Size:', composite.width, 'x', composite.height);
    }

    Module.releaseParser(result.handle);
    console.log('Done!');
  } catch (e) {
    console.error('Error:', e);
  }
})();
