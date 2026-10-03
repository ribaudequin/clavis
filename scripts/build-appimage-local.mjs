import { execSync } from 'child_process';

console.log('Cleaning previous make output...');
execSync('npm run clean', { stdio: 'inherit' });
console.log('Full rebuild...');
execSync('npm run build', { stdio: 'inherit' });
console.log('Making local AppImage...');
execSync('npm run make -- --platform=linux', { stdio: 'inherit' });
console.log('Local AppImage built.');