#!/usr/bin/env node

import { program } from 'commander';

import { add } from './lib/cli/add/index.js';
import { check } from './lib/cli/check.js';
import { create } from './lib/cli/create.js';
import { migrate } from './lib/cli/migrate.js';
import { helpConfig } from './lib/cli/utils/common.js';
import pkg from './package.json' with { type: 'json' };

// adds a gap of spacing between the executing command and the output
console.log();

program.name(pkg.name).version(pkg.version, '-v, --version').configureHelp(helpConfig);
program.addCommand(create).addCommand(add).addCommand(migrate).addCommand(check);
program.parse();
