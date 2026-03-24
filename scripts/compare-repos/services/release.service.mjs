import { getPerPRCodeChanges } from './git.service.mjs';

export const buildReleaseEntries = ({
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
	pkgPath,
}) => {
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
		const codeChanges = pkgPath ? getPerPRCodeChanges(pkgPath, unassigned) : [];

		if (isPrincipalBranch) {
			changelog[impact].push({
				pr: {
					number: null,
					url: repoWebUrl ? `${repoWebUrl}/commits/${currentBranch || branch}` : '#',
					title: `Direct commits on ${currentBranch || branch} (no PR)`,
					owner: 'local',
					createdAt: null,
					mergedAt: null,
					reviewers: [],
					approvers: [],
					isDirect: true,
				},
				commits: unassigned,
				codeChanges,
			});
		} else {
			const maxKnown = sortedPRNums.length > 0 ? Math.max(...sortedPRNums) : 0;
			const nextPrNumber = Math.max(maxKnown, prMaxNumber || 0) + 1;
			changelog[impact].push({
				pr: {
					number: nextPrNumber,
					url: repoWebUrl ? `${repoWebUrl}/pull/${nextPrNumber}` : '#',
					title: `Changes from current branch (${currentBranch || branch})`,
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
	}

	return { currentVersion, nextVersion, build: buildTag, impact, changelog };
};
