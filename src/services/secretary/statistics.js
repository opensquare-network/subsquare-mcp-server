import BigNumber from "bignumber.js";
import { chains } from "../../config/chain.js";
import { getChainConfig } from "../../config/chains.js";
import { request } from "../api.js";
import { formatAmount } from "../../utils/amount.js";
import {
  SECRETARY_SALARY_CYCLES_STATISTICS_PATH,
  SECRETARY_SALARY_MEMBERS_STATISTICS_PATH,
  createSecretaryIdentityResolver,
} from "./common.js";

export async function getSecretarySalaryStatistics() {
  const { members, paymentReferenda } = await fetchSecretarySalaryData();

  const memberByAddress = new Map(
    members.map((member) => [member.address, member]),
  );
  const addresses = collectStatisticAddresses(members, paymentReferenda);
  const compactIdentity = await createSecretaryIdentityResolver(addresses);

  const fundingByBeneficiary = summarizeFunding(paymentReferenda);
  const byAddress = createByAddressEntries(
    addresses,
    memberByAddress,
    fundingByBeneficiary,
    compactIdentity,
  );

  return {
    totalPaid: {
      ...sumMemberSalaries(members),
      dot: sumDecimalStrings(
        [...fundingByBeneficiary.values()].map((funding) => funding.dot),
      ),
    },
    totalUsd: byAddress
      .reduce((sum, entry) => sum.plus(entry.totalUsd), new BigNumber(0))
      .toFixed(2),
    byAddress,
  };
}

async function fetchSecretarySalaryData() {
  const { apiUrl } = getChainConfig(chains.collectives);
  const [cyclesData, memberStats] = await Promise.all([
    request.get(new URL(SECRETARY_SALARY_CYCLES_STATISTICS_PATH, apiUrl)),
    request.get(new URL(SECRETARY_SALARY_MEMBERS_STATISTICS_PATH, apiUrl)),
  ]);

  if (!Array.isArray(memberStats)) {
    throw new Error(
      "SubSquare Secretary salary members response did not include members",
    );
  }

  return {
    members: memberStats.map(createMemberStat),
    paymentReferenda: Array.isArray(cyclesData?.paymentReferenda)
      ? cyclesData.paymentReferenda
      : [],
  };
}

function createMemberStat(stat) {
  return {
    address: stat.who,
    cycles: stat.cycles ?? 0,
    salary: {
      usdt: stat.salary?.usdt ?? "0",
      hollar: stat.salary?.hollar ?? "0",
    },
  };
}

function sumMemberSalaries(members) {
  return {
    usdt: sumDecimalStrings(members.map((member) => member.salary.usdt)),
    hollar: sumDecimalStrings(members.map((member) => member.salary.hollar)),
  };
}

function sumTotalUsd(salary, funding) {
  return new BigNumber(salary.usdt)
    .plus(salary.hollar)
    .plus(funding?.usd ?? "0")
    .toFixed(2);
}

function collectStatisticAddresses(members, paymentReferenda) {
  const seen = new Set();
  const addresses = [];
  const pushIfNew = (address) => {
    if (typeof address === "string" && !seen.has(address)) {
      seen.add(address);
      addresses.push(address);
    }
  };

  members.forEach((member) => pushIfNew(member.address));
  (paymentReferenda || []).forEach((referenda) =>
    pushIfNew(referenda?.beneficiary),
  );

  return addresses;
}

function createByAddressEntries(
  addresses,
  memberByAddress,
  fundingByBeneficiary,
  compactIdentity,
) {
  return addresses.map((address) => {
    const member = memberByAddress.get(address);
    const funding = fundingByBeneficiary.get(address);
    const salary = {
      usdt: member?.salary?.usdt ?? "0",
      hollar: member?.salary?.hollar ?? "0",
    };

    return {
      address,
      cycles: member?.cycles ?? 0,
      salary: {
        ...salary,
        dot: funding?.dot ?? "0",
      },
      totalUsd: sumTotalUsd(salary, funding),
      identity: compactIdentity(address),
    };
  });
}

function summarizeFunding(paymentReferenda) {
  const byBeneficiary = new Map();

  for (const referenda of paymentReferenda || []) {
    const funding = parseFundingReferenda(referenda);
    if (funding === null) {
      continue;
    }
    const entry = byBeneficiary.get(referenda.beneficiary) ?? {
      dot: new BigNumber(0),
      usd: new BigNumber(0),
    };
    entry.dot = entry.dot.plus(funding.dot);
    entry.usd = entry.usd.plus(funding.usd);
    byBeneficiary.set(referenda.beneficiary, entry);
  }

  return new Map(
    [...byBeneficiary].map(([address, entry]) => [
      address,
      { dot: entry.dot.toString(), usd: entry.usd.toFixed(2) },
    ]),
  );
}

function parseFundingReferenda(referenda) {
  let dot = null;
  try {
    dot = formatAmount(referenda.value, referenda.decimals);
  } catch {
    dot = null;
  }
  if (dot === null) {
    return null;
  }

  const price = new BigNumber(referenda.price);
  return {
    dot,
    usd: new BigNumber(dot).times(price),
  };
}

function sumDecimalStrings(values) {
  return values
    .filter((value) => {
      if (value == null || value === "") {
        return false;
      }
      const number = new BigNumber(value);
      if (!number.isFinite()) {
        return false;
      }
      return true;
    })
    .reduce((sum, value) => sum.plus(value), new BigNumber(0))
    .toString();
}
