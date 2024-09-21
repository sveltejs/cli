#!/usr/bin/env node

import pkg from './package.json';
import { program } from 'commander';
import { add } from './commands/add.js';
import { create } from './commands/create.js';
import { create as createApi } from '@svelte-cli/create';
import { helpConfig } from './common.js';

// TODO temporary workaround to expose the create project api for tests
export { createApi as create };

// program.name(pkg.name).version(pkg.version, '-v').configureHelp(helpConfig);
// program.addCommand(create).addCommand(add);
// program.parse();
