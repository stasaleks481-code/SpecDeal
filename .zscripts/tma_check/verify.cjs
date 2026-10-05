// TMA render verification for https://specdeal.vercel.app
// Captures screenshots at 0.5s, 1.5s, 3s and records DOM/console data.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://specdeal.vercel.app';
const OUT = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

function ts() { return new Date().toISOString(); }

function getBgColor(style, prop) {
  if (!style) return null;
  return style.getPropertyValue(prop).trim();
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 780 }, // iPhone-ish TMA viewport
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  const consoleLogs = [];
  const pageErrors = [];
  const requestsFailed = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') consoleErrors.push(text);
    else if (type === 'warning') consoleWarnings.push(text);
    else consoleLogs.push(`[${type}] ${text}`);
  });
  page.on('pageerror', (err) => pageErrors.push(err.stack || err.message));
  page.on('requestfailed', (req) => {
    requestsFailed.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  console.log(`[${ts()}] Navigating to ${URL}`);
  const navStart = Date.now();
  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`[${ts()}] Navigation HTTP status: ${resp?.status()} (took ${Date.now() - navStart}ms)`);

  // ---- 0.5s screenshot ----
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 't-0.5s.png'), fullPage: false });
  console.log(`[${ts()}] Captured t-0.5s.png`);

  // ---- 1.5s screenshot ----
  await page.waitForTimeout(1000); // total ~1.5s
  await page.screenshot({ path: path.join(OUT, 't-1.5s.png'), fullPage: false });
  console.log(`[${ts()}] Captured t-1.5s.png`);

  // ---- 3s screenshot ----
  await page.waitForTimeout(1500); // total ~3s
  await page.screenshot({ path: path.join(OUT, 't-3s.png'), fullPage: false });
  console.log(`[${ts()}] Captured t-3s.png`);

  // ---- DOM inspection at 3s ----
  const data = await page.evaluate(() => {
    const bodyStyle = window.getComputedStyle(document.body);
    const htmlStyle = window.getComputedStyle(document.documentElement);
    // First non-trivial element with background (often a wrapper/root div)
    const rootDiv = document.querySelector('#__next') || document.querySelector('#root') || document.body;

    function climbBg(el) {
      let cur = el;
      const trace = [];
      while (cur && cur !== document.documentElement) {
        const s = window.getComputedStyle(cur);
        const bg = s.backgroundColor;
        const bgImg = s.backgroundImage;
        trace.push({ tag: cur.tagName, id: cur.id, cls: cur.className, bg, bgImg });
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          return { found: bg, trace };
        }
        cur = cur.parentElement;
      }
      // fallback: html bg
      return { found: window.getComputedStyle(document.documentElement).backgroundColor, trace };
    }

    const bgInfo = climbBg(document.body.firstElementChild || document.body);

    const text = document.body.innerText;

    // Look for spinner svg / Loader2-ish rotating element
    const spinningSvg = Array.from(document.querySelectorAll('svg')).find((svg) => {
      const s = window.getComputedStyle(svg);
      const anim = s.animationName || svg.querySelector('animate, animateTransform');
      return s.animationName && s.animationName !== 'none';
    });

    // Look for buttons
    const buttons = Array.from(document.querySelectorAll('button')).map((b) => ({
      text: b.innerText.trim(),
      ariaLabel: b.getAttribute('aria-label'),
    }));

    // Detect backdrop-blur (glassmorphism) - search any element with backdrop-filter
    const glass = [];
    document.querySelectorAll('*').forEach((el) => {
      const s = window.getComputedStyle(el);
      if ((s.backdropFilter && s.backdropFilter !== 'none') ||
          (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none')) {
        glass.push({
          tag: el.tagName,
          cls: el.className,
          backdrop: s.backdropFilter || s.webkitBackdropFilter,
          bg: s.backgroundColor,
          opacity: s.opacity,
          text: el.innerText?.slice(0, 80),
        });
      }
    });

    return {
      title: document.title,
      bodyBg: bodyStyle.backgroundColor,
      htmlBg: htmlStyle.backgroundColor,
      rootBg: rootDiv ? window.getComputedStyle(rootDiv).backgroundColor : null,
      bgInfo,
      bodyText: text.slice(0, 1500),
      hasSpinningSvg: !!spinningSvg,
      spinningSvgClass: spinningSvg ? spinningSvg.className : null,
      buttons,
      glass,
      textColor: window.getComputedStyle(document.body).color,
      url: window.location.href,
    };
  });

  // Also probe the loading-state (0.5s) DOM by reloading and capturing at 0.5s
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(500);
  const earlyData = await page.evaluate(() => {
    const spinners = Array.from(document.querySelectorAll('svg')).map((svg) => {
      const s = window.getComputedStyle(svg);
      return {
        cls: svg.className,
        anim: s.animationName,
        dur: s.animationDuration,
      };
    }).filter((s) => s.anim && s.anim !== 'none');
    return {
      text: document.body.innerText.slice(0, 800),
      spinners,
      title: document.title,
    };
  });
  await page.screenshot({ path: path.join(OUT, 't-0.5s-reload.png'), fullPage: false });

  const report = {
    url: URL,
    finalUrl: data.url,
    title: data.title,
    httpStatus: resp?.status(),
    navMs: Date.now() - navStart,
    early: earlyData,
    final: data,
    consoleErrors,
    consoleWarnings,
    consoleLogs,
    pageErrors,
    requestsFailed,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n===== REPORT SUMMARY =====');
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
