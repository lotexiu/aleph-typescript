import { FILTER, FORCE, SKIP_CURRENT_SETUP, SKIP_REF, VERBOSE, ROOT, REF_DIR, colors as c } from './config.mjs';
import { log } from './logger.mjs';
import { checkRequiredTools } from './services/tools.service.mjs';
import { getSubmodules } from './services/git.service.mjs';
import { exists } from './core/fs-utils.mjs';
import { setupCurrentMonorepo } from './setup/build-setup.mjs';
import { setupReference } from './setup/reference-setup.mjs';
import { analyzePackage } from './package-analyzer.mjs';

export const run = async () => {
	checkRequiredTools();
	console.log(`\n${c.bold}${c.white}=== pnpm get-changes ===${c.reset}`);
	console.log(`${c.gray}  Root: ${ROOT}${c.reset}`);
	console.log(`${c.gray}  Ref: ${REF_DIR}${c.reset}`);
	console.log(`${c.gray}  Mode: ${VERBOSE ? 'verbose' : 'normal'}${FORCE ? ' +force' : ''}${SKIP_REF ? ' +skip-ref' : ''}${SKIP_CURRENT_SETUP ? ' +skip-current-setup' : ''}${FILTER ? ` filter=${FILTER}` : ''}${c.reset}\n`);

	const submodules = getSubmodules();
	if (submodules.length === 0) {
		log.error('No submodules found in .gitmodules');
		process.exit(1);
	}

	const filtered = FILTER
		? (submodules.some((s) => s.shortName === FILTER)
			? submodules.filter((s) => s.shortName === FILTER)
			: submodules.filter((s) => s.relPath.includes(FILTER)))
		: submodules;

	if (filtered.length === 0) {
		log.error(`No submodule matches "${FILTER}"`);
		process.exit(1);
	}

	log.info(`Packages to check: ${filtered.map((s) => s.shortName).join(', ')}`);

	setupCurrentMonorepo(log);
	if (!SKIP_REF) setupReference(log);
	else log.warn('Skipping reference update/build (--skip-ref)');

	const results = [];
	for (const submodule of filtered) {
		if (!exists(`${submodule.absPath}/package.json`)) continue;
		const result = await analyzePackage(submodule);
		if (result) results.push(result);
	}

	console.log(`\n${c.bold}${c.white}=== Summary ===${c.reset}`);
	if (results.length === 0) {
		log.info('No changed package detected');
	} else {
		for (const result of results) {
			const buildOk = result.tags.build === 'build-passed';
			console.log(
				`  ${buildOk ? c.green + 'OK' : c.red + 'ERR'}${c.reset} ${c.bold}${result.package}${c.reset} ` +
				`impact=${c.cyan}${result.tags.impact}${c.reset} ` +
				`type=${c.cyan}${result.tags.type}${c.reset} ` +
				`build=${buildOk ? c.green : c.red}${result.tags.build}${c.reset}`
			);
			result.issues.forEach((issue) => console.log(`       ${c.yellow}WARN${c.reset} ${issue}`));
		}
	}

	process.exit(results.some((r) => r.tags.build === 'build-failed') ? 1 : 0);
};
