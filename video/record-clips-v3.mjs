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
  
  // Stitch at 30fps for smooth playback, speed up 1.5x
  const outPath = join(CLIPS_DIR, `${name}.mp4`);
  execSync(`ffmpeg -y -framerate 20 -i "${framesDir}/frame-%05d.png" -c:v libx264 -pix_fmt yuv420p -vf "scale=1920:1080,setpts=0.65*PTS" -r 30 "${outPath}"`, { stdio: 'pipe' });
  execSync(`rm -rf "${framesDir}"`, { stdio: 'pipe' });
  console.log(`  → ${outPath}`);
  await page.close();
}

// Dashboard — go direct, fast scroll
console.log('Recording: dashboard...');
await recordClip('dashboard', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 150));
  }
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 1500));
});

// Agents — go direct to agents page
console.log('Recording: agents...');
await recordClip('agents', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  // Click agents tab immediately
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Agents') b.click(); });
  });
  await new Promise(r => setTimeout(r, 1500));
  // Hover and click Ziggy
  await page.mouse.move(400, 350, { steps: 5 });
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="cursor-pointer"], [class*="rounded-xl"]');
    for (const c of cards) { if (c.textContent.includes('Ziggy')) { c.click(); break; } }
  });
  await new Promise(r => setTimeout(r, 1500));
  // Fast scroll through detail
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, 800));
});

// Services — go direct
console.log('Recording: services...');
await recordClip('services', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Services') b.click(); });
  });
  await new Promise(r => setTimeout(r, 1500));
  // Fast hover over cards
  for (const [x, y] of [[450, 380], [950, 380], [450, 600]]) {
    await page.mouse.move(x, y, { steps: 5 });
    await new Promise(r => setTimeout(r, 500));
  }
  // Click first View Details
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('View Details')) { b.click(); return; } });
  });
  await new Promise(r => setTimeout(r, 1500));
  // Scroll
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, 800));
});

// Register — go direct, fill form fast
console.log('Recording: register...');
await recordClip('register', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Register') b.click(); });
  });
  await new Promise(r => setTimeout(r, 1500));
  // Type fast
  const nameInput = await page.$('input');
  if (nameInput) {
    await nameInput.click();
    await nameInput.type('ResearchBot', { delay: 40 });
  }
  await new Promise(r => setTimeout(r, 600));
  const textareas = await page.$$('textarea');
  if (textareas[0]) {
    await textareas[0].click();
    await textareas[0].type('Deep market analysis and competitive intelligence.', { delay: 20 });
  }
  await new Promise(r => setTimeout(r, 600));
  // Next
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Next')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 1500));
  // Fill service
  const inputs = await page.$$('input');
  for (const inp of inputs) {
    const ph = await inp.evaluate(el => el.placeholder || '');
    if (ph.toLowerCase().includes('name') || ph.toLowerCase().includes('service')) {
      await inp.click();
      await inp.type('Market Analysis', { delay: 35 });
      break;
    }
  }
  await new Promise(r => setTimeout(r, 500));
  // Next again
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Next')) b.click(); });
  });
  await new Promise(r => setTimeout(r, 1500));
});

// Docs — go direct, fast scroll
console.log('Recording: docs...');
await recordClip('docs', async (page) => {
  await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.evaluate(() => {
    document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Docs') b.click(); });
  });
  await new Promise(r => setTimeout(r, 1500));
  // Fast continuous scroll
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy({ top: 80, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 500));
  // Click a sidebar item
  await page.evaluate(() => {
    const links = document.querySelectorAll('button, a, span');
    for (const l of links) { if (l.textContent.includes('Payment Flow')) { l.click(); break; } }
  });
  await new Promise(r => setTimeout(r, 1200));
  for (let i = 0; i < 15; i++) {
    await page.evaluate(() => window.scrollBy({ top: 80, behavior: 'smooth' }));
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 800));
});

console.log('\n✅ All clips recorded!');
await browser.close();
