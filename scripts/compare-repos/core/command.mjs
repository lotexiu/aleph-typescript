import { execSync } from 'child_process';
import { ROOT } from '../config.mjs';

export const exec = (cmd, opts = {}) => {
	try {
		return (
			execSync(cmd, {
				encoding: 'utf-8',
				cwd: opts.cwd || ROOT,
				stdio: opts.stdio || 'pipe',
			})?.trim() || ''
		);
	} catch (e) {
		if (opts.silent) return '';
		throw e;
	}
};

export const execSafe = (cmd, opts = {}) => {
	try {
		return exec(cmd, opts);
	} catch {
		return '';
	}
};
