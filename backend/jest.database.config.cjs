module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/database-tests'],
  testMatch: ['**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', useESM: true }] },
  testTimeout: 20000,
};
