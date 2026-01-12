#!/usr/bin/env node
/**
 * Portable constants updater - works on Mac, Windows, Linux
 * Usage: node update-constants.mjs <APP_ID> <CHAIN_ID>
 * 
 * This script updates src/constants.ts with the deployed APP_ID and CHAIN_ID
 * without using sed (which has different behavior on Mac vs Linux)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const [, , appId, chainId] = process.argv;

if (!appId || !chainId) {
    console.error('Usage: node update-constants.mjs <APP_ID> <CHAIN_ID>');
    process.exit(1);
}

// Default to /app for Docker, but support running from project root
const baseDir = process.cwd().includes('/app') ? '/app' : process.cwd();
const constantsPath = join(baseDir, 'src', 'constants.ts');

console.log(`Updating ${constantsPath}...`);
console.log(`  APP_ID: ${appId}`);
console.log(`  BANK_CHAIN_ID: ${chainId}`);

let content = readFileSync(constantsPath, 'utf8');

// Replace APP_ID
content = content.replace(
    /export const APP_ID = ".*";/,
    `export const APP_ID = "${appId}";`
);

// Replace BANK_CHAIN_ID
content = content.replace(
    /export const BANK_CHAIN_ID = ".*";/,
    `export const BANK_CHAIN_ID = "${chainId}";`
);

writeFileSync(constantsPath, content, 'utf8');
console.log('✅ Constants updated successfully!');
