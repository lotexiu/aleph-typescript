import fs from 'fs';
import path from 'path';
import { compareExports, areChangesBreaking } from '@grafana/levitate';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { exists } from '../core/fs-utils.mjs';
import { exec } from '../core/command.mjs';
import { normalizePatch } from '../core/patch-utils.mjs';

const captureConsoleOutput = (fn) => {
	const originalStdoutWrite = process.stdout.write.bind(process.stdout);
	const originalStderrWrite = process.stderr.write.bind(process.stderr);
	let stdoutBuffer = '';
	let stderrBuffer = '';

	process.stdout.write = (chunk, encoding, callback) => {
		const text = typeof chunk === 'string' ? chunk : chunk?.toString(encoding || 'utf-8');
		stdoutBuffer += text || '';
		return originalStdoutWrite(chunk, encoding, callback);
	};

	process.stderr.write = (chunk, encoding, callback) => {
		const text = typeof chunk === 'string' ? chunk : chunk?.toString(encoding || 'utf-8');
		stderrBuffer += text || '';
		return originalStderrWrite(chunk, encoding, callback);
	};

	try {
		const result = fn();
		return {
			result,
			output: `${stdoutBuffer}\n${stderrBuffer}`,
		};
	} finally {
		process.stdout.write = originalStdoutWrite;
		process.stderr.write = originalStderrWrite;
	}
};

const parseApiWarnings = (rawOutput) => {
	if (!rawOutput) return [];
	const warnings = [];
	const warningLines = rawOutput
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('Warning: '));

	for (const line of warningLines) {
		const raw = line.replace(/^Warning:\s*/, '').trim();
		const detailMatch = raw.match(/^(.*?):(\d+):(\d+)\s-\s\(([^)]+)\)\s(.+)$/);
		if (detailMatch) {
			warnings.push({
				raw,
				file: detailMatch[1],
				line: Number(detailMatch[2]),
				column: Number(detailMatch[3]),
				code: detailMatch[4],
				message: detailMatch[5],
			});
		} else {
			warnings.push({ raw, file: null, line: null, column: null, code: null, message: raw });
		}
	}

	return warnings;
};

const normalizeWarningFromCallback = (message) => {
	const rawText = String(message?.text || '').trim();
	const raw = rawText.replace(/^Warning:\s*/, '').trim();
	return {
		raw,
		file: message?.sourceFilePath || null,
		line: Number.isFinite(message?.sourceFileLine) ? Number(message.sourceFileLine) : null,
		column: Number.isFinite(message?.sourceFileColumn) ? Number(message.sourceFileColumn) : null,
		code: message?.messageId || null,
		message: raw || rawText,
	};
};

const dedupeWarnings = (warnings) => {
	const seen = new Set();
	const result = [];
	for (const warning of warnings) {
		const key = `${warning.file || ''}|${warning.line || ''}|${warning.column || ''}|${warning.code || ''}|${warning.message || warning.raw || ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(warning);
	}
	return result;
};

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
		const callbackWarnings = [];
		const captured = captureConsoleOutput(() => Extractor.invoke(config, {
			localBuild: true,
			showVerboseMessages: verbose,
			messageCallback: (message) => {
				if (message?.logLevel === 'warning') {
					callbackWarnings.push(normalizeWarningFromCallback(message));
				}
			},
		}));
		const result = captured.result;
		const parsedWarnings = parseApiWarnings(captured.output);
		const warnings = dedupeWarnings([...callbackWarnings, ...parsedWarnings]);
		const reportPath = path.join(outDir, reportFileName);
		return {
			succeeded: result.succeeded,
			errorCount: result.errorCount,
			warningCount: result.warningCount,
			warnings,
			reportPath: exists(reportPath) ? reportPath : null,
		};
	} catch (e) {
		return {
			succeeded: false,
			errorCount: 1,
			warningCount: 0,
			warnings: [],
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
