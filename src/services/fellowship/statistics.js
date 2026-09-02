import BigNumber from "bignumber.js";
import isPlainObject from "lodash/isPlainObject.js";
import pick from "lodash/pick.js";
import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import {
  getUserFellowshipRankRecords,
  getUserFellowshipStatistics,
} from "../address.js";
import { request } from "../api.js";

const FELLOWSHIP_SALARY_CYCLES_STATISTICS_PATH =
  "fellowship/statistics/salary/cycles";
const FELLOWSHIP_SALARY_RANKS_STATISTICS_PATH =
  "fellowship/statistics/salary/ranks";
const FELLOWSHIP_SALARY_CLAIMANTS_STATISTICS_PATH =
  "fellowship/statistics/salary/members";
const FELLOWSHIP_MEMBERSHIP_TIMES_STATISTICS_PATH =
  "fellowship/statistics/membership/times";
const SALARY_ASSETS = ["usdt", "hollar"];
const SALARY_CYCLE_FIELDS = [
  "index",
  "registeredPaidCount",
  "unRegisteredPaidCount",
];
const RANK_CHANGE_FIELDS = [
  "promotionTimes",
  "demotionTimes",
  "retentionTimes",
];
const MEMBER_STATISTIC_FIELDS = ["joinedCycles", ...RANK_CHANGE_FIELDS];
const RANK_RECORD_FIELDS = ["time", "rank", "event"];

function createCollectivesUrl(path) {
  const { apiUrl } = getChainConfig(chains.collectives);
  return new URL(path, apiUrl);
}

function requireArrayResponse(response, context) {
  if (!Array.isArray(response)) {
    throw new Error(`${context} response was not an array`);
  }

  return response;
}

function createAssetAmounts(amounts, context) {
  if (!isPlainObject(amounts)) {
    throw new Error(`${context} did not include asset amounts`);
  }

  return Object.fromEntries(
    SALARY_ASSETS.map((asset) => {
      const value = String(amounts[asset] ?? "0");
      const amount = new BigNumber(value);
      if (!amount.isFinite() || amount.isNegative()) {
        throw new Error(`${context} included an invalid ${asset} amount`);
      }

      return [asset, value];
    }),
  );
}

function addAssetAmounts(totalByAsset, amounts) {
  for (const [asset, value] of Object.entries(amounts)) {
    const currentTotal = totalByAsset.get(asset);
    totalByAsset.set(asset, currentTotal.plus(value));
  }
}

function serializeAssetTotals(totalByAsset) {
  const total = BigNumber.sum(...totalByAsset.values()).toFixed();
  const amounts = Object.fromEntries(
    Array.from(totalByAsset, ([asset, value]) => [asset, value.toFixed()]),
  );

  return {
    ...amounts,
    total,
  };
}

function createSalaryCycle(cycle, position) {
  const context = `Fellowship salary cycle at position ${position}`;
  return {
    ...pick(cycle, SALARY_CYCLE_FIELDS),
    registeredPaid: createAssetAmounts(
      cycle?.registeredPaid,
      `${context} registered salary`,
    ),
    unRegisteredPaid: createAssetAmounts(
      cycle?.unRegisteredPaid,
      `${context} unregistered salary`,
    ),
  };
}

function createRankSalary(rankStatistic, position) {
  const salary = createAssetAmounts(
    rankStatistic?.salary,
    `Fellowship salary rank at position ${position}`,
  );

  return {
    rank: rankStatistic?.rank,
    salary,
    totalSalary: BigNumber.sum(...Object.values(salary)),
  };
}

function calculatePercentage(value, total) {
  if (!total.isGreaterThan(0)) {
    return 0;
  }

  return value
    .dividedBy(total)
    .multipliedBy(100)
    .decimalPlaces(2, BigNumber.ROUND_HALF_UP)
    .toNumber();
}

export async function getFellowshipSalaryOverview() {
  const response = await request.get(
    createCollectivesUrl(FELLOWSHIP_SALARY_CYCLES_STATISTICS_PATH),
  );
  const cycles = requireArrayResponse(
    response,
    "Fellowship salary cycles statistics",
  ).map(createSalaryCycle);
  const totalByAsset = new Map(
    SALARY_ASSETS.map((asset) => [asset, new BigNumber(0)]),
  );

  for (const cycle of cycles) {
    addAssetAmounts(totalByAsset, cycle.registeredPaid);
    addAssetAmounts(totalByAsset, cycle.unRegisteredPaid);
  }

  return {
    totalSpent: serializeAssetTotals(totalByAsset),
    cycles,
  };
}

export async function getFellowshipSalaryByRank() {
  const response = await request.get(
    createCollectivesUrl(FELLOWSHIP_SALARY_RANKS_STATISTICS_PATH),
  );
  const ranks = requireArrayResponse(
    response,
    "Fellowship salary ranks statistics",
  ).map(createRankSalary);
  const totalSalary = BigNumber.sum(...ranks.map((rank) => rank.totalSalary));

  return {
    ranks: ranks.map((rank) => ({
      rank: rank.rank,
      salary: rank.salary,
      totalSalary: rank.totalSalary.toFixed(),
      percentage: calculatePercentage(rank.totalSalary, totalSalary),
    })),
  };
}

export async function listFellowshipSalaryClaimants() {
  const response = await request.get(
    createCollectivesUrl(FELLOWSHIP_SALARY_CLAIMANTS_STATISTICS_PATH),
  );
  return requireArrayResponse(
    response,
    "Fellowship salary claimants statistics",
  );
}

export async function getFellowshipRankChangeStatistics() {
  const response = await request.get(
    createCollectivesUrl(FELLOWSHIP_MEMBERSHIP_TIMES_STATISTICS_PATH),
  );
  return pick(response, RANK_CHANGE_FIELDS);
}

export async function getFellowshipMemberStatistics({ address } = {}) {
  const [statistics, rankRecords] = await Promise.all([
    getUserFellowshipStatistics({ address }),
    getUserFellowshipRankRecords({ address }),
  ]);

  return {
    totalPaid: createAssetAmounts(
      statistics?.totalPaid,
      "Fellowship member salary statistics",
    ),
    ...pick(statistics, MEMBER_STATISTIC_FIELDS),
    rankRecords: requireArrayResponse(
      rankRecords,
      "Fellowship member rank records",
    ).map((record) => pick(record, RANK_RECORD_FIELDS)),
  };
}
