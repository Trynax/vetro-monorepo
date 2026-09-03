import { Drawer } from "components/base/drawer";
import { DrawerLoader } from "components/base/drawer/drawerLoader";
import { DrawerTitle } from "components/base/drawer/drawerTitle";
import type { MarketData } from "hooks/borrow/useMarketData";
import { usePositionInfo } from "hooks/borrow/usePositionInfo";
import { useAmount } from "hooks/useAmount";
import { Suspense, lazy, useState } from "react";
import { useTranslation } from "react-i18next";

const BorrowForm = lazy(() =>
  import("./borrowForm").then((m) => ({
    default: m.BorrowForm,
  })),
);

type Props = {
  market: MarketData;
  onClose: VoidFunction;
};

export function SupplyCollateralAndBorrowDrawerForm({
  market,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [borrowInput, onBorrowChange] = useAmount();
  const [collateralInput, onCollateralChange] = useAmount();
  const [isProgressDrawerOpen, setIsProgressDrawerOpen] = useState(false);
  const { data: position } = usePositionInfo(market.marketId);

  return (
    <Drawer onClose={onClose}>
      <div className="flex h-full flex-col">
        <DrawerTitle>
          {t("pages.borrow.supply-collateral-and-borrow")}
        </DrawerTitle>
        {position ? (
          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={<DrawerLoader />}>
              <BorrowForm
                borrowInput={borrowInput}
                collateralInput={collateralInput}
                isDrawerOpen={isProgressDrawerOpen}
                market={market}
                onBorrowChange={onBorrowChange}
                onCollateralChange={onCollateralChange}
                onDrawerOpenChange={setIsProgressDrawerOpen}
                onSuccess={onClose}
                position={position}
              />
            </Suspense>
          </div>
        ) : (
          <DrawerLoader />
        )}
      </div>
    </Drawer>
  );
}
