import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { SECRETARY_SALARY_CYCLES_STATISTICS_PATH } from "./common.js";

export async function listSecretarySalaryCycles() {
  const { apiUrl } = getChainConfig(chains.collectives);
  const data = await request.get(
    new URL(SECRETARY_SALARY_CYCLES_STATISTICS_PATH, apiUrl),
  );

  if (!Array.isArray(data?.cycles)) {
    throw new Error(
      "SubSquare Secretary salary cycles response did not include cycles",
    );
  }

  return data.cycles.map(createCompactCycle);
}

function createCompactCycle(cycle) {
  return {
    index: cycle.index,
    registeredPaidCount: cycle.registeredPaidCount,
    unRegisteredPaidCount: cycle.unRegisteredPaidCount,
    registeredPaid: cycle.registeredPaid,
    unRegisteredPaid: cycle.unRegisteredPaid,
    blockTime: cycle.indexer?.blockTime ?? null,
  };
}
