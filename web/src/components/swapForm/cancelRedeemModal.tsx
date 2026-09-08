import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "components/base/button";
import { Modal } from "components/base/modal";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useCancelRedeemRequest } from "hooks/useCancelRedeemRequest";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

type Props = {
  onClose: VoidFunction;
  onSuccess: VoidFunction;
  peggedToken: TokenWithGateway;
  redeemableAmount: bigint;
};

export function CancelRedeemModal({
  onClose,
  onSuccess,
  peggedToken,
  redeemableAmount,
}: Props) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [isCancelling, setIsCancelling] = useState(false);
  const { t } = useTranslation();

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "swap",
      text: t("pages.swap.activity.cancel-redeem-text", {
        amount: formatUnits(redeemableAmount, peggedToken.decimals),
        symbol: peggedToken.symbol,
      }),
      title: `${t("nav.swap")} · ${t("pages.swap.redeem-queue.cancel-redeem")}`,
    });

  const { mutate } = useCancelRedeemRequest({
    onEmitter(emitter) {
      emitter.on("pre-cancel-redeem-request", () => setIsCancelling(true));
      emitter.on("user-signed-cancel-redeem-request", function (hash) {
        onTransactionHash(hash);
        onPending();
      });
      emitter.on("cancel-redeem-request-transaction-succeeded", function () {
        onCompleted();
        onClose();
        onSuccess();
      });
      emitter.on("cancel-redeem-request-failed", function () {
        onFailed();
        setIsCancelling(false);
      });
      emitter.on("cancel-redeem-request-failed-validation", function () {
        onFailed();
        setIsCancelling(false);
      });
      emitter.on("cancel-redeem-request-transaction-reverted", function () {
        onFailed();
        setIsCancelling(false);
      });
      emitter.on("user-signing-cancel-redeem-request-error", function () {
        onFailed();
        setIsCancelling(false);
      });
      emitter.on("unexpected-error", function () {
        onFailed();
        setIsCancelling(false);
      });
    },
    peggedToken,
    redeemableAmount,
  });

  return (
    <Modal
      ariaLabel={t("pages.swap.redeem-queue.cancel-redeem")}
      onClose={onClose}
    >
      {({ close }) => (
        <div className="flex w-full flex-col gap-6 p-6 md:w-112">
          <div className="flex flex-col gap-y-1">
            <h4 className="text-gray-900">
              {t("pages.swap.redeem-queue.cancel-redeem")}
            </h4>
            <p className="text-b-regular text-gray-500">
              {t("pages.swap.redeem-queue.cancel-redeem-description", {
                symbol: peggedToken.symbol,
              })}
            </p>
          </div>
          <div className="flex gap-3 *:flex-1">
            <Button
              disabled={isCancelling}
              onClick={close}
              size="xSmall"
              variant="secondary"
            >
              {t("pages.swap.redeem-queue.keep-redeem")}
            </Button>
            {isConnected ? (
              <Button
                disabled={isCancelling}
                onClick={() => mutate()}
                size="xSmall"
                variant="danger"
              >
                {isCancelling
                  ? t("pages.swap.redeem-queue.cancel-redeem-btn-cancelling")
                  : t("pages.swap.redeem-queue.cancel-redeem-btn-cancel")}
              </Button>
            ) : (
              <Button
                onClick={openConnectModal}
                size="xSmall"
                variant="primary"
              >
                {t("common.connect-wallet")}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
