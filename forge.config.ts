import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';

export default {
  packagerConfig: {
    asar: true,
    icon: 'icons/linux/512x512.png',
  },
  rebuildConfig: {},
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
  ],
  plugins: [],
};

