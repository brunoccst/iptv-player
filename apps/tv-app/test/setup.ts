// Global test setup: app config and secure storage without native modules.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { APP_NAME: 'Test TV', APP_SLUG: 'test-tv', APP_API_BASE_URL: 'http://api.test' } } },
}));

jest.mock('expo-secure-store', () => {
  const data = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => data.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => void data.set(key, value),
    deleteItemAsync: async (key: string) => void data.delete(key),
  };
});

// App-private JSON files (src/dataStorage.ts) kept in memory.
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  class Directory {
    exists = true;
    create() {}
    createFile(name: string) {
      return new File(this, name);
    }
    // System folder picker (backup, D-056); tests replace it.
    static pickDirectoryAsync = jest.fn(async () => new Directory());
  }
  class File {
    private readonly path: string;
    constructor(_directory: unknown, name: string) {
      this.path = name;
    }
    get name() {
      return this.path;
    }
    // System file picker (restore, D-056); tests replace it.
    static pickFileAsync = jest.fn(async () => ({ canceled: true, result: null }));
    get exists() {
      return files.has(this.path);
    }
    async text() {
      return files.get(this.path) ?? '';
    }
    create() {
      files.set(this.path, '');
    }
    write(value: string) {
      files.set(this.path, value);
    }
    delete() {
      files.delete(this.path);
    }
  }
  return { Directory, File, Paths: { document: new Directory() }, __files: files };
});

// Player hides the phone navigation bar; no native module in Jest.
jest.mock('expo-navigation-bar', () => ({ NavigationBar: () => null }));
