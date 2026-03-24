const formatDatePT = (value) => {
	if (!value) return 'n/a';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return 'n/a';
	return d.toLocaleString('pt-BR');
};

const toMentions = (users = []) => {
	if (!Array.isArray(users) || users.length === 0) return 'none';
	return users.map((u) => `@${u}`).join(', ');
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
		out += `Nenhuma alteracao de impacto ${name.toLowerCase()}\n\n`;
		return out;
	}
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const isLast = i === items.length - 1;
		const prNum = item.pr.number || 'local';
		const prUrl = item.pr.url || '#';
		out += `- [[PR ${prNum}](${prUrl})]: ${item.pr.title}\n`;
		out += `\t- PR date: ${formatDatePT(item.pr.createdAt)}\n`;
		out += `\t- PR owner: ${item.pr.owner || 'unknown'}\n`;
		out += `\t- Reviewers: ${toMentions(item.pr.reviewers)}\n`;
		out += `\t- Approvers: ${toMentions(item.pr.approvers)}\n`;

		for (const commit of item.commits) {
			const commitUrl = commit.url || '#';
			const cleanMessage = cleanCommitMessage(commit.message);
			out += `\t- [[Commit](${commitUrl})]: ${cleanMessage} (owner: ${commit.author || 'unknown'})\n`;
		}

		const changes = item.codeChanges || [];
		for (const change of changes) {
			if (change.added > 0) out += `\t\t- Added ${change.file} (+${change.added})\n`;
		}
		for (const change of changes) {
			if (change.removed > 0 && change.added === 0) out += `\t\t- Removed ${change.file} (-${change.removed})\n`;
		}

		if (isLast && analysis?.comparison?.api?.levitate) {
			const levitate = analysis.comparison.api.levitate;
			for (const added of levitate.added || []) out += `\t\t- Added ${added}\n`;
			for (const removed of levitate.removed || []) out += `\t\t- Removed ${removed}\n`;
		}
	}
	out += '\n';
	return out;
};

export const genChangelogMd = (analysis) => {
	const release = analysis.release;
	const now = new Date(analysis.timestamp).toLocaleDateString('pt-BR');
	const build = release.build;
	let md = `# Release v${release.nextVersion} - ${now} - ${build}\n\n`;
	md += '## Changelog\n\n';
	md += formatSection('Major', release.changelog.major, analysis);
	md += formatSection('Minor', release.changelog.minor, analysis);
	md += formatSection('Patch', release.changelog.patch, analysis);

	const issues = analysis.openIssues || [];
	if (issues.length > 0) {
		md += '## Open Issues\n\n';
		for (const issue of issues) {
			const labels = (issue.labels || []).map((l) => `\`${l.name}\``).join(', ');
			const assignees = (issue.assignees || []).map((a) => `@${a.login}`).join(', ');
			let line = `- [[#${issue.number}](${issue.url})]: ${issue.title}`;
			if (labels) line += ` - ${labels}`;
			if (assignees) line += ` (${assignees})`;
			md += `${line}\n`;
		}
		md += '\n';
	}

	return md;
};
