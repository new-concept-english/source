import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: './scripts/buildingDependencies.ts',
      formats: ['umd', 'es'],
      name: '@boses/source',
      fileName: 'index',
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
});
