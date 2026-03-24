import path from 'path';
import { REF_DIR, SKIP_BUILD, ROOT, VERBOSE } from './config.mjs';
import { log } from './logger.mjs';
import { readJSON, writeFile, writeJSON, cleanupApiArtifacts } from './core/fs-utils.mjs';
import { getDefaultBranch, getCurrentBranch, getChangedFiles, toWebRepoUrl, collectCodeChanges, compareDist, compareSingleFile, getCommitEntries } from './services/git.service.mjs';
import { getOpenIssues, getPRData } from './services/github.service.mjs';
import { buildPackage } from './setup/build-setup.mjs';
import { runLevitate, runApiExtractor, compareApiExtractorReports, detectImpact, detectType, bumpVersion } from './analyzers/api-diff.analyzer.mjs';
import { buildReleaseEntries } from './services/release.service.mjs';
import { auditPackage } from './analyzers/audit.analyzer.mjs';
import { buildPrAnalysis } from './generators/pr-analysis.generator.mjs';
import { genChangelogMd } from './generators/changelog.generator.mjs';
import { genTagNotesMd } from './generators/tag-notes.generator.mjs';
import { execSafe } from './core/command.mjs';

export const analyzePackage = async (submodule) => {
	log.step(`Analyzing ${submodule.shortName}`);
	const branch = getDefaultBranch(submodule.absPath);
	const currentBranch = getCurrentBranch(submodule.absPath);
	const isPrincipalBranch = currentBranch === branch;
	const repoUrl = execSafe('git remote get-url origin', { cwd: submodule.absPath });
	const repoWebUrl = toWebRepoUrl(repoUrl);

	const changedFiles = getChangedFiles(submodule.absPath, branch);
	if (changedFiles.length === 0) {
		log.info('No relevant changes outside .changes/ - skipping');
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
	const api = runLevitate(refPackageDir, submodule.absPath, log);
	const apiExtractorCurrent = runApiExtractor(submodule.absPath, 'current', VERBOSE);
	const apiExtractorReference = runApiExtractor(refPackageDir, 'reference', VERBOSE);
	const apiExtractorDiff = compareApiExtractorReports(apiExtractorReference, apiExtractorCurrent);

	const commits = getCommitEntries(submodule.absPath, branch, repoWebUrl);
	const repoSlug = repoWebUrl ? repoWebUrl.replace('https://github.com/', '') : null;
	log.debug(`Fetching GitHub data for ${repoSlug || 'unknown'}...`);
	const commitShas = commits.map((c) => c.sha);
	const { map: prCommitMap, maxNumber: prMaxNumber } = getPRData(repoSlug, commitShas, log);
	const openIssues = getOpenIssues(repoSlug);
	log.info(`GitHub: ${Object.values(prCommitMap).filter((v, i, a) => a.findIndex((x) => x.number === v.number) === i).length} PRs mapped, ${openIssues.length} open issue(s)`);

	const impact = detectImpact(api, codeChanges);
	const type = detectType(api, codeChanges, changedFiles);
	const nextVersion = bumpVersion(currentVersion, impact);

	const release = buildReleaseEntries({
		branch,
		currentBranch,
		isPrincipalBranch,
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

	cleanupApiArtifacts(submodule.absPath, refPackageDir);

	const analysis = buildPrAnalysis({
		submodule,
		branch,
		changedFiles,
		codeChanges,
		distChanges,
		packageDiff,
		readmeDiff,
		api,
		apiExtractorCurrent,
		apiExtractorReference,
		apiExtractorDiff,
		commits,
		release,
		openIssues,
		issues,
		buildTag,
		impact,
		type,
	});

	const changesDir = path.join(submodule.absPath, '.changes');
	writeJSON(path.join(changesDir, 'pr-analysis.json'), analysis);
	writeFile(path.join(changesDir, 'CHANGELOG.md'), genChangelogMd(analysis));
	writeFile(path.join(changesDir, 'TAG_NOTES.md'), genTagNotesMd(analysis));

	log.info(`Written: ${path.relative(ROOT, path.join(changesDir, 'pr-analysis.json'))}`);
	log.info(`Written: ${path.relative(ROOT, path.join(changesDir, 'CHANGELOG.md'))}`);
	log.info(`Written: ${path.relative(ROOT, path.join(changesDir, 'TAG_NOTES.md'))}`);
	log.hr();

	return analysis;
};
