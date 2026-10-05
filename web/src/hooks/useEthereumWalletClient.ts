import { mainnet } from "networks/mainnet";
import { useWalletClient } from "wagmi";

export const useEthereumWalletClient = () =>
  useWalletClient({ chainId: mainnet.id });
