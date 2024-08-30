#!/usr/bin/env node

import pkg from './package.json';
import { program } from 'commander';
import { add } from './commands/add.js';
import { create } from './commands/create.js';

program.name(pkg.name).version(pkg.version, '-v');
program.addCommand(create).addCommand(add);
program.parse();
