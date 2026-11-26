import BigNumber from "bignumber.js";

const Percentage = BigNumber.clone({
  DECIMAL_PLACES: 4,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
});

export function toPercent(part, total = 1) {
  if (part == null || total == null) {
    return null;
  }

  const numerator = new Percentage(part);
  const denominator = new Percentage(total);
  if (!numerator.isFinite() || !denominator.isFinite()) {
    throw new Error("[invalid_upstream_response] Percentage ratios must use finite values");
  }

  return denominator.isZero()
    ? null
    : numerator.times(100).div(denominator).toNumber();
}

export function getApprovalPercent(ayes, nays) {
  if (ayes == null || nays == null) {
    return null;
  }

  return toPercent(ayes, new Percentage(ayes).plus(nays));
}
