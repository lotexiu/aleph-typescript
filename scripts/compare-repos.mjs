#!/usr/bin/env node

/**
 * pnpm get-changes
 *
 * Local comparison workflow for monorepo submodules.
 * Generates:
 * - .changes/pr-analysis.json
 * - .changes/CHANGELOG.md
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { compareExports, areChangesBreaking } from '@grafana/levitate';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REF_DIR = '/tmp/aleph-typescript-ref';
const REPO_URL = 'https://github.com/lotexiu/aleph-typescript.git';

const ARGS = process.argv.slice(2);
const VERBOSE = ARGS.includes('--verbose');
const FORCE = ARGS.includes('--force');
const SKIP_REF = ARGS.includes('--skip-ref');
const SKIP_CURRENT_SETUP = ARGS.includes('--skip-current-setup');
const SKIP_BUILD = ARGS.includes('--skip-build');
const FILTER = ARGS.find((a) => !a.startsWith('-')) || null;

const MAX_PATCH_LINES = 200;

const c = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	white: '\x1b[97m',
};

const log = {
	info: (m) => console.log(`  ${c.green}✓${c.reset} ${m}`),
	warn: (m) => console.log(`  ${c.yellow}⚠${c.reset} ${m}`),
	error: (m) => console.log(`  ${c.red}✗${c.reset} ${m}`),
	step: (m) => console.log(`\n${c.blue}${c.bold}▶${c.reset} ${c.bold}${m}${c.reset}`),
	debug: (m) => VERBOSE && console.log(`  ${c.gray}→ ${m}${c.reset}`),
	hr: () => console.log(`  ${c.gray}${'─'.repeat(70)}${c.reset}`),
};

const exec = (cmd, opts = {}) => {
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

const execSafe = (cmd, opts = {}) => {
	try {
		return exec(cmd, opts);
	} catch {
		return '';
	}
};

const checkRequiredTools = () => {
	const checkCmd = (cmd, name, installUrl) => {
		const result = execSafe(cmd, { silent: true });
		if (!result) {
			console.error(`\n${c.red}✗${c.reset} ${c.bold}${name}${c.reset} is required but not found.`);
			console.error(`  Please install it: ${installUrl}`);
			process.exit(1);
		}
	};

	checkCmd('git --version', 'git', 'https://git-scm.com/downloads');
	checkCmd('gh --version', 'gh (GitHub CLI)', 'https://cli.github.com/');

	// Verify gh is authenticated
	try {
		execSync('gh auth status', { stdio: 'pipe' });
	} catch (e) {
		const stderr = (e.stderr || e.stdout || Buffer.alloc(0)).toString();
		const notLogged = /not logged|not authenticated|no github hosts/i.test(stderr);
		console.error(`\n${c.red}✗${c.reset} ${c.bold}GitHub CLI${c.reset} is not authenticated.`);
		if (notLogged) console.error('  Run: gh auth login');
		else console.error(stderr.trim());
		process.exit(1);
	}
};

const exists = (p) => fs.existsSync(p);

const readJSON = (p) => {
	try {
		return JSON.parse(fs.readFileSync(p, 'utf-8'));
	} catch {
		return null;
	}
};

const writeJSON = (p, value) => {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n');
};

const writeFile = (p, value) => {
	fs.mkdirSync(path.dirname(p), { recursive: true });
	fs.writeFileSync(p, value);
};

const ensureGitRepoDir = (dir) => {
	if (!exists(dir)) return;
	if (exists(path.join(dir, '.git'))) return;
	const backup = `${dir}-invalid-${Date.now()}`;
	fs.renameSync(dir, backup);
	log.warn(`Reference path was not a git repo, moved to ${backup}`);
};

const toWebRepoUrl = (remoteUrl) => {
	if (!remoteUrl) return null;
	if (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://')) {
		return remoteUrl.replace(/\.git$/, '');
	}
	const match = remoteUrl.match(/^git@github\.com:(.+?)\/(.+?)(\.git)?$/);
	if (!match) return null;
	return `https://github.com/${match[1]}/${match[2]}`;
};

const normalizePatch = (patch) => {
	const lines = patch.split('\n');
	const filtered = [];
	for (const line of lines) {
		if (line.startsWith('diff --git')) continue;
		if (line.startsWith('index ')) continue;
		if (line.startsWith('--- ')) continue;
		if (line.startsWith('+++ ')) continue;
		if (line.startsWith('\\ No newline at end of file')) continue;
		if (!line.startsWith('@@') && !line.startsWith('+') && !line.startsWith('-') && !line.startsWith(' ')) continue;
		filtered.push(line);
		if (filtered.length >= MAX_PATCH_LINES) {
			filtered.push('... [truncated]');
			break;
		}
	}
	return filtered.join('\n').trim();
};

const countPatch = (patch) => {
	let added = 0;
	let removed = 0;
	for (const line of patch.split('\n')) {
		if (line.startsWith('+') && !line.startsWith('+++')) added += 1;
		if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
	}
	return { added, removed };
};

const getSubmodules = () => {
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

const getDefaultBranch = (repoPath) => {
	if (execSafe('git rev-parse --verify origin/master', { cwd: repoPath, silent: true })) return 'master';
	if (execSafe('git rev-parse --verify origin/main', { cwd: repoPath, silent: true })) return 'main';
	const branchRef = execSafe('git symbolic-ref refs/remotes/origin/HEAD --short', { cwd: repoPath });
	const branch = branchRef.replace('origin/', '').trim();
	if (branch) return branch;
	return 'master';
};

const setupReference = () => {
	log.step('Setting up reference monorepo');
	ensureGitRepoDir(REF_DIR);

	if (!exists(REF_DIR)) {
		log.info(`Cloning ${REPO_URL} → ${REF_DIR}`);
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

const setupCurrentMonorepo = () => {
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

const getChangedFiles = (pkgPath, branch) => {
	execSafe('git fetch --quiet origin', { cwd: pkgPath });
	const diff = execSafe(`git diff origin/${branch}...HEAD --name-only --diff-filter=ACMRD`, { cwd: pkgPath });
	return diff ? diff.split('\n').filter(Boolean).filter((file) => !file.startsWith('.changes/')) : [];
};

const getCommitEntries = (pkgPath, branch, repoWebUrl) => {
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

const collectCodeChanges = (pkgPath, branch, changedFiles) => {
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

/**
 * Computes file-level changes introduced by a specific list of commits.
 * Uses git diff <parentOfOldest>..<newest> to isolate the changes.
 * Falls back to empty list if commit range cannot be determined.
 */
