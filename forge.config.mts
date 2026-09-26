import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import MakerAppImage from '@reforged/maker-appimage';
import { MakerDMG } from '@electron-forge/maker-dmg';

const iconForPlatform: string = (() => {
  switch (process.platform) {
    case 'win32': return 'icons/windows/clavis.ico';
    case 'darwin': return 'icons/mac/icon.icns';
    default: return 'icons/linux/512x512.png';
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
  makers: [],
  plugins: [
    [MakerSquirrel, {
      name: 'clavis',
      platforms: ['win32'],
      config: {
        name: 'clavis',
        iconUrl: 'https://raw.githubusercontent.com/ribaudequin/clavis/main/icons/windows/clavis.ico',
        setupIcon: 'icons/windows/clavis.ico',
        certificateFile: process.env.WINDOWS_CERT_FILE,
        certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
      },
    }],
    [MakerZIP, {
      name: 'clavis',
      platforms: ['win32'],
      config: {
        artifactName: 'Clavis-${version}-portable.zip',
      },
    }],
    [MakerDeb, {
      name: 'clavis',
      platforms: ['linux'],
      config: {
        options: {
          icon: 'icons/linux/512x512.png',
          maintainer: 'Marcelo Salvador',
          homepage: 'https://github.com/ribaudequin/clavis',
        },
      },
    }],
    [MakerAppImage, {
      name: 'clavis',
      platforms: ['linux'],
      config: {
        options: {
          icon: 'icons/linux/512x512.png',
          categories: ['Utility'],
        },
      },
    }],
    [MakerDMG, {
      name: 'clavis',
      platforms: ['darwin'],
      config: {
        name: 'clavis',
        icon: 'icons/mac/icon.icns',
        format: 'ULFO',
      },
    }],
  ],
};

export default config;
