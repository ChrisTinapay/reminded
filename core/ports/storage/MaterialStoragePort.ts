export interface MaterialStoragePort {
  removeMaterial(filePath: string): Promise<void>;
}

