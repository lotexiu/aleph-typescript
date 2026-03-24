import { REF_DIR, REPO_URL, VERBOSE } from '../config.mjs';
import { exec } from '../core/command.mjs';
import { ensureGitRepoDir, exists } from '../core/fs-utils.mjs';
import { getDefaultBranch } from '../services/git.service.mjs';

export const setupReference = (log) => {
	log.step('Setting up reference monorepo');
	ensureGitRepoDir(REF_DIR, log);

	if (!exists(REF_DIR)) {
		log.info(`Cloning ${REPO_URL} -> ${REF_DIR}`);
		exec(`git clone "${REPO_URL}" "${REF_DIR}"`, { stdio: VERBOSE ? 'inherit' : 'pipe' });
	} else {
		log.info('Updating reference clone...');
		exec('git fetch --quiet origin', { cwd: REF_DIR });
		const branch = getDefaultBranch(REF_DIR);
		exec(`git reset --hard origin/${branch}`, { cwd: REF_DIR });
		exec('git clean -fd -q', { cwd: REF_DIR });
	}

	log.info('Preparing reference submodules...');
	exec('git submodule update --init --recursive', { cwd: REF_DIR, stdio: VERBOSE ? 'inherit' : 'pipe' });
	log.info('Installing deps in reference...');
	exec('pnpm install --no-frozen-lockfile', { cwd: REF_DIR, stdio: VERBOSE ? 'inherit' : 'pipe' });
	log.info('Building reference monorepo...');
	exec('pnpm build', { cwd: REF_DIR, stdio: VERBOSE ? 'inherit' : 'pipe' });
	log.info('Reference ready');
};
