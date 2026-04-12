import { spawnSync } from 'node:child_process';
import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';

const action = process.argv[2] ?? 'lint';
const validActions = new Set(['lint', 'fix']);

if (!validActions.has(action)) {
	console.error("Usage: node scripts/syncpack-mismatch.mjs <lint|fix>");
	process.exit(1);
}

function workspacePackageJsonSources() {
	const root = process.cwd();
	const workspaceGlobs = readWorkspacePackageGlobs(root);
	const submodulePaths = readGitSubmodulePaths(root);

	const sources = new Set(['package.json']);

	for (const rawPattern of workspaceGlobs) {
		const isNegated = rawPattern.startsWith('!');
		const pattern = isNegated ? rawPattern.slice(1) : rawPattern;
		const matches = globSync(pattern, { cwd: root });

		for (const match of matches) {
			const normalizedMatch = normalizePath(match);
			const candidate = normalizedMatch.endsWith('/package.json')
				? normalizedMatch
				: normalizePath(path.join(normalizedMatch, 'package.json'));

			if (!existsSync(path.join(root, candidate))) continue;
			if (isNestedPackageInsideSubmodule(candidate, submodulePaths)) continue;

			if (isNegated) {
				sources.delete(candidate);
			} else {
				sources.add(candidate);
			}
		}
	}

	return [...sources].sort((a, b) => a.localeCompare(b));
}

function readWorkspacePackageGlobs(root) {
	const candidates = ['pnpm-workspace.yaml', 'pnpm-workspace.yml'];
	const workspaceFile = candidates
		.map((name) => path.join(root, name))
		.find((filePath) => existsSync(filePath));

	if (!workspaceFile) {
		console.error('Could not find pnpm-workspace.yaml or pnpm-workspace.yml');
		process.exit(1);
	}

	const content = readFileSync(workspaceFile, 'utf8');
	const lines = content.split(/\r?\n/);
	const globs = [];
	let inPackages = false;

	for (const line of lines) {
		if (!inPackages) {
			if (/^packages:\s*$/.test(line.trim())) {
				inPackages = true;
			}
			continue;
		}

		if (/^\S/.test(line)) {
			break;
		}

		const match = line.match(/^\s*-\s*['\"]?(.+?)['\"]?\s*$/);
		if (match) {
			globs.push(match[1]);
		}
	}

	if (globs.length === 0) {
		console.error('No package globs found under packages: in pnpm-workspace file');
		process.exit(1);
	}

	return globs;
}

function readGitSubmodulePaths(root) {
	const gitmodulesPath = path.join(root, '.gitmodules');
	if (!existsSync(gitmodulesPath)) return [];

	const content = readFileSync(gitmodulesPath, 'utf8');
	return content
		.split(/\r?\n/)
		.map((line) => line.match(/^\s*path\s*=\s*(.+?)\s*$/)?.[1])
		.filter(Boolean)
		.map((value) => normalizePath(value));
}

function isNestedPackageInsideSubmodule(packageJsonPath, submodulePaths) {
	for (const submodulePath of submodulePaths) {
		const submodulePackageJson = `${submodulePath}/package.json`;
		if (packageJsonPath === submodulePackageJson) return false;
		if (packageJsonPath.startsWith(`${submodulePath}/`)) return true;
	}

	return false;
}

function normalizePath(value) {
	return value.replaceAll('\\\\', '/');
}

function extractSharedDependencies(sources) {
	const depCount = new Map();
	const ignoredDeps = new Set([
		// Tooling may intentionally differ between app and library packages.
		'vite',
	]);

	for (const source of sources) {
		try {
			const pkg = JSON.parse(readFileSync(source, 'utf8'));
			const names = [
				...Object.keys(pkg.dependencies ?? {}),
				...Object.keys(pkg.devDependencies ?? {}),
			];

			for (const dep of new Set(names)) {
				depCount.set(dep, (depCount.get(dep) ?? 0) + 1);
			}
		} catch (error) {
			console.warn(`Skipping invalid JSON file: ${source}`);
		}
	}

	// Consider only dependencies shared by at least 2 projects.
	return [...depCount.entries()]
		.filter(([, count]) => count >= 2)
		.map(([dep]) => dep)
		.filter((dep) => !ignoredDeps.has(dep))
		.sort((a, b) => a.localeCompare(b));
}

const sources = workspacePackageJsonSources();
const sharedDeps = extractSharedDependencies(sources);

const args = [
	'--config.onlyBuiltDependencies=[]',
	'dlx',
	'syncpack',
	action,
	'--dependency-types',
	'dev,prod',
	...sources.flatMap((source) => ['--source', source]),
	...sharedDeps.flatMap((dep) => ['--dependencies', dep]),
];

const result = spawnSync('pnpm', args, {
	stdio: 'inherit',
	shell: false,
});

if (result.error) {
	console.error(result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
