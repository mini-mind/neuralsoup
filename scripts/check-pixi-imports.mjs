import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');
const allowedLegacyEntrypoint = path.join('src', 'engine', 'pixi.ts');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);
const pixiSpecifierPattern = /(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"](?<specifier>pixi\.js|pixi\.js-legacy|@pixi\/[^'"]+)['"]|import\s*\(\s*['"](?<dynamic>pixi\.js|pixi\.js-legacy|@pixi\/[^'"]+)['"]\s*\)/g;

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      return [fullPath];
    }

    return [];
  }));

  return files.flat();
}

async function main() {
  const sourceFiles = await collectSourceFiles(srcRoot);
  const violations = [];

  for (const filePath of sourceFiles) {
    const relativePath = path.relative(projectRoot, filePath);
    const content = await readFile(filePath, 'utf8');
    const matches = content.matchAll(pixiSpecifierPattern);

    for (const match of matches) {
      const specifier = match.groups?.specifier ?? match.groups?.dynamic;
      if (!specifier) {
        continue;
      }

      const isAllowedLegacyEntrypoint =
        relativePath === allowedLegacyEntrypoint && specifier === 'pixi.js-legacy';

      if (isAllowedLegacyEntrypoint) {
        continue;
      }

      violations.push(`${relativePath}: disallowed direct Pixi import "${specifier}"`);
    }
  }

  if (violations.length > 0) {
    console.error('Pixi import contract violation(s) found:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log(`Pixi import contract passed for ${sourceFiles.length} source files.`);
}

main().catch((error) => {
  console.error('Failed to check Pixi imports:', error);
  process.exit(1);
});
