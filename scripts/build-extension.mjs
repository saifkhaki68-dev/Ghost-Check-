import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const source = join(root, 'extension');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await buildTarget('chrome');
await buildTarget('firefox');

async function buildTarget(target) {
  const output = join(dist, target);
  await cp(source, output, { recursive: true });

  const manifestPath = join(output, 'manifest.json');
  const manifest = await importJson(manifestPath);

  if (target === 'chrome') {
    delete manifest.browser_specific_settings;
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function importJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