const getPerPRCodeChanges = (pkgPath, commits) => {
	if (!commits || commits.length === 0) return [];
	const shas = commits.map((c) => c.sha).filter(Boolean);
	if (shas.length === 0) return [];

	// commits are newest-first (git log order), so last = oldest
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

const compareDist = (refDist, curDist) => {

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

const compareSingleFile = (refDir, curDir, name) => {
	const refPath = path.join(refDir, name);
	const curPath = path.join(curDir, name);
	if (!exists(refPath) || !exists(curPath)) return { file: name, changed: false, patch: '' };
	const ref = fs.readFileSync(refPath, 'utf-8');
	const cur = fs.readFileSync(curPath, 'utf-8');
	if (ref === cur) return { file: name, changed: false, patch: '' };
	const patch = exec(`git diff --no-color --no-index --unified=3 "${refPath}" "${curPath}" || true`);
	return { file: name, changed: true, patch: normalizePatch(patch) };
};

const runLevitate = (refPackageDir, curPackageDir) => {
	const refIndex = [
		path.join(refPackageDir, 'dist', 'index.d.ts'),
		path.join(refPackageDir, 'index.d.ts'),
	].find(exists);

	const curIndex = [
		path.join(curPackageDir, 'dist', 'index.d.ts'),
		path.join(curPackageDir, 'index.d.ts'),
	].find(exists);

	if (!refIndex || !curIndex) return null;

	try {
		const ignored = { additions: [], changes: [], removals: [] };
		const result = compareExports(refIndex, curIndex, ignored);
		return {
			breaking: areChangesBreaking(result),
			added: Object.keys(result.additions || {}),
			removed: Object.keys(result.removals || {}),
			modified: Object.keys(result.changes || {}),
		};
	} catch (e) {
		log.debug(`Levitate failed: ${e.message}`);
		return null;
	}
};

const runApiExtractor = (packageDir, label) => {
	const entryPoint = path.join(packageDir, 'dist', 'index.d.ts');
	const tsconfig = path.join(packageDir, 'tsconfig.json');
	if (!exists(entryPoint) || !exists(tsconfig)) return null;

	const outDir = path.join(packageDir, '.changes', '.api');
	const reportFileName = `${label}.api.md`;
	const configObject = {
		$schema: 'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
		projectFolder: packageDir,
		mainEntryPointFilePath: entryPoint,
		apiReport: {
			enabled: true,
			reportFileName,
			reportFolder: outDir,
			reportTempFolder: outDir,
		},
		docModel: { enabled: false },
		dtsRollup: { enabled: false },
		tsdocMetadata: { enabled: false },
		compiler: { tsconfigFilePath: tsconfig },
		messages: {
			compilerMessageReporting: { default: { logLevel: 'warning' } },
			extractorMessageReporting: { default: { logLevel: 'warning' } },
			tsdocMessageReporting: { default: { logLevel: 'warning' } },
		},
	};

	try {
		fs.mkdirSync(outDir, { recursive: true });
		const config = ExtractorConfig.prepare({
			configObject,
			configObjectFullPath: path.join(outDir, `api-extractor.${label}.json`),
			packageJsonFullPath: path.join(packageDir, 'package.json'),
		});
		const result = Extractor.invoke(config, {
			localBuild: true,
			showVerboseMessages: VERBOSE,
		});
		const reportPath = path.join(outDir, reportFileName);
		return {
			succeeded: result.succeeded,
			errorCount: result.errorCount,
			warningCount: result.warningCount,
			reportPath: exists(reportPath) ? reportPath : null,
		};
	} catch (e) {
		return {
			succeeded: false,
			errorCount: 1,
			warningCount: 0,
			reportPath: null,
			error: e.message,
		};
	}
};

const compareApiExtractorReports = (refResult, curResult) => {
	if (!refResult?.reportPath || !curResult?.reportPath) return null;
	const ref = fs.readFileSync(refResult.reportPath, 'utf-8');
	const cur = fs.readFileSync(curResult.reportPath, 'utf-8');
	if (ref === cur) return { changed: false, patch: '' };
	const patch = exec(`git diff --no-color --no-index --unified=3 "${refResult.reportPath}" "${curResult.reportPath}" || true`);
	return { changed: true, patch: normalizePatch(patch) };
};

const detectImpact = (api, codeChanges) => {
	if (api?.breaking || (api?.removed?.length || 0) > 0) return 'major';
	if ((api?.added?.length || 0) > 0) return 'minor';
	const totalAdded = codeChanges.reduce((sum, item) => sum + item.added, 0);
	if (totalAdded > 80) return 'minor';
	return 'patch';
};

const detectType = (api, codeChanges, changedFiles) => {
	const onlyDocs = changedFiles.length > 0 && changedFiles.every((f) => /readme|\.md$/i.test(f));
	if (onlyDocs) return 'docs';
	if ((api?.added?.length || 0) > 0 && !api?.breaking) return 'feature';
	const added = codeChanges.reduce((sum, item) => sum + item.added, 0);
	const removed = codeChanges.reduce((sum, item) => sum + item.removed, 0);
	if (added > 0 && removed > 0 && !api?.breaking && (api?.added?.length || 0) === 0 && (api?.removed?.length || 0) === 0) {
		return 'refactor';
	}
	if (added > removed * 1.4) return 'feature';
	return 'fix';
};

const bumpVersion = (version, impact) => {
	const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10));
	if (impact === 'major') return `${major + 1}.0.0`;
	if (impact === 'minor') return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
};


