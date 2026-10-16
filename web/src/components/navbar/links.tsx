import { useTranslation } from "react-i18next";

import { I18nLink } from "../base/i18nLink";

import { AnalyticsIcon } from "./analyticsIcon";
import { BorrowIcon } from "./borrowIcon";
import { BridgeIcon } from "./bridgeIcon";
import { EarnIcon } from "./earnIcon";
import { LiquidityIcon } from "./liquidityIcon";
import { SwapIcon } from "./swapIcon";

export const navLinks = [
  { href: "/swap", Icon: SwapIcon, translationKey: "nav.swap" },
  { href: "/bridge", Icon: BridgeIcon, translationKey: "nav.bridge" },
  { href: "/earn", Icon: EarnIcon, translationKey: "nav.earn" },
  { href: "/borrow", Icon: BorrowIcon, translationKey: "nav.borrow" },
  {
    href: "/liquidity",
    Icon: LiquidityIcon,
    translationKey: "nav.liquidity",
  },
  { href: "/analytics", Icon: AnalyticsIcon, translationKey: "nav.analytics" },
] as const;

export const NavBarLinks = function () {
  const { t } = useTranslation();

  return (
    <ul className="flex items-center gap-x-1.5">
      {navLinks.map(({ href, Icon, translationKey }) => (
        <li key={href}>
          <I18nLink
            className={({ isActive }) =>
              `button--base button-x-small button-regular ${isActive ? "button-nav-primary pl-1.5!" : "button-nav-secondary gap-0!"}`
            }
            to={href}
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  className={`inline-flex shrink-0 overflow-hidden transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none ${isActive ? "w-4 scale-100" : "w-0 scale-0"}`}
                >
                  <Icon className="size-4 shrink-0" />
                </span>
                {t(translationKey)}
              </>
            )}
          </I18nLink>
        </li>
      ))}
    </ul>
  );
};
