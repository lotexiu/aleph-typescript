import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '../..');
export const REF_DIR = '/tmp/aleph-typescript-ref';
export const REPO_URL = 'https://github.com/lotexiu/aleph-typescript.git';

// CLI arguments:
// --verbose: show verbose logs from commands and analyzers.
// --force: keep execution even when warnings/issues are found.
// --skip-ref: skip updating/building the reference clone in /tmp.
// --skip-current-setup: skip install/build of current monorepo before analysis.
// --skip-build: skip package build execution (marks as build-passed).
// --warnings-json-only: only generate API warning JSON report, even without diffs.
// <filter>: package name/path filter (example: typescript).
export const ARGS = process.argv.slice(2);
export const VERBOSE = ARGS.includes('--verbose');
export const FORCE = ARGS.includes('--force');
export const SKIP_REF = ARGS.includes('--skip-ref');
export const SKIP_CURRENT_SETUP = ARGS.includes('--skip-current-setup');
export const SKIP_BUILD = ARGS.includes('--skip-build');
export const WARNINGS_JSON_ONLY = ARGS.includes('--warnings-json-only');
export const FILTER = ARGS.find((a) => !a.startsWith('-')) || null;

// Warning fragments ignored in the JSON report by default.
// This intentionally ignores entry-point export noise (index.ts/index.d.ts style warnings).
export const IGNORED_WARNING_PATTERNS = [
	'entry point index.d.ts',
	'index.ts',
	'ae-forgotten-export',
];

export const MAX_PATCH_LINES = 200;

export const colors = {
	reset: '\x1b[0m',
	bold: '\x1b[1m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	white: '\x1b[97m',
	gray: '\x1b[90m',
};
