// The artifact locator, per platform.
//
// Why this file exists: the locator used to probe a hardcoded list of platform
// directories — 'clavis-linux-x64', 'clavis-win32-x64', 'clavis-darwin-x64' — for a
// flat file at the root of each. Two things were wrong with that on macOS, and both
// were invisible until the suite was about to run there:
//
//   1. the runner is arm64 (`macos-latest` is Apple Silicon), so the packager writes
//      `out/clavis-darwin-arm64/` and the list had no entry for it at all;
//   2. the macOS layout is not a flat file but a bundle —
//      `out/clavis-darwin-<arch>/clavis.app/Contents/MacOS/clavis` — so even the x64
//      entry was probing for a file that does not exist.
//
// The locator therefore derives the candidate from the host (process.platform /
// process.arch). That derivation is a pure function, so it can be asserted here for
// every platform without a build on disk, a macOS machine, or a CI runner — and this
// test is the one that keeps the derivation honest when the suite itself can only ever
// run on Linux.
//
// The comparisons are built with path.join rather than written as 'a/b' literals: a
// hand-written separator is a separator on Linux and macOS and a literal character on
// Windows, so a literal would make this test fail on the platform it is meant to
// protect.
import { describe, it, expect } from 'vitest';
import path from 'path';
import { packagedExecutableRelativePath } from './e2e/artifact';

describe('the packaged executable path, per platform', () => {
  it('linux/x64 is the flat binary at the root of the platform directory', () => {
    expect(packagedExecutableRelativePath('linux', 'x64')).toBe(
      path.join('clavis-linux-x64', 'clavis')
    );
  });

  it('win32/x64 is the flat .exe at the root of the platform directory', () => {
    expect(packagedExecutableRelativePath('win32', 'x64')).toBe(
      path.join('clavis-win32-x64', 'clavis.exe')
    );
  });

  it('darwin/arm64 is the executable inside the .app bundle', () => {
    expect(packagedExecutableRelativePath('darwin', 'arm64')).toBe(
      path.join('clavis-darwin-arm64', 'clavis.app', 'Contents', 'MacOS', 'clavis')
    );
  });

  it('darwin/x64 is the x64 variant of the same bundle layout', () => {
    expect(packagedExecutableRelativePath('darwin', 'x64')).toBe(
      path.join('clavis-darwin-x64', 'clavis.app', 'Contents', 'MacOS', 'clavis')
    );
  });

  it('never returns the linux path for a darwin host', () => {
    const darwin = packagedExecutableRelativePath('darwin', 'arm64');
    expect(darwin).not.toBe(packagedExecutableRelativePath('linux', 'x64'));
    // The platform is in the directory name, not only in the executable's name: a
    // stray out/clavis-linux-x64 on a macOS machine must never win.
    expect(darwin.split(path.sep)[0]).toBe('clavis-darwin-arm64');
    expect(darwin).not.toContain('linux');
  });

  it('never returns the linux path for a win32 host', () => {
    expect(packagedExecutableRelativePath('win32', 'x64')).not.toBe(
      packagedExecutableRelativePath('linux', 'x64')
    );
  });

  it('scopes the search to the host: the platform directory carries the platform', () => {
    const cases: [NodeJS.Platform, string][] = [
      ['linux', 'x64'],
      ['win32', 'x64'],
      ['darwin', 'arm64'],
      ['darwin', 'x64'],
    ];
    for (const [platform, arch] of cases) {
      const relative = packagedExecutableRelativePath(platform, arch);
      const platformDir = relative.split(path.sep)[0];
      expect(platformDir).toBe(`clavis-${platform}-${arch}`);
    }
  });

  it('returns a path relative to out/, so it never depends on where the repo lives', () => {
    for (const [platform, arch] of [
      ['linux', 'x64'],
      ['win32', 'x64'],
      ['darwin', 'arm64'],
    ] as [NodeJS.Platform, string][]) {
      const relative = packagedExecutableRelativePath(platform, arch);
      expect(path.isAbsolute(relative)).toBe(false);
      expect(relative).not.toContain('..');
    }
  });
});
