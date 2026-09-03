import { Button } from "components/base/button";
import { ChevronIcon } from "components/base/chevronIcon";
import { Dropdown } from "components/base/dropdown";
import type { BorrowAction } from "hooks/borrow/useBorrowAction";
import { useTranslation } from "react-i18next";
import { type Hash } from "viem";

const PlusCircleIcon = () => (
  <svg
    className="text-gray-400 group-hover/item:text-gray-900"
    fill="none"
    height="16"
    viewBox="0 0 14 14"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M7 14C10.866 14 14 10.866 14 7C14 3.13401 10.866 0 7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14ZM7.75 3.75V6.25L10.25 6.25C10.6642 6.25 11 6.58579 11 7C11 7.41421 10.6642 7.75 10.25 7.75H7.75V10.25C7.75 10.6642 7.41421 11 7 11C6.58579 11 6.25 10.6642 6.25 10.25V7.75H3.75C3.33579 7.75 3 7.41421 3 7C3 6.58579 3.33579 6.25 3.75 6.25L6.25 6.25V3.75C6.25 3.33579 6.58579 3 7 3C7.41421 3 7.75 3.33579 7.75 3.75Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const RepayIcon = () => (
  <svg
    className="text-gray-400 group-hover/item:text-gray-900"
    fill="none"
    height="16"
    viewBox="0 0 16 16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M8 15C9.85652 15 11.637 14.2625 12.9497 12.9497C14.2625 11.637 15 9.85652 15 8C15 6.14348 14.2625 4.36301 12.9497 3.05025C11.637 1.7375 9.85652 1 8 1C6.14348 1 4.36301 1.7375 3.05025 3.05025C1.7375 4.36301 1 6.14348 1 8C1 9.85652 1.7375 11.637 3.05025 12.9497C4.36301 14.2625 6.14348 15 8 15ZM11.844 6.209C11.9657 6.05146 12.0199 5.85202 11.9946 5.65454C11.9693 5.45706 11.8665 5.27773 11.709 5.156C11.5515 5.03427 11.352 4.9801 11.1545 5.00542C10.9571 5.03073 10.7777 5.13346 10.656 5.291L6.956 10.081L5.307 8.248C5.24174 8.17247 5.16207 8.11073 5.07264 8.06639C4.98322 8.02205 4.88584 7.996 4.78622 7.98978C4.6866 7.98356 4.58674 7.99729 4.4925 8.03016C4.39825 8.06303 4.31151 8.11438 4.23737 8.1812C4.16322 8.24803 4.10316 8.32898 4.06071 8.41931C4.01825 8.50965 3.99425 8.60755 3.99012 8.70728C3.98599 8.807 4.00181 8.90656 4.03664 9.00009C4.07148 9.09363 4.12464 9.17927 4.193 9.252L6.443 11.752C6.51649 11.8335 6.60697 11.8979 6.70806 11.9406C6.80915 11.9833 6.91838 12.0034 7.02805 11.9993C7.13772 11.9952 7.24515 11.967 7.34277 11.9169C7.44038 11.8667 7.5258 11.7958 7.593 11.709L11.844 6.209Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

const WithdrawIcon = () => (
  <svg
    className="text-gray-400 group-hover/item:text-gray-900"
    fill="none"
    height="16"
    viewBox="0 0 16 16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8.75 5.99934H7.25V3.55934L6.03 4.77934C5.88783 4.91182 5.69978 4.98394 5.50548 4.98052C5.31118 4.97709 5.12579 4.89838 4.98838 4.76096C4.85097 4.62355 4.77225 4.43816 4.76883 4.24386C4.7654 4.04956 4.83752 3.86152 4.97 3.71934L7.47 1.21934C7.61063 1.07889 7.80125 1 8 1C8.19875 1 8.38937 1.07889 8.53 1.21934L11.03 3.71934C11.1037 3.788 11.1628 3.8708 11.2038 3.9628C11.2448 4.0548 11.2668 4.15411 11.2686 4.25482C11.2704 4.35552 11.2518 4.45555 11.2141 4.54894C11.1764 4.64233 11.1203 4.72716 11.049 4.79838C10.9778 4.8696 10.893 4.92574 10.7996 4.96346C10.7062 5.00118 10.6062 5.01971 10.5055 5.01793C10.4048 5.01615 10.3055 4.99411 10.2135 4.95312C10.1215 4.91213 10.0387 4.85303 9.97 4.77934L8.75 3.55934V5.99934H11C11.5304 5.99934 12.0391 6.21005 12.4142 6.58513C12.7893 6.9602 13 7.46891 13 7.99934V12.9993C13 13.5298 12.7893 14.0385 12.4142 14.4136C12.0391 14.7886 11.5304 14.9993 11 14.9993H5C4.46957 14.9993 3.96086 14.7886 3.58579 14.4136C3.21071 14.0385 3 13.5298 3 12.9993V7.99934C3 7.46891 3.21071 6.9602 3.58579 6.58513C3.96086 6.21005 4.46957 5.99934 5 5.99934H7.25V11.2493C7.25 11.4483 7.32902 11.639 7.46967 11.7797C7.61032 11.9203 7.80109 11.9993 8 11.9993C8.19891 11.9993 8.38968 11.9203 8.53033 11.7797C8.67098 11.639 8.75 11.4483 8.75 11.2493V5.99934Z"
      fill="currentColor"
    />
  </svg>
);

type Props = {
  marketId: Hash;
  onAction: (action: BorrowAction) => void;
};

export function ManageButton({ marketId, onAction }: Props) {
  const { t } = useTranslation();
  const items = [
    {
      icon: <PlusCircleIcon />,
      key: "supply-collateral" as BorrowAction,
      label: t("pages.borrow.supply-more-collateral"),
    },
    {
      icon: <WithdrawIcon />,
      key: "withdraw-collateral" as BorrowAction,
      label: t("pages.borrow.withdraw-collateral"),
    },
    {
      icon: <PlusCircleIcon />,
      key: "borrow-more" as BorrowAction,
      label: t("pages.borrow.borrow-more"),
    },
    {
      icon: <PlusCircleIcon />,
      key: "supply-collateral-and-borrow" as BorrowAction,
      label: t("pages.borrow.supply-collateral-and-borrow"),
    },
    {
      icon: <RepayIcon />,
      key: "repay-loan" as BorrowAction,
      label: t("pages.borrow.repay-loan"),
    },
  ];

  return (
    <Dropdown
      getItemKey={(item) => item.key}
      items={items}
      onChange={(item) => onAction(item.key)}
      renderItem={(item) => (
        <div className="flex items-center gap-2">
          {item.icon}
          {item.label}
        </div>
      )}
      renderTrigger={(isOpen, triggerProps) => (
        <Button {...triggerProps} size="xSmall" variant="primary">
          {t("pages.borrow.manage")}
          <ChevronIcon direction={isOpen ? "up" : "down"} />
        </Button>
      )}
      triggerId={`manage-${marketId}`}
    />
  );
}
