# Clavis

**Clavis** is a cross-platform encrypted notes application for storing sensitive data such as banking information, PINs, website passwords, safe codes, and door codes.

## Features

- **Encrypted Drawers**: Store data in encrypted "drawers" (passwords, PINs, bank details, etc.)
- **Per-Drawer Passwords**: Each drawer can have its own unique password or use a global master password
- **Easy Backup**: Export/import encrypted drawer files for secure backups
- **Deterministic Icons**: Each drawer generates a unique visual icon based on its hash
- **Cross-Platform Support**: Native experience on Linux (AppImage), Windows (NSIS + Portable), and Flatpak

## Architecture

- **Electron + TypeScript**: Cross-platform desktop application
- **React + Tailwind CSS**: Modern frontend framework
- **AES-256-GCM**: Standard encryption for drawer contents
- **Argon2id**: Memory-hard key derivation for password-based encryption
- **Electron Forge**: Unified build system for all platforms

## Installation

### From Source

1. Clone this repository:
   
   ```bash
   git clone <repository-url>
   cd clavis
   ```

2. Install dependencies:
   
   ```bash
   npm install
   ```

3. Build the application:
   
   ```bash
   npm run build
   ```

4. Run the application:
   
   ```bash
   npm start
   ```

## Usage

### Creating a New Drawer

1. Click the **"New Drawer"** button in the header
2. Enter drawer title, password, and confirm password
3. The drawer will appear in your list with a unique icon

### Accessing a Drawer

1. Click on a drawer in the list
2. Enter the drawer's password
3. View and edit the drawer contents

### Viewing Credits and Support

1. Click the **heart icon** (❤️) in the top-right of the header
2. The Credits modal displays project info: maintainer, design, icons, security features
3. Use the **Support** section to back the project via Ko-fi, GitHub, ETH, or SOL
4. Click **OK** or the **close button** to dismiss

### Managing Drawers

- **Save**: Encrypts and saves changes to the drawer
- **Delete**: Removes the drawer permanently (with confirmation)
- **Export**: Back up drawer data as an encrypted file

## Building for Distribution

Use Electron Forge to create platform-specific distributions:

### Linux (AppImage)

```bash
npm run make
```

### Windows (NSIS + Portable)

```bash
npm run make
```

### Flatpak

```bash
npm run flatpak-make
```

## Support

If you find this project useful, consider supporting its development:

**Ko-fi:** https://ko-fi.com/A0383T5

**ETH:** (any EVM chain): 0x8a9D7dABf92B3F82f2c3aE5C4bF6A9d2E1aB3cCd

**SOL:** 7nQ1M4kF2eP9jB8vR3cT6yU5xW0zA2bC9dE8fG7hJ6k

## License

This project is open source and available under the MIT License.

## Credits

- **Maintained by:** Marcelo Salvador
- **Design:** Wireframes and UI mockups documented in the `wireframes/` directory
- **Icons:** Deterministic icon generation system documented in `wireframes/04-esquema-icones.md`
- **Special Thanks:** All contributors and early testers

## Security Notes

- All drawer contents are encrypted using AES-256-GCM
- Passwords are processed using Argon2id (memory-hard)
- Only drawer titles and metadata are stored unencrypted
- Use strong, unique passwords for each drawer
- Backup your encrypted drawer files securely

## UI Notes

- No native menu bar (Electron menu disabled)
- Header features: application title, "New Drawer" button, and a Credits button (❤️)
- In-app Credits modal shows project info and support options
- All icons use inline SVG for reliability across packaging formats
