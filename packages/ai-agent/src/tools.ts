import type { AgentTool } from './types.js'

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'get_wallet_balance',
    description: 'Get the current token balances for a specific wallet address on a chain. Returns all token balances including native and ERC-20/SPL tokens.',
    input_schema: {
      type: 'object',
      properties: {
        walletId:  { type: 'string', description: 'The wallet ID to check' },
        address:   { type: 'string', description: 'The wallet address' },
        chain:     { type: 'string', description: 'The blockchain chain ID (ethereum, base, polygon, solana, arbitrum, optimism)' },
      },
      required: ['walletId', 'address', 'chain'],
    },
  },
  {
    name: 'estimate_gas_fee',
    description: 'Estimate the gas fee in USD for sending a transaction on a given chain. Use this to determine the cheapest chain for a payment.',
    input_schema: {
      type: 'object',
      properties: {
        chain:     { type: 'string', description: 'Chain to estimate gas on' },
        token:     { type: 'string', description: 'Token being sent' },
        amount:    { type: 'string', description: 'Amount to send in human-readable units' },
        toAddress: { type: 'string', description: 'Destination address' },
      },
      required: ['chain', 'token', 'amount', 'toAddress'],
    },
  },
  {
    name: 'get_token_price',
    description: 'Get the current USD price for a token.',
    input_schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Token symbol e.g. ETH, USDC, SOL' },
      },
      required: ['token'],
    },
  },
  {
    name: 'select_payment_wallet',
    description: 'Finalize the decision: select which wallet and token to use for a payment. Call this once you have gathered enough context to make a confident decision.',
    input_schema: {
      type: 'object',
      properties: {
        walletId:    { type: 'string',  description: 'The wallet ID to pay from' },
        chain:       { type: 'string',  description: 'The chain to execute on' },
        token:       { type: 'string',  description: 'The token to use for payment' },
        reasoning:   { type: 'string',  description: 'Clear explanation of why this wallet/chain/token was chosen' },
        confidence:  { type: 'string',  description: 'high | medium | low — how confident you are in this choice' },
      },
      required: ['walletId', 'chain', 'token', 'reasoning', 'confidence'],
    },
  },
]

export const TOOL_NAMES = AGENT_TOOLS.map((t) => t.name)
