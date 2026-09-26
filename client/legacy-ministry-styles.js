import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

// Compile the original designs with route-local selectors. The HTML source remains
// the design reference; none of its scripts or inline event handlers are executed.
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const ministries = ['land', 'agriculture', 'health', 'water', 'nid', 'passport', 'tax', 'education'];
const prefixes = { agriculture: 'agri', passport: 'pp' };

// Preserve lightness/alpha and all geometry; retint cool ministry colors to
// Bangladesh green. Red, warning amber, neutral text and photographs stay intact.
export function bangladeshColors(value) {
  const tint = (r, g, b) => {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max - min < 8 || r > g * 1.2 || (b < g * .7 && r > g * .85)) return [r, g, b];
    const range = max - min;
    return [min, max, Math.round(min + range * .736)];
  };
  return value.replace(/#[\da-f]{3,8}\b/gi, hex => {
    let h = hex.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return hex;
    return '#' + tint(...[0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))).map(n => n.toString(16).padStart(2, '0')).join('') + h.slice(6);
  }).replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)([^)]*)\)/gi, (match, r, g, b, tail) => `${match.startsWith('rgba') ? 'rgba' : 'rgb'}(${tint(+r, +g, +b).join(', ')}${tail})`);
}

export function legacyMinistryStyles() {
  return {
    name: 'nationx-legacy-ministry-styles',
    resolveId(id) { if (id === 'virtual:legacy-ministry.css') return '\0legacy-ministry.css'; },
    load(id) {
      if (id !== '\0legacy-ministry.css') return;
      return ministries.map(ministry => {
        const cssPath = path.join(publicDir, 'css', `${ministry}.css`);
        const htmlPath = path.join(publicDir, `${ministry}.html`);
        this.addWatchFile(htmlPath);
        const html = fs.readFileSync(htmlPath, 'utf8');
        let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
        if (fs.existsSync(cssPath)) {
          this.addWatchFile(cssPath);
          css = fs.readFileSync(cssPath, 'utf8') + '\n' + css;
        }
        const scope = `.nationx-ministry-page.nx-ministry-${ministry}`;
        const prefix = prefixes[ministry] || ministry;
        const aliases = {
          [`.${prefix}-card`]: '.react-panel',
          '.nid-card-section': '.react-panel',
          '.card': '.react-panel',
          [`.${prefix}-stats-grid`]: '.react-service-stats',
          [`.${prefix}-stat-card`]: '.react-service-stats > article',
          '.stat-value': '.react-service-stats strong',
          '.stat-label': '.react-service-stats span'
        };
        const root = postcss.parse(css);
        const animations = new Map();
        root.walkAtRules(/keyframes$/, rule => {
          const renamed = `nx-${ministry}-${rule.params}`;
          animations.set(rule.params, renamed);
          rule.params = renamed;
        });
        root.walkRules(rule => {
          if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
          if (rule.selector.trim() === '*') { rule.remove(); return; }
          rule.selectors = rule.selectors.flatMap(selector => {
            const selectors = [selector];
            if (aliases[selector]) selectors.push(aliases[selector]);
            return selectors.map(value => /^(body|html|:root)(?=$|[\s.:#>])/.test(value)
              ? value.replace(/^(body|html|:root)/, scope)
              : `${scope} ${value}`);
          });
        });
        root.walkDecls(decl => {
          if (/color|background|border|shadow|fill|stroke|^--/.test(decl.prop)) decl.value = bangladeshColors(decl.value);
          decl.value = decl.value.replace(/url\((['"]?)(?:\.\.\/)?images\//g, 'url($1/images/');
          if (/animation/.test(decl.prop)) {
            for (const [name, renamed] of animations) decl.value = decl.value.replace(new RegExp(`\\b${name}\\b`, 'g'), renamed);
          }
          // The app ships Font Awesome 7 locally.
          if (decl.prop === 'font-family') decl.value = decl.value.replace(/Font Awesome [56] Free/g, 'Font Awesome 7 Free');
        });
        return root.toString();
      }).join('\n');
    }
  };
}
