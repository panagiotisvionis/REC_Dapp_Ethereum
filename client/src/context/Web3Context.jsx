import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ethers }                                                       from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, TARGET_CHAIN_ID, NETWORK_NAME } from '../lib/config';

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [account,    setAccount]    = useState(null);
  const [contract,   setContract]   = useState(null);
  const [provider,   setProvider]   = useState(null);
  const [isIssuer,   setIsIssuer]   = useState(false);
  const [chainId,    setChainId]    = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error,      setError]      = useState(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install it to use this app.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
      if (currentChain !== TARGET_CHAIN_ID) {
        try {
          // Try switching first (works for known networks)
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: TARGET_CHAIN_ID }],
          });
        } catch (switchErr) {
          // Chain not in MetaMask yet — try adding it (works for Hardhat/custom RPCs)
          if (switchErr.code === 4902) {
            const rpcUrl = import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId:         TARGET_CHAIN_ID,
                  chainName:       NETWORK_NAME,
                  nativeCurrency:  { name: 'ETH', symbol: 'ETH', decimals: 18 },
                  rpcUrls:         [rpcUrl],
                }],
              });
            } catch {
              setError(`Please switch MetaMask to ${NETWORK_NAME} (Chain ID ${parseInt(TARGET_CHAIN_ID, 16)}).`);
              setConnecting(false);
              return;
            }
          } else {
            setError(`Please switch MetaMask to ${NETWORK_NAME} (Chain ID ${parseInt(TARGET_CHAIN_ID, 16)}).`);
            setConnecting(false);
            return;
          }
        }
      }

      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const signer       = await web3Provider.getSigner();
      const addr         = await signer.getAddress();
      const rec          = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const issuerRole   = await rec.ISSUER_ROLE();
      const hasRole      = await rec.hasRole(issuerRole, addr);

      setProvider(web3Provider);
      setContract(rec);
      setAccount(addr);
      setIsIssuer(hasRole);
      setChainId(currentChain);
    } catch (err) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }, []);

  // Handle account / chain changes from MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const onAccountsChanged = () => connect();
    const onChainChanged    = () => window.location.reload();
    window.ethereum.on('accountsChanged', onAccountsChanged);
    window.ethereum.on('chainChanged',    onChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', onAccountsChanged);
      window.ethereum.removeListener('chainChanged',    onChainChanged);
    };
  }, [connect]);

  return (
    <Web3Context.Provider value={{ account, contract, provider, isIssuer, chainId, connecting, error, connect }}>
      {children}
    </Web3Context.Provider>
  );
}

export const useWeb3 = () => useContext(Web3Context);
