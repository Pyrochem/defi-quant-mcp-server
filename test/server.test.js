import test from "node:test";
import assert from "node:assert/strict";
import { callQuantEndpoint, buildZeroKeyLocalPreview } from "../index.js";

const ENDPOINTS = [
  { tool: "scan_stablecoin_yield_arbitrage_radar", path: "/api/v1/arbitrage/stablecoin-carry-radar", params: { leverage: 5 } },
  { tool: "simulate_morpho_blue_kink_slippage", path: "/api/v1/morpho/market-risk", params: { simBorrowDelta: 2000000 } },
  { tool: "simulate_ethena_susde_vesting_dilution", path: "/api/v1/ethena/yield-analytics", params: { simDepositUSDe: 25000000 } },
  { tool: "unpack_fluid_liquidity_layer_state", path: "/api/v1/fluid/resolver", params: { simBorrowDelta: 2000000 } },
  { tool: "simulate_sky_susds_leveraged_carry", path: "/api/v1/sky/susds-analytics", params: { leverage: 5, borrowRateOverride: 6.5 } },
  { tool: "audit_euler_v2_vault_and_evc_subaccounts", path: "/api/v1/euler/vault-audit", params: { simBorrowDelta: 2000000 } },
  { tool: "analyze_pendle_v2_logit_curve_and_twap", path: "/api/v1/pendle/market-analytics", params: { simPtTradeSize: 1000000 } },
];

for (const item of ENDPOINTS) {
  test(`exercises ${item.tool} handler and deterministic preview`, async () => {
    const res = await callQuantEndpoint(item.path, item.params);
    assert.ok(res.content && Array.isArray(res.content));
    const parsed = JSON.parse(res.content[0].text);
    assert.equal(parsed.endpoint_requested, item.path);
    assert.ok(parsed.local_simulation_scorecard);
  });
}

test("buildZeroKeyLocalPreview detects post-trade 90% kink breach", () => {
  const result = buildZeroKeyLocalPreview("/api/v1/morpho/market-risk", {
    simBorrowDelta: 5000000,
  });
  assert.equal(
    result.local_simulation_scorecard.verdict,
    "CAUTION (POST-TRADE KINK BREACH)"
  );
});