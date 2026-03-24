import path from 'path';
import { ROOT, SKIP_CURRENT_SETUP, VERBOSE } from '../config.mjs';
import { exec } from '../core/command.mjs';
import { readJSON } from '../core/fs-utils.mjs';

export const setupCurrentMonorepo = (log) => {
	if (SKIP_CURRENT_SETUP) {
		log.warn('Skipping current monorepo setup (--skip-current-setup)');
		return;
	}
	log.step('Preparing current monorepo');
	log.info('Installing current deps...');
	exec('pnpm install --no-frozen-lockfile', { cwd: ROOT, stdio: VERBOSE ? 'inherit' : 'pipe' });
	log.info('Building current monorepo...');
	exec('pnpm build', { cwd: ROOT, stdio: VERBOSE ? 'inherit' : 'pipe' });
	log.info('Current monorepo ready');
};

export const buildPackage = (submodule) => {
	const packageJson = readJSON(path.join(submodule.absPath, 'package.json'));
	if (!packageJson?.name || !packageJson?.scripts?.build) return { passed: true, skipped: true };
	try {
		exec(`pnpm --filter "${packageJson.name}" build`, { cwd: ROOT, stdio: VERBOSE ? 'inherit' : 'pipe' });
		return { passed: true, skipped: false };
	} catch (e) {
		return {
			passed: false,
			skipped: false,
			error: e.message?.split('\n').slice(0, 12).join('\n') || 'Build failed',
		};
	}
};
