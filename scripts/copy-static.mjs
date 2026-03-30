import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const filesToCopy = [
  {
    from: resolve(rootDir, 'countries_final.geojson'),
    to: resolve(rootDir, 'dist', 'countries_final.geojson')
  }
];

async function main() {
  for (const file of filesToCopy) {
    await mkdir(dirname(file.to), { recursive: true });
    await copyFile(file.from, file.to);
  }
}

main().catch((error) => {
  console.error('Failed to copy static deployment files:', error);
  process.exitCode = 1;
});

