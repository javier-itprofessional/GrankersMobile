/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/__tests__/env-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.ts',
    '^@react-native-community/netinfo$': '<rootDir>/__mocks__/netinfo.ts',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.ts',
    '^@nozbe/watermelondb$': '<rootDir>/__mocks__/watermelondb.ts',
    '^@nozbe/watermelondb/(.*)$': '<rootDir>/__mocks__/watermelondb-sub.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        experimentalDecorators: true,
        strict: false,
        paths: { '@/*': ['./*'] },
        module: 'commonjs',
      },
      diagnostics: false,
    }],
  },
  transformIgnorePatterns: ['/node_modules/'],
};