/**
 * Fetches PR data from GitHub for the given repo slug (owner/repo).
 *
 * Phase 1 — Batch fetch ALL PRs using only mergeCommit (no commits[] field → avoids
 * GitHub GraphQL complexity limit that kicks in when commits[] is included with many PRs).
 * Phase 2 — For each local commit SHA not resolved in phase 1, run a targeted
 * gh pr list --search (one call per unresolved commit). Only needed for branch commits
 * that are not the merge commit (e.g. the actual feature commit on the PR branch).
 *
 * @param {string} repoSlug  - "owner/repo"
 * @param {string[]} [commitShas] - full SHAs of local commits to resolve in phase 2
 */
const getPRData = (repoSlug, commitShas = []) => {
	if (!repoSlug) return { map: {}, maxNumber: 0 };
	const map = {};
	let maxNumber = 0;
	const addToMap = (sha, prInfo) => {
		if (!sha) return;
		map[sha] = prInfo;
		if (sha.length > 7) map[sha.slice(0, 7)] = prInfo;
	};
	try {
		// Phase 1: batch fetch — only mergeCommit (no GraphQL complexity issue)
		log.debug(`Fetching all PRs (mergeCommit only) for ${repoSlug}...`);
		const raw = execSafe(
			`gh pr list --state all --limit 100 --json number,title,url,mergeCommit --repo "${repoSlug}"`,
			{ silent: true }
		);
		if (raw) {
			const prs = JSON.parse(raw);
			for (const pr of prs) {
				if (pr.number > maxNumber) maxNumber = pr.number;
				const prInfo = { number: pr.number, title: pr.title, url: pr.url };
				addToMap(pr.mergeCommit?.oid, prInfo);
			}
			log.debug(`Phase 1: ${prs.length} PRs indexed by mergeCommit.`);
		}
	} catch (e) {
		log.debug(`getPRData phase 1 failed: ${e.message}`);
	}
	// Phase 2: resolve branch commits not found via merge commit
	const unresolved = commitShas.filter((sha) => !map[sha] && !map[sha.slice(0, 7)]);
	if (unresolved.length > 0) {
		log.debug(`Phase 2: searching ${unresolved.length} unresolved commit(s) individually...`);
		for (const sha of unresolved) {
			try {
				const raw = execSafe(
					`gh pr list --search "${sha.slice(0, 7)}" --state all --limit 1 --json number,title,url --repo "${repoSlug}"`,
					{ silent: true }
				);
				if (!raw) continue;
				const results = JSON.parse(raw);
				if (results.length > 0) {
					const pr = results[0];
					if (pr.number > maxNumber) maxNumber = pr.number;
					addToMap(sha, { number: pr.number, title: pr.title, url: pr.url });
					log.debug(`  ${sha.slice(0, 7)} → PR #${pr.number}`);
				}
			} catch {
				// ignore individual failures
			}
		}
	}
	return { map, maxNumber };
};

