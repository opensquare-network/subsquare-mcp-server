import { getChainConfig } from "../config/chains.js";
import { request } from "./api.js";

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function getDaysInMonth(year, month) {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseIsoTimestamp(text) {
  const match = ISO_TIMESTAMP_PATTERN.exec(text);
  if (!match) {
    return Number.NaN;
  }

  const [
    , year, month, day, hour = "0", minute = "0", second = "0", fraction = "",
  ] = match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  const secondNumber = Number(second);
  // ISO 8601 allows 24:00 as the end of the day, but nothing later.
  const isEndOfDay = hourNumber === 24 &&
    minuteNumber === 0 && secondNumber === 0 && !/[1-9]/.test(fraction);

  if (
    monthNumber < 1 || monthNumber > 12 ||
    dayNumber < 1 || dayNumber > getDaysInMonth(Number(year), monthNumber) ||
    hourNumber > 24 || minuteNumber > 59 || secondNumber > 59 ||
    (hourNumber === 24 && !isEndOfDay)
  ) {
    return Number.NaN;
  }

  return Date.parse(text);
}

function toTimestamp(value, fieldName) {
  const trimmed = String(value ?? "").trim();
  const parsed = /^-?\d+$/.test(trimmed)
    ? Number(trimmed)
    : parseIsoTimestamp(trimmed);

  if (!Number.isFinite(new Date(parsed).getTime())) {
    throw new Error(
      `[invalid_time] ${fieldName} must be a valid ISO 8601 datetime or epoch milliseconds`,
    );
  }

  return parsed;
}

function compactSummaryEvent(item) {
  return {
    type: item.type ?? null,
    category: item.category ?? null,
    subCategory: item.subCategory ?? null,
    blockHeight: item.indexer?.blockHeight ?? null,
    blockTime: item.indexer?.blockTime ?? null,
  };
}

const TREASURY_SPEND_PREFIXES = [
  "treasury_spend_",
  "fellowship_treasury_spend_",
];
const REFERENDUM_EVENT_PREFIXES = [
  "referenda_",
  "fellowship_",
  "ambassador_referendum_",
];

function isTreasurySpendEvent(type) {
  return TREASURY_SPEND_PREFIXES.some((prefix) => type.startsWith(prefix));
}

function isReferendumEvent(type) {
  return !isTreasurySpendEvent(type) &&
    REFERENDUM_EVENT_PREFIXES.some((prefix) => type.startsWith(prefix));
}

function compactEvent(item) {
  const { proposal, ...data } = item.data ?? {};
  const type = String(item.type ?? "");
  // Subsquare stores the referendum index as `index` for referendum events,
  // and the spend index as `index` for Treasury spend events.
  const isTreasurySpend = isTreasurySpendEvent(type);
  const isReferendum = isReferendumEvent(type);

  return {
    ...compactSummaryEvent(item),
    eventIndex: item.indexer?.eventIndex ?? null,
    referendumIndex: item.referendumIndex ?? (isReferendum ? item.index : null) ?? null,
    spendIndex: item.spendIndex ?? (isTreasurySpend ? item.index : null) ?? null,
    bountyIndex: item.bountyIndex ?? null,
    childBountyIndex: item.childBountyIndex ?? null,
    proposalIndex: item.proposalIndex ?? null,
    tipHash: item.tipHash ?? (type.startsWith("treasury_tip_") ? item.hash : null) ?? null,
    postTitle: data.postTitle ?? null,
    data,
    proposal: proposal ?? null,
  };
}

export async function listGovernanceEvents({
  chain,
  begin_time: beginTime,
  end_time: endTime,
  summary = true,
  category,
  sub_category: subCategory,
  type,
  limit = 100,
} = {}) {
  const beginTimestamp = toTimestamp(beginTime, "begin_time");
  const endTimestamp = toTimestamp(endTime, "end_time");

  if (endTimestamp < beginTimestamp) {
    throw new Error("[invalid_time_window] end_time must be at or after begin_time");
  }

  const { apiUrl } = getChainConfig(chain);
  const path = summary ? "events/summary" : "events";
  const endpoint = new URL(path, apiUrl);
  const response = await request.get(endpoint, {
    begin_time: beginTimestamp,
    end_time: endTimestamp,
  });

  if (!Array.isArray(response)) {
    throw new Error("[invalid_upstream_response] SubSquare events response was not an array");
  }

  const filtered = response
    .filter((item) => (category ? item.category === category : true))
    .filter((item) =>
      subCategory ? item.subCategory === subCategory : true,
    )
    .filter((item) =>
      type ? String(item.type ?? "").includes(type) : true,
    )
    .sort(
      (left, right) =>
        (left.indexer?.blockTime ?? 0) - (right.indexer?.blockTime ?? 0),
    );

  const items = filtered
    .slice(0, limit)
    .map((item) => (summary ? compactSummaryEvent(item) : compactEvent(item)));

  return {
    chain,
    scope: summary ? "summary" : "detail",
    window: {
      beginTime: beginTimestamp,
      endTime: endTimestamp,
      beginIso: new Date(beginTimestamp).toISOString(),
      endIso: new Date(endTimestamp).toISOString(),
    },
    filters: {
      category: category ?? null,
      subCategory: subCategory ?? null,
      type: type ?? null,
    },
    total: filtered.length,
    returned: items.length,
    truncated: filtered.length > items.length,
    items,
    source: endpoint.toString(),
  };
}
