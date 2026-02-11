import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

async function recordClip(name, fn) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  const client = await page.createCDPSession();
  const framesDir = join(CLIPS_DIR, `${name}-frames`);
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
  
  await fn(page);
  
  recording = false;
  await client.send('Page.stopScreencast');
  console.log(`  ${name}: ${frameCount} frames`);
  
  const outPath = join(CLIPS_DIR, `${name}.mp4`);
  execSync(`ffmpeg -y -framerate 30 -i "${framesDir}/frame-%05d.png" -c:v libx264 -pix_fmt yuv420p -vf "scale=1920:1080" "${outPath}"`, { stdio: 'pipe' });
  execSync(`rm -rf "${framesDir}"`, { stdio: 'pipe' });
  console.log(`  → ${outPath}`);
  await page.close();
}

// Clip 1: Dashboard — full scroll with pauses
console.log('Recording: dashboard...');
await recordClip('dashboard', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2500)); // Let animations settle
  // Slow smooth scroll through entire page
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy({ top: 60, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 250));
  }
  // Pause at bottom
  await new Promise(r => setTimeout(r, 1500));
  // Scroll back up
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 2000));
});

// Clip 2: Agent Explorer — browse + click into agent
console.log('Recording: agents...');
await recordClip('agents', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  // Navigate to Agents
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Agents')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 2000));
  // Mouse movement over the card area
  await page.mouse.move(400, 350);
  await new Promise(r => setTimeout(r, 500));
  await page.mouse.move(400, 400);
  await new Promise(r => setTimeout(r, 500));
  // Click on Ziggy card
  await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="cursor-pointer"], [class*="border"]');
    if (cards[0]) cards[0].click();
  });
  await new Promise(r => setTimeout(r, 3000));
  // Scroll through agent detail
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy({ top: 80, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 300));
  }
  await new Promise(r => setTimeout(r, 1500));
});

// Clip 3: Services — browse with hover effects
console.log('Recording: services...');
await recordClip('services', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Services')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 2000));
  // Hover over each service card
  for (const y of [350, 350, 550]) {
    for (const x of [400, 900]) {
      await page.mouse.move(x, y, { steps: 10 });
      await new Promise(r => setTimeout(r, 800));
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  // Click View Details on first service
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) { if (b.textContent.includes('View Details')) { b.click(); break; } }
  });
  await new Promise(r => setTimeout(r, 2500));
});

// Clip 4: Registration — walk through steps
console.log('Recording: register...');
await recordClip('register', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Register')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 2000));
  // Type agent name
  const nameInput = await page.$('input');
  if (nameInput) {
    await nameInput.click();
    await nameInput.type('ResearchBot', { delay: 60 });
  }
  await new Promise(r => setTimeout(r, 1000));
  // Type description
  const textareas = await page.$$('textarea');
  if (textareas[0]) {
    await textareas[0].click();
    await textareas[0].type('AI research agent providing deep market analysis and competitive intelligence reports.', { delay: 30 });
  }
  await new Promise(r => setTimeout(r, 1500));
  // Click Next
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Next')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 2000));
  // Add a service
  const inputs = await page.$$('input');
  for (const inp of inputs) {
    const placeholder = await inp.evaluate(el => el.placeholder);
    if (placeholder && placeholder.toLowerCase().includes('service')) {
      await inp.click();
      await inp.type('Market Analysis', { delay: 50 });
    }
  }
  await new Promise(r => setTimeout(r, 1500));
  // Next again
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Next')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 2500));
});

// Clip 5: Docs — smooth scroll showing depth
console.log('Recording: docs...');
await recordClip('docs', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Docs')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 2000));
  // Smooth continuous scroll
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.scrollBy({ top: 50, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1000));
});

console.log('\n✅ All clips recorded!');
await browser.close();
