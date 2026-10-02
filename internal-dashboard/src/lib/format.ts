import { shorten } from "crypto-shortener";
import { type Address, getAddress, zeroAddress } from "viem";

const usdFormatter = new Intl.NumberFormat("en-US", {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
});

export const formatUsd = (value: number) => usdFormatter.format(value);

export const formatPercent = (value: number) => `${value.toFixed(2)}%`;

export const formatOptionalUsd = (value: number | undefined) =>
  value === undefined ? "—" : formatUsd(value);

export const formatOptionalPercent = (value: number | undefined) =>
  value === undefined ? "—" : formatPercent(value);

// Base trading-fee APY plus the venue's emission APY. Only Curve gauges set
// emissions today, hence the "CRV" label. The emission is a boost range
// (min → max) like Curve shows, collapsing to a single value when there's no
// boost spread; pools with no emissions show the base APY alone.
export const formatPoolApy = function ({
  baseApy,
  emissionApy,
  emissionApyMax,
}: {
  baseApy: number | undefined;
  emissionApy: number;
  emissionApyMax: number;
}) {
  if (emissionApy === 0) {
    return formatOptionalPercent(baseApy);
  }
  const emissions =
    emissionApyMax > emissionApy
      ? `${formatPercent(emissionApy)} → ${formatPercent(emissionApyMax)}`
      : formatPercent(emissionApy);
  return `${formatOptionalPercent(baseApy)} + ${emissions} CRV`;
};

export const formatTokenAmount = (value: number) =>
  value.toLocaleString("en-US", {
    maximumFractionDigits: value !== 0 && Math.abs(value) < 1 ? 6 : 2,
  });

export const formatPrice = (value: number) =>
  value.toLocaleString("en-US", {
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 2 : 6,
    style: "currency",
  });

export const formatRate = (value: number) =>
  value.toLocaleString("en-US", { maximumSignificantDigits: 6 });

export const formatDuration = function (seconds: number) {
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) {
    return "<1m";
  }
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

export const shortenAddress = (address: Address) =>
  shorten(address, { length: 4, prefixes: ["0x"] });

// Checksum a possibly-missing address into a viem Address, treating the zero
// address as absent. Normalizes raw (string) addresses from external APIs.
export const normalizeAddress = (address: string | undefined) =>
  address && address.toLowerCase() !== zeroAddress
    ? getAddress(address)
    : undefined;
