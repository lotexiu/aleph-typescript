import { getPerPRCodeChanges } from './git.service.mjs';

export const buildReleaseEntries = ({ branch, repoWebUrl, impact, commits, buildTag, nextVersion, currentVersion, prCommitMap, prMaxNumber, pkgPath }) => {
	const prGroups = {};
	const unassigned = [];

	for (const commit of commits) {
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
	const sortedPRNums = Object.keys(prGroups).map(Number).sort((a, b) => a - b);
	for (const prNum of sortedPRNums) {
		const group = prGroups[prNum];
		const codeChanges = pkgPath ? getPerPRCodeChanges(pkgPath, group.commits) : [];
		changelog[impact].push({ pr: group.pr, commits: group.commits, codeChanges });
	}

	if (unassigned.length > 0) {
		const maxKnown = sortedPRNums.length > 0 ? Math.max(...sortedPRNums) : 0;
		const nextPrNumber = Math.max(maxKnown, prMaxNumber || 0) + 1;
		const codeChanges = pkgPath ? getPerPRCodeChanges(pkgPath, unassigned) : [];
		changelog[impact].push({
			pr: {
				number: nextPrNumber,
				url: repoWebUrl ? `${repoWebUrl}/pull/${nextPrNumber}` : '#',
				title: `Changes from current branch (${branch})`,
				owner: 'local',
				createdAt: null,
				mergedAt: null,
				reviewers: [],
				approvers: [],
			},
			commits: unassigned,
			codeChanges,
		});
	}

	return { currentVersion, nextVersion, build: buildTag, impact, changelog };
};
