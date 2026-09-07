#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const importer = path.resolve(__dirname, 'import.js');
const result = spawnSync(process.execPath, [importer, '--mode', 'rollback', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
});
process.exit(result.status === null ? 1 : result.status);
