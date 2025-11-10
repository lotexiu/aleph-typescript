import path from 'path';
import fs from "fs-extra";
import type { ResolvedConfig, PluginOption } from 'vite';
import { groupFilesByBase, loadRootPackage, ROOT_DIR } from '../utils.ts';

/**
 * @param {object} options
 * @param {string} options.outputDir - O diretório de saída da build (ex: 'dist')
 * @param {string} options.mainFile - O arquivo JS/MJS principal (ex: 'index.js')
 * @param {string} options.typesFile - O arquivo de declaração de tipos (ex: 'index.d.ts')
 * @returns {import('vite').Plugin}
 */
export function updatePackageJsonPlugin(): PluginOption {
  const pkgPath = path.resolve(ROOT_DIR, 'package.json');
	let config: ResolvedConfig;

  return {
    name: 'update-package-json-exports',
		configResolved(conf) {config = conf},

    async writeBundle() {
      const pathOutDir = path.relative(ROOT_DIR, config.build.outDir);
      const files = fs.globSync(`${config.build.outDir}/**/*.*`).map(f => path.relative(ROOT_DIR, f));
      const groupedFiles: Record<string, Record<string, string>> = groupFilesByBase(files);
      const pkg = loadRootPackage();
      pkg.export = {};
      Object.entries(groupedFiles).forEach(([base, variants]) => {
        if (variants['.js']) {
          pkg.export[base] = {
            import: `./${path.posix.join(pathOutDir, path.posix.basename(variants['.js']))}`,
          };
        }
      })
      fs.writeJSON(pkgPath, pkg, { spaces: 2 });
    },
  };
}