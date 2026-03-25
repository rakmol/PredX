// Watermark helpers for anti-piracy prediction screenshots

/**
 * Overlays a semi-transparent username watermark on a canvas element.
 * Called before allowing screenshot/share of prediction cards.
 */
export function applyCanvasWatermark(
  canvas: HTMLCanvasElement,
  username: string,
  timestamp: string,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const text = `${username} · PredX · ${timestamp}`;
  ctx.save();

  // Diagonal repeating pattern
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Inter, system-ui, sans-serif';

  const step = 160;
  for (let x = -canvas.width; x < canvas.width * 2; x += step) {
    for (let y = -canvas.height; y < canvas.height * 2; y += step) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 6);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Returns a CSS class string that blurs content for free-tier users.
 */
export function blurClass(isLocked: boolean): string {
  return isLocked ? 'blur-locked select-none pointer-events-none' : '';
}

/**
 * Builds the shareable card footer text burned into every export.
 */
export function buildShareFooter(username: string, expiresAt: string): string {
  const expires = new Date(expiresAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return `@${username} via PredX · Valid until ${expires}`;
}

/**
 * addWatermark — returns a CSS `background-image` value (SVG data URI) that
 * tiles the Pro watermark text diagonally across any element it is applied to.
 *
 * Format: "PredX Pro · @username · Month YYYY"
 *
 * Usage:
 *   <div style={{ backgroundImage: addWatermark(username), backgroundRepeat: 'repeat' }}>
 *     ...prediction content...
 *   </div>
 */
export function addWatermark(username: string): string {
  const now = new Date();
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const text = `PredX Pro · @${username} · ${monthYear}`;

  // Build an SVG tile that rotates the text −30°, then encode as data URI.
  // The tile is 320×120 px so the text repeats cleanly at an angle.
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120">`,
    `<text`,
    `  x="160" y="60"`,
    `  transform="rotate(-30 160 60)"`,
    `  text-anchor="middle"`,
    `  dominant-baseline="middle"`,
    `  fill="rgba(255,255,255,0.06)"`,
    `  font-size="13"`,
    `  font-family="Inter, system-ui, sans-serif"`,
    `  font-weight="500"`,
    `>${text}</text>`,
    `</svg>`,
  ].join('');

  // btoa is safe here — SVG only contains ASCII printable characters.
  return `url("data:image/svg+xml;base64,${btoa(svg)}")`;
}
