#!/usr/bin/env node

import pkg from './package.json';
import { program } from 'commander';
import { add } from './commands/add/index.ts';
import { create } from './commands/create.ts';
import { migrate } from './commands/migrate.ts';
import { check } from './commands/check.ts';
import { helpConfig } from './utils/common.ts';

program.name(pkg.name).version(pkg.version, '-v, --version').configureHelp(helpConfig);
program.addCommand(create).addCommand(add).addCommand(migrate).addCommand(check);
program.parse();
