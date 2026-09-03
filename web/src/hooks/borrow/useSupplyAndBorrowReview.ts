import type { AccrualPosition } from "@morpho-org/blue-sdk";
import type { Token } from "@vetro-protocol/core";
import { parseTokenUnits } from "utils/token";

import { usePositionReview } from "./usePositionReview";

type Params = {
  borrowApy: number;
  borrowInput: string;
  collateralInput: string;
  collateralToken: Token;
  frozen?: boolean;
  loanToken: Token;
  position: AccrualPosition | undefined;
};

export const useSupplyAndBorrowReview = ({
  borrowApy,
  borrowInput,
  collateralInput,
  collateralToken,
  frozen,
  loanToken,
  position,
}: Params) =>
  usePositionReview({
    borrowApy,
    collateralToken,
    frozen,
    getUpdatedPosition: (pos, borrowAmount) => ({
      borrowShares: pos.market.toBorrowShares(
        pos.market.toBorrowAssets(pos.borrowShares) + borrowAmount,
      ),
      collateral:
        pos.collateral + parseTokenUnits(collateralInput, collateralToken),
    }),
    input: borrowInput,
    inputToken: loanToken,
    loanToken,
    position,
  });
