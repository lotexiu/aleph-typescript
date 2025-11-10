import { defineConfig } from 'vite';
import dts from "vite-plugin-dts";
import path from 'path';
import { extractTsconfigAliases, getLibraryEntries } from '@lotexiu/vite-utils/utils';
import { updatePackageJsonPlugin } from '@lotexiu/vite-utils/plugins/main-package';


const libSrc = path.resolve(__dirname, 'src');
const entries = getLibraryEntries(libSrc);

export default defineConfig({
  resolve: {
    alias: extractTsconfigAliases(),
  },
  plugins: [
    dts({
      include: ["src"],
      outDir: "dist",
      insertTypesEntry: false,
    }),
    updatePackageJsonPlugin()
  ],
  build: {
    lib: {
      entry: entries,
    },
    
    // ... outras configurações ...
    rollupOptions: {
      // external: ['vue', 'react', 'react-dom'],
      output: {
        preserveModules: true,
        preserveModulesRoot: libSrc,
        dir: 'dist',
        format: 'es', 
      },
    },
  },
});