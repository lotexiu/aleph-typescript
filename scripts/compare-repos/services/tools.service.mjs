import { execSync } from 'child_process';
import { colors as c } from '../config.mjs';
import { execSafe } from '../core/command.mjs';

export const checkRequiredTools = () => {
	const checkCmd = (cmd, name, installUrl) => {
		const result = execSafe(cmd, { silent: true });
		if (!result) {
			console.error(`\n${c.red}ERR${c.reset} ${c.bold}${name}${c.reset} is required but not found.`);
			console.error(`  Please install it: ${installUrl}`);
			process.exit(1);
		}
	};

	checkCmd('git --version', 'git', 'https://git-scm.com/downloads');
	checkCmd('gh --version', 'gh (GitHub CLI)', 'https://cli.github.com/');

	try {
		execSync('gh auth status', { stdio: 'pipe' });
	} catch (e) {
		const stderr = (e.stderr || e.stdout || Buffer.alloc(0)).toString();
		const notLogged = /not logged|not authenticated|no github hosts/i.test(stderr);
		console.error(`\n${c.red}ERR${c.reset} ${c.bold}GitHub CLI${c.reset} is not authenticated.`);
		if (notLogged) console.error('  Run: gh auth login');
		else console.error(stderr.trim());
		process.exit(1);
	}
};
