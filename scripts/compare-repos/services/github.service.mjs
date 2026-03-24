import { execSafe } from '../core/command.mjs';

const toPRInfo = (pr) => {
	const latestReviews = pr.latestReviews || [];
	const reviewerSet = new Set();
	const approverSet = new Set();
	for (const review of latestReviews) {
		const login = review?.author?.login;
		if (!login) continue;
		reviewerSet.add(login);
		if ((review.state || '').toUpperCase() === 'APPROVED') approverSet.add(login);
	}
	return {
		number: pr.number,
		title: pr.title,
		url: pr.url,
		owner: pr.author?.login || pr.author?.name || 'unknown',
		createdAt: pr.createdAt || null,
		mergedAt: pr.mergedAt || null,
		reviewers: Array.from(reviewerSet),
		approvers: Array.from(approverSet),
	};
};

export const getPRData = (repoSlug, commitShas = [], log) => {
	if (!repoSlug) return { map: {}, maxNumber: 0 };
	const map = {};
	let maxNumber = 0;
	const addToMap = (sha, prInfo) => {
		if (!sha) return;
		map[sha] = prInfo;
		if (sha.length > 7) map[sha.slice(0, 7)] = prInfo;
	};
	try {
		log.debug(`Fetching all PRs (mergeCommit only) for ${repoSlug}...`);
		const raw = execSafe(
			`gh pr list --state all --limit 100 --json number,title,url,author,createdAt,mergedAt,latestReviews,mergeCommit --repo "${repoSlug}"`,
			{ silent: true }
		);
		if (raw) {
			const prs = JSON.parse(raw);
			for (const pr of prs) {
				if (pr.number > maxNumber) maxNumber = pr.number;
				const prInfo = toPRInfo(pr);
				addToMap(pr.mergeCommit?.oid, prInfo);
			}
			log.debug(`Phase 1: ${prs.length} PRs indexed by mergeCommit.`);
		}
	} catch (e) {
		log.debug(`getPRData phase 1 failed: ${e.message}`);
	}
	const unresolved = commitShas.filter((sha) => !map[sha] && !map[sha.slice(0, 7)]);
	if (unresolved.length > 0) {
		log.debug(`Phase 2: searching ${unresolved.length} unresolved commit(s) individually...`);
		for (const sha of unresolved) {
			try {
				const raw = execSafe(
					`gh pr list --search "${sha.slice(0, 7)}" --state all --limit 1 --json number,title,url,author,createdAt,mergedAt,latestReviews --repo "${repoSlug}"`,
					{ silent: true }
				);
				if (!raw) continue;
				const results = JSON.parse(raw);
				if (results.length > 0) {
					const pr = results[0];
					if (pr.number > maxNumber) maxNumber = pr.number;
					addToMap(sha, toPRInfo(pr));
					log.debug(`  ${sha.slice(0, 7)} -> PR #${pr.number}`);
				}
			} catch {
				// ignore individual failures
			}
		}
	}
	return { map, maxNumber };
};

export const getOpenIssues = (repoSlug) => {
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
