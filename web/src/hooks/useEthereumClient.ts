import { mainnet } from "networks/mainnet";
import { usePublicClient } from "wagmi";

export const useEthereumClient = () => usePublicClient({ chainId: mainnet.id });
