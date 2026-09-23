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
