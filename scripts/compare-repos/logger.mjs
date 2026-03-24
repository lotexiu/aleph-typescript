import { VERBOSE, colors as c } from './config.mjs';

export const log = {
	info: (m) => console.log(`  ${c.green}OK${c.reset} ${m}`),
	warn: (m) => console.log(`  ${c.yellow}WARN${c.reset} ${m}`),
	error: (m) => console.log(`  ${c.red}ERR${c.reset} ${m}`),
	step: (m) => console.log(`\n${c.blue}${c.bold}>${c.reset} ${c.bold}${m}${c.reset}`),
	debug: (m) => VERBOSE && console.log(`  ${c.gray}-> ${m}${c.reset}`),
	hr: () => console.log(`  ${c.gray}${'-'.repeat(70)}${c.reset}`),
};
