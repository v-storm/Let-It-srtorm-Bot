// index.js — точка входа LET IT STORM (ESM)

import 'dotenv/config';

console.log('ENV loaded. DATABASE_URL:', process.env.DATABASE_URL ? 'OK' : 'MISSING');

import './bot/index.js';
