import isNil from "lodash/isNil.js";
import { getAsset } from "../../config/assets.js";
import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { formatAmount } from "../../utils/amount.js";
import { request } from "../api.js";
import { getTypedApi } from "../papi.js";

const FELLOWSHIP_TREASURY_SPENDS_PATH = "fellowship/treasury/spends";
const OVERVIEW_SUMMARY_PATH = "overview/summary";
const FELLOWSHIP_TREASURY_ACCOUNT =
  "16VcQSRcMFy6ZHVjBvosKmo7FKqTb8ZATChDYo8ibutzLnos";
const FELLOWSHIP_SALARY_ACCOUNT =
  "13w7NdvSR1Af8xsQTArDtZmVvjE8XhWNdL4yed3iFHrUNCnS";

function createCollectivesUrl(path) {
  const { apiUrl } = getChainConfig(chains.collectives);
  return new URL(path, apiUrl);
}

function createCollectivesSiteUrl(path) {
  const { siteUrl } = getChainConfig(chains.collectives);
  return new URL(path, siteUrl);
}

function getFellowshipTreasuryExtracted(spend) {
  return spend?.extracted ?? spend?.onchainData?.extracted;
}

function formatFellowshipTreasuryAmount(extracted) {
  const rawAmount = extracted?.amount;
  const symbol = extracted?.assetKind?.symbol?.toUpperCase();
  const decimals = getAsset(chains.polkadotAssetHub, symbol)?.decimals;

  if (isNil(rawAmount) || isNil(decimals)) {
    return null;
  }

  return `${formatAmount(rawAmount, decimals)} ${symbol}`;
}

function createFellowshipTreasurySpend(spend) {
  return {
    index: spend.index,
    title: spend.title,
    state: spend.state,
    amount: formatFellowshipTreasuryAmount(
      getFellowshipTreasuryExtracted(spend),
    ),
    url: createCollectivesSiteUrl(
      `${FELLOWSHIP_TREASURY_SPENDS_PATH}/${spend.index}`,
    ).toString(),
  };
}

function createFellowshipTreasurySpendDetail(spend) {
  const extracted = getFellowshipTreasuryExtracted(spend);

  return {
    ...createFellowshipTreasurySpend(spend),
    beneficiary: extracted?.beneficiary?.address ?? null,
    referendumIndex: spend.referendumIndex ?? null,
    content: spend.content ?? null,
  };
}

function createFellowshipTreasuryPage(response) {
  return {
    page: response.page,
    pageSize: response.pageSize,
    total: response.total,
    items: response.items.map(createFellowshipTreasurySpend),
  };
}

export async function getFellowshipTreasuryStatus() {
  const {
    fellowshipTreasurySpends: { active, all: total },
  } = await request.get(createCollectivesUrl(OVERVIEW_SUMMARY_PATH));

  return {
    active,
    total,
  };
}

export async function getFellowshipTreasuryBalance() {
  const assetHubChain = chains.polkadotAssetHub;
  const dot = getAsset(assetHubChain, "DOT");
  const usdt = getAsset(assetHubChain, "USDT");
  const assetHubHollarAsset = getAsset(assetHubChain, "HOLLAR");
  const hydrationHollarAsset = getAsset(chains.hydration, "HOLLAR");
  const assetHubApi = getTypedApi(assetHubChain);
  const hydrationApi = getTypedApi(chains.hydration);
  const [
    account,
    assetHubHollarAccount,
    hydrationHollarAccount,
    salaryUsdtAccount,
    salaryHollarAccount,
  ] =
    await Promise.all([
      assetHubApi.query.System.Account.getValue(FELLOWSHIP_TREASURY_ACCOUNT),
      assetHubApi.query.ForeignAssets.Account.getValue(
        assetHubHollarAsset.assetId,
        FELLOWSHIP_TREASURY_ACCOUNT,
      ),
      hydrationApi.apis.CurrenciesApi.account(
        hydrationHollarAsset.assetId,
        FELLOWSHIP_TREASURY_ACCOUNT,
      ),
      assetHubApi.query.Assets.Account.getValue(
        usdt.assetId,
        FELLOWSHIP_SALARY_ACCOUNT,
      ),
      assetHubApi.query.ForeignAssets.Account.getValue(
        assetHubHollarAsset.assetId,
        FELLOWSHIP_SALARY_ACCOUNT,
      ),
    ]);
  const dotBalance = account?.data.free.toString() ?? "0";
  const hollarBalance =
    BigInt(assetHubHollarAccount?.balance ?? 0) +
    BigInt(hydrationHollarAccount.free);

  return {
    account: FELLOWSHIP_TREASURY_ACCOUNT,
    balances: {
      dot: formatAmount(dotBalance, dot.decimals),
      hollar: formatAmount(hollarBalance, assetHubHollarAsset.decimals),
    },
    salaryAccount: FELLOWSHIP_SALARY_ACCOUNT,
    salaryBalances: {
      usdt: formatAmount(salaryUsdtAccount?.balance ?? 0, usdt.decimals),
      hollar: formatAmount(
        salaryHollarAccount?.balance ?? 0,
        assetHubHollarAsset.decimals,
      ),
    },
  };
}

export async function listFellowshipTreasurySpends(query = {}) {
  const response = await request.get(
    createCollectivesUrl(FELLOWSHIP_TREASURY_SPENDS_PATH),
    {
      ...query,
      simple: true,
    },
  );

  return createFellowshipTreasuryPage(response);
}

export async function getFellowshipTreasurySpend({ spend_index } = {}) {
  if (!Number.isInteger(spend_index) || spend_index < 0) {
    throw new Error(
      "Fellowship Treasury spend_index must be a non-negative integer",
    );
  }

  const spend = await request.get(
    createCollectivesUrl(`${FELLOWSHIP_TREASURY_SPENDS_PATH}/${spend_index}`),
  );
  return createFellowshipTreasurySpendDetail(spend);
}
