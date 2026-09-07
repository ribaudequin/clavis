import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerAppImage } from '@reforged/maker-appimage';
import { MakerDMG } from '@electron-forge/maker-dmg';

const iconForPlatform: string = (() => {
  switch (process.platform) {
    case 'win32':
      return 'icons/windows/clavis.ico';
    case 'darwin':
      return 'icons/mac/icon.icns';
    default:
      return 'icons/linux/512x512.png';
  }
})();

const config: ForgeConfig = {
  packagerConfig: {
    asar: { unpack: '**/node_modules/argon2/**/*' },
    icon: iconForPlatform,
  },
  rebuildConfig: {
    disablePreGypCopy: true,
    ignoreModules: ['argon2'],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'clavis',
        iconUrl: 'https://raw.githubusercontent.com/ribaudequin/clavis/main/icons/windows/clavis.ico',
        setupIcon: 'icons/windows/clavis.ico',
        certificateFile: process.env.WINDOWS_CERT_FILE,
        certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
      config: {
        artifactName: 'Clavis-${version}-portable.zip',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          icon: 'icons/linux/512x512.png',
          maintainer: 'Marcelo Salvador',
          homepage: 'https://github.com/ribaudequin/clavis',
        },
      },
    },
    {
      name: '@reforged/maker-appimage',
      platforms: ['linux'],
      config: {
        options: {
          icon: 'icons/linux/512x512.png',
          categories: ['Utility'],
        },
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'clavis',
        icon: 'icons/mac/icon.icns',
        format: 'ULFO',
      },
    },
  ],
  plugins: [],
};

export default config;

