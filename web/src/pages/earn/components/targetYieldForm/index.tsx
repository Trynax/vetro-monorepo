import type { Token } from "@vetro-protocol/core";
import { SegmentedControl } from "components/base/segmentedControl";
import { useAmount } from "hooks/useAmount";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import type { Address } from "viem";

import { DepositForm } from "./depositForm";
import { ExitForm } from "./exitForm";
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
  const [inputValue, handleInputChange] = useAmount();
  const [mode, setMode] = useState<TargetYieldMode>("deposit");

  function handleModeChange(newMode: TargetYieldMode) {
    if (newMode === mode) {
      return;
    }
    handleInputChange("0");
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
      {mode === "deposit" ? (
        <DepositForm {...sharedProps} />
      ) : (
        <ExitForm {...sharedProps} />
      )}
    </>
  );
}
