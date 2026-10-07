import fs from 'node:fs';
import path from 'node:path';

const [,, targetPath, contentFile] = process.argv;
if (!targetPath || !contentFile) {
  console.error('Usage: node writer.js <targetPath> <contentFile>');
  process.exit(1);
}

const dir = path.dirname(targetPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const content = fs.readFileSync(contentFile, 'utf8');
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully wrote:', targetPath);
