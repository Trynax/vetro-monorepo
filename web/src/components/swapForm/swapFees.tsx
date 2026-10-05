import type { FetchStatus, QueryStatus } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { DollarSign } from "components/base/dollarSign";
import { RenderFiatValue } from "components/base/fiatValue";
import { FeeDetails } from "components/feeDetails";
import { FeesContainer } from "components/feesContainer";
import { mainnet } from "networks/mainnet";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatFiatNumber } from "utils/format";
import { getNativeToken } from "utils/nativeToken";

type FeeData = {
  data: bigint | undefined;
  fetchStatus: FetchStatus;
  status: QueryStatus;
};

type TotalFeesData = {
  data: number | undefined;
  fetchStatus: FetchStatus;
  status: QueryStatus;
};

type Props = {
  fromToken: Token;
  networkFee: FeeData;
  outputLabel?: ReactNode;
  protocolFee?: FeeData;
  sectionClassName?: string;
  totalFees?: TotalFeesData;
};

const Container = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center">{children}</div>
);

export const SwapFees = function ({
  fromToken,
  networkFee,
  outputLabel,
  protocolFee,
  sectionClassName,
  totalFees,
}: Props) {
  const { t } = useTranslation();

  const ethToken = getNativeToken(mainnet);

  const isNetworkFeeIdle = networkFee.fetchStatus === "idle";
  const isNetworkFeeError = networkFee.status === "error";

  const networkFeeValue =
    networkFee.data !== undefined ? (
      <Container>
        <DollarSign />
        <RenderFiatValue token={ethToken} value={networkFee.data} />
      </Container>
    ) : undefined;

  const protocolFeeValue =
    protocolFee && protocolFee.data !== undefined ? (
      <Container>
        <DollarSign />
        <RenderFiatValue token={fromToken} value={protocolFee.data} />
      </Container>
    ) : undefined;

  const isTotalFeesIdle = totalFees?.fetchStatus === "idle";
  const isTotalFeesError = totalFees?.status === "error";

  const totalFeesValue =
    totalFees?.data !== undefined ? (
      <Container>
        <DollarSign />
        {formatFiatNumber(totalFees.data.toFixed(2))}
      </Container>
    ) : undefined;

  return (
    <FeesContainer
      isError={isTotalFeesError}
      isIdle={isTotalFeesIdle}
      label={outputLabel}
      sectionClassName={sectionClassName}
      totalFees={totalFeesValue}
    >
      <FeeDetails
        className={sectionClassName}
        isError={isNetworkFeeError}
        isIdle={isNetworkFeeIdle}
        label={t("common.network-fee")}
        token={ethToken}
        value={networkFeeValue}
      />
      {protocolFee ? (
        <FeeDetails
          className={sectionClassName}
          isError={protocolFee.status === "error"}
          isIdle={protocolFee.fetchStatus === "idle"}
          label={t("pages.swap.fees.fixed-protocol-fee")}
          token={fromToken}
          value={protocolFeeValue}
        />
      ) : null}
    </FeesContainer>
  );
};
