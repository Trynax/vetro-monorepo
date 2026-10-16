import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { GlobeIllustration } from "../globeIllustration";

import "react-loading-skeleton/dist/skeleton.css";

export function MainContent({
  bottom,
  children,
}: {
  bottom?: ReactNode;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <div className="relative flex h-full flex-col overflow-y-auto *:mx-auto *:w-[calc(100%-2rem)] md:*:w-[calc(100%-6rem)] xl:*:w-5xl">
      <main
        className="motion-safe:animate-page-in grow border-x border-gray-200"
        key={pathname}
      >
        {children}
      </main>
      {bottom}
    </div>
  );
}

export const AppLayout = ({ children }: { children: ReactNode }) => (
  <MainContent
    bottom={<GlobeIllustration className="border-x border-gray-200 pt-18" />}
  >
    {children}
  </MainContent>
);
