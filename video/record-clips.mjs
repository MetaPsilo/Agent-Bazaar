import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIPS_DIR = join(__dirname, 'public', 'clips');
const SITE = 'https://agentbazaar.org';

await mkdir(CLIPS_DIR, { recursive: true });

const browser = await puppeteer.launch({
  headless: false,
  defaultViewport: { width: 1920, height: 1080 },
  args: ['--window-size=1920,1080', '--no-sandbox'],
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});

async function recordClip(name, fn, durationMs = 5000) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const client = await page.createCDPSession();
  const framesDir = join(CLIPS_DIR, `${name}-frames`);
  await mkdir(framesDir, { recursive: true });
  
  // Start screen recording via CDP
  await client.send('Page.startScreencast', {
    format: 'png',
    quality: 100,
    maxWidth: 1920,
    maxHeight: 1080,
    everyNthFrame: 1,
  });
  
  let frameCount = 0;
  client.on('Page.screencastFrame', async (event) => {
    const { data, sessionId } = event;
    const buf = Buffer.from(data, 'base64');
    const framePath = join(framesDir, `frame-${String(frameCount).padStart(5, '0')}.png`);
    const { writeFile } = await import('fs/promises');
    await writeFile(framePath, buf);
    frameCount++;
    await client.send('Page.screencastFrameAck', { sessionId });
  });
  
  await fn(page);
  
  await new Promise(r => setTimeout(r, durationMs));
  await client.send('Page.stopScreencast');
  
  console.log(`  Recorded ${frameCount} frames for ${name}`);
  
  // Use ffmpeg to stitch frames into mp4
  const { execSync } = await import('child_process');
  const outPath = join(CLIPS_DIR, `${name}.mp4`);
  try {
    execSync(`ffmpeg -y -framerate 15 -i "${framesDir}/frame-%05d.png" -c:v libx264 -pix_fmt yuv420p -vf "scale=1920:1080" "${outPath}"`, { stdio: 'pipe' });
    console.log(`  → ${outPath}`);
    // Clean up frames
    execSync(`rm -rf "${framesDir}"`, { stdio: 'pipe' });
  } catch (e) {
    console.error(`  ffmpeg error for ${name}:`, e.message);
  }
  
  await page.close();
}

// Clip 1: Dashboard scroll
console.log('Recording: dashboard...');
await recordClip('dashboard', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  // Slow scroll down
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy(0, 80));
    await new Promise(r => setTimeout(r, 300));
  }
}, 8000);

// Clip 2: Agent Explorer
console.log('Recording: agents...');
await recordClip('agents', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  // Click Agents tab
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.includes('Agents')) b.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));
  // Hover over Ziggy card
  const card = await page.$('[class*="border"]');
  if (card) await card.hover();
  await new Promise(r => setTimeout(r, 2000));
}, 7000);

// Clip 3: Services
console.log('Recording: services...');
await recordClip('services', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.includes('Services')) b.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));
  // Scroll through services
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 100));
    await new Promise(r => setTimeout(r, 400));
  }
}, 7000);

// Clip 4: Registration flow
console.log('Recording: register...');
await recordClip('register', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.includes('Register')) b.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));
  // Type in agent name
  const nameInput = await page.$('input[placeholder*="agent"]');
  if (nameInput) await nameInput.type('DemoAgent', { delay: 80 });
  await new Promise(r => setTimeout(r, 1500));
  // Click Next
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.includes('Next')) b.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));
}, 8000);

// Clip 5: Docs scroll
console.log('Recording: docs...');
await recordClip('docs', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.includes('Docs')) b.click(); }
  });
  await new Promise(r => setTimeout(r, 2000));
  // Smooth scroll through docs
  for (let i = 0; i < 25; i++) {
    await page.evaluate(() => window.scrollBy(0, 60));
    await new Promise(r => setTimeout(r, 200));
  }
}, 9000);

console.log('\nAll clips recorded!');
await browser.close();
