export const auditPackage = ({ changedFiles, codeChanges, api, packageDiff, readmeDiff, apiExtractorCurrent }) => {
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
