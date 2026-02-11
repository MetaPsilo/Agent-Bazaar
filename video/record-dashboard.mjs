import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIPS_DIR = join(__dirname, 'public', 'clips');

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: { width: 1920, height: 1080 },
  args: ['--window-size=1920,1080', '--no-sandbox'],
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const client = await page.createCDPSession();
const framesDir = join(CLIPS_DIR, 'dashboard-frames');
await mkdir(framesDir, { recursive: true });

let frameCount = 0;
let recording = true;

await client.send('Page.startScreencast', {
  format: 'png', quality: 100, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1,
});

client.on('Page.screencastFrame', async (event) => {
  if (!recording) return;
  const buf = Buffer.from(event.data, 'base64');
  await writeFile(join(framesDir, `frame-${String(frameCount).padStart(5, '0')}.png`), buf);
  frameCount++;
  await client.send('Page.screencastFrameAck', { sessionId: event.sessionId });
});

await page.goto('https://agentbazaar.org', { waitUntil: 'networkidle2', timeout: 15000 });
await new Promise(r => setTimeout(r, 800));

// Fast scroll to stats
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.scrollBy({ top: 150, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 80));
}
await new Promise(r => setTimeout(r, 400));

// Quick scroll to network viz + activity
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.scrollBy({ top: 150, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 80));
}
await new Promise(r => setTimeout(r, 600));

// Snap back to top
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
await new Promise(r => setTimeout(r, 800));

// Quick scroll all the way down
await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
await new Promise(r => setTimeout(r, 1200));

recording = false;
await client.send('Page.stopScreencast');
console.log(`Recorded ${frameCount} frames`);

const outPath = join(CLIPS_DIR, 'dashboard.mp4');
execSync(`ffmpeg -y -framerate 30 -i "${framesDir}/frame-%05d.png" -c:v libx264 -pix_fmt yuv420p -vf "scale=1920:1080,setpts=0.7*PTS" -r 30 "${outPath}"`, { stdio: 'pipe' });
execSync(`rm -rf "${framesDir}"`, { stdio: 'pipe' });
console.log(`→ ${outPath}`);

await browser.close();
