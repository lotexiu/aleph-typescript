#!/usr/bin/env node

import { log } from './compare-repos/logger.mjs';
import { run } from './compare-repos/main.mjs';

run().catch((e) => {
log.error(`Fatal: ${e.message}`);
console.error(e.stack);
process.exit(1);
});
