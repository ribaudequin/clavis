module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'icons/icone_base.png',
    osxSign: {},
    osxNotarize: {},
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'clavis',
        iconUrl: 'icons/windows/clavis.ico',
        setupIcon: 'icons/windows/clavis.ico',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          icon: 'icons/linux/48x48.png',
        },
      },
    },
  ],
  plugins: [],
};