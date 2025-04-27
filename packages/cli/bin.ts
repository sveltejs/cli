#!/usr/bin/env node

import process from 'node:process';

const paraglide = process.argv[3];
console.log('received paraglide args: ' + paraglide);

const expectedResult = 'paraglide=languageTags:en,de,demo:no';
if (paraglide !== expectedResult) console.log('result unexpected, expected: ' + expectedResult);
else console.log('ok');
