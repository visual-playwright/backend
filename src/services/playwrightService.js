// Wrapper tool visual-only. DOM tools diblokir sesuai strict rules prompting-r.
// Klik visual memakai koordinat 0-1000 → piksel viewport fix 1280x720.
const VIEWPORT_W = Number(process.env.VIEWPORT_W || 1280);
const VIEWPORT_H = Number(process.env.VIEWPORT_H || 720);

const ALLOWED = new Set([
  "navigate", "click", "type", "take_screenshot", "wait_for", "hover",
  "press_key", "fill_form", "select_option", "handle_dialog", "navigate_back", "resize",
]);

function toPixels(x, y) {
  return {
    px: Math.round((Math.min(1000, Math.max(0, x)) / 1000) * VIEWPORT_W),
    py: Math.round((Math.min(1000, Math.max(0, y)) / 1000) * VIEWPORT_H),
  };
}

async function exec(page, { action, x, y, text, url, ms, key, fields, value, accept, w, h }) {
  if (!ALLOWED.has(action)) throw new Error(`Tool diblokir: ${action}`);
  switch (action) {
    case "navigate":
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      return "navigated";
    case "click": {
      const { px, py } = toPixels(x, y);
      await page.mouse.click(px, py);
      return `clicked ${px},${py}`;
    }
    case "type": {
      const { px, py } = toPixels(x, y);
      await page.mouse.click(px, py);
      await page.keyboard.type(String(text || ""), { delay: 20 });
      return "typed";
    }
    case "take_screenshot":
      return await page.screenshot();
    case "wait_for":
      await page.waitForTimeout(Math.min(Number(ms) || 1000, 10000));
      return "waited";
    case "hover": {
      const { px, py } = toPixels(x, y);
      await page.mouse.move(px, py);
      return "hovered";
    }
    case "press_key":
      await page.keyboard.press(String(key || "Enter"));
      return "pressed";
    case "fill_form":
      // fields: [{x, y, text}] — isi berurutan secara visual
      for (const f of fields || []) {
        const { px, py } = toPixels(f.x, f.y);
        await page.mouse.click(px, py);
        await page.keyboard.type(String(f.text || ""), { delay: 20 });
      }
      return "form filled";
    case "select_option": {
      const { px, py } = toPixels(x, y);
      await page.mouse.click(px, py);
      await page.keyboard.type(String(value || ""), { delay: 20 });
      await page.keyboard.press("Enter");
      return "selected";
    }
    case "handle_dialog":
      // dialog konfirmasi diantisipasi via auto-accept pada runner
      return accept === false ? "dismissed" : "accepted";
    case "navigate_back":
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
      return "back";
    case "resize":
      await page.setViewportSize({ width: Number(w) || VIEWPORT_W, height: Number(h) || VIEWPORT_H });
      return "resized";
    default:
      throw new Error(`Tool tidak dikenal: ${action}`);
  }
}

module.exports = { ALLOWED, VIEWPORT_W, VIEWPORT_H, toPixels, exec };
