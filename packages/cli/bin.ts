#!/usr/bin/env node

import pkg from './package.json';
import { program } from 'commander';
import { add } from './commands/add.js';
import { create } from './commands/create.js';
import { migrate } from './commands/migrate.js';
import { helpConfig } from './common.js';

program.name(pkg.name).version(pkg.version, '-v').configureHelp(helpConfig);
program.addCommand(create).addCommand(add).addCommand(migrate);
program.parse();
