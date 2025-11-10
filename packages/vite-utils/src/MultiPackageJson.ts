import fs from "fs-extra";
import path from "path";
import ora from "ora";
import { PluginOption } from "vite";
import { buildPackageName, DIST_DIR, formatGroups, importPatterns, loadRootPackage, logger, ROOT_DIR, SRC_DIR, TEMPLATE_PKG } from "./utils";

/*───────────────────────────────────────────────
│ Setup inicial
───────────────────────────────────────────────*/

function loadTsconfigAliases() {
	const tsconfigPath = path.join(ROOT_DIR, "tsconfig.json");
	if (!fs.pathExistsSync(tsconfigPath)) return {};

	const spinner = ora("Lendo aliases do tsconfig.json...").start();
	try {
		const tsconfig = fs.readJsonSync(tsconfigPath);
		const aliases = tsconfig.compilerOptions?.paths ?? {};
		spinner.succeed(`Aliases carregados (${Object.keys(aliases).length})`);
		return aliases;
	} catch (e) {
		spinner.fail("Falha ao ler tsconfig.json");
		logger.warn(String(e));
		return {};
	}
}

/*───────────────────────────────────────────────
│ Utilitários
───────────────────────────────────────────────*/
function resolveAlias(libName: string, aliasMap: Record<string, string[]>): string {
	for (const alias in aliasMap) {
		const cleanAlias = alias.replace(/\*$/, "");
		if (libName.startsWith(cleanAlias)) {
			const paths = aliasMap[alias];
			if (paths?.length) {
				return paths[0].replace(/\*$/, "");
			}
		}
	}
	return libName;
}

/*───────────────────────────────────────────────
│ Geração de package.json
───────────────────────────────────────────────*/
function generateExports(files: string[]) {
	const exportsObj: Record<string, any> = {};

	files.forEach(file => {
		const ext = path.extname(file).toLowerCase();
		const basePath = `./${file.replace(/\.[^.]+$/, "")}`;
		const relPath = `./${file}`;

		switch (ext) {
			case ".tsx":
			case ".jsx":
				exportsObj[basePath] = {
					import: `${basePath}.jsx`,
					require: `${basePath}.jsx`,
					types: `${basePath}.d.ts`,
				};
				break;
			case ".ts":
			case ".js":
				exportsObj[basePath] = {
					import: `${basePath}.js`,
					require: `${basePath}.js`,
					types: `${basePath}.d.ts`,
				};
				break;
			case ".d.ts":
			case ".scss":
			case ".sass":
			case ".css":
				exportsObj[basePath] = relPath;
				break;
			default:
				logger.warn(`Formato não suportado: ${ext} (${file})`);
		}
	});
	return exportsObj;
}

function extractDependencies(content: string, ext: string, aliasMap: any, folder: string, rootPkg: any) {
	const deps: Record<string, string> = {};
	const groupKey = formatGroups[ext];
	if (!groupKey) return deps;

	const patterns = importPatterns[groupKey];
	if (!patterns) return deps;

	patterns.forEach(pattern => {
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(content)) !== null) {
			const imp = match[1] || match[2];
			if (!imp || imp.startsWith(".") || imp.startsWith("/")) continue;

			const resolved = resolveAlias(imp, aliasMap);

			if (resolved !== imp && !resolved.startsWith(`./src/${folder}`)) {
				const originalFolder = path.relative("./src", resolved).split("/")[0];
				deps[buildPackageName(rootPkg.author, originalFolder)] = rootPkg.version;
			} else if (rootPkg.dependencies?.[imp]) {
				deps[imp] = rootPkg.dependencies[imp];
			}
		}
	});
	return deps;
}

function generateDependencies(files: string[], folder: string, aliasMap: any, rootPkg: any) {
	const spinner = ora(`Gerando dependências de ${folder}...`).start();
	const deps: Record<string, string> = {};
	try {
		for (const file of files) {
			const content = fs.readFileSync(file, "utf-8");
			const ext = path.extname(file).replace(".", "").toLowerCase();
			Object.assign(deps, extractDependencies(content, ext, aliasMap, folder, rootPkg));
		}
		spinner.succeed(`${folder}: ${Object.keys(deps).length} dependências detectadas`);
	} catch (e) {
		spinner.fail(`Falha ao gerar dependências para ${folder}`);
		logger.warn(String(e));
	}
	return deps;
}

function createPackageJson(files: string[], folder: string, aliasMap: any, rootPkg: any) {
	const spinner = ora(`Gerando package.json para ${folder}...`).start();
	try {
		const template = fs.readJSONSync(TEMPLATE_PKG, "utf-8");
		template.author = rootPkg.author ?? "";
		template.name = buildPackageName(rootPkg.author, folder);
		template.version = rootPkg.version ?? "1.0.0";
		template.license = rootPkg.license ?? "MIT";
		template.repository.url += `/${folder}`;
		template.keywords.push(template.author);
		template.exports = generateExports(files.map(f => path.relative(`./src/${folder}`, f)));
		template.dependencies = generateDependencies(files, folder, aliasMap, rootPkg);
		template.keywords.push(...Object.keys(template.dependencies));
		spinner.succeed(`package.json de ${folder} criado!`);
		return template;
	} catch (e) {
		spinner.fail(`Erro ao criar package.json de ${folder}`);
		logger.error(String(e));
		return {};
	}
}

/*───────────────────────────────────────────────
│ Pipeline principal
───────────────────────────────────────────────*/
export function MultiPackageJsonPlugin(): PluginOption {
	return {
		name: "build-multi-package",
		apply: "build",
		closeBundle() {
			logger.step("Iniciando criação dos package.json...");
		
			const rootPkg = loadRootPackage();
			const tsConfigAlias = loadTsconfigAliases();
		
			const packages = fs.globSync(`${SRC_DIR}/*/`);
			const spinner = ora("Processando pacotes...").start();
		
			for (const folderPath of packages) {
				const folder = path.basename(folderPath);
				const files = fs.globSync(`${folderPath}/**/*.*`);
		
				const pkg = createPackageJson(files, folder, tsConfigAlias, rootPkg);
				const distPath = path.join(DIST_DIR, folder);
		
				fs.mkdirpSync(distPath);
				fs.writeJSONSync(path.join(distPath, "package.json"), pkg, { spaces: 2 });
			}
			spinner.succeed("Todos os pacotes foram processados!");
			logger.success("✅ Build finalizado com sucesso!");
		},
	}

}

/*───────────────────────────────────────────────
│ Execução
───────────────────────────────────────────────*/
// MultiPackageJsonPlugin();
