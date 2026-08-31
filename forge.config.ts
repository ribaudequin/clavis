module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'icons/icone_base.png',
    // TODO (code signing): macOS signing requires an Apple Developer ID certificate +
    //   notarization credentials (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID).
    //   Windows signing requires a code-signing certificate (e.g. Azure Trusted Signing).
    //   Ref: https://www.electronforge.io/guides/code-signing
    osxSign: {},
    osxNotarize: {
      // Replace placeholders with real credentials when a signing identity is available:
      // appleId: process.env.APPLE_ID,
      // appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      // teamId: process.env.APPLE_TEAM_ID,
    },
    // Windows signing: add a winCodeSign entitlements config when a cert is available.
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'clavis',
        // TODO (auto-update): Squirrel.Windows supports delta updates out of the box once the
        //   app is signed and published to an update feed; configure the UpdateExe settings here.
      },
    },
    {
      name: '@electron-forge/maker-zip',
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
    {
      name: '@electron-forge/maker-flatpak',
      config: {
        id: 'com.github.marcelosalvador.Clavis',
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {},
    },
    // TODO (auto-update): To enable auto-updates, add @electron-forge/plugin-auto-update
    //   plus an update server (e.g. electron-release-server, GitHub Releases, or a generic URL).
    //   Wire electron-updater into the main process guarded by app.isPackaged.
  ],
};
