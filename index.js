#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST =
  process.env.RAPIDAPI_HOST ||
  "defi-quant-multi-protocol-yield-risk-api.p.rapidapi.com";

export const server = new McpServer({
  name: "defi-quant-mcp-server",
  version: "1.0.8",
});

// Explicit boolean annotations required by MCP quality scanners & OpenAI directory
const QUANT_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export function buildZeroKeyLocalPreview(path, queryParams = {}) {
  const leverage = Number(queryParams.leverage || 5.0);
  const supplyApy = 11.5;
  const borrowApy = Number(queryParams.borrowRateOverride || 7.2);
  const lltv = 0.915;
  const poolSupply = 25000000;
  const poolBorrow = 20500000;

  const simDelta = Number(
    queryParams.simBorrowDelta ||
      queryParams.simDepositUSDe ||
      queryParams.simPtTradeSize ||
      2000000
  );

  const netRoe = supplyApy + (leverage - 1) * (supplyApy - borrowApy);
  const breakevenBorrow =
    leverage > 1 ? (leverage * supplyApy) / (leverage - 1) : supplyApy;
  const carrySpreadBps = Math.round((supplyApy - borrowApy) * 100);

  const utilBefore = (poolBorrow / poolSupply) * 100;
  const utilAfter = ((poolBorrow + simDelta) / poolSupply) * 100;
  const maxSafeBorrowBeforeKink = Math.max(0, 0.9 * poolSupply - poolBorrow);

  const currentLtv = leverage > 1 ? (leverage - 1) / leverage : 0;
  const drawdownBufferPct = (1 - currentLtv / lltv) * 100;

  return {
    status: "local_deterministic_preview",
    mode: "UNAUTHENTICATED_LOCAL_SIMULATION",
    endpoint_requested: path,
    parameters_received: queryParams,
    notice:
      "Missing RAPIDAPI_KEY environment variable. Running local deterministic math preview with baseline state. Connect a free RAPIDAPI_KEY to fetch live, real-time on-chain RPC telemetry across Morpho Blue, Ethena, Fluid, Sky, Euler V2, and Pendle V2.",
    local_simulation_scorecard: {
      verdict:
        utilAfter > 90
          ? "CAUTION (POST-TRADE KINK BREACH)"
          : "DEPLOY (WITHIN 90% KINK BUFFER)",
      carry_metrics: {
        leverage_multiplier: `${leverage.toFixed(2)}x`,
        baseline_supply_apy_pct: Number(supplyApy.toFixed(2)),
        baseline_borrow_apy_pct: Number(borrowApy.toFixed(2)),
        net_leveraged_roe_pct: Number(netRoe.toFixed(2)),
        breakeven_borrow_apy_pct: Number(breakevenBorrow.toFixed(2)),
        positive_carry_spread_bps: carrySpreadBps,
      },
      kink_stress_test: {
        simulated_trade_delta_usd: simDelta,
        target_irm_kink_pct: 90.0,
        utilization_pre_trade_pct: Number(utilBefore.toFixed(2)),
        utilization_post_trade_pct: Number(utilAfter.toFixed(2)),
        remaining_pre_kink_capacity_usd: Math.round(maxSafeBorrowBeforeKink),
      },
      liquidation_safety: {
        market_lltv_pct: Number((lltv * 100).toFixed(2)),
        position_ltv_pct: Number((currentLtv * 100).toFixed(2)),
        collateral_drawdown_to_liquidation_pct: Number(
          drawdownBufferPct.toFixed(2)
        ),
      },
    },
    upgrade_to_live_rpc_telemetry: {
      free_tier_url:
        "https://rapidapi.com/infio-infio-quant/api/defi-quant-multi-protocol-yield-risk-api",
      instructions:
        "Grab a free API key (100 requests/month free tier) at RapidAPI and set RAPIDAPI_KEY in your MCP client config to unlock real-time RPC storage slot unpacking and live multi-protocol yield scanning.",
      host: RAPIDAPI_HOST,
    },
  };
}

