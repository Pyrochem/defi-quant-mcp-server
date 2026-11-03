# DeFi Quant Multi-Protocol Yield & Risk API
[Subscribe on RapidAPI Hub](https://rapidapi.com/infio-infio-quant/api/defi-quant-multi-protocol-yield-risk-api)

**Block-Accurate Yield, Borrow Kink, Cap Headroom & Arbitrage Simulation Engine Across Morpho Blue, Ethena (`sUSDe`), Fluid, Sky (`sUSDS`), Euler V2 (`EVK`/`EVC`), and Pendle V2 (`Logit AMM` + `TWAP`)**

[![Ethereum Mainnet](https://img.shields.io/badge/Chain-Ethereum_Mainnet-blue.svg)]()
[![Multicall3](https://img.shields.io/badge/Execution-Atomic_Multicall3-success.svg)]()
[![MCP Ready](https://img.shields.io/badge/AI_Agent_Ready-MCP_Compatible-orange.svg)]()

---

## Why Quantitative Traders & AI Agents Use This API

Reading raw Ethereum smart contracts for modern modular DeFi protocols requires unpacking custom bit-shifted storage slots, simulating non-linear interest rate kinks, and computing continuous per-second ray exponents off-chain. If an autonomous trading bot or AI agent relies on delayed subgraph indexers or naive spot rates, it risks hitting on-chain `SupplyCapExceeded` reverts or suffering severe interest-rate slippage across utilization kinks.

The **DeFi Quant Multi-Protocol Yield & Risk API** solves these data bottlenecks in a single, stateless REST and MCP-compatible interface:

* **Zero Bit-Shifting Boilerplate:** Automatically unpacks Fluid Protocol's `256-bit` (`56|8` `BigMath`) storage slots and Euler V2's `uint16` compact floating-point amount caps into human-readable liquidity and headroom figures.
* **Pre-Trade Slippage & Kink Guards:** Simulates how your exact borrow, stake, or Principal Token (`PT`) swap size will shift post-trade utilization and APYs *before* you broadcast a transaction.
* **Atomic Block Determinism:** All multi-contract state reads are batched inside a single `Multicall3.aggregate3` call at the tip of Ethereum Mainnet, ensuring zero cross-block state drift.

---

## Core Architecture & Protocol Coverage (7 Endpoints)

| # | Protocol | Endpoint Path | Core Quant Problem Solved |
| :--- | :--- | :--- | :--- |
| **1** | **Cross-Protocol Radar** | `GET /api/v1/radar/stablecoin-yield-matrix` | Compares live stablecoin yields (`sUSDe`, `sUSDS`) against cheapest `USDC` debt (`Morpho`, `Fluid`, `Euler V2`) and computes leveraged carry ROE. |
| **2** | **Morpho Blue** | `GET /api/v1/morpho/market-and-risk` | Simulates post-trade utilization and borrow APY spikes across the `90%` `AdaptiveCurveIRM` utilization kink. |
| **3** | **Ethena (`sUSDe`)** | `GET /api/v1/ethena/vesting-and-dilution` |Tracks live 8-hour linear epoch unvested `USDe` drip rates and simulates whale stake APY dilution. |
| **4** | **Fluid Protocol** | `GET /api/v1/fluid/liquidity-state` | Decodes `56|8` `BigMath` bit-packed liquidity slots into human-readable supply/borrow amounts, exchange prices, and post-trade utilization. |
| **5** | **Sky (`sUSDS`)** | `GET /api/v1/sky/susds-carry-simulator` | Computes continuous `RAY` ($10^{27}$) per-second `rpow` compounding against Morpho `USDC` borrow costs and breakeven thresholds. |
| **6** | **Euler V2 (`EVK` + `EVC`)** | `GET /api/v1/euler-v2/vault-and-evc-simulator` | Unpacks `uint16` supply/borrow caps, simulates IRM kink slippage, and scans `EVC` isolated XOR sub-accounts (`0..3`). |
| **7** | **Pendle V2** | `GET /api/v1/pendle-v2/logit-curve-and-twap` | Extracts `MarketState` logit curve parameters, compares Spot Implied Fixed APY vs. `PendlePtOracle` TWAP, and simulates `PT` swap slippage. |

---

## Detailed Endpoint Reference

### 1. Cross-Protocol Stablecoin Yield & Arbitrage Matrix (Radar)
**`GET /api/v1/radar/stablecoin-yield-matrix`**

Scans the top yield-bearing stablecoins (`Ethena sUSDe` and `Sky sUSDS`) alongside the three primary institutional `USDC` borrow markets (`Morpho Blue`, `Fluid Liquidity Layer`, and `Euler V2 Prime`) in a single atomic call.

* **Query Parameters:**
  * `leverage` *(optional, number, default: `5`)*: Target loop leverage multiplier (`1` to `10`).
* **Sample Response:**
```json
{
  "blockNumber": 23684120,
  "yieldSources": {
    "ethenaSusde": {
      "apyPercent": 11.42,
      "unvestedUsdeRemainingInEpoch": 412500.5
    },
    "skySusds": {
      "apyPercent": 8.75
    }
  },
  "borrowMarkets": {
    "morphoBlueUsdc": { "borrowApyPercent": 6.84, "utilizationPercent": 86.4 },
    "fluidLiquidityUsdc": { "borrowAprPercent": 6.12, "utilizationPercent": 79.1 },
    "eulerPrimeUsdc": { "borrowApyPercent": 5.95 }
  },
  "arbitrageSummary": {
    "bestYieldLeg": { "protocol": "Ethena sUSDe", "apyPercent": 11.42 },
    "cheapestDebtLeg": { "protocol": "Euler V2 Prime USDC", "apyPercent": 5.95 },
    "unleveragedSpreadBps": 547,
    "leverageSelected": "5x",
    "projectedNetLoopRoePercent": 33.3,
    "isPositiveCarry": true
  }
}
```

---

### 2. Morpho Blue Market & Kink Slippage Simulator
**`GET /api/v1/morpho/market-and-risk`**

Evaluates any isolated Morpho Blue market and calls the on-chain `AdaptiveCurveIRM.borrowRateView` contract with both current state and a simulated post-borrow state to quantify rate slippage across the `90%` utilization kink.

* **Query Parameters:**
  * `marketId` *(optional, string)*: 32-byte Morpho Blue market ID hex (defaults to flagship `wstETH/USDC` market).
  * `simBorrowDelta` *(optional, number, default: `2000000`)*: Simulated additional borrow amount in loan token units.

---

### 3. Ethena `sUSDe` 8-Hour Epoch Vesting & Whale Dilution Simulator
**`GET /api/v1/ethena/vesting-and-dilution`**

Reads the live `sUSDe` staking vault (`0x9D39A5DE30e57443BfF2A8307A4256c8797A3497`) to calculate the exact linear drip rate ($\text{USDe}/\text{sec}$) over the 28,800-second (8-hour) epoch and simulates how a large whale deposit dilutes the annualized yield.

* **Query Parameters:**
  * `simStakeUsde` *(optional, number, default: `25000000`)*: Simulated new `USDe` stake deposit.

---

### 4. Fluid Protocol `56|8` `BigMath` Unpacker & Liquidity State
**`GET /api/v1/fluid/liquidity-state`**

Queries the `FluidLiquidityResolver` and unpacks the `256-bit` bit-masked configuration words (`coeff << exp`) into normalized supply/borrow balances, exchange prices, and post-trade utilization.

* **Query Parameters:**
  * `token` *(optional, string)*: Underlying ERC20 token address (defaults to `wstETH`: `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0`).
  * `simBorrowDelta` *(optional, number, default: `2500`)*: Simulated borrow delta in token units.

---

### 5. Sky Protocol (`sUSDS`) `RAY` `rpow` & Leveraged Carry Simulator
**`GET /api/v1/sky/susds-carry-simulator`**

Reads `ssr`, `chi`, and `rho` from the `sUSDS` contract, extrapolates the exact continuous exchange rate at the current block timestamp using $\chi_{\text{now}} = \chi \cdot \text{ssr}^{\Delta t}$, and computes net leveraged carry ROE against Morpho Blue `USDC` debt.

* **Query Parameters:**
  * `leverage` *(optional, number, default: `6`)*: Target loop leverage (`1` to `15`).

---

### 6. Euler V2 (`EVK` + `EVC`) Vault Cap Decoder, IRM Kink & Sub-Account Scanner
**`GET /api/v1/euler-v2/vault-and-evc-simulator`**

Decodes Euler V2's `uint16` floating-point supply and borrow caps ($\frac{10^{\text{exp}} \cdot \text{mantissa}}{100}$), simulates post-trade interest rate shifts via `computeInterestRateView`, checks whether a trade will revert with `BorrowCapExceeded` or `SupplyCapExceeded`, and scans isolated Ethereum Vault Connector (`EVC`) XOR sub-accounts (`0..3`).

* **Query Parameters:**
  * `vault` *(optional, string)*: Euler V2 EVault address (defaults to K3 Capital Prime USDC: `0x797DD80692c3b2dAdabCe8e30C07fDE5307D48a9`).
  * `simBorrowDelta` *(optional, number, default: `1000000`)*: Simulated borrow amount in underlying token units.
  * `simSupplyDelta` *(optional, number, default: `0`)*: Simulated supply amount in underlying token units.
  * `account` *(optional, string)*: Owner wallet address (e.g., `0x56a9a116D7CB83d6B8d85A9Aa2f709ABC022538C`) to scan isolated EVC sub-accounts `0..3`.

---

### 7. Pendle V2 `MarketState` Logit Curve & PT Oracle TWAP Analyzer
**`GET /api/v1/pendle-v2/logit-curve-and-twap`**

Reads live `MarketState` parameters (`totalPt`, `totalSy`, `scalarRoot`, `lastLnImpliedRate`) from `PendleMarketV3`, compares the Spot Implied Fixed APY against the on-chain `PendlePtOracle` geometric TWAP rate, and simulates fixed-APY slippage along Pendle's logit curve:

$$\text{ExchangeRate}_{\text{post}} = \text{rateAnchor} + \frac{\ln\left(\frac{p_{\text{post}}}{1 - p_{\text{post}}}\right)}{\text{rateScalar}}$$

* **Query Parameters:**
  * `market` *(optional, string)*: `PendleMarketV3` pool contract address on Ethereum Mainnet. **If omitted, the API automatically resolves an active, liquid Mainnet market.**
  * `twapSeconds` *(optional, number, default: `900`)*: TWAP duration in seconds (`60` to `86400`).
  * `simPtSwapDelta` *(optional, number, default: `25000`)*: Simulated `PT` swap size (`+X` sells `PT` into the AMM; `-X` buys `PT` from the AMM).

---

## Quickstart Code Examples

### Python (`requests`)
```python
import requests

url = "https://YOUR_RAPIDAPI_HOST.p.rapidapi.com/api/v1/radar/stablecoin-yield-matrix"
headers = {
    "X-RapidAPI-Key": "YOUR_RAPIDAPI_KEY",
    "X-RapidAPI-Host": "YOUR_RAPIDAPI_HOST.p.rapidapi.com"
}

response = requests.get(url, headers=headers, params={"leverage": 5})
data = response.json()

print(f"Best Carry Loop: {data['arbitrageSummary']['bestYieldLeg']['protocol']} vs {data['arbitrageSummary']['cheapestDebtLeg']['protocol']}")
print(f"Projected 5x Net ROE: {data['arbitrageSummary']['projectedNetLoopRoePercent']}%")
```

### Node.js / TypeScript (`fetch`)
```javascript
const url = 'https://YOUR_RAPIDAPI_HOST.p.rapidapi.com/api/v1/euler-v2/vault-and-evc-simulator?simBorrowDelta=2500000';

const response = await fetch(url, {
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': 'YOUR_RAPIDAPI_HOST.p.rapidapi.com'
  }
});

const result = await response.json();
console.log('Post-Trade Euler Borrow APY:', result.irmKinkSimulation.postTradeBorrowApyPercent);
console.log('Execution Guard:', result.irmKinkSimulation.executionGuard);
```

---

## Using with AI Agents (Claude Desktop, Cursor & MCP)

This API powers the `defi-quant-mcp-server` Model Context Protocol (MCP) package, enabling Claude Desktop, Cursor, and autonomous agents to query live DeFi yields and run pre-trade risk simulations in plain English.

Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "defi-quant": {
      "command": "npx",
      "args": ["-y", "defi-quant-mcp-server"],
      "env": {
        "RAPIDAPI_KEY": "YOUR_RAPIDAPI_KEY",
        "RAPIDAPI_HOST": "YOUR_RAPIDAPI_HOST.p.rapidapi.com"
      }
    }
  }
}
```