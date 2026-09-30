import { Button, ButtonIcon } from "components/base/button";
import { Toast } from "components/base/toast";
import { TrashIcon } from "components/icons/trashIcon";
import { RequireWalletConnected } from "components/requireWalletConnected";
import { Tooltip } from "components/tooltip";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useClaimWithdraw } from "hooks/useClaimWithdraw";
import { useVaultPeggedToken } from "hooks/useVaultPeggedToken";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isGeoRestricted } from "utils/geoRestriction";
import { formatAmount } from "utils/token";

import type { ExitTicket } from "../../types";

import { DeleteTicketModal } from "./deleteTicketModal";
import { getTicketStatus } from "./getTicketStatus";

type Props = {
  disabled?: boolean;
  onDeleteSuccess?: VoidFunction;
  onWithdrawingChange?: (isWithdrawing: boolean) => void;
  ticket: ExitTicket;
};

type WithdrawButtonProps = {
  disabled: boolean;
  geoRestricted: boolean;
  isWithdrawing: boolean;
  onWithdraw: VoidFunction;
};

function WithdrawButton({
  disabled,
  geoRestricted,
  isWithdrawing,
  onWithdraw,
}: WithdrawButtonProps) {
  const { t } = useTranslation();

  const button = (
    <Button
      disabled={disabled || isWithdrawing || geoRestricted}
      onClick={onWithdraw}
      size="xSmall"
      variant="primary"
    >
      <span className="invisible">
        {t("pages.earn.exit-tickets.withdrawing")}
      </span>
      <span className="absolute">
        {isWithdrawing
          ? t("pages.earn.exit-tickets.withdrawing")
          : t("pages.earn.exit-tickets.withdraw")}
      </span>
    </Button>
  );

  return (
    <RequireWalletConnected size="xSmall">
      {geoRestricted ? (
        <Tooltip content={t("common.geo-restriction-title")}>{button}</Tooltip>
      ) : (
        button
      )}
    </RequireWalletConnected>
  );
}

export function ActionsCell({
  disabled = false,
  onDeleteSuccess,
  onWithdrawingChange,
  ticket,
}: Props) {
  const { t } = useTranslation();
  const geoRestricted = isGeoRestricted();

  const { data: peggedToken } = useVaultPeggedToken(ticket.stakingVaultAddress);
  const status = getTicketStatus(ticket);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [showWithdrawToast, setShowWithdrawToast] = useState(false);

  const formattedAmount = formatAmount({
    amount: BigInt(ticket.assets),
    decimals: peggedToken?.decimals ?? 18,
    isError: false,
  });

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "earn",
      text: t("pages.earn.activity.claim-withdraw-text", {
        amount: formattedAmount,
        symbol: peggedToken?.symbol,
      }),
      title: `${t("nav.earn")} · ${t("pages.earn.exit-tickets.withdraw")}`,
    });

  const { mutate: claimWithdraw } = useClaimWithdraw({
    onStatusChange(claimStatus) {
      const handlers: Partial<Record<typeof claimStatus, () => void>> = {
        claiming: onPending,
        completed() {
          onCompleted();
          setIsWithdrawing(false);
          setShowWithdrawToast(true);
          onWithdrawingChange?.(false);
        },
        failed() {
          onFailed();
          setIsWithdrawing(false);
          onWithdrawingChange?.(false);
        },
      };
      handlers[claimStatus]?.();
    },
    onTransactionHash,
    requestId: BigInt(ticket.requestId),
    stakingVaultAddress: ticket.stakingVaultAddress,
  });

  function handleWithdraw() {
    setIsWithdrawing(true);
    onWithdrawingChange?.(true);
    claimWithdraw();
  }

  return (
    <>
      {status !== "withdrawn" && (
        <div className="flex items-center gap-3">
          {status === "ready" && (
            <WithdrawButton
              disabled={disabled}
              geoRestricted={geoRestricted}
              isWithdrawing={isWithdrawing}
              onWithdraw={handleWithdraw}
            />
          )}
          <Tooltip
            content={
              geoRestricted
                ? t("common.geo-restriction-title")
                : t("pages.earn.exit-tickets.delete-tooltip")
            }
          >
            <ButtonIcon
              aria-label={t("pages.earn.exit-tickets.delete-tooltip")}
              disabled={disabled || isWithdrawing || geoRestricted}
              onClick={() => setIsModalOpen(true)}
              size="xSmall"
              variant="secondary"
            >
              <TrashIcon />
            </ButtonIcon>
          </Tooltip>
        </div>
      )}
      {isModalOpen && peggedToken && (
        <DeleteTicketModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={onDeleteSuccess}
          peggedToken={peggedToken}
          ticket={ticket}
        />
      )}
      {showWithdrawToast && (
        <Toast
          closable
          description={t("pages.earn.exit-tickets.withdraw-toast-description")}
          onClose={() => setShowWithdrawToast(false)}
          title={t("pages.earn.exit-tickets.withdraw-toast-title")}
        />
      )}
    </>
  );
}
