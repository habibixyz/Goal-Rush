const { spawnSync } = require('child_process');

const serviceData = [
  {
    "operation": "update",
    "id": "30860",
    "serviceName": "Soccer Prediction Swarm",
    "serviceDescription": "Runs a three-model AI consensus swarm to predict the outcome of any active Tournament match on Robinhood Chain.\nProvide a valid matchId from the GoalRush live match feed and an optional clientAddress.",
    "serviceType": "A2MCP",
    "fee": "0.5",
    "endpoint": "https://goal-rush-backend-production.up.railway.app/api/predict"
  },
  {
    "operation": "update",
    "id": "30861",
    "serviceName": "Match Prediction Oracle",
    "serviceDescription": "Returns a high-confidence consensus winner for any GoalRush League match using a three-agent AI swarm vote. Optional: clientAddress wallet.",
    "serviceType": "A2MCP",
    "fee": "0.5",
    "endpoint": "https://goal-rush-backend-production.up.railway.app/api/predict"
  }
];

try {
  const result = spawnSync('onchainos.exe', [
    'agent', 'update',
    '--agent-id', '4564',
    '--picture', 'https://static.robinhood.com/cdn/web3/wallet/marketplace/headimages/agent/avatar/237b3ffc-e7e0-4d82-bbab-21939880a7a3.png',
    '--service', JSON.stringify(serviceData)
  ], {
    encoding: 'utf-8',
    stdio: 'pipe',
    shell: false
  });
  console.log(result.stdout);
  if (result.stderr) console.error(result.stderr);
} catch (err) {
  console.error(err);
}