export async function callQuantEndpoint(path, queryParams = {}) {
  if (!RAPIDAPI_KEY || RAPIDAPI_KEY === "YOUR_RAPIDAPI_KEY") {
    const previewPayload = buildZeroKeyLocalPreview(path, queryParams);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(previewPayload, null, 2),
        },
      ],
    };
  }

  const url = new URL(`https://${RAPIDAPI_HOST}${path}`);
  Object.entries(queryParams).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      url.searchParams.append(key, String(val));
    }
  });

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
        Accept: "application/json",
      },
    });

    const rawText = await response.text();
    let parsedData;
    try {
      parsedData = rawText
        ? JSON.parse(rawText)
        : { error: "Empty response from upstream API" };
    } catch {
      parsedData = { status: response.status, raw_response: rawText };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(parsedData, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: "Network request failed", details: err.message },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

// 1. Cross-Protocol Stablecoin Carry & Arbitrage Radar
server.registerTool(
  "scan_stablecoin_yield_arbitrage_radar",
  {
    title: "Stablecoin Yield & Carry Arbitrage Radar",
    description:
      "Use this tool when a user asks where to find the best DeFi stablecoin yield, how to loop stablecoins for leveraged carry, or wants to compare Ethena sUSDe and Sky sUSDS yields against the cheapest USDC borrow rates across Morpho Blue, Fluid, and Euler V2.",
    inputSchema: z.object({
      leverage: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe("Target loop leverage multiplier (1 to 10, default: 5)"),
    }),
    annotations: {
      title: "Stablecoin Yield & Carry Arbitrage Radar",
      ...QUANT_TOOL_ANNOTATIONS,
    },
  },
  async ({ leverage }) =>
    callQuantEndpoint("/api/v1/radar/stablecoin-yield-matrix", { leverage })
);

// 2. Morpho Blue AdaptiveCurveIRM Kink & Slippage Simulator
server.registerTool(
  "simulate_morpho_blue_kink_slippage",
  {
    title: "Morpho Blue 90% Kink & Borrow Slippage Simulator",
    description:
      "Use this tool when a user wants to check Morpho Blue borrow rates, market utilization, or simulate how a large borrow or loop position will impact the 90% AdaptiveCurveIRM kink and push up post-trade borrow APY.",
    inputSchema: z.object({
      marketId: z
        .string()
        .optional()
        .describe(
          "32-byte Morpho Blue market ID hex (defaults to flagship wstETH/USDC market)"
        ),
      simBorrowDelta: z
        .number()
        .positive()
        .optional()
        .describe(
          "Simulated additional borrow amount in loan token units (default: 2000000)"
        ),
    }),
    annotations: {
      title: "Morpho Blue 90% Kink & Borrow Slippage Simulator",
      ...QUANT_TOOL_ANNOTATIONS,
    },
  },
  async ({ marketId, simBorrowDelta }) =>
    callQuantEndpoint("/api/v1/morpho/market-and-risk", {
      marketId,
      simBorrowDelta,
    })
);

// 3. Ethena sUSDe Epoch Vesting & Whale Dilution Simulator
server.registerTool(
  "simulate_ethena_susde_vesting_dilution",
  {
    title: "Ethena sUSDe Vesting & Whale Dilution Simulator",
    description:
      "Use this tool when a user asks about Ethena sUSDe real-time APY, 8-hour epoch reward vesting (`getUnvestedAmount`), or how a large whale deposit into the sUSDe staking contract will dilute the current yield.",
    inputSchema: z.object({
      simDepositUSDe: z
        .number()
        .positive()
        .optional()
        .describe(
          "Simulated new USDe deposit size to test APY dilution (default: 25000000)"
        ),
    }),
    annotations: {
      title: "Ethena sUSDe Vesting & Whale Dilution Simulator",
      ...QUANT_TOOL_ANNOTATIONS,
    },
  },
  async ({ simDepositUSDe }) =>
    callQuantEndpoint("/api/v1/ethena/vesting-and-dilution", { simDepositUSDe })
);

// 4. Fluid Protocol LiquidityLayer Bit-Unpacker & Utilization Simulator
server.registerTool(
  "unpack_fluid_liquidity_layer_state",
  {
    title: "Fluid LiquidityLayer Bit-Unpacker & Simulator",
    description:
      "Use this tool when a user asks about Fluid Protocol USDC borrow/supply rates, needs to decode Fluid's 256-bit BigMath storage slots (`exchangePricesAndConfig`), or wants to simulate post-trade utilization on Fluid.",
    inputSchema: z.object({
      tokenAddress: z
        .string()
        .optional()
        .describe(
          "ERC-20 token address on Fluid LiquidityLayer (defaults to Mainnet USDC)"
        ),
      simBorrowDelta: z
        .number()
        .positive()
        .optional()
        .describe(
          "Simulated additional borrow amount in token units (default: 2000000)"
        ),
    }),
    annotations: {
      title: "Fluid LiquidityLayer Bit-Unpacker & Simulator",
      ...QUANT_TOOL_ANNOTATIONS,
    },
  },
  async ({ tokenAddress, simBorrowDelta }) =>
    callQuantEndpoint("/api/v1/fluid/liquidity-state", {
      tokenAddress,
      simBorrowDelta,
    })
);

// 5. Sky Protocol (MakerDAO) sUSDS Continuous RAY Carry Simulator
server.registerTool(
  "simulate_sky_susds_leveraged_carry",
  {
    title: "Sky sUSDS Continuous RAY Leveraged Carry Simulator",
    description:
      "Use this tool when a user asks about Sky Protocol (MakerDAO) sUSDS savings rate, continuous per-second RAY compounding (`ssr` and `chi`), or wants to calculate leveraged sUSDS/USDC loop ROE and breakeven borrow rates on Morpho.",
    inputSchema: z.object({
      leverage: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe("Target loop leverage multiplier (default: 5)"),
      borrowRateOverride: z
        .number()
        .min(0)
        .optional()
        .describe(
          "Optional manual USDC borrow APY override in percent (e.g. 6.5)"
        ),
    }),
    annotations: {
      title: "Sky sUSDS Continuous RAY Leveraged Carry Simulator",
      ...QUANT_TOOL_ANNOTATIONS,
    },
  },
  async ({ leverage, borrowRateOverride }) =>
    callQuantEndpoint("/api/v1/sky/susds-carry-simulator", {
      leverage,
      borrowRateOverride,
    })
);

// 6. Euler V2 Vault & EVC Sub-Account Auditor
server.registerTool(
  "audit_euler_v2_vault_and_evc_subaccounts",
  {
    title: "Euler V2 Vault & EVC Sub-Account Auditor",
    description:
      "Use this tool when a user wants to audit an Euler V2 (EVK) vault, decode uint16 compact floating-point supply/borrow caps, simulate Euler IRM borrow kink slippage, or inspect Ethereum Vault Connector (EVC) 256-bit XOR sub-account bitmaps.",
    inputSchema: z.object({
      vaultAddress: z
        .string()
        .optional()
        .describe(
          "Euler V2 EVault address (defaults to flagship Euler V2 Prime USDC Vault)"
        ),
      accountAddress: z
        .string()
        .optional()
        .describe(
          "Optional Ethereum wallet address to scan EVC sub-account prefixes (0..3)"
        ),
      simBorrowDelta: z
        .number()
        .positive()
        .optional()
        .describe(
          "Simulated additional borrow amount in underlying units (default: 2000000)"
        ),
    }),
    annotations: {
      title: "Euler V2 Vault & EVC Sub-Account Auditor",
      ...QUANT_TOOL_ANNOTATIONS,
    },
  },
  async ({ vaultAddress, accountAddress, simBorrowDelta }) =>
    callQuantEndpoint("/api/v1/euler-v2/vault-and-evc-simulator", {
      vaultAddress,
      accountAddress,
      simBorrowDelta,
    })
);

// 7. Pendle V2 Logit AMM Curve & PT TWAP Slippage Analyzer
server.registerTool(
  "analyze_pendle_v2_logit_curve_and_twap",
  {
    title: "Pendle V2 Logit Curve & PT TWAP Slippage Analyzer",
    description:
      "Use this tool when a user asks about Pendle V2 fixed yields (PT/YT), wants to compare Spot Implied APY against the 15-minute geometric PT Oracle TWAP, or needs to simulate how a large PT trade impacts the logit AMM curve (`scalarRoot`, `lnFeeRateRoot`).",
    inputSchema: z.object({
      marketAddress: z
        .string()
        .optional()
        .describe(
          "Pendle V2 Market contract address (defaults to flagship PT-sUSDe market)"
        ),
      simPtTradeSize: z
        .number()
        .positive()
        .optional()
        .describe(
          "Simulated PT trade size to calculate logit curve price impact (default: 1000000)"
        ),
    }),
    annotations: {
      title: "Pendle V2 Logit Curve & PT TWAP Slippage Analyzer",
      ...QUANT_TOOL_ANNOTATIONS,
    },
  },
  async ({ marketAddress, simPtTradeSize }) =>
    callQuantEndpoint("/api/v1/pendle-v2/logit-curve-and-twap", {
      marketAddress,
      simPtTradeSize,
    })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run stdio server only when executed directly (never during node --test)
const entryFile = (process.argv[1] || "").replace(/\\/g, "/");
if (
  entryFile &&
  !entryFile.endsWith(".test.js") &&
  (import.meta.url.endsWith(entryFile) ||
    entryFile.endsWith("/defi-quant-mcp-server") ||
    entryFile.endsWith("/index.js"))
) {
  main().catch((error) => {
    console.error("Fatal MCP Server error:", error);
    process.exit(1);
  });
}