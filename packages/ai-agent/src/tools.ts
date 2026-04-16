// AI agent tools — actions the agent can take
export const agentTools = [
  {
    name: 'get_wallet_balance',
    description: 'Get the current balance of a wallet on a given chain',
    parameters: {
      walletId: 'string',
      chain: 'string',
    },
  },
  {
    name: 'estimate_gas',
    description: 'Estimate gas cost for a transaction',
    parameters: {
      chain: 'string',
      to: 'string',
      amount: 'string',
    },
  },
  {
    name: 'execute_payment',
    description: 'Execute a payment from a specific wallet',
    parameters: {
      walletId: 'string',
      to: 'string',
      amount: 'string',
      token: 'string',
    },
  },
]