const getOpenIssues = (repoSlug) => {
	if (!repoSlug) return [];
	try {
		const raw = execSafe(
			`gh issue list --state open --limit 50 --json number,title,url,labels,assignees --repo "${repoSlug}"`,
			{ silent: true }
		);
		if (!raw) return [];
		return JSON.parse(raw) || [];
	} catch {
		return [];
	}
};

const auditPackage = ({ changedFiles, codeChanges, api, packageDiff, readmeDiff, apiExtractorCurrent }) => {
	const issues = [];

	const changedCode = changedFiles.some((f) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f));

	if (changedCode && !readmeDiff.changed) {
		issues.push('README.md not updated for code changes.');
	}

	if (changedCode && !packageDiff.changed) {
		issues.push('package.json not updated (verify version/dependency impact).');
	}

	if ((api?.added?.length || 0) > 0) {
		const hasVisibilityTags = codeChanges.some((item) => /@public|@internal/.test(item.patch));
		if (!hasVisibilityTags) {
			issues.push('New API exports detected without @public/@internal annotation evidence in changed code.');
		}
	}

	for (const item of codeChanges.filter((x) => /\.ts$/.test(x.file) && !x.file.endsWith('.d.ts'))) {
		const exportAdditions = item.patch.split('\n').filter((line) => line.startsWith('+export '));
		const jsdocAdditions = item.patch.split('\n').filter((line) => line.startsWith('+/**'));
		if (exportAdditions.length > jsdocAdditions.length) {
			issues.push(`${item.file}: possible missing JSDoc for newly exported members.`);
		}
	}

	if (apiExtractorCurrent && !apiExtractorCurrent.succeeded) {
		issues.push(`API Extractor failed (${apiExtractorCurrent.errorCount} errors).`);
	}

	return issues;
};

