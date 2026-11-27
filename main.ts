// main.ts — hands CANYON RUN in to make.fun.
// One file, one job: copy game/ and screenshots/ to the output directory
// and write the dossier that buildDossier computes from them.
// The grader runs this twice and both runs must write the same bytes,
// so nothing here depends on time or chance.
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outputDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const src = join(repoRoot, name);
  const dest = join(outputDir, name);
  if (!existsSync(src)) throw new Error(`main.ts: missing ${src}`);
  cpSync(src, dest, { recursive: true });
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
