import { Breadcrumb } from "components/base/breadcrumb";
import { BreadcrumbSelector } from "components/base/breadcrumb/breadcrumbSelector";
import { ButtonLink } from "components/base/button";
import { FixedTermInfoCards } from "components/earn/fixedTermInfoCards";
import { FixedTermPositionCards } from "components/earn/fixedTermPositionCards";
import { VaultHeader } from "components/earn/vaultHeader";
import { EarnIcon } from "components/navbar/earnIcon";
import { StripedDivider } from "components/stripedDivider";
import { TokenLogo } from "components/tokenLogo";
import { useShareToken } from "hooks/useShareToken";
import { useVaultPeggedToken } from "hooks/useVaultPeggedToken";
import { targetYieldVaultAddresses } from "pages/earn/targetYieldVaults";
import { ErrorPage } from "pages/errorPage";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { Navigate, useParams } from "react-router";
import { type Address, isAddress, isAddressEqual } from "viem";

const VaultDropdownItem = function ({
  stakingVaultAddress,
}: {
  stakingVaultAddress: Address;
}) {
  const { data: peggedToken } = useVaultPeggedToken(stakingVaultAddress);
  const { data: shareToken } = useShareToken(stakingVaultAddress);

  if (!peggedToken || !shareToken) {
    return <Skeleton height={20} width={80} />;
  }

  return (
    <div className="flex items-center gap-2">
      <TokenLogo {...peggedToken} size="small" />
      <span>{shareToken.symbol}</span>
    </div>
  );
};

// TODO: replace with the target-yield stake form
// See https://github.com/vetro-protocol/vetro-monorepo/issues/646
const StakeFormPlaceholder = () => (
  <div className="text-b-medium flex h-[615px] items-center justify-center text-gray-500">
    Form goes here
  </div>
);

const FixedTermEarnDetailsContent = function ({
  stakingVaultAddress,
}: {
  stakingVaultAddress: Address;
}) {
  const { t } = useTranslation();
  const { data: peggedToken, isError: isPeggedTokenError } =
    useVaultPeggedToken(stakingVaultAddress);
  const { data: shareToken, isError: isShareTokenError } =
    useShareToken(stakingVaultAddress);

  if (isPeggedTokenError || isShareTokenError) {
    return <ErrorPage />;
  }

  if (!peggedToken || !shareToken) {
    return (
      <div className="p-8">
        <Skeleton count={3} height={40} />
      </div>
    );
  }

  const otherVaultAddresses = targetYieldVaultAddresses.filter(
    (address) => !isAddressEqual(address, stakingVaultAddress),
  );

  return (
    <div className="flex flex-col">
      <Breadcrumb
        items={[
          {
            menu: (
              <ButtonLink href="/earn" size="xSmall" variant="tertiary">
                <EarnIcon className="size-4 text-gray-400" />
                {t("nav.earn")}
              </ButtonLink>
            ),
          },
          {
            menu: (
              <BreadcrumbSelector
                getItemKey={(item) => item}
                getItemUrl={(item) => `/earn/fixed-term/${item}`}
                items={otherVaultAddresses}
                renderItem={(item) => (
                  <VaultDropdownItem stakingVaultAddress={item} />
                )}
                trigger={
                  <>
                    <TokenLogo {...peggedToken} size="small" />
                    {shareToken.symbol}
                  </>
                }
                triggerId="breadcrumb-vault-selector"
              />
            ),
          },
        ]}
      />
      <VaultHeader
        peggedToken={peggedToken}
        symbol={shareToken.symbol}
        title={t("pages.earn.fixed-term.header-title")}
      />
      <div className="flex flex-col-reverse md:flex-row">
        <div className="min-w-0 flex-1 bg-gray-100">
          <FixedTermInfoCards stakingVaultAddress={stakingVaultAddress} />
          <StripedDivider variant="small" />
          <FixedTermPositionCards
            shareToken={shareToken}
            stakingVaultAddress={stakingVaultAddress}
          />
        </div>
        <div className="bg-gray-100 md:hidden">
          <StripedDivider />
        </div>
        <div className="w-full shrink-0 md:w-[341px] md:border-b md:border-l md:border-gray-200">
          <div className="md:sticky md:top-0">
            <StakeFormPlaceholder />
          </div>
        </div>
      </div>
    </div>
  );
};

export const FixedTermEarnDetails = function () {
  const { address, lang } = useParams<{ address: string; lang: string }>();

  const stakingVaultAddress =
    address && isAddress(address, { strict: false })
      ? targetYieldVaultAddresses.find((vault) =>
          isAddressEqual(vault, address),
        )
      : undefined;

  if (!stakingVaultAddress) {
    return <Navigate replace to={`/${lang}/not-found`} />;
  }

  return (
    <FixedTermEarnDetailsContent stakingVaultAddress={stakingVaultAddress} />
  );
};
