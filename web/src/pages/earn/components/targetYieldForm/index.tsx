import type { Token } from "@vetro-protocol/core";
import { SegmentedControl } from "components/base/segmentedControl";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { sanitizeAmount } from "utils/sanitizeAmount";
import type { Address } from "viem";

import { DepositForm } from "./depositForm";
import type { TargetYieldMode } from "./types";

type Props = {
  peggedToken: TokenWithGateway;
  shareToken: Token;
  stakingVaultAddress: Address;
};

export function TargetYieldForm({
  peggedToken,
  shareToken,
  stakingVaultAddress,
}: Props) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("0");
  const [mode, setMode] = useState<TargetYieldMode>("deposit");

  function handleInputChange(value: string) {
    const result = sanitizeAmount(value);
    if (!("error" in result)) {
      setInputValue(result.value);
    }
  }

  function handleModeChange(newMode: TargetYieldMode) {
    setInputValue("0");
    setMode(newMode);
  }

  const sharedProps = {
    inputValue,
    onInputChange: handleInputChange,
    peggedToken,
    shareToken,
    stakingVaultAddress,
  };

  return (
    <>
      <div className="bg-gray-100 p-3">
        <SegmentedControl
          onChange={handleModeChange}
          options={[
            { label: t("pages.earn.stake.deposit"), value: "deposit" },
            { label: t("pages.earn.fixed-term.exit"), value: "exit" },
          ]}
          size="xs"
          value={mode}
        />
      </div>
      {/* TODO add exit form https://github.com/vetro-protocol/vetro-monorepo/issues/646 */}
      {mode === "deposit" ? (
        <DepositForm {...sharedProps} />
      ) : (
        <span>ExitForm</span>
      )}
    </>
  );
}
