import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(root, "packages/pi-plugin");
const destination = process.argv[2] && resolve(process.argv[2]);

if (!destination || existsSync(destination)) {
	throw new Error("Pass a new, nonexistent output directory");
}
if (!existsSync(resolve(source, "dist/index.js"))) {
	throw new Error("Build packages/pi-plugin before packaging the Git plugin");
}

mkdirSync(destination, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(source, "package.json"), "utf8"));
delete manifest.scripts;
delete manifest.devDependencies;
delete manifest.repository.directory;
manifest.repository.url = "https://github.com/HayabusaC/magic-context";
writeFileSync(resolve(destination, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(resolve(source, "dist"), resolve(destination, "dist"), { recursive: true });
// GitHub's secret scanner mistakes this public Transformers class name for a
// 32-character Mistral API key. Escape one character without changing its value.
for (const file of readdirSync(resolve(destination, "dist"))) {
	if (!file.endsWith(".js")) continue;
	const path = resolve(destination, "dist", file);
	const content = readFileSync(path, "utf8");
	const escaped = content.replaceAll(
		'"Mistral3ForConditionalGeneration"',
		'"Mistral3ForConditionalGenerat\\u0069on"',
	);
	if (escaped !== content) writeFileSync(path, escaped);
}
cpSync(resolve(source, "README.md"), resolve(destination, "README.md"));
cpSync(resolve(root, "LICENSE"), resolve(destination, "LICENSE"));
console.log(`OMP Git package ready: ${destination}`);