const buildPackage = (submodule) => {
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

const buildReleaseEntries = ({ branch, repoWebUrl, impact, commits, buildTag, nextVersion, currentVersion, prCommitMap, prMaxNumber, pkgPath }) => {
	const prGroups = {};   // { [prNumber]: { pr, commits[] } }
	const unassigned = [];

	for (const commit of commits) {
		// Look up by full SHA first, then short SHA
		const prInfo = prCommitMap[commit.sha] || prCommitMap[commit.shortSha];
		if (prInfo) {
			if (!prGroups[prInfo.number]) {
				prGroups[prInfo.number] = { pr: { ...prInfo }, commits: [] };
			}
			prGroups[prInfo.number].commits.push(commit);
		} else {
			unassigned.push(commit);
		}
	}

	const changelog = { major: [], minor: [], patch: [] };

	// Add known PR groups sorted by PR number (oldest first)
	const sortedPRNums = Object.keys(prGroups).map(Number).sort((a, b) => a - b);
	for (const prNum of sortedPRNums) {
		const group = prGroups[prNum];
		const codeChanges = pkgPath ? getPerPRCodeChanges(pkgPath, group.commits) : [];
		changelog[impact].push({ pr: group.pr, commits: group.commits, codeChanges });
	}

	// Unassigned commits → next PR number slot
	if (unassigned.length > 0) {
		const maxKnown = sortedPRNums.length > 0 ? Math.max(...sortedPRNums) : 0;
		const nextPrNumber = Math.max(maxKnown, prMaxNumber || 0) + 1;
		const codeChanges = pkgPath ? getPerPRCodeChanges(pkgPath, unassigned) : [];
		changelog[impact].push({
			pr: {
				number: nextPrNumber,
				url: repoWebUrl ? `${repoWebUrl}/pull/${nextPrNumber}` : '#',
				title: `Changes from current branch (${branch})`,
			},
			commits: unassigned,
			codeChanges,
		});
	}

	return { currentVersion, nextVersion, build: buildTag, impact, changelog };
};


const cleanCommitMessage = (message) => {
	const multiLine = message
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line && !/^[\s-]+$/.test(line))
		.join(' ')
		.trim();
	return multiLine
		.replace(/\s+[-\s]+$/g, '')
		.replace(/(\s-+)+/g, '')
		.trim();
};

const formatSection = (name, items, analysis) => {
	let out = `### ${name}\n`;
	if (items.length === 0) {
		out += `Nenhuma alteração de impacto ${name.toLowerCase()}\n\n`;
		return out;
	}
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const isLast = i === items.length - 1;
		const prNum = item.pr.number || 'local';
		const prUrl = item.pr.url || '#';
		out += `- [[PR ${prNum}](${prUrl})]: ${item.pr.title}\n`;

		for (const commit of item.commits) {
			const commitUrl = commit.url || '#';
			const cleanMessage = cleanCommitMessage(commit.message);
			out += `\t- [[Commit](${commitUrl})]: ${cleanMessage}\n`;
		}

		// Per-PR file changes (computed specifically for this PR's commits)
		const changes = item.codeChanges || [];
		for (const change of changes) {
			if (change.added > 0) {
				out += `\t\t- Added ${change.file} (+${change.added})\n`;
			}
		}
		for (const change of changes) {
			if (change.removed > 0 && change.added === 0) {
				out += `\t\t- Removed ${change.file} (-${change.removed})\n`;
			}
		}

		// Levitate API changes are global (total diff vs reference).
		// Show them on the last entry in this section.
		if (isLast && analysis?.comparison?.api?.levitate) {
			const levitate = analysis.comparison.api.levitate;
			for (const added of levitate.added || []) {
				out += `\t\t- Added ${added}\n`;
			}
			for (const removed of levitate.removed || []) {
				out += `\t\t- Removed ${removed}\n`;
			}
		}
	}
	out += '\n';
	return out;
};

