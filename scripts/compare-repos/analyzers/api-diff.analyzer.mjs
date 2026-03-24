import fs from 'fs';
import path from 'path';
import { compareExports, areChangesBreaking } from '@grafana/levitate';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { exists } from '../core/fs-utils.mjs';
import { exec } from '../core/command.mjs';
import { normalizePatch } from '../core/patch-utils.mjs';

export const runLevitate = (refPackageDir, curPackageDir, log) => {
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

export const runApiExtractor = (packageDir, label, verbose) => {
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
			showVerboseMessages: verbose,
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

export const compareApiExtractorReports = (refResult, curResult) => {
	if (!refResult?.reportPath || !curResult?.reportPath) return null;
	const ref = fs.readFileSync(refResult.reportPath, 'utf-8');
	const cur = fs.readFileSync(curResult.reportPath, 'utf-8');
	if (ref === cur) return { changed: false, patch: '' };
	const patch = exec(`git diff --no-color --no-index --unified=3 "${refResult.reportPath}" "${curResult.reportPath}" || true`);
	return { changed: true, patch: normalizePatch(patch) };
};

export const detectImpact = (api, codeChanges) => {
	if (api?.breaking || (api?.removed?.length || 0) > 0) return 'major';
	if ((api?.added?.length || 0) > 0) return 'minor';
	const totalAdded = codeChanges.reduce((sum, item) => sum + item.added, 0);
	if (totalAdded > 80) return 'minor';
	return 'patch';
};

export const detectType = (api, codeChanges, changedFiles) => {
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

export const bumpVersion = (version, impact) => {
	const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10));
	if (impact === 'major') return `${major + 1}.0.0`;
	if (impact === 'minor') return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
};
