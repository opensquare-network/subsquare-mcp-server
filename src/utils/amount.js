export function formatAmount(rawAmount, decimals) {
  if (rawAmount == null) {
    return null;
  }

  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error("Amount decimals must be a non-negative integer");
  }

  let amount;
  try {
    amount = BigInt(rawAmount);
  } catch {
    throw new Error("Amount must be an integer hexadecimal or decimal value");
  }

  if (amount < 0n) {
    throw new Error("Amount cannot be negative");
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}
