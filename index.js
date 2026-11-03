#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST || 'defi-quant-multi-protocol-yield-risk-api.p.rapidapi.com';
const BASE_URL = process.env.DEFI_API_BASE_URL || `https://${RAPIDAPI_HOST}`;

async function callDefiEndpoint(path, queryParams = {}) {
  if (!RAPIDAPI_KEY && !BASE_URL.includes('localhost')) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Missing RAPIDAPI_KEY environment variable. Please subscribe to the DeFi Quant Multi-Protocol Yield & Risk API on RapidAPI Hub and add your RAPIDAPI_KEY to your MCP config.'
        }
      ]
    };
  }

  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const headers = { Accept: 'application/json' };
  if (RAPIDAPI_KEY) {
    headers['X-RapidAPI-Key'] = RAPIDAPI_KEY;
    headers['X-RapidAPI-Host'] = RAPIDAPI_HOST;
  }

  const res = await fetch(url.toString(), { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || `API failed with status ${res.status}`);
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  };
}

const server = new McpServer({
  name: 'defi-quant-mcp-server',
  version: '1.0.0'
});

// Tool 1: Cross-Protocol Stablecoin Carry Radar
server.tool(
  'scan_stablecoin_yield_arbitrage_radar',
  'Compares live stablecoin yields (Ethena sUSDe, Sky sUSDS) against cheapest USDC borrow rates (Morpho Blue, Fluid, Euler V2) and computes leveraged loop ROE.',
  {
    leverage: z.number().min(1).max(10).optional().describe('Target loop leverage (1-10, default 5)')
  },
  async ({ leverage }) => callDefiEndpoint('/api/v1/radar/stablecoin-yield-matrix', { leverage })
);

// Tool 2: Morpho Blue Kink Simulator
server.tool(
  'simulate_morpho_blue_kink_slippage',
  'Reads Morpho Blue market utilization and simulates post-trade borrow APY slippage across the 90% AdaptiveCurveIRM kink.',
  {
    marketId: z.string().optional().describe('32-byte Morpho Blue market ID hex'),
    simBorrowDelta: z.number().optional().describe('Simulated borrow amount in loan token units (default 2000000)')
  },
  async (args) => callDefiEndpoint('/api/v1/morpho/market-and-risk', args)
);

// Tool 3: Ethena sUSDe Vesting & Dilution
server.tool(
  'simulate_ethena_susde_vesting_dilution',
  'Calculates live Ethena sUSDe 8-hour linear epoch unvested drip rate and post-whale deposit APY dilution.',
  {
    simStakeUsde: z.number().optional().describe('Simulated USDe stake deposit to test APY dilution (default 25000000)')
  },
  async (args) => callDefiEndpoint('/api/v1/ethena/vesting-and-dilution', args)
);

// Tool 4: Fluid 56|8 BigMath Liquidity Unpacker
server.tool(
  'unpack_fluid_liquidity_layer_state',
  'Unpacks Fluid Protocol 256-bit BigMath storage slots into human liquidity, utilization, borrow APR, and post-trade utilization.',
  {
    token: z.string().optional().describe('ERC20 token address on Ethereum Mainnet (defaults to wstETH)'),
    simBorrowDelta: z.number().optional().describe('Simulated borrow delta in token units')
  },
  async (args) => callDefiEndpoint('/api/v1/fluid/liquidity-state', args)
);

// Tool 5: Sky sUSDS RAY rpow Carry Simulator
server.tool(
  'simulate_sky_susds_leveraged_carry',
  'Computes continuous RAY (10^27) per-second compounding for Sky sUSDS against Morpho USDC borrow costs and breakeven rates.',
  {
    leverage: z.number().min(1).max(15).optional().describe('Target leverage multiplier (default 6)')
  },
  async (args) => callDefiEndpoint('/api/v1/sky/susds-carry-simulator', args)
);

// Tool 6: Euler V2 Cap Headroom & EVC Sub-Account Auditor
server.tool(
  'audit_euler_v2_vault_and_evc_subaccounts',
  'Decodes Euler V2 uint16 compact floating-point supply/borrow caps, simulates IRM kink slippage, and scans EVC XOR sub-accounts (0..3).',
  {
    vault: z.string().optional().describe('Euler V2 EVault address (defaults to K3 Capital Prime USDC)'),
    simBorrowDelta: z.number().optional().describe('Simulated borrow delta in underlying token units'),
    simSupplyDelta: z.number().optional().describe('Simulated supply delta in underlying token units'),
    account: z.string().optional().describe('Optional wallet address to scan EVC isolated sub-accounts 0..3')
  },
  async (args) => callDefiEndpoint('/api/v1/euler-v2/vault-and-evc-simulator', args)
);

// Tool 7: Pendle V2 Logit Curve & TWAP Oracle Spread
server.tool(
  'analyze_pendle_v2_logit_curve_and_twap',
  'Reads Pendle V2 MarketState logit curve parameters, compares Spot Implied Fixed APY against PT Oracle TWAP APY, and simulates PT swap slippage.',
  {
    market: z.string().optional().describe('PendleMarketV3 pool address (auto-resolves active market if omitted)'),
    twapSeconds: z.number().optional().describe('PT Oracle TWAP duration in seconds (60-86400, default 900)'),
    simPtSwapDelta: z.number().optional().describe('Simulated PT swap delta (+X sells PT into pool, -X buys PT)')
  },
  async (args) => callDefiEndpoint('/api/v1/pendle-v2/logit-curve-and-twap', args)
);

const transport = new StdioServerTransport();
await server.connect(transport);