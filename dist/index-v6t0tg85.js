// ../../node_modules/.bun/quickjs-emscripten-core@0.32.0/node_modules/quickjs-emscripten-core/dist/index.mjs
async function newQuickJSAsyncWASMModuleFromVariant(variantOrPromise) {
  let variant = smartUnwrap(await variantOrPromise), [wasmModuleLoader, QuickJSAsyncFFI, { QuickJSAsyncWASMModule: QuickJSAsyncWASMModule2 }] = await Promise.all([variant.importModuleLoader().then(smartUnwrap), variant.importFFI(), import("./module-asyncify-2EFITU5U-rkqjhjxd.js").then(smartUnwrap)]), wasmModule = await wasmModuleLoader();
  wasmModule.type = "async";
  let ffi = new QuickJSAsyncFFI(wasmModule);
  return new QuickJSAsyncWASMModule2(wasmModule, ffi);
}
function smartUnwrap(val) {
  return val && "default" in val && val.default ? val.default && "default" in val.default && val.default.default ? val.default.default : val.default : val;
}
export {
  newQuickJSAsyncWASMModuleFromVariant
};
