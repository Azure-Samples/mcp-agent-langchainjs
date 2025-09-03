import path from 'node:path';
import dotenv from 'dotenv';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Env file is located in the root of the repository
dotenv.config({ path: path.join(__dirname, '../../../.env'), quiet: true });

// Use --local option to force MCP server to connect to local Burger API
const localApiUrl = 'http://localhost:7071';
export const burgerApiUrl = process.argv[2] === '--local' ? localApiUrl : (process.env.BURGER_API_URL || localApiUrl);
