/**
 * electron-builder afterPack hook.
 * Fixes native module arch mismatch when cross-building Windows on Linux.
 *
 * Problem: `argon2` ships both a compiled `build/Release/argon2.node` (ELF on Linux)
 * and `prebuilds/win32-x64/*.node` (PE). `node-gyp-build` prefers `build/Release`
 * over prebuilds. When the Windows artifact is built on Linux, the ELF binary
 * gets shipped to Windows → "is not a valid Win32 application".
 *
 * Solution: On win32 targets, delete the host-compiled `build/` folder from the
 * unpacked app so that `node-gyp-build` falls back to the correct prebuild.
 * The prebuild `prebuilds/win32-x64/argon2.glibc.node` is already a valid PE32+.
 */
const fs = require('fs');
const path = require('path');

module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName;
  if (platform !== 'win32') return;

  const unpackedArgon2 = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'argon2'
  );

  // Candidate paths that may contain a host-compiled ELF
  const stalePaths = [
    path.join(unpackedArgon2, 'build'),
    path.join(unpackedArgon2, 'build', 'Release', 'argon2.node'),
    path.join(unpackedArgon2, 'build', 'Debug'),
  ];

  for (const p of stalePaths) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          fs.rmSync(p, { recursive: true, force: true });
          console.log(`[afterPack] Removed stale host build: ${p}`);
        } else {
          fs.unlinkSync(p);
          console.log(`[afterPack] Removed stale file: ${p}`);
        }
      }
    } catch (e) {
      console.warn(`[afterPack] Failed to clean ${p}: ${e.message}`);
    }
  }

  // Verify that the Windows prebuild exists after cleanup
  const winPrebuild = path.join(unpackedArgon2, 'prebuilds', 'win32-x64', 'argon2.glibc.node');
  if (!fs.existsSync(winPrebuild)) {
    console.warn(`[afterPack] WARNING: Windows prebuild not found at ${winPrebuild}`);
    console.warn(`[afterPack] Available prebuilds: ${fs.readdirSync(path.join(unpackedArgon2, 'prebuilds')).join(', ')}`);
  } else {
    console.log(`[afterPack] Windows prebuild verified: ${winPrebuild}`);
  }
};

// Also support direct CLI invocation for testing: `node scripts/afterPack.js /path/to/win-unpacked`
if (require.main === module) {
  const testDir = process.argv[2];
  if (testDir) {
    module.exports({ electronPlatformName: 'win32', appOutDir: testDir }).then(() => console.log('Done'));
  }
}
