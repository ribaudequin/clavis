export interface DrawerMetadata {
  id: string;
  title: string;
  iconData: string;
  createdAt: number;
  updatedAt: number;
}

export interface EncryptedDrawer {
  id: string;
  title: string;
  iconData: string;
  createdAt: number;
  updatedAt: number;
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
  keyDerivation: {
    algorithm: string;
    iterations: number;
    memory: number;
    parallelism: number;
  };
}

export interface DrawerListItem {
  id: string;
  title: string;
  iconData: string;
}
