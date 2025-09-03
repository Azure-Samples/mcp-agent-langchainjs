// Display deployed services URLs from environment variables
import 'dotenv/config';

function cyan(text) {
  return `\x1b[36m${text}\x1b[0m`;
}

const deployedEnvironment = `
\x1b[1mDeployed services URLs:\x1b[0m

- Burger API    : ${cyan(process.env.BURGER_API_URL || 'Not found')}
- Burger MCP    : ${cyan(process.env.BURGER_MCP_URL ? process.env.BURGER_MCP_URL : 'Not found')}
- Burger orders : ${cyan(process.env.BURGER_WEBAPP_URL || 'Not found')}
- Agent webapp  : ${cyan(process.env.AGENT_WEBAPP_URL || 'Not found')}
`;

console.log(deployedEnvironment);
