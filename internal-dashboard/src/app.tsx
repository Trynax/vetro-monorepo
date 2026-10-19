import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { Header } from "./components/header";
import { Layout } from "./components/layout";
import { DexPage } from "./pages/dex";
import { DexPoolPage } from "./pages/dexPool";
import { EarnAgentPage } from "./pages/earnAgent";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

export const App = () => (
  <div className="lg:px-4 xl:px-8 2xl:px-28">
    <Header />
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route element={<DexPoolPage />} path="/dex/:poolId" />
            <Route element={<Navigate replace to="/dex" />} path="/" />
            <Route element={<DexPage />} path="/dex" />
            <Route element={<EarnAgentPage />} path="/hemi-earn" />
            <Route element={<Navigate replace to="/dex" />} path="*" />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  </div>
);
