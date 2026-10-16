import { useConnectModal } from "@rainbow-me/rainbowkit";
import { gatewayAddresses } from "@vetro-protocol/gateway";
import { Button } from "components/base/button";
import { StatusMessage } from "components/base/statusMessage";
import { InboxCircleIcon } from "components/icons/inboxCircleIcon";
import { usePeggedToken } from "hooks/usePeggedToken";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

const WalletIcon = () => (
  <svg fill="none" height="28" width="28" xmlns="http://www.w3.org/2000/svg">
    <rect fill="#EAF4FF" height="24" rx="12" width="24" x="2" y="2" />
    <rect
      height="24"
      rx="12"
      stroke="#416BFF"
      strokeOpacity="0.2"
      width="24"
      x="2"
      y="2"
    />
    <path
      d="M9.5 11.5h9a1.5 1.5 0 0 1 1.5 1.5v4.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 8 17.5V13a1.5 1.5 0 0 1 1.5-1.5Z"
      stroke="#416BFF"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
    <path
      d="M9.5 11.5V10a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5v1.5"
      stroke="#416BFF"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
    <circle cx="17" cy="15" fill="#416BFF" r="1" />
  </svg>
);

export function PositionsDisconnectedState() {
  const { openConnectModal } = useConnectModal();
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center border-b border-gray-200 bg-white px-8 py-12">
      <StatusMessage
        action={
          <Button
            onClick={() => openConnectModal?.()}
            size="xSmall"
            type="button"
          >
            {t("pages.borrow.connect-button")}
          </Button>
        }
        description={t("pages.borrow.disconnected-description")}
        icon={<InboxCircleIcon />}
        title={t("pages.borrow.disconnected-title")}
      />
    </div>
  );
}

export function PositionsEmptyState() {
  const { t } = useTranslation();
  // The only markets so far for Borrow are VUSD ones, so this is safe
  const { data: peggedToken } = usePeggedToken(gatewayAddresses[0]);

  return (
    <div className="flex items-center justify-center border-b border-gray-200 bg-white px-8 py-12">
      <StatusMessage
        description={
          peggedToken !== undefined ? (
            t("pages.borrow.no-positions-description", {
              symbol: peggedToken.symbol,
            })
          ) : (
            <Skeleton count={2} width={200} />
          )
        }
        icon={<WalletIcon />}
        title={t("pages.borrow.no-positions-title")}
      />
    </div>
  );
}
