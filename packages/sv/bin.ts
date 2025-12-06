#!/usr/bin/env node

import pkg from './package.json' with { type: 'json' };
import { program } from 'commander';
import { add } from './lib/cli/add/index.ts';
import { create } from './lib/cli/create.ts';
import { migrate } from './lib/cli/migrate.ts';
import { check } from './lib/cli/check.ts';
import { helpConfig } from './lib/cli/utils/common.ts';

// adds a gap of spacing between the executing command and the output
console.log();

program.name(pkg.name).version(pkg.version, '-v, --version').configureHelp(helpConfig);
program.addCommand(create).addCommand(add).addCommand(migrate).addCommand(check);
program.parse();
