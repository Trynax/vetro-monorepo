import { PageTitle } from "components/base/pageTitle";
import { useTranslation } from "react-i18next";

import { PoolsTable } from "./components/poolsTable";

export const DexLiquidity = function () {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle
        description={t("pages.dex-liquidity.description")}
        value={t("pages.dex-liquidity.title")}
      />
      <PoolsTable />
    </>
  );
};
