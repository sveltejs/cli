#!/usr/bin/env node

import { program } from 'commander';
import { add } from './src/cli/add.ts';
import { check } from './src/cli/check.ts';
import { create } from './src/cli/create.ts';
import { migrate } from './src/cli/migrate.ts';
import { helpConfig } from './src/core/common.ts';
import pkg from './package.json' with { type: 'json' };

// adds a gap of spacing between the executing command and the output
console.log();

program.name(pkg.name).version(pkg.version, '-v, --version').configureHelp(helpConfig);
program.addCommand(create).addCommand(add).addCommand(migrate).addCommand(check);
program.parse();
