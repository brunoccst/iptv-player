/** Jest (jest-expo preset). Native module and TV remote are replaced by test doubles in test/. */
module.exports = {
  preset: 'jest-expo/android',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  // The first render in a file transforms React Native's lazily required modules; on a cold CI cache that alone can pass 5 s.
  testTimeout: 20_000,
  moduleNameMapper: {
    '^.*/modules/tv-media$': '<rootDir>/test/tvMediaMock.tsx',
    '^.*/tv/remote$': '<rootDir>/test/remoteMock.ts',
  },
};
