const inputErrors = [
  "amount-too-small-to-bridge",
  "enter-amount",
  "exceeds-debt",
  "exceeds-max-mint",
  "exceeds-max-request",
  "insufficient-balance",
  "insufficient-collateral",
  "insufficient-gas",
  "insufficient-liquidity",
  "insufficient-treasury",
] as const;

export type InputError = (typeof inputErrors)[number];

const isInputError = (error: string): error is InputError =>
  inputErrors.includes(error as InputError);

export function getTextColor({
  errorKey,
  value,
}: {
  errorKey: string | undefined;
  value: string;
}) {
  if (value === "0" || parseFloat(value) === 0) {
    return "text-gray-600 focus:text-gray-900";
  }

  if (errorKey !== undefined && isInputError(errorKey)) {
    return "text-rose-500";
  }

  return "text-gray-900 focus:text-gray-900";
}
