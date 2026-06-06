import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ethers }                                                       from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID }            from '../lib/config';

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
      if (currentChain !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch {
          setError('Please switch MetaMask to the Sepolia testnet.');
          setConnecting(false);
          return;
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
