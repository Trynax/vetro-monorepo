import { describe, expect, it } from "vitest";

import {
  formatEvmAddress,
  formatPercentage,
  formatPercentageTick,
} from "../../src/utils/format";

describe("utils/format", function () {
  describe("formatEvmAddress", function () {
    it("should shorten a valid EVM address", function () {
      expect(
        formatEvmAddress("0xdcfe1234567890abcdef1234567890abcdefb5f9"),
      ).toBe("0xdcfe...b5f9");
    });

    it("should keep 0x prefix and 4 characters on each side", function () {
      expect(
        formatEvmAddress("0x1234567890123456789012345678901234567890"),
      ).toBe("0x1234...7890");
    });

    it("should handle lowercase addresses", function () {
      expect(
        formatEvmAddress("0xabcdef1234567890abcdef1234567890abcdef12"),
      ).toBe("0xabcd...ef12");
    });

    it("should handle checksummed addresses", function () {
      expect(
        formatEvmAddress("0xABCDEF1234567890ABCDEF1234567890ABCDEF12"),
      ).toBe("0xABCD...EF12");
    });
  });

  describe("formatPercentage", function () {
    it("should format integer percentage correctly", function () {
      expect(formatPercentage(50)).toBe("50.00%");
    });

    it("should format decimal percentage correctly", function () {
      expect(formatPercentage(25.5)).toBe("25.50%");
    });

    it("should format percentage with many decimals correctly", function () {
      expect(formatPercentage(33.333333)).toBe("33.33%");
    });

    it("should format zero percentage correctly", function () {
      expect(formatPercentage(0)).toBe("0.00%");
    });

    it("should format percentage greater than 100 correctly", function () {
      expect(formatPercentage(150)).toBe("150.00%");
    });

    it("should format negative percentage correctly", function () {
      expect(formatPercentage(-25.5)).toBe("-25.50%");
    });

    it("should format string percentage correctly", function () {
      expect(formatPercentage("75")).toBe("75.00%");
    });

    it("should format string decimal percentage correctly", function () {
      expect(formatPercentage("12.34")).toBe("12.34%");
    });

    it("should format values below 0.01 as '< 0.01%'", function () {
      expect(formatPercentage(0.001)).toBe("< 0.01%");
      expect(formatPercentage(0.009)).toBe("< 0.01%");
      expect(formatPercentage("0.005")).toBe("< 0.01%");
    });

    it("should format exactly 0.01 normally", function () {
      expect(formatPercentage(0.01)).toBe("0.01%");
    });

    it("should format percentage with high precision correctly", function () {
      expect(formatPercentage(99.999999)).toBe("100.00%");
    });
  });

  describe("formatPercentageTick", function () {
    it("should format integer percentage without decimals", function () {
      expect(formatPercentageTick(0)).toBe("0%");
      expect(formatPercentageTick(60)).toBe("60%");
    });

    it("should keep up to two decimals", function () {
      expect(formatPercentageTick(2.5)).toBe("2.5%");
      expect(formatPercentageTick(1.234)).toBe("1.23%");
    });
  });
});
