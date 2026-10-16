import type { DexPool } from "@vetro-protocol/core";

const logos = {
  brownfi: "/dexes/brownfi.svg",
  curve: "/dexes/curve.png",
  sushi: "/dexes/sushi.png",
  uniswap: "/dexes/uniswap.svg",
};

type Props = {
  dex: DexPool["dex"];
};

export const VenueLogo = ({ dex }: Props) => (
  <img alt="" className="size-4 object-contain" src={logos[dex]} />
);
