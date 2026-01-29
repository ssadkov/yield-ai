const fs = require("fs");
const path = require("path");

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-lightprotocol-wasm] Source not found, skip: ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`[copy-lightprotocol-wasm] Copied ${src} -> ${dest}`);
}

function main() {
  try {
    const baseDir = path.join(
      __dirname,
      "..",
      "node_modules",
      "@lightprotocol",
      "hasher.rs",
      "dist"
    );

    const browserFatDir = path.join(baseDir, "browser-fat", "es");

    copyIfExists(
      path.join(baseDir, "hasher_wasm_simd_bg.wasm"),
      path.join(browserFatDir, "hasher_wasm_simd_bg.wasm")
    );

    copyIfExists(
      path.join(baseDir, "light_wasm_hasher_bg.wasm"),
      path.join(browserFatDir, "light_wasm_hasher_bg.wasm")
    );
  } catch (e) {
    console.error("[copy-lightprotocol-wasm] Failed:", e && e.message);
    process.exit(1);
  }
}

main();

