import fs from 'fs';
import path from 'path';
import { ROOT } from '../config.mjs';
import { exec, execSafe } from '../core/command.mjs';
import { countPatch, normalizePatch } from '../core/patch-utils.mjs';
import { exists } from '../core/fs-utils.mjs';

export const toWebRepoUrl = (remoteUrl) => {
	if (!remoteUrl) return null;
	if (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://')) {
		return remoteUrl.replace(/\.git$/, '');
	}
	const match = remoteUrl.match(/^git@github\.com:(.+?)\/(.+?)(\.git)?$/);
	if (!match) return null;
	return `https://github.com/${match[1]}/${match[2]}`;
};

export const getSubmodules = () => {
	const gitmodulesPath = path.join(ROOT, '.gitmodules');
	if (!exists(gitmodulesPath)) return [];
	const content = fs.readFileSync(gitmodulesPath, 'utf-8');
	const re = /\[submodule "([^"]+)"\][\s\S]*?path\s*=\s*([^\n]+)[\s\S]*?url\s*=\s*([^\n]+)/g;
	const items = [];
	let m;
	while ((m = re.exec(content)) !== null) {
		const name = m[1].trim();
		const relPath = m[2].trim();
		const url = m[3].trim();
		items.push({
			name,
			relPath,
			url,
			absPath: path.join(ROOT, relPath),
			shortName: relPath.split('/').pop(),
		});
	}
	return items;
};

export const getDefaultBranch = (repoPath) => {
	if (execSafe('git rev-parse --verify origin/master', { cwd: repoPath, silent: true })) return 'master';
	if (execSafe('git rev-parse --verify origin/main', { cwd: repoPath, silent: true })) return 'main';
	const branchRef = execSafe('git symbolic-ref refs/remotes/origin/HEAD --short', { cwd: repoPath });
	const branch = branchRef.replace('origin/', '').trim();
	if (branch) return branch;
	return 'master';
};

export const getChangedFiles = (pkgPath, branch) => {
	execSafe('git fetch --quiet origin', { cwd: pkgPath });
	const diff = execSafe(`git diff origin/${branch}...HEAD --name-only --diff-filter=ACMRD`, { cwd: pkgPath });
	return diff ? diff.split('\n').filter(Boolean).filter((file) => !file.startsWith('.changes/')) : [];
};

export const getCommitEntries = (pkgPath, branch, repoWebUrl) => {
	const raw = execSafe(`git log --pretty=format:%H%x1f%s%x1f%an%x1f%ad --date=short origin/${branch}..HEAD`, { cwd: pkgPath });
	if (!raw) return [];
	return raw.split('\n').filter(Boolean).map((line) => {
		const [sha, message, author, date] = line.split('\x1f');
		const filesRaw = execSafe(`git show --pretty="" --name-only --diff-filter=ACMRD "${sha}"`, { cwd: pkgPath });
		const changedFiles = filesRaw
			.split('\n')
			.filter(Boolean)
			.filter((file) => !file.startsWith('.changes/'));
		return {
			sha,
			shortSha: sha.slice(0, 7),
			url: repoWebUrl ? `${repoWebUrl}/commit/${sha}` : null,
			message,
			author,
			date,
			changedFiles,
		};
	}).filter((commit) => commit.changedFiles.length > 0);
};

export const collectCodeChanges = (pkgPath, branch, changedFiles) => {
	const textCode = changedFiles.filter((f) =>
		/\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|scss|sass|css)$/.test(f) && !f.startsWith('dist/') && !f.startsWith('.changes/')
	);

	const details = [];
	for (const file of textCode) {
		const patch = execSafe(`git diff --no-color --unified=3 origin/${branch}...HEAD -- "${file}"`, { cwd: pkgPath });
		if (!patch.trim()) continue;
		const normalized = normalizePatch(patch);
		const { added, removed } = countPatch(patch);
		details.push({ file, added, removed, patch: normalized });
	}
	return details;
};

export const getPerPRCodeChanges = (pkgPath, commits) => {
	if (!commits || commits.length === 0) return [];
	const shas = commits.map((c) => c.sha).filter(Boolean);
	if (shas.length === 0) return [];

	const oldest = shas[shas.length - 1];
	const newest = shas[0];

	const parentOfOldest = execSafe(`git rev-parse "${oldest}^"`, { cwd: pkgPath });
	if (!parentOfOldest) return [];

	const textExt = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|yml|yaml|scss|sass|css)$/;
	const filesRaw = execSafe(
		`git diff --name-only "${parentOfOldest}..${newest}" --diff-filter=ACMRD`,
		{ cwd: pkgPath }
	);
	const files = filesRaw
		.split('\n')
		.filter((f) => f && textExt.test(f) && !f.startsWith('dist/') && !f.startsWith('.changes/'));

	const details = [];
	for (const file of files) {
		const patch = execSafe(
			`git diff --no-color --unified=3 "${parentOfOldest}..${newest}" -- "${file}"`,
			{ cwd: pkgPath }
		);
		if (!patch.trim()) continue;
		const { added, removed } = countPatch(patch);
		details.push({ file, added, removed, patch: normalizePatch(patch) });
	}
	return details;
};

export const compareDist = (refDist, curDist) => {
	if (!exists(refDist) || !exists(curDist)) return [];
	const changes = [];
	const collect = (dir) => {
		const out = new Set();
		const walk = (d) => {
			for (const e of fs.readdirSync(d, { withFileTypes: true })) {
				const full = path.join(d, e.name);
				if (e.isDirectory()) walk(full);
				else out.add(path.relative(dir, full));
			}
		};
		walk(dir);
		return out;
	};
	const refFiles = collect(refDist);
	const curFiles = collect(curDist);
	for (const file of curFiles) {
		if (!refFiles.has(file)) {
			changes.push({ file, status: 'added' });
			continue;
		}
		const refContent = fs.readFileSync(path.join(refDist, file), 'utf-8');
		const curContent = fs.readFileSync(path.join(curDist, file), 'utf-8');
		if (refContent !== curContent) changes.push({ file, status: 'modified' });
	}
	for (const file of refFiles) {
		if (!curFiles.has(file)) changes.push({ file, status: 'removed' });
	}
	return changes;
};

export const compareSingleFile = (refDir, curDir, name) => {
	const refPath = path.join(refDir, name);
	const curPath = path.join(curDir, name);
	if (!exists(refPath) || !exists(curPath)) return { file: name, changed: false, patch: '' };
	const ref = fs.readFileSync(refPath, 'utf-8');
	const cur = fs.readFileSync(curPath, 'utf-8');
	if (ref === cur) return { file: name, changed: false, patch: '' };
	const patch = exec(`git diff --no-color --no-index --unified=3 "${refPath}" "${curPath}" || true`);
	return { file: name, changed: true, patch: normalizePatch(patch) };
};
