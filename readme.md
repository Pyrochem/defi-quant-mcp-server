# DeFi Quant MCP Server (`defi-quant-mcp-server`)

This repository contains the official open-source **Model Context Protocol (MCP)** server implementation for the DeFi Quant suite. Built with `@modelcontextprotocol/sdk` and Zod schema validation, it exposes **7 native DeFi yield, leveraged carry, and pre-trade risk simulation tools** directly to AI agents (Claude Desktop, Cursor, Windsurf, and autonomous trading agents).

Unlike read-only DeFi wrappers that only return static historical snapshots, this MCP server performs **pre-execution smart contract state simulations** across **Morpho Blue, Ethena (`sUSDe`), Fluid Protocol, Sky Protocol (`sUSDS`), Euler V2 (EVK/EVC), and Pendle V2**.

---

## Example AI Prompts This Server Solves

Once connected to Claude Desktop or Cursor, your AI agent can autonomously answer complex quantitative DeFi questions:

* **Cross-Protocol Yield & Looping:** *"Where is the highest leveraged stablecoin carry right now between Ethena sUSDe and Sky sUSDS, and is it cheaper to borrow USDC on Morpho Blue, Fluid, or Euler V2 at 5x leverage?"*
* **Morpho Blue Kink Slippage:** *"What happens to the borrow APY on the Morpho wstETH/USDC market if I borrow an extra $2,000,000? Does it push utilization past the 90% AdaptiveCurveIRM kink?"*
* **Ethena Epoch Dilution:** *"How much unvested USDe is left in Ethena's current 8-hour epoch, and how much will the sUSDe APY drop if a whale deposits $25M right now?"*
* **Fluid Bit-Packed State:** *"Unpack the Fluid LiquidityLayer 256-bit storage slot for USDC and calculate post-trade utilization after a $2M borrow."*
* **Pendle V2 Fixed Yield & TWAP Divergence:** *"Compare Pendle's Spot Implied Fixed APY against the 15-minute PT Oracle TWAP, and simulate the implied yield slippage on a $1M PT swap."*
* **Euler V2 Vault & Sub-Account Audits:** *"Decode the uint16 supply/borrow caps on the Euler V2 Prime USDC vault and check active EVC sub-account bitmaps."*

---

## Native MCP Tools Included (7 Tools)

1. **`scan_stablecoin_yield_arbitrage_radar`** — Compares live stablecoin yields (`sUSDe`, `sUSDS`) against the cheapest USDC borrow rates (`Morpho Blue`, `Fluid`, `Euler V2`) and calculates net leveraged loop ROE and breakeven borrow spreads.
2. **`simulate_morpho_blue_kink_slippage`** — Reads live Morpho Blue market state (`borrowShares`, `totalSupplyAssets`) and simulates post-trade borrow APY slippage across the 90% `AdaptiveCurveIRM` kink.
3. **`simulate_ethena_susde_vesting_dilution`** — Queries Ethena `getUnvestedAmount()` linear 8-hour epoch decay and models post-deposit APY dilution.
4. **`unpack_fluid_liquidity_layer_state`** — Unpacks Fluid Protocol's `56|8` `BigMath` bit-packed storage slots into human-readable supply/borrow liquidity, utilization, and post-trade rate impact.
5. **`simulate_sky_susds_leveraged_carry`** — Computes continuous RAY ($10^{27}$) per-second `ssr`/`chi` compounding for Sky `sUSDS` against Morpho USDC borrow costs.
6. **`audit_euler_v2_vault_and_evc_subaccounts`** — Decodes Euler V2 compact floating-point mantissa/exponent caps, simulates IRM kink slippage, and scans EVC 256-bit XOR sub-accounts (`0..3`).
7. **`analyze_pendle_v2_logit_curve_and_twap`** — Reads Pendle V2 `MarketState` logit curve parameters (`scalarRoot`, `lnFeeRateRoot`), compares Spot Implied APY vs. PT Oracle TWAP, and simulates PT swap slippage.

---

## Quick Start (Claude Desktop / Cursor Configuration)

1. Grab a free API key from the **[DeFi Quant Multi-Protocol Yield & Risk API on RapidAPI](https://rapidapi.com/infio-infio-quant/api/defi-quant-multi-protocol-yield-risk-api)** (includes a **Free $0/mo Basic Tier** with 50 requests/month).
2. Add the following block to your `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "defi-quant": {
      "command": "npx",
      "args": ["-y", "defi-quant-mcp-server"],
      "env": {
        "RAPIDAPI_KEY": "YOUR_RAPIDAPI_KEY",
        "RAPIDAPI_HOST": "defi-quant-multi-protocol-yield-risk-api.p.rapidapi.com"
      }
    }
  }
}