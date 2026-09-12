import * as Sentry from "@sentry/react";
import { AnalyticsTracker } from "components/analyticsTracker";
import { AppLayout, MainContent } from "components/base/appLayout";
import { AppViewport } from "components/base/appViewport";
import { ErrorBoundary } from "components/base/errorBoundary";
import { GeoRestrictionRibbon } from "components/geoRestrictionRibbon";
import { Header } from "components/header";
import { I18nInitializer, useUnsupportedLanguageRedirect } from "i18n/config";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { Analytics } from "pages/analytics";
import { Borrow } from "pages/borrow";
import { BorrowMarketDetails } from "pages/borrowMarketDetails";
import { Bridge } from "pages/bridge";
import { Contact } from "pages/contact";
import { Earn } from "pages/earn";
import { ErrorPage } from "pages/errorPage";
import { Faq } from "pages/faq";
import { NotFound } from "pages/notFound";
import { Swap } from "pages/swap";
import { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { featureFlags } from "utils/featureFlags";
import { isGeoRestricted } from "utils/geoRestriction";

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

const analyticsEnabled =
  !!import.meta.env.VITE_ANALYTICS_URL &&
  !!import.meta.env.VITE_ANALYTICS_WEBSITE_ID;

const AppNotifications = lazy(() =>
  import("components/appNotifications").then((m) => ({
    default: m.AppNotifications,
  })),
);

const FixedTermEarnDetails = lazy(() =>
  import("pages/fixedTermEarnDetails").then((m) => ({
    default: m.FixedTermEarnDetails,
  })),
);

const VariableYieldEarnDetails = lazy(() =>
  import("pages/variableYieldEarnDetails").then((m) => ({
    default: m.VariableYieldEarnDetails,
  })),
);

/**
 * Two nested ErrorBoundaries handle errors at different stages:
 * - Outer: catches errors before translations load (Header, I18nInitializer) — ErrorPage renders without i18n
 * - Inner: catches page-level errors after translations are available — ErrorPage can use translated strings
 *
 * The inner ErrorBoundary is keyed by pathname so it resets on navigation,
 * allowing recovery from page-level errors without a full reload.
 */
function LanguageRoutes() {
  const { pathname } = useLocation();
  const unsupportedLanguageRedirect = useUnsupportedLanguageRedirect();

  if (unsupportedLanguageRedirect) {
    return <Navigate replace to={unsupportedLanguageRedirect} />;
  }

  return (
    <ErrorBoundary
      fallback={
        <MainContent>
          <ErrorPage />
        </MainContent>
      }
    >
      {isGeoRestricted() && <GeoRestrictionRibbon />}
      <Header />
      <I18nInitializer />
      <ErrorBoundary
        fallback={
          <MainContent>
            <ErrorPage />
          </MainContent>
        }
        key={pathname}
      >
        <Routes>
          <Route element={<Navigate replace to="swap" />} index />
          <Route
            element={
              <AppLayout>
                <Outlet />
              </AppLayout>
            }
          >
            <Route element={<Swap />} path="swap" />
            <Route element={<Earn />} path="earn" />
            {featureFlags.fixedTermYield && (
              <Route
                element={
                  <Suspense>
                    <FixedTermEarnDetails />
                  </Suspense>
                }
                path="earn/fixed-term/:address"
              />
            )}
            <Route
              element={
                <Suspense>
                  <VariableYieldEarnDetails />
                </Suspense>
              }
              path="earn/variable-yield/:address"
            />
            <Route element={<Borrow />} path="borrow" />
            <Route element={<BorrowMarketDetails />} path="borrow/:marketId" />
            <Route element={<Bridge />} path="bridge" />
            <Route element={<Analytics />} path="analytics" />
            <Route element={<Faq />} path="faq" />
            <Route element={<Contact />} path="contact" />
          </Route>
          <Route
            element={
              <MainContent>
                <NotFound />
              </MainContent>
            }
            path="*"
          />
        </Routes>
      </ErrorBoundary>
      <Suspense>
        <AppNotifications />
      </Suspense>
    </ErrorBoundary>
  );
}

export const App = () => (
  <BrowserRouter>
    <NuqsAdapter>
      {analyticsEnabled && <AnalyticsTracker />}
      <AppViewport>
        <SentryRoutes>
          {/* Redirect root to English */}
          <Route element={<Navigate replace to="/en" />} path="/" />

          {/* Language-prefixed routes */}
          <Route element={<LanguageRoutes />} path="/:lang/*" />

          {/* Catch-all: redirect unknown paths to English */}
          <Route element={<Navigate replace to="/en" />} path="*" />
        </SentryRoutes>
      </AppViewport>
    </NuqsAdapter>
  </BrowserRouter>
);
