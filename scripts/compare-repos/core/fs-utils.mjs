import fs from 'fs';
import path from 'path';

export const exists = (p) => fs.existsSync(p);

export const readJSON = (p) => {
	try {
		return JSON.parse(fs.readFileSync(p, 'utf-8'));
	} catch {
		return null;
	}
};

export const writeJSON = (p, value) => {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
};

export const writeFile = (p, value) => {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, value);
};

export const ensureGitRepoDir = (dir, log) => {
	if (!exists(dir)) return;
	if (exists(path.join(dir, '.git'))) return;
	const backup = `${dir}-invalid-${Date.now()}`;
	fs.renameSync(dir, backup);
	log.warn(`Reference path was not a git repo, moved to ${backup}`);
};

export const cleanupApiArtifacts = (submodulePath, refPackageDir) => {
	fs.rmSync(path.join(submodulePath, '.changes', '.api'), { recursive: true, force: true });
	fs.rmSync(path.join(refPackageDir, '.changes', '.api'), { recursive: true, force: true });
	fs.rmSync(path.join(submodulePath, 'current.api.md'), { force: true });
	fs.rmSync(path.join(submodulePath, 'reference.api.md'), { force: true });
};
