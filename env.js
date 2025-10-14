// Display deployed services URLs from environment variables
import 'dotenv/config';

function cyan(text) {
  return `\u001B[36m${text}\u001B[0m`;
}

const deployedEnvironment = `
\u001B[1mDeployed services URLs:\u001B[0m

- Burger API    : ${cyan(process.env.BURGER_API_URL || 'Not found')}
- Burger MCP    : ${cyan(process.env.BURGER_MCP_URL || 'Not found')}
- Burger orders : ${cyan(process.env.BURGER_WEBAPP_URL || 'Not found')}
- Agent webapp  : ${cyan(process.env.AGENT_WEBAPP_URL || 'Not found')}
`;

console.log(deployedEnvironment);
