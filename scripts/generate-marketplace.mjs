// Regenerates .claude-plugin/marketplace.json from skills/*/SKILL.md and
// creates a .zcode-plugin/plugin.json for any skill dir missing one.
// Run from repo root: node scripts/generate-marketplace.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEV_CATEGORIES = new Set([
  'mcp-builder', 'claude-api', 'webapp-testing', 'web-artifacts-builder', 'skill-creator',
]);
const DOC_CATEGORIES = new Set(['docx', 'pptx', 'pdf', 'xlsx']);

function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out = {};
  const lines = m[1].split(/\r?\n/);
  let key = null, buf = [];
  const flush = () => {
    if (key) out[key] = buf.join(' ').replace(/\s+/g, ' ').trim();
    key = null; buf = [];
  };
  for (const line of lines) {
    if (/^[a-zA-Z_-]+:/.test(line)) {
      flush();
      key = line.slice(0, line.indexOf(':')).trim();
      buf.push(line.slice(line.indexOf(':') + 1).trim());
    } else if (key) {
      buf.push(line.trim());
    }
  }
  flush();
  return out;
}

const skillDirs = readdirSync('skills', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const plugins = [];
for (const name of skillDirs) {
  const dir = join('skills', name);
  const skillMdPath = join(dir, 'SKILL.md');
  if (!existsSync(skillMdPath)) {
    console.log(`skip ${name}: no SKILL.md`);
    continue;
  }
  const fm = parseFrontmatter(readFileSync(skillMdPath, 'utf8'));
  const skillName = fm.name || name;
  const description = (fm.description || '').slice(0, 200);

  const manifestPath = join(dir, '.zcode-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) {
    mkdirSync(join(dir, '.zcode-plugin'), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({
      name: skillName,
      version: '0.1.0',
      description,
      skills: '.',
    }, null, 2) + '\n');
    console.log(`created ${manifestPath}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  plugins.push({
    name: skillName,
    source: `./skills/${name}`,
    version: manifest.version,
    description,
    category: DOC_CATEGORIES.has(name) ? 'productivity'
      : DEV_CATEGORIES.has(name) ? 'developer-tools' : 'other',
  });
}

const catalog = {
  name: 'anthropics-skills',
  metadata: {
    description: 'One ZCode plugin per skill from anthropics/skills, auto-synced from upstream',
    version: '0.2.0',
  },
  plugins,
};

writeFileSync('.claude-plugin/marketplace.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(`wrote .claude-plugin/marketplace.json with ${plugins.length} plugins`);
