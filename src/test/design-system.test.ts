import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Sistema Base: color enters the product only through the tokens in styles.css, always in oklch.
const root = path.resolve(__dirname, "..");
// The standalone error page is served when the app itself failed, without styles.css, so it mirrors the token values.
const exempt = new Set(["styles.css", "lib/error-page.ts", "routeTree.gen.ts"]);

const forbidden: [string, RegExp][] = [
  ["Tailwind palette color", /\b(bg|text|border|ring|fill|stroke|outline|divide|placeholder|caret|accent|decoration|from|to|via|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d{2,3})?\b/],
  ["arbitrary color value", /-\[(#|rgb|hsl|oklch)/],
  ["hex color", /#[0-9a-fA-F]{6}\b/],
  ["literal oklch", /oklch\(/],
  ["opacity on a color token", /\b(bg|text|border|ring|fill|stroke|outline|divide|from|to|via)-[a-z-]+\/\d{1,3}\b/],
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "test" ? [] : sources(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

describe("Design system color rule", () => {
  it("keeps colors out of components: no palette utilities, literals or opacity on tokens", () => {
    const violations = sources(root)
      .filter(file => !exempt.has(path.relative(root, file).split(path.sep).join("/")))
      .flatMap(file => readFileSync(file, "utf8").split("\n").flatMap((line, index) =>
        forbidden.filter(([, pattern]) => pattern.test(line)).map(([rule]) => `${path.relative(root, file)}:${index + 1} ${rule}`)));
    expect(violations).toEqual([]);
  });

  it("writes literal colors only in the token blocks of styles.css", () => {
    const css = readFileSync(path.join(root, "styles.css"), "utf8");
    const components = css.slice(css.indexOf("@layer base"));
    expect(components).not.toMatch(/oklch\(|color-mix\(|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it("uses the system typefaces", () => {
    const css = readFileSync(path.join(root, "styles.css"), "utf8");
    expect(css).toContain('--font-sans: "Barlow", system-ui, sans-serif;');
    expect(css).toContain('--font-display: "Barlow Condensed", system-ui, sans-serif;');
  });
});
