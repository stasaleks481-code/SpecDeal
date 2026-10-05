// Deeper TMA verification: capture very early screenshots + full style stack
// of the error card to confirm glassmorphism (backdrop-filter / translucency).

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://specdeal.vercel.app';
const OUT = path.resolve(__dirname, 'screenshots');

function ts() { return new Date().toISOString(); }

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const timeline = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log(`[${ts()}] goto ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Capture DOM state at very early intervals
  const checkpoints = [0, 100, 250, 500, 1000, 1500, 3000];
  let acc = 0;
  for (const cp of checkpoints) {
    const wait = cp - acc;
    if (wait > 0) await page.waitForTimeout(wait);
    acc = cp;
    const label = `t-${cp}ms.png`;
    await page.screenshot({ path: path.join(OUT, label), fullPage: false });
    const state = await page.evaluate(() => {
      const spinners = Array.from(document.querySelectorAll('svg'))
        .map((svg) => {
          const s = window.getComputedStyle(svg);
          return { cls: svg.getAttribute('class'), anim: s.animationName, dur: s.animationDuration, stroke: s.stroke };
        });
      const rotating = spinners.filter((s) => s.anim && s.anim !== 'none');
      // Find an element whose text contains "Connecting" or "Auth failed"
      const all = Array.from(document.querySelectorAll('body *'));
      const connecting = all.find((el) => el.children.length === 0 && /Connecting/i.test(el.textContent || ''));
      const authFailed = all.find((el) => el.children.length === 0 && /Auth failed/i.test(el.textContent || ''));
      // Find spinner container: any element containing only a rotating svg + text
      return {
        bodyTextSnippet: document.body.innerText.slice(0, 200).replace(/\n+/g, ' | '),
        svgCount: spinners.length,
        rotatingSvgCount: rotating.length,
        rotatingSvgs: rotating,
        hasConnectingText: !!connecting,
        hasAuthFailedText: !!authFailed,
      };
    });
    timeline.push({ at: cp, ...state });
    console.log(`[${ts()}] t=${cp}ms  text="${state.bodyTextSnippet}"  rotatingSvgs=${state.rotatingSvgCount}  connecting=${state.hasConnectingText}  authFailed=${state.hasAuthFailedText}`);
  }

  // ---- At 3s, dump the error card element + ancestors full style stack ----
  const cardStack = await page.evaluate(() => {
    // find deepest element whose text contains "Auth failed"
    const all = Array.from(document.querySelectorAll('body *'));
    const leaf = all.find((el) => el.children.length === 0 && /Auth failed/i.test(el.textContent || ''));
    if (!leaf) return { found: false };
    // climb up to find a "card-like" ancestor: anything with a background, border, or backdrop-filter
    const stack = [];
    let cur = leaf;
    let i = 0;
    while (cur && cur !== document.body && i < 12) {
      const s = window.getComputedStyle(cur);
      stack.push({
        depth: i,
        tag: cur.tagName,
        cls: cur.getAttribute('class') || '',
        bg: s.backgroundColor,
        bgImage: s.backgroundImage,
        backdropFilter: s.backdropFilter,
        webkitBackdropFilter: s.webkitBackdropFilter,
        filter: s.filter,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        opacity: s.opacity,
        width: s.width,
        height: s.height,
        padding: s.padding,
      });
      cur = cur.parentElement;
      i++;
    }
    return { found: true, stack };
  });

  fs.writeFileSync(path.join(OUT, 'card-stack.json'), JSON.stringify(cardStack, null, 2));
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline, null, 2));
  fs.writeFileSync(path.join(OUT, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));

  console.log('\n===== CARD STACK =====');
  console.log(JSON.stringify(cardStack, null, 2));
  console.log('\n===== TIMELINE =====');
  console.log(JSON.stringify(timeline, null, 2));
  console.log('\n===== CONSOLE ERRORS =====');
  console.log(JSON.stringify(consoleErrors, null, 2));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
