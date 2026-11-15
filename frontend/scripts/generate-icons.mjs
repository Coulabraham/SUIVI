import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const folder = new URL('../public/icons/', import.meta.url);
await mkdir(folder, { recursive: true });
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const [name, size] of [
    ['icon-192', 192],
    ['icon-512', 512],
    ['maskable-512', 512],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{margin:0;background:#0758bd;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`${name}.png`, folder)),
      omitBackground: false,
    });
    await page.close();
  }
} finally {
  await browser.close();
}
