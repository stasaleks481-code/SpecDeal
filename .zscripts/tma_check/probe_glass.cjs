// Focused probe: read both -webkit-backdrop-filter and backdrop-filter
// explicitly (CSSStyleDeclaration.getPropertyValue), plus check whether
// the build stripped the standard property.

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'https://specdeal.vercel.app';
const OUT = path.resolve(__dirname, 'screenshots');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

  const probe = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('body *'));
    const leaf = all.find((el) => el.children.length === 0 && /Auth failed/i.test(el.textContent || ''));
    if (!leaf) return { found: false };
    // climb to the .glass-card ancestor
    let card = leaf;
    while (card && !card.classList?.contains('glass-card')) card = card.parentElement;
    if (!card) return { found: false, note: 'no glass-card ancestor' };
    const s = window.getComputedStyle(card);
    // Explicit property reads (preserves both standard + prefixed)
    const explicit = {
      'backdrop-filter': s.getPropertyValue('backdrop-filter'),
      '-webkit-backdrop-filter': s.getPropertyValue('-webkit-backdrop-filter'),
      'filter': s.getPropertyValue('filter'),
      'background-color': s.getPropertyValue('background-color'),
      'background': s.getPropertyValue('background'),
      'border': s.getPropertyValue('border'),
      'border-radius': s.getPropertyValue('border-radius'),
      'box-shadow': s.getPropertyValue('box-shadow'),
    };
    // Also dump the matched CSS rule text from the stylesheet for .glass-card
    let ruleText = null;
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.cssText && rule.cssText.includes('glass-card') && rule.cssText.includes('backdrop')) {
            ruleText = rule.cssText;
          }
        }
      } catch (e) { /* cross-origin */ }
    }
    return { found: true, explicit, ruleText };
  });

  fs.writeFileSync(path.join(OUT, 'glass-probe.json'), JSON.stringify(probe, null, 2));
  console.log(JSON.stringify(probe, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