const genChangelogMd = (analysis) => {
	const release = analysis.release;
	const now = new Date(analysis.timestamp).toLocaleDateString('pt-BR');
	const build = release.build;
	let md = `# Release v${release.nextVersion} - ${now} - ${build}\n\n`;
	md += `## Changelog\n\n`;
	md += formatSection('Major', release.changelog.major, analysis);
	md += formatSection('Minor', release.changelog.minor, analysis);
	md += formatSection('Patch', release.changelog.patch, analysis);

	// Open Issues section
	const issues = analysis.openIssues || [];
	if (issues.length > 0) {
		md += `## Open Issues\n\n`;
		for (const issue of issues) {
			const labels = (issue.labels || []).map((l) => `\`${l.name}\``).join(', ');
			const assignees = (issue.assignees || []).map((a) => `@${a.login}`).join(', ');
			let line = `- [[#${issue.number}](${issue.url})]: ${issue.title}`;
			if (labels) line += ` — ${labels}`;
			if (assignees) line += ` (${assignees})`;
			md += `${line}\n`;
		}
		md += '\n';
	}

	return md;
};

const analyzePackage = async (submodule) => {
	log.step(`Analyzing ${submodule.shortName}`);
	const branch = getDefaultBranch(submodule.absPath);
	const repoUrl = execSafe('git remote get-url origin', { cwd: submodule.absPath });
	const repoWebUrl = toWebRepoUrl(repoUrl);

	const changedFiles = getChangedFiles(submodule.absPath, branch);
	if (changedFiles.length === 0) {
		log.info('No relevant changes outside .changes/ — skipping');
		return null;
	}

	log.info(`${changedFiles.length} changed file(s)`);
	changedFiles.forEach((file) => log.debug(file));

	const buildResult = SKIP_BUILD ? { passed: true, skipped: true } : buildPackage(submodule);
	const buildTag = buildResult.passed ? 'build-passed' : 'build-failed';
	log.info(`Build result: ${buildTag}`);

	const refPackageDir = path.join(REF_DIR, submodule.relPath);
	const currentPackageJson = readJSON(path.join(submodule.absPath, 'package.json'));
	const currentVersion = currentPackageJson?.version || '0.0.0';

	const codeChanges = collectCodeChanges(submodule.absPath, branch, changedFiles);
	const distChanges = compareDist(path.join(refPackageDir, 'dist'), path.join(submodule.absPath, 'dist'));
	const packageDiff = compareSingleFile(refPackageDir, submodule.absPath, 'package.json');
	const readmeDiff = compareSingleFile(refPackageDir, submodule.absPath, 'README.md');
	const api = runLevitate(refPackageDir, submodule.absPath);
	const apiExtractorCurrent = runApiExtractor(submodule.absPath, 'current');
	const apiExtractorReference = runApiExtractor(refPackageDir, 'reference');
	const apiExtractorDiff = compareApiExtractorReports(apiExtractorReference, apiExtractorCurrent);

	const commits = getCommitEntries(submodule.absPath, branch, repoWebUrl);
	const repoSlug = repoWebUrl ? repoWebUrl.replace('https://github.com/', '') : null;
	log.debug(`Fetching GitHub data for ${repoSlug || 'unknown'}...`);
	const commitShas = commits.map((c) => c.sha);
	const { map: prCommitMap, maxNumber: prMaxNumber } = getPRData(repoSlug, commitShas);
	const openIssues = getOpenIssues(repoSlug);
	log.info(`GitHub: ${Object.values(prCommitMap).filter((v, i, a) => a.findIndex(x => x.number === v.number) === i).length} PRs mapped, ${openIssues.length} open issue(s)`);

	const impact = detectImpact(api, codeChanges);
	const type = detectType(api, codeChanges, changedFiles);
	const nextVersion = bumpVersion(currentVersion, impact);

	const release = buildReleaseEntries({
		branch,
		repoWebUrl,
		impact,
		commits,
		buildTag,
		nextVersion,
		currentVersion,
		prCommitMap,
		prMaxNumber,
		pkgPath: submodule.absPath,
	});

	const issues = auditPackage({
		changedFiles,
		codeChanges,
		api,
		packageDiff,
		readmeDiff,
		apiExtractorCurrent,
	});

	// Cleanup temporary API extractor artifacts so only release files remain in .changes/
	fs.rmSync(path.join(submodule.absPath, '.changes', '.api'), { recursive: true, force: true });
	fs.rmSync(path.join(refPackageDir, '.changes', '.api'), { recursive: true, force: true });
	fs.rmSync(path.join(submodule.absPath, 'current.api.md'), { force: true });
	fs.rmSync(path.join(submodule.absPath, 'reference.api.md'), { force: true });

	const analysis = {
		package: submodule.shortName,
		timestamp: new Date().toISOString(),
		baseBranch: branch,
		tags: {
			impact,
			type,
			build: buildTag,
		},
		comparison: {
			changedFiles,
			codeChanges,
			distChanges,
			packageJson: packageDiff,
			readme: readmeDiff,
			api: {
				levitate: api,
				apiExtractor: {
					current: apiExtractorCurrent,
					reference: apiExtractorReference,
					reportDiff: apiExtractorDiff,
				},
			},
		},
		commits,
		release,
		openIssues,
		issues,
	};

	const changesDir = path.join(submodule.absPath, '.changes');
	writeJSON(path.join(changesDir, 'pr-analysis.json'), analysis);
	writeFile(path.join(changesDir, 'CHANGELOG.md'), genChangelogMd(analysis));

	log.info(`Written: ${path.relative(ROOT, path.join(changesDir, 'pr-analysis.json'))}`);
	log.info(`Written: ${path.relative(ROOT, path.join(changesDir, 'CHANGELOG.md'))}`);
	log.hr();

	return analysis;
};

