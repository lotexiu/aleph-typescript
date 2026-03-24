import { MAX_PATCH_LINES } from '../config.mjs';

export const normalizePatch = (patch) => {
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

export const countPatch = (patch) => {
	let added = 0;
	let removed = 0;
	for (const line of patch.split('\n')) {
		if (line.startsWith('+') && !line.startsWith('+++')) added += 1;
		if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
	}
	return { added, removed };
};
