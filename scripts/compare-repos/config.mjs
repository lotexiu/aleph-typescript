import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '../..');
export const REF_DIR = '/tmp/aleph-typescript-ref';
export const REPO_URL = 'https://github.com/lotexiu/aleph-typescript.git';

export const ARGS = process.argv.slice(2);
export const VERBOSE = ARGS.includes('--verbose');
export const FORCE = ARGS.includes('--force');
export const SKIP_REF = ARGS.includes('--skip-ref');
export const SKIP_CURRENT_SETUP = ARGS.includes('--skip-current-setup');
export const SKIP_BUILD = ARGS.includes('--skip-build');
export const FILTER = ARGS.find((a) => !a.startsWith('-')) || null;

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