const main = async () => {
	checkRequiredTools();
	console.log(`\n${c.bold}${c.white}━━━ pnpm get-changes ━━━${c.reset}`);
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

	setupCurrentMonorepo();
	if (!SKIP_REF) setupReference();
	else log.warn('Skipping reference update/build (--skip-ref)');

	const results = [];
	for (const submodule of filtered) {
		if (!exists(path.join(submodule.absPath, 'package.json'))) continue;
		const result = await analyzePackage(submodule);
		if (result) results.push(result);
	}

	console.log(`\n${c.bold}${c.white}━━━ Summary ━━━${c.reset}`);
	if (results.length === 0) {
		log.info('No changed package detected');
	} else {
		for (const result of results) {
			const buildOk = result.tags.build === 'build-passed';
			console.log(
				`  ${buildOk ? c.green + '✓' : c.red + '✗'}${c.reset} ${c.bold}${result.package}${c.reset} ` +
				`impact=${c.cyan}${result.tags.impact}${c.reset} ` +
				`type=${c.cyan}${result.tags.type}${c.reset} ` +
				`build=${buildOk ? c.green : c.red}${result.tags.build}${c.reset}`
			);
			result.issues.forEach((issue) => console.log(`       ${c.yellow}⚠${c.reset} ${issue}`));
		}
	}

	process.exit(results.some((r) => r.tags.build === 'build-failed') ? 1 : 0);
};

main().catch((e) => {
	log.error(`Fatal: ${e.message}`);
	if (VERBOSE) console.error(e.stack);
	process.exit(1);
});
