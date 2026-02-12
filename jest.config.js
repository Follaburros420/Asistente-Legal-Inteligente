/**
 * Configuración de Jest para Tests de Regresión
 * 
 * Configuración optimizada para tests del sistema legal con mocks apropiados.
 */

module.exports = {
  // Entorno de testing
  testEnvironment: 'node',
  
  // Directorios de tests
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.js'
  ],
  
  // Directorios a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/dist/',
    '/build/',
    '/__tests__/lib/memory/',
    '/__tests__/lib/anti-hallucination/',
    '/__tests__/lib/verification/',
    '/__tests__/integration/legal-flow-end-to-end.test.ts'
  ],
  
  // Configuración de módulos
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Extensiones de archivos
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],
  
  // Transformación de archivos
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Configuración de TypeScript
  preset: 'ts-jest',
  
  // Configuración de cobertura
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Archivos a incluir en cobertura (solo backend/lib)
  collectCoverageFrom: [
    'lib/**/*.ts',
    'app/api/**/*.ts',
    '!lib/**/*.tsx',
    '!app/**/*.tsx',
    '!components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/__tests__/**'
  ],
  
  // Umbrales de cobertura
  // coverageThreshold: define cuando exista una base de tests estable.
  
  // Configuración de timeouts
  testTimeout: 30000, // 30 segundos para tests de integración
  
  // Configuración de setup
  setupFilesAfterEnv: [
    '<rootDir>/__tests__/setup.ts'
  ],
  
  // Configuración de mocks
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Configuración de verbose
  verbose: true,
  
  // Configuración de errores
  errorOnDeprecated: true,
  
  // Configuración de globals
  // Configuración de transformación de archivos estáticos
  transformIgnorePatterns: [
    '/node_modules/(?!(some-es6-module)/)'
  ],
  
  // Configuración de reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml',
      suiteName: 'Legal Assistant Tests'
    }]
  ],
  
  // Configuración de watchman
  watchman: false,
  
  // Configuración de cache
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache'
}
