import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIPS_DIR = join(__dirname, 'public', 'clips');
const SITE = 'https://agentbazaar.org';

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: { width: 1920, height: 1080 },
  args: ['--window-size=1920,1080', '--no-sandbox'],
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const client = await page.createCDPSession();
const framesDir = join(CLIPS_DIR, 'register-frames');
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

// Go directly to register page
await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
await page.evaluate(() => {
  document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Register') b.click(); });
});
await new Promise(r => setTimeout(r, 1200));

// Step 1: Agent Details — type fast
const nameInput = await page.$('input');
if (nameInput) {
  await nameInput.click();
  await nameInput.type('ResearchBot', { delay: 25 });
}
await new Promise(r => setTimeout(r, 400));

const textareas = await page.$$('textarea');
if (textareas[0]) {
  await textareas[0].click();
  await textareas[0].type('AI-powered market analysis and intelligence.', { delay: 15 });
}
await new Promise(r => setTimeout(r, 500));

// Click Next → Step 2
await page.evaluate(() => {
  document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Next')) b.click(); });
});
await new Promise(r => setTimeout(r, 1200));

// Step 2: Services — fill service
const inputs2 = await page.$$('input');
for (const inp of inputs2) {
  const ph = await inp.evaluate(el => el.placeholder || '');
  if (ph.toLowerCase().includes('name') || ph.toLowerCase().includes('service')) {
    await inp.click();
    await inp.type('Market Analysis', { delay: 25 });
    break;
  }
}
await new Promise(r => setTimeout(r, 300));

// Fill price if visible
const allInputs = await page.$$('input');
for (const inp of allInputs) {
  const type = await inp.evaluate(el => el.type);
  if (type === 'number') {
    await inp.click();
    await inp.type('0.05', { delay: 30 });
    break;
  }
}
await new Promise(r => setTimeout(r, 300));

// Fill service description
const tas2 = await page.$$('textarea');
if (tas2.length > 0) {
  const last = tas2[tas2.length - 1];
  await last.click();
  await last.type('Deep competitive analysis reports.', { delay: 15 });
}
await new Promise(r => setTimeout(r, 500));

// Click Next → Step 3
await page.evaluate(() => {
  document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Next')) b.click(); });
});
await new Promise(r => setTimeout(r, 1200));

// Step 3: Wallet — just show it
await new Promise(r => setTimeout(r, 1200));

// Click Next → Step 4
await page.evaluate(() => {
  document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Next')) b.click(); });
});
await new Promise(r => setTimeout(r, 1500));

// Step 4: Deploy — show it
await new Promise(r => setTimeout(r, 1000));

recording = false;
await client.send('Page.stopScreencast');
console.log(`Recorded ${frameCount} frames`);

const outPath = join(CLIPS_DIR, 'register.mp4');
execSync(`ffmpeg -y -framerate 20 -i "${framesDir}/frame-%05d.png" -c:v libx264 -pix_fmt yuv420p -vf "scale=1920:1080,setpts=0.5*PTS" -r 30 "${outPath}"`, { stdio: 'pipe' });
execSync(`rm -rf "${framesDir}"`, { stdio: 'pipe' });
console.log(`→ ${outPath}`);

await browser.close();
