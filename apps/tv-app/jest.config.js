/** Jest (jest-expo preset). Native module and TV remote are replaced by test doubles in test/. */
module.exports = {
  preset: 'jest-expo/android',
  roots: ['<rootDir>/src'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^.*/modules/tv-media$': '<rootDir>/test/tvMediaMock.tsx',
    '^.*/tv/remote$': '<rootDir>/test/remoteMock.ts',
  },
};
