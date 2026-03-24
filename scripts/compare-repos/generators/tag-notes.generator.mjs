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

const badgeValue = (value) => encodeURIComponent(String(value).replace(/-/g, '--').replace(/\s+/g, '_'));
const badge = (label, value, color) => `![](https://img.shields.io/badge/${badgeValue(label)}-${badgeValue(value)}-${badgeValue(color)}?style=for-the-badge&logo=github)<br>`;

export const genTagNotesMd = (analysis) => {
	const release = analysis.release;
	const now = new Date(analysis.timestamp).toLocaleString('pt-BR');
	const section = release.changelog[release.impact] || [];
	const prCount = section.length;
	const commitCount = section.reduce((acc, item) => acc + (item.commits?.length || 0), 0);

	let md = `# Tag Notes - v${release.nextVersion}\n\n`;
	md += `Generated: ${now}\n\n`;
	const impact = analysis.tags?.impact || release.impact;
	const type = analysis.tags?.type || 'unknown';
	const build = analysis.tags?.build || release.build;
	const impactColor = impact === 'major' ? 'orange' : impact === 'minor' ? 'blue' : 'lightgrey';
	const typeColor = type === 'feature' ? 'brightgreen' : type === 'fix' ? 'yellow' : type === 'refactor' ? 'blueviolet' : type === 'docs' ? 'informational' : 'lightgrey';
	const buildColor = build === 'build-passed' ? 'brightgreen' : 'red';

	md += '## Release Signals\n\n';
	md += `${badge('impact', impact, impactColor)}\n`;
	md += `${badge('type', type, typeColor)}\n`;
	md += `${badge('build', build, buildColor)}\n`;
	md += `${badge('prs', prCount, 'blue')}\n`;
	md += `${badge('commits', commitCount, 'blue')}\n\n`;

	md += '## PR Digest\n\n';
	if (section.length === 0) {
		md += '- No PR entries found for this release impact.\n\n';
	} else {
		for (const item of section) {
			if (item.pr.isDirect) {
				md += `### Direct Commits - ${item.pr.title}\n`;
				md += `- URL: ${item.pr.url || '#'}\n`;
			} else {
				md += `### PR #${item.pr.number} - ${item.pr.title}\n`;
				md += `- URL: ${item.pr.url || '#'}\n`;
				md += `- PR date: ${formatDatePT(item.pr.createdAt)}\n`;
				md += `- PR owner: ${item.pr.owner || 'unknown'}\n`;
				md += `- Reviewers: ${toMentions(item.pr.reviewers)}\n`;
				md += `- Approvers: ${toMentions(item.pr.approvers)}\n`;
			}
			for (const commit of item.commits || []) {
				md += `- Commit ${commit.shortSha}: ${cleanCommitMessage(commit.message)} (owner: ${commit.author || 'unknown'})\n`;
			}
			md += '\n';
		}
	}

	md += '## Analysis Warnings\n\n';
	if ((analysis.issues || []).length === 0) {
		md += '- none\n';
	} else {
		for (const issue of analysis.issues) md += `- ${issue}\n`;
	}

	md += '\n## API Warnings (Related To Changes)\n\n';
	const apiWarnings = analysis.apiWarnings || [];
	if (apiWarnings.length === 0) {
		md += '- none\n';
	} else {
		for (const warning of apiWarnings) {
			const location = warning?.file ? `${warning.file}${warning?.line ? `:${warning.line}` : ''}` : 'unknown';
			const code = warning?.code ? ` (${warning.code})` : '';
			md += `- ${location}${code}: ${warning?.message || warning?.raw || 'warning'}\n`;
		}
	}

	return md;
};
