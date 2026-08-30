module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'icons/clavis-icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'clavis',
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
  ],
};
