import { writeFileSync, readFileSync, statSync, existsSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;

function sha512(filePath) {
  const data = readFileSync(filePath);
  return createHash('sha512').update(data).digest('base64');
}

function getFiles() {
  const dir = 'out/make';
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { recursive: true, withFileTypes: false });
  const result = [];
  for (const entry of entries) {
    const f = typeof entry === 'string' ? entry : entry.name || entry;
    const filePath = join(dir, f);
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      result.push(filePath);
    }
  }
  return result;
}

const files = getFiles();
let filesYml = '';
let mainFilePath = '';
let mainFileName = '';

for (const f of files) {
  const basename = f.split('/').pop();
  const stats = statSync(f);
  const size = stats.size;
  const hash = sha512(f);
  filesYml += `  - url: ${basename}\n    sha512: ${hash}\n    size: ${size}\n`;
  if (!mainFilePath) {
    mainFilePath = f;
    mainFileName = basename;
  }
}

const mainHash = files.length > 0 ? sha512(mainFilePath) : 'PLACEHOLDER';
const mainSize = files.length > 0 ? statSync(mainFilePath).size : 0;

const yml = `version: ${version}
files:
${filesYml}path: ${mainFileName}
sha512: ${mainHash}
releaseDate: '${new Date().toISOString()}'
`;

writeFileSync('latest.yml', yml);
console.log('Generated latest.yml for version', version, 'with', files.length, 'artifact(s)');
