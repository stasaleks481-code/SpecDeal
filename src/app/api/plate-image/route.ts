import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/plate-image?text=А777АА&region=777&rarity=legendary
 *
 * Returns an SVG image (200 OK, content-type: image/svg+xml) depicting a
 * Russian-style license plate with the requested text + region. Used as
 * inline image preview in chat for "fancy" plate reveals.
 *
 * Why SVG (not PNG via Pillow/sharp)?
 *   - Zero native dependencies (works on Vercel free tier without build issues)
 *   - Instant generation, ~1KB response
 *   - Telegram can render inline SVG via photo URL... actually it can't,
 *     but we use it as an HTTP endpoint for future HTML rendering.
 *
 * For now this serves as a future-proof endpoint — Telegram requires
 * sending photos via sendPhoto with binary content. See the plates handler
 * for how we generate the actual photo using a different method (bytes
 * uploaded directly via bot.api.sendPhoto).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const text = (req.nextUrl.searchParams.get('text') ?? 'А000АА').toUpperCase().slice(0, 6)
  const region = (req.nextUrl.searchParams.get('region') ?? '77').slice(0, 3)
  const rarity = (req.nextUrl.searchParams.get('rarity') ?? 'common').toLowerCase()

  // Color theme based on rarity
  const themes: Record<string, { bg: string; border: string; glow: string }> = {
    common:     { bg: '#ffffff', border: '#000000', glow: 'none' },
    mirror:     { bg: '#e3f2fd', border: '#1976d2', glow: 'none' },
    hundred:    { bg: '#e8f5e9', border: '#388e3c', glow: 'none' },
    triple:     { bg: '#fff8e1', border: '#f57c00', glow: '0 0 8px #ffc107' },
    elite:      { bg: '#f3e5f5', border: '#7b1fa2', glow: '0 0 10px #9c27b0' },
    legendary:  { bg: '#ffebee', border: '#c62828', glow: '0 0 15px #ff1744' },
  }
  const theme = themes[rarity] ?? themes.common

  const svg = generatePlateSvg(text, region, theme)

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}

function generatePlateSvg(
  text: string,
  region: string,
  theme: { bg: string; border: string; glow: string },
): string {
  // Standard Russian plate proportions: 520mm × 110mm (ratio ~4.7:1)
  const W = 520
  const H = 112

  // Escape XML special chars
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="bg-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${theme.bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${theme.bg}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>

  <!-- Outer border (rarity-colored) -->
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="8" ry="8"
        fill="url(#bg-grad)" stroke="${theme.border}" stroke-width="3"
        ${theme.glow !== 'none' ? 'filter="url(#glow)"' : ''}/>

  <!-- Inner black frame (standard plate look) -->
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="4" ry="4"
        fill="none" stroke="#000" stroke-width="2"/>

  <!-- Plate text (the main letters+numbers) -->
  <text x="60" y="${H / 2 + 16}"
        font-family="'Arial Black', 'Helvetica Neue', sans-serif"
        font-size="56" font-weight="900"
        fill="#000" letter-spacing="2">
    ${esc(text)}
  </text>

  <!-- Region number (right side, smaller) -->
  <text x="${W - 80}" y="${H / 2 - 4}"
        font-family="'Arial Black', 'Helvetica Neue', sans-serif"
        font-size="32" font-weight="700"
        fill="#000" text-anchor="middle">
    ${esc(region)}
  </text>

  <!-- RUS label (bottom right) -->
  <text x="${W - 80}" y="${H / 2 + 22}"
        font-family="'Arial', sans-serif"
        font-size="14" font-weight="700"
        fill="#000" text-anchor="middle">
    RUS
  </text>

  <!-- Small flag stripe (left of region) -->
  <rect x="${W - 110}" y="${H / 2 - 14}" width="20" height="9" fill="#fff" stroke="#000" stroke-width="0.5"/>
  <rect x="${W - 110}" y="${H / 2 - 5}" width="20" height="9" fill="#0039A6"/>
  <rect x="${W - 110}" y="${H / 2 + 4}" width="20" height="9" fill="#D52B1E"/>
</svg>`
}
