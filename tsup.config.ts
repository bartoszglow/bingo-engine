import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'alphabet/index': 'src/alphabet/index.ts',
    'solver/index': 'src/solver/index.ts',
    'generator/index': 'src/generator/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  platform: 'neutral',
  outDir: 'dist',
});
