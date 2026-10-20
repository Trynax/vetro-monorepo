import { PageTitle } from "components/base/pageTitle";
import { useTranslation } from "react-i18next";

import { PoolsStats } from "./components/poolsStats";
import { PoolsTable } from "./components/poolsTable";

export const Liquidity = function () {
  const { t } = useTranslation();
  return (
    <>
      <PageTitle
        description={t("pages.liquidity.description")}
        value={t("pages.liquidity.title")}
      />
      <PoolsStats />
      <PoolsTable />
    </>
  );
};
