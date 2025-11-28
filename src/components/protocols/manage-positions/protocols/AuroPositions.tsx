import React, { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ManagePositionsButton } from "../../ManagePositionsButton";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { useClaimRewards } from '@/lib/hooks/useClaimRewards';
import { useDeposit } from '@/lib/hooks/useDeposit';
import { useWithdraw } from '@/lib/hooks/useWithdraw';
import { PanoraPricesService } from "@/lib/services/panora/prices";
import { TokenPrice } from "@/lib/types/panora";
import { createDualAddressPriceMap } from "@/lib/utils/addressNormalization";
import { formatNumber, formatCurrency } from "@/lib/utils/numberFormat";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, Loader2 } from "lucide-react";
import { useAmountInput } from "@/hooks/useAmountInput";
import { calcYield } from "@/lib/utils/calcYield";
import { useWalletData } from '@/contexts/WalletContext';
import { Token } from '@/lib/types/panora';
import { showTransactionSuccessToast } from '@/components/ui/transaction-toast';
import tokenList from "@/lib/data/tokenList.json";
import { WithdrawModal } from '@/components/ui/withdraw-modal';

interface AuroPositionsProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
}

export function AuroPositions({ address, onPositionsValueChange }: AuroPositionsProps) {
  const { account, signAndSubmitTransaction } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [poolsData, setPoolsData] = useState<any[]>([]);
  const [rewardsData, setRewardsData] = useState<{ [positionAddress: string]: { collateral: any[], borrow: any[] } }>({});
  const [tokenPrices, setTokenPrices] = useState<Record<string, string>>({});
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedDepositPosition, setSelectedDepositPosition] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isYieldExpanded, setIsYieldExpanded] = useState(false);
  
  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedWithdrawPosition, setSelectedWithdrawPosition] = useState<any>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // Claim rewards confirmation modal state
  const [showClaimRewardsModal, setShowClaimRewardsModal] = useState(false);
  const [pendingWithdrawAction, setPendingWithdrawAction] = useState<(() => Promise<void>) | null>(null);
  const { claimRewards, isLoading: isClaiming } = useClaimRewards();
  const { deposit } = useDeposit();
  const { withdraw } = useWithdraw();
  const { tokens, refreshPortfolio } = useWalletData();
  const pricesService = PanoraPricesService.getInstance();

  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Auro Finance");

  // Получаем информацию о токене из списка токенов
  const getTokenInfo = (address: string): Token | undefined => {
    // Normalize addresses by removing leading zeros after 0x
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    
    const normalizedAddress = normalizeAddress(address);
    
    return (tokenList.data.data as Token[]).find(token => {
      const normalizedTokenAddress = normalizeAddress(token.tokenAddress || '');
      const normalizedFaAddress = normalizeAddress(token.faAddress || '');
      
      return normalizedTokenAddress === normalizedAddress || 
             normalizedFaAddress === normalizedAddress;
    });
  };

  // Находим текущий токен в кошельке по адресу
  const getCurrentToken = (tokenAddress: string) => {
    return tokens?.find(t => {
      const tokenInfo = getTokenInfo(t.address);
      if (!tokenInfo) return false;
      
      // Normalize addresses for comparison
      const normalizeAddress = (addr: string) => {
        if (!addr || !addr.startsWith('0x')) return addr;
        return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
      };
      
      const normalizedTokenAddress = normalizeAddress(tokenAddress);
      const normalizedTokenInfoAddress = normalizeAddress(tokenInfo.tokenAddress || '');
      const normalizedFaAddress = normalizeAddress(tokenInfo.faAddress || '');
      
      return normalizedTokenInfoAddress === normalizedTokenAddress || 
             normalizedFaAddress === normalizedTokenAddress;
    });
  };

  // Получаем цену токена из кэша
  const getTokenPrice = useCallback((tokenAddress: string): string => {
    let cleanAddress = tokenAddress;
    if (cleanAddress.startsWith('@')) {
      cleanAddress = cleanAddress.slice(1);
    }
    if (!cleanAddress.startsWith('0x')) {
      cleanAddress = `0x${cleanAddress}`;
    }
    const price = tokenPrices[cleanAddress] || '0';
    return price;
  }, [tokenPrices]);

  // Функция для получения информации о токене наград
  const getRewardTokenInfoHelper = useCallback((tokenAddress: string) => {
    const cleanAddress = tokenAddress.startsWith('@') ? tokenAddress.slice(1) : tokenAddress;
    const fullAddress = cleanAddress.startsWith('0x') ? cleanAddress : `0x${cleanAddress}`;
    
    const token = (tokenList as any).data.data.find((token: any) => 
      token.tokenAddress === fullAddress || 
      token.faAddress === fullAddress
    );
    
    
    if (!token) {
      return undefined;
    }
    
    const result = {
      address: token.tokenAddress,
      faAddress: token.faAddress,
      symbol: token.symbol,
      icon_uri: token.logoUrl,
      decimals: token.decimals,
      price: getTokenPrice(fullAddress) // Используем динамическую цену
    };
    
    return result;
  }, [getTokenPrice]);

  // useEffect для загрузки позиций
  useEffect(() => {
    if (!walletAddress) {
      setPositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/protocols/auro/userPositions?address=${walletAddress}`)
      .then(res => res.json())
      .then(data => {
        setPositions(Array.isArray(data.positionInfo) ? data.positionInfo : []);
      })
      .catch(err => {
        setError("Failed to load Auro Finance positions");
        setPositions([]);
      })
      .finally(() => setLoading(false));
  }, [walletAddress]);

  // Обработчик события refreshPositions
  useEffect(() => {
    const handleRefreshPositions = (event: any) => {
      const { protocol, data } = event.detail;
      console.log('AuroPositions received refreshPositions event:', { protocol, eventDetail: event.detail });
      
      if (protocol === 'auro' || !protocol) {
        console.log('Refreshing Auro positions due to refreshPositions event');
        
        // Если есть данные в событии, используем их (как в других протоколах)
        if (data && Array.isArray(data)) {
          console.log('Using data from refreshPositions event:', data);
          setPositions(data);
          
          // Обновляем цены для новых позиций
          if (data.length > 0) {
            const addresses = new Set<string>();
            data.forEach((position: any) => {
              if (position.collateralTokenAddress) {
                addresses.add(position.collateralTokenAddress);
              }
              // Добавляем USDA для долга
              addresses.add("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec");
            });
            
            // Обновляем цены
            pricesService.getPrices(1, Array.from(addresses))
              .then(response => {
                const priceMap = response.data ? createDualAddressPriceMap(response.data) : {};
                setTokenPrices(priceMap);
                console.log('Prices updated after refresh from event data:', priceMap);
              })
              .catch(err => {
                console.error('Failed to update prices after refresh from event data:', err);
              });
          }
        } else {
          // Если данных нет, загружаем позиции заново из API
          console.log('No event data, fetching from API');
          if (walletAddress) {
            setLoading(true);
            setError(null);
            
            fetch(`/api/protocols/auro/userPositions?address=${walletAddress}`)
              .then(res => res.json())
              .then(data => {
                const newPositions = Array.isArray(data.positionInfo) ? data.positionInfo : [];
                setPositions(newPositions);
                console.log('Auro positions refreshed from API:', newPositions);
                
                // Также обновляем цены после обновления позиций
                if (newPositions.length > 0) {
                  const addresses = new Set<string>();
                  newPositions.forEach((position: any) => {
                    if (position.collateralTokenAddress) {
                      addresses.add(position.collateralTokenAddress);
                    }
                    // Добавляем USDA для долга
                    addresses.add("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec");
                  });
                  
                  // Обновляем цены
                  pricesService.getPrices(1, Array.from(addresses))
                    .then(response => {
                      const priceMap = response.data ? createDualAddressPriceMap(response.data) : {};
                      setTokenPrices(priceMap);
                      console.log('Prices updated after refresh from API:', priceMap);
                    })
                    .catch(err => {
                      console.error('Failed to update prices after refresh from API:', err);
                    });
                }
              })
              .catch(err => {
                console.error('Failed to refresh Auro positions from API:', err);
                setError("Failed to refresh Auro Finance positions");
              })
              .finally(() => setLoading(false));
          }
        }
      }
    };

    window.addEventListener('refreshPositions', handleRefreshPositions);
    return () => window.removeEventListener('refreshPositions', handleRefreshPositions);
  }, [walletAddress, pricesService]);

  // useEffect для загрузки данных пулов
  useEffect(() => {
    fetch('/api/protocols/auro/pools')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data)) {
          setPoolsData(data.data);
        }
      })
      .catch(error => {
      });
  }, []);

  // useEffect для загрузки наград
  useEffect(() => {
    if (positions.length === 0 || poolsData.length === 0) return;

    const fetchRewards = async () => {
      try {
        
        // Формируем positionsInfo в нужном формате
        const positionsInfo = positions.map(pos => ({
          address: pos.address,
          poolAddress: pos.poolAddress,
          debtAmount: pos.debtAmount
        }));

        // Формируем poolsData в нужном формате
        const formattedPoolsData = poolsData.map(pool => ({
          type: pool.type,
          poolAddress: pool.poolAddress,
          rewardPoolAddress: pool.rewardPoolAddress,
          borrowRewardsPoolAddress: pool.borrowRewardsPoolAddress
        }));


        if (positionsInfo.length === 0 || formattedPoolsData.length === 0) {
          return;
        }

        const requestBody = {
          positionsInfo,
          poolsData: formattedPoolsData
        };


        const response = await fetch('/api/protocols/auro/rewards', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });


        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data) {
            setRewardsData(data.data);
          } else {
            setRewardsData({});
          }
        } else {
          const errorText = await response.text();
          setRewardsData({});
        }
      } catch (error) {
        setRewardsData({});
      }
    };

    fetchRewards();
  }, [positions, poolsData]);

  // Получаем цены токенов через Panora API
  useEffect(() => {
    const fetchPrices = async () => {
      // Получаем адреса токенов напрямую
      const addresses = new Set<string>();

      positions.forEach(position => {
        // Добавляем collateral токен
        if (position.collateralTokenAddress) {
          let cleanAddress = position.collateralTokenAddress;
          if (cleanAddress.startsWith('@')) {
            cleanAddress = cleanAddress.slice(1);
          }
          if (!cleanAddress.startsWith('0x')) {
            cleanAddress = `0x${cleanAddress}`;
          }
          addresses.add(cleanAddress);
        }
        
        // Добавляем debt токен (USDA)
        const debtTokenAddress = "0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec";
        addresses.add(debtTokenAddress);
      });

      // Добавляем адреса токенов наград
      Object.values(rewardsData).forEach((positionRewards: any) => {
        if (positionRewards.collateral) {
          positionRewards.collateral.forEach((reward: any) => {
            if (reward?.key) {
              let cleanAddress = reward.key;
              if (cleanAddress.startsWith('@')) {
                cleanAddress = cleanAddress.slice(1);
              }
              if (!cleanAddress.startsWith('0x')) {
                cleanAddress = `0x${cleanAddress}`;
              }
              addresses.add(cleanAddress);
            }
          });
        }
        if (positionRewards.borrow) {
          positionRewards.borrow.forEach((reward: any) => {
            if (reward?.key) {
              let cleanAddress = reward.key;
              if (cleanAddress.startsWith('@')) {
                cleanAddress = cleanAddress.slice(1);
              }
              if (!cleanAddress.startsWith('0x')) {
                cleanAddress = `0x${cleanAddress}`;
              }
              addresses.add(cleanAddress);
            }
          });
        }
      });

      const addressesArray = Array.from(addresses);
      
      if (addressesArray.length === 0) return;

      try {
        const response = await pricesService.getPrices(1, addressesArray);
        if (response.data) {
          // Use utility function to create price map with both address versions
          const prices = createDualAddressPriceMap(response.data);
          setTokenPrices(prices);
        }
      } catch (error) {
        console.error('Failed to fetch token prices:', error);
      }
    };

    fetchPrices();
  }, [positions, rewardsData, pricesService]);

  // Функция для расчета стоимости наград позиции
  const calculateRewardsValue = useCallback((positionAddress: string) => {
    let rewardsValue = 0;
    if (rewardsData[positionAddress]) {
      // Collateral rewards
      rewardsData[positionAddress].collateral.forEach((reward: any) => {
        if (reward && reward.key && reward.value) {
          const tokenInfo = getRewardTokenInfoHelper(reward.key);
          if (tokenInfo && tokenInfo.price) {
            const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
            rewardsValue += amount * parseFloat(tokenInfo.price);
          }
        }
      });
      
      // Borrow rewards
      rewardsData[positionAddress].borrow.forEach((reward: any) => {
        if (reward && reward.key && reward.value) {
          const tokenInfo = getRewardTokenInfoHelper(reward.key);
          if (tokenInfo && tokenInfo.price) {
            const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
            rewardsValue += amount * parseFloat(tokenInfo.price);
          }
        }
      });
    }
    return rewardsValue;
  }, [rewardsData, getRewardTokenInfoHelper]);

  // Сортировка по value (по убыванию) - включая награды
  const sortedPositions = [...positions].sort((a, b) => {
    const collateralPriceA = a.collateralTokenAddress ? parseFloat(getTokenPrice(a.collateralTokenAddress)) : 0;
    const collateralPriceB = b.collateralTokenAddress ? parseFloat(getTokenPrice(b.collateralTokenAddress)) : 0;
    const valueA = parseFloat(a.collateralAmount) * collateralPriceA;
    const valueB = parseFloat(b.collateralAmount) * collateralPriceB;
    
    // Добавляем стоимость наград для сортировки
    const rewardsValueA = calculateRewardsValue(a.address);
    const rewardsValueB = calculateRewardsValue(b.address);
    
    return (valueB + rewardsValueB) - (valueA + rewardsValueA);
  });

  // Функция для расчета общей стоимости всех наград
  const calculateTotalRewardsValue = useCallback(() => {
    return sortedPositions.reduce((total, pos) => {
      return total + calculateRewardsValue(pos.address);
    }, 0);
  }, [sortedPositions, calculateRewardsValue]);

  // Мемоизируем общую стоимость наград для оптимизации
  const totalRewardsValue = calculateTotalRewardsValue();
  
  // Пересчитываем сортировку при изменении наград
  useEffect(() => {
    // Сортировка уже обновляется автоматически благодаря зависимости от rewardsData
  }, [rewardsData]);

  // Сумма активов
  useEffect(() => {
    const total = sortedPositions.reduce((sum, pos) => {
      const collateralPrice = pos.collateralTokenAddress ? parseFloat(getTokenPrice(pos.collateralTokenAddress)) : 0;
      const collateralValue = parseFloat(pos.collateralAmount) * collateralPrice;
      
      const debtPrice = parseFloat(getTokenPrice("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec")); // USDA
      const debtValue = parseFloat(pos.debtAmount) * debtPrice;
      
      // Добавляем стоимость наград
      const rewardsValue = calculateRewardsValue(pos.address);
      
      return sum + collateralValue - debtValue + rewardsValue;
    }, 0);
    setTotalValue(total);
    
    if (onPositionsValueChange) {
      onPositionsValueChange(total);
    }
  }, [sortedPositions, rewardsData, onPositionsValueChange, calculateRewardsValue, getTokenPrice]);

  // Получение реальных APR данных из API
  const getCollateralAPRData = (poolAddress: string) => {
    const pool = poolsData.find(p => p.poolAddress === poolAddress);
    if (!pool) return { totalApr: 0, supplyApr: 0, supplyIncentiveApr: 0, stakingApr: 0 };
    
    return {
      totalApr: pool.totalSupplyApr || 0,
      supplyApr: pool.supplyApr || 0,
      supplyIncentiveApr: pool.supplyIncentiveApr || 0,
      stakingApr: pool.stakingApr || 0,
      rewardPoolAddress: pool.rewardPoolAddress
    };
  };

  const getDebtAPRData = () => {
    const borrowPool = poolsData.find(p => p.type === 'BORROW');
    if (!borrowPool) return { totalApr: 0, borrowApr: 0, borrowIncentiveApr: 0 };
    
    const borrowApr = borrowPool.borrowApr || 0;
    const incentiveApr = borrowPool.borrowIncentiveApr || 0;
    const totalApr = incentiveApr - borrowApr; // Разность: Incentive - Borrow
    
    return {
      totalApr: totalApr,
      borrowApr: borrowApr,
      borrowIncentiveApr: incentiveApr,
      rewardPoolAddress: borrowPool.borrowRewardsPoolAddress
    };
  };



  // Получение наград для позиции
  const getPositionRewards = (positionAddress: string) => {
    const collateralRewards = rewardsData[positionAddress]?.collateral || [];
    const borrowRewards = rewardsData[positionAddress]?.borrow || [];
    return [...collateralRewards, ...borrowRewards];
  };

  // Собираем все positionIds и tokenTypes для claim
  const getClaimablePositionsAndTokens = () => {
    const positionIds: string[] = [];
    const tokenTypesSet = new Set<string>();
    Object.entries(rewardsData).forEach(([positionId, rewards]) => {
      const hasRewards =
        (rewards.collateral && rewards.collateral.length > 0) ||
        (rewards.borrow && rewards.borrow.length > 0);
      if (hasRewards) {
        positionIds.push(positionId);
        [...(rewards.collateral || []), ...(rewards.borrow || [])].forEach((reward: any) => {
          if (reward && reward.key) tokenTypesSet.add(reward.key);
        });
      }
    });
    return { positionIds, tokenTypes: Array.from(tokenTypesSet) };
  };

  const handleClaimAllRewards = async () => {
    const { positionIds, tokenTypes } = getClaimablePositionsAndTokens();
    if (positionIds.length === 0 || tokenTypes.length === 0) return;
    try {
      await claimRewards('auro', positionIds, tokenTypes);
    } catch (e) {
      // Ошибка уже обработана в hook
    }
  };

  // Подсчет общей суммы claimable rewards (USD)
  const totalClaimableRewards = Object.keys(rewardsData).reduce((sum, positionId) => {
    const rewards = rewardsData[positionId];
    let localSum = 0;
    if (rewards) {
      [...(rewards.collateral || []), ...(rewards.borrow || [])].forEach((reward: any) => {
        const tokenInfo = getRewardTokenInfoHelper(reward.key);
        if (tokenInfo && tokenInfo.price) {
          const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
          localSum += amount * parseFloat(tokenInfo.price);
        }
      });
    }
    return sum + localSum;
  }, 0);

  if (!walletAddress) return null;
  
  if (loading) {
    return (
      <div className="space-y-4 text-base">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-6 bg-muted rounded w-2/3" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="space-y-4 text-base">
        <div className="text-red-500 text-center py-4">{error}</div>
      </div>
    );
  }
  
  if (!positions || positions.length === 0) return null;

  // Deposit handlers
  const handleDepositClick = (position: any) => {
    setSelectedDepositPosition(position);
    setShowDepositModal(true);
  };

  const handleDepositConfirm = async (amount: bigint): Promise<void> => {
    if (!selectedDepositPosition) return;
    
    try {
      setIsDepositing(true);
      
      // Get position address (not pool address) for deposit_entry
      const positionAddress = selectedDepositPosition.address;
      
      console.log('Auro Deposit Debug Info:', {
        selectedDepositPosition,
        positionAddress,
        poolAddress: selectedDepositPosition.poolAddress,
        amount: amount.toString(),
        collateralTokenAddress: selectedDepositPosition.collateralTokenAddress,
        collateralSymbol: selectedDepositPosition.collateralSymbol
      });
      
      // For Auro Finance, we need to use the special deposit_entry function
      // Import AuroProtocol and use buildDepositToPosition method with safe import
      const { safeImport } = await import('@/lib/utils/safeImport');
      const { AuroProtocol } = await safeImport(() => import('@/lib/protocols/auro'));
      const auroProtocol = new AuroProtocol();
      
      // Build the transaction payload using buildDepositToPosition
      // Use position address (not pool address) for deposit_entry
      console.log('Using position address:', positionAddress);
      console.log('Using token type:', selectedDepositPosition.collateralTokenAddress);
      const payload = await auroProtocol.buildDepositToPosition(positionAddress, amount, selectedDepositPosition.collateralTokenAddress);
      
      console.log('Generated payload:', payload);
      
      if (!account || !signAndSubmitTransaction) {
        throw new Error('Wallet not connected');
      }
      
      const result = await signAndSubmitTransaction({
        data: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments,
          functionArguments: payload.arguments
        },
        options: {
          maxGasAmount: 20000,
        },
      });
      
      console.log('Auro deposit transaction result:', result);

      if (result.hash) {
        console.log('Checking transaction status for hash:', result.hash);
        const maxAttempts = 10;
        const delay = 2000;
        
        for (let i = 0; i < maxAttempts; i++) {
          console.log(`Checking transaction status attempt ${i + 1}/${maxAttempts}`);
          try {
            const txResponse = await fetch(`https://fullnode.mainnet.aptoslabs.com/v1/transactions/by_hash/${result.hash}`);
            const txData = await txResponse.json();
            console.log('Transaction success:', txData.success);
            console.log('Transaction vm_status:', txData.vm_status);
            
            if (txData.success && txData.vm_status === "Executed successfully") {
              console.log('Transaction confirmed successfully, showing toast...');
              showTransactionSuccessToast({ 
                hash: result.hash, 
                title: "Auro Finance deposit successful!" 
              });
              console.log('Toast should be shown now');
              
              // Close modal and update state
              setShowDepositModal(false);
              setSelectedDepositPosition(null);
              setDepositAmount('');
              
              // Refresh positions after successful deposit
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('refreshPositions', { 
                  detail: { protocol: 'auro' }
                }));
              }, 2000);
              return;
            } else if (txData.vm_status) {
              console.error('Transaction failed with status:', txData.vm_status);
              throw new Error(`Transaction failed: ${txData.vm_status}`);
            }
          } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
          }
          
          console.log(`Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        console.error('Transaction status check timeout');
        throw new Error('Transaction status check timeout');
      }
      
      // Close modal and update state (fallback if no hash)
      setShowDepositModal(false);
      setSelectedDepositPosition(null);
      setDepositAmount('');
      
    } catch (error) {
      console.error('Deposit failed:', error);
    } finally {
      setIsDepositing(false);
    }
  };

  // Withdraw handlers
  const handleWithdrawClick = (position: any) => {
    setSelectedWithdrawPosition(position);
    setShowWithdrawModal(true);
  };

  const handleWithdrawConfirm = async (amount: bigint): Promise<void> => {
    if (!selectedWithdrawPosition) return;
    
    try {
      setIsWithdrawing(true);
      
      // Проверяем, является ли это 100% withdraw
      const totalSupplyInOctas = BigInt(Math.floor(parseFloat(selectedWithdrawPosition.collateralAmount) * Math.pow(10, selectedWithdrawPosition.collateralTokenInfo?.decimals || 8)));
      const isFullWithdraw = amount >= totalSupplyInOctas;
      
      if (isFullWithdraw) {
        // Для 100% withdraw сначала показываем модальное окно о claim rewards
        setPendingWithdrawAction(() => async () => {
          // Claim rewards
          const { positionIds, tokenTypes } = getClaimablePositionsAndTokens();
          if (positionIds.length > 0 && tokenTypes.length > 0) {
            await claimRewards('auro', positionIds, tokenTypes);
          }
          
          // После успешного claim, выполняем exit position
          await performExitPosition(selectedWithdrawPosition);
        });
        setShowClaimRewardsModal(true);
        return; // Не закрываем modal и не завершаем функцию
      } else {
        // Обычный withdraw
        await performWithdraw(selectedWithdrawPosition, amount);
      }
      
      // Закрываем модал и обновляем состояние
      setShowWithdrawModal(false);
      setSelectedWithdrawPosition(null);
      
      // Обновляем позиции после успешного withdraw
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refreshPositions', { 
          detail: { protocol: 'auro' }
        }));
      }, 2000);
      
    } catch (error) {
      console.error('Withdraw failed:', error);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const performWithdraw = async (position: any, amount: bigint) => {
    const isCustomToken = position.collateralTokenAddress && position.collateralTokenAddress.includes('::');
    
    // Import AuroProtocol and use appropriate withdraw method
    const { AuroProtocol } = await import('@/lib/protocols/auro');
    const auroProtocol = new AuroProtocol();
    
    let payload;
    if (isCustomToken) {
      // Используем withdraw_coin_entry для токенов с ::
      payload = await auroProtocol.buildWithdrawCoinEntry(position.address, amount, position.collateralTokenAddress);
    } else {
      // Используем withdraw_entry для токенов без ::
      payload = await auroProtocol.buildWithdrawEntry(position.address, amount, position.collateralTokenAddress);
    }
    
    if (!account || !signAndSubmitTransaction) {
      throw new Error('Wallet not connected');
    }
    
    const result = await signAndSubmitTransaction({
      data: {
        function: payload.function as `${string}::${string}::${string}`,
        typeArguments: payload.type_arguments,
        functionArguments: payload.arguments
      },
      options: {
        maxGasAmount: 20000,
      },
    });
    
    console.log('Auro withdraw transaction result:', result);
    
    if (result.hash) {
      showTransactionSuccessToast({ 
        hash: result.hash, 
        title: "Auro Finance withdraw successful!" 
      });
    }
  };

  const performExitPosition = async (position: any) => {
    const isCustomToken = position.collateralTokenAddress && position.collateralTokenAddress.includes('::');
    
    // Import AuroProtocol and use appropriate exit method
    const { AuroProtocol } = await import('@/lib/protocols/auro');
    const auroProtocol = new AuroProtocol();
    
    let payload;
    if (isCustomToken) {
      // Используем exit_position_coin для токенов с ::
      payload = await auroProtocol.buildExitPositionCoin(position.address, position.collateralTokenAddress);
    } else {
      // Используем exit_position для токенов без ::
      payload = await auroProtocol.buildExitPosition(position.address, position.collateralTokenAddress);
    }
    
    if (!account || !signAndSubmitTransaction) {
      throw new Error('Wallet not connected');
    }
    
    const result = await signAndSubmitTransaction({
      data: {
        function: payload.function as `${string}::${string}::${string}`,
        typeArguments: payload.type_arguments,
        functionArguments: payload.arguments
      },
      options: {
        maxGasAmount: 20000,
      },
    });
    
    console.log('Auro exit position transaction result:', result);
    
    if (result.hash) {
      showTransactionSuccessToast({ 
        hash: result.hash, 
        title: "Auro Finance position exit successful!" 
      });
    }
  };

  // Claim rewards confirmation handlers
  const handleClaimRewardsConfirm = async () => {
    if (pendingWithdrawAction) {
      try {
        await pendingWithdrawAction();
        
        // Закрываем модалы и обновляем состояние
        setShowClaimRewardsModal(false);
        setShowWithdrawModal(false);
        setSelectedWithdrawPosition(null);
        setPendingWithdrawAction(null);
        
        // Обновляем позиции после успешного withdraw
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refreshPositions', { 
            detail: { protocol: 'auro' }
          }));
        }, 2000);
        
      } catch (error) {
        console.error('Claim rewards and withdraw failed:', error);
      } finally {
        setIsWithdrawing(false);
      }
    }
  };

  const handleClaimRewardsCancel = () => {
    setShowClaimRewardsModal(false);
    setPendingWithdrawAction(null);
    setIsWithdrawing(false);
  };

  return (
    <div className="space-y-4 text-base">
      <ScrollArea>
        {sortedPositions.map((pos, idx) => {
          const collateral = pos.collateralAmount;
          const collateralSymbol = pos.collateralSymbol;
          const collateralLogo = pos.collateralTokenInfo?.logoUrl;
          const collateralPrice = pos.collateralTokenAddress ? parseFloat(getTokenPrice(pos.collateralTokenAddress)).toFixed(2) : 'N/A';
          const collateralValue = pos.collateralTokenAddress ? (parseFloat(collateral) * parseFloat(getTokenPrice(pos.collateralTokenAddress))).toFixed(2) : 'N/A';
          const collateralAPRData = getCollateralAPRData(pos.poolAddress);
          
          const debt = pos.debtAmount;
          const debtSymbol = pos.debtSymbol;
          const debtLogo = pos.debtTokenInfo?.logoUrl;
          const debtPrice = parseFloat(getTokenPrice("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec")).toFixed(2); // USDA
          const debtValue = (parseFloat(debt) * parseFloat(getTokenPrice("0x534e4c3dc0f038dab1a8259e89301c4da58779a5d482fb354a41c08147e6b9ec"))).toFixed(2); // USDA
          const debtAPRData = getDebtAPRData();
          
          const hasDebt = parseFloat(debt) > 0;
          
                      return (
              <div 
                key={pos.address || idx} 
                className="p-4 border-b last:border-b-0 transition-colors"
              >
              {/* Desktop layout - Collateral позиция */}
              <div className="hidden md:flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-8 h-8 relative cursor-help">
                          {collateralLogo && (
                            <Image 
                              src={collateralLogo} 
                              alt={collateralSymbol}
                              width={32}
                              height={32}
                              className="object-contain"
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="w-[768px] p-4 bg-popover text-popover-foreground border-border">
                        <div className="space-y-3">
                                                      <div className="font-semibold text-sm text-white">{collateralSymbol} Supply</div>
                          <div className="text-xs space-y-2 text-foreground">
                            <div><span className="font-medium text-white">Position ID:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">{pos.address}</code></div>
                            <div><span className="font-medium text-white">Pool ID:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">{pos.poolAddress}</code></div>
                            <div><span className="font-medium text-white">Liquidation Price:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">${pos.liquidatePrice}</code></div>
                            {collateralAPRData.rewardPoolAddress && (
                              <div><span className="font-medium text-white">Reward Pool:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">{collateralAPRData.rewardPoolAddress}</code></div>
                            )}
                          </div>
                          <div className="text-xs space-y-1 text-foreground">
                            <div><span className="font-medium text-white">Supply APR:</span> {collateralAPRData.supplyApr.toFixed(2)}%</div>
                            <div><span className="font-medium text-white">Incentive APR:</span> {collateralAPRData.supplyIncentiveApr.toFixed(2)}%</div>
                            <div><span className="font-medium text-white">Staking APR:</span> {collateralAPRData.stakingApr.toFixed(2)}%</div>
                            <div className="border-t border-border pt-1 mt-1">
                              <span className="font-semibold text-white">Total APR: {collateralAPRData.totalApr.toFixed(2)}%</span>
                            </div>
                            {collateralAPRData.rewardPoolAddress && (
                              <div className="mt-2">
                                <span className="font-medium text-white">Reward Pool:</span>
                                <code className="bg-card px-1 rounded text-xs text-foreground block mt-1">{collateralAPRData.rewardPoolAddress}</code>
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg">{collateralSymbol}</div>
                      <Badge 
                        variant="outline" 
                        className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
                      >
                                                  Supply
                      </Badge>
                    </div>
                    <div className="text-base text-muted-foreground mt-0.5">
                      ${collateralPrice}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs font-normal px-2 py-0.5 h-5 cursor-help",
                              collateralAPRData.totalApr > 0 
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : "bg-muted0/10 text-foreground border-gray-500/20"
                            )}
                          >
                            APR: {collateralAPRData.totalApr.toFixed(2)}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="w-80 p-3 bg-popover text-popover-foreground border-border">
                          <div className="space-y-2">
                            <div className="font-semibold text-sm text-white">APR Breakdown</div>
                            <div className="text-xs space-y-1 text-foreground">
                              <div><span className="font-medium text-white">Supply APR:</span> {collateralAPRData.supplyApr.toFixed(2)}%</div>
                              <div><span className="font-medium text-white">Incentive APR:</span> {collateralAPRData.supplyIncentiveApr.toFixed(2)}%</div>
                              <div><span className="font-medium text-white">Staking APR:</span> {collateralAPRData.stakingApr.toFixed(2)}%</div>
                              <div className="border-t border-border pt-1 mt-1">
                                <span className="font-semibold text-white">Total APR: {collateralAPRData.totalApr.toFixed(2)}%</span>
                              </div>
                              {collateralAPRData.rewardPoolAddress && (
                                <div className="mt-2">
                                  <span className="font-medium text-white">Reward Pool:</span>
                                  <code className="bg-card px-1 rounded text-xs text-foreground block mt-1">{collateralAPRData.rewardPoolAddress}</code>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-lg font-bold text-right w-24">${collateralValue}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">
                    {formatNumber(parseFloat(collateral), 4)} {collateralSymbol}
                  </div>
                  
                  {/* Rewards section - прямо в карточке */}
                  {rewardsData[pos.address] && (
                    rewardsData[pos.address].collateral.length > 0 || 
                    (!hasDebt && rewardsData[pos.address].borrow.length > 0)
                  ) && (
                    <div className="mt-2 pt-2 border-t border-border">
                      {/* Collateral Rewards */}
                      {rewardsData[pos.address].collateral.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-foreground mb-1">💰 Supply Rewards</div>
                          <div className="space-y-1">
                            {rewardsData[pos.address].collateral.map((reward, rewardIdx) => {
                              if (!reward || !reward.key || !reward.value) return null;
                              const tokenInfo = getRewardTokenInfoHelper(reward.key);
                              if (!tokenInfo) return null;
                              const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                              const rewardValue = tokenInfo.price ? (amount * parseFloat(tokenInfo.price)).toFixed(2) : 'N/A';
                              return (
                                <TooltipProvider key={rewardIdx}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-between text-xs cursor-help">
                                        <div className="flex items-center gap-1">
                                        </div>
                                        <div className="text-right">
                                          {rewardValue !== 'N/A' ? (
                                            <div className="font-medium">${rewardValue}</div>
                                          ) : (
                                            <div className="font-medium">{amount.toFixed(4)}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-popover text-popover-foreground border-border">
                                      <div className="text-xs">
                                        <div className="text-gray-300">{amount.toFixed(6)} {tokenInfo.symbol}</div>
                                        {rewardValue !== 'N/A' && (
                                          <div className="text-gray-300">${rewardValue}</div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Borrow Rewards - показываем в collateral секции, если нет debt */}
                      {!hasDebt && rewardsData[pos.address].borrow.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-foreground mb-1">💳 Borrow Rewards</div>
                          <div className="space-y-1">
                            {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                              if (!reward || !reward.key || !reward.value) return null;
                              const tokenInfo = getRewardTokenInfoHelper(reward.key);
                              if (!tokenInfo) return null;
                              const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                              const borrowRewardValue = tokenInfo.price ? (amount * parseFloat(tokenInfo.price)).toFixed(2) : 'N/A';
                              return (
                                <TooltipProvider key={rewardIdx}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-between text-xs cursor-help">
                                        <div className="flex items-center gap-1">
                                        </div>
                                        <div className="text-right">
                                          {borrowRewardValue !== 'N/A' ? (
                                            <div className="font-medium">${borrowRewardValue}</div>
                                          ) : (
                                            <div className="font-medium">{amount.toFixed(4)}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-popover text-popover-foreground border-border">
                                      <div className="text-xs">
                                        <div className="text-gray-300">{amount.toFixed(6)} {tokenInfo.symbol}</div>
                                        {borrowRewardValue !== 'N/A' && (
                                          <div className="text-gray-300">${borrowRewardValue}</div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Action buttons for collateral positions */}
                  <div className="mt-2 pt-2 border-t border-border">
                    <div className="flex gap-2 justify-end">
                      <Button
                        onClick={() => handleDepositClick(pos)}
                        disabled={isDepositing}
                        size="sm"
                        variant="default"
                        className="h-10"
                      >
                        {isDepositing ? 'Depositing...' : 'Deposit'}
                      </Button>
                      {!hasDebt && (
                        <Button
                          onClick={() => handleWithdrawClick(pos)}
                          disabled={isWithdrawing}
                          size="sm"
                          variant="outline"
                          className="h-10"
                        >
                          {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile layout - Collateral позиция */}
              <div className="md:hidden space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {collateralLogo && (
                      <div className="w-8 h-8 relative">
                        <Image 
                          src={collateralLogo} 
                          alt={collateralSymbol}
                          width={32}
                          height={32}
                          className="object-contain"
                        />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <div className="text-lg">{collateralSymbol}</div>
                        <Badge 
                          variant="outline" 
                          className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-normal px-2 py-0.5 h-5"
                        >
                          Supply
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${collateralPrice}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold w-24 ml-auto">${collateralValue}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatNumber(parseFloat(collateral), 4)} {collateralSymbol}
                    </div>
                  </div>
                </div>

                {/* APR и ликвидационная цена */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-xs font-normal px-2 py-0.5 h-5",
                        collateralAPRData.totalApr > 0 
                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                          : "bg-muted0/10 text-foreground border-gray-500/20"
                      )}
                    >
                      APR: {collateralAPRData.totalApr.toFixed(2)}%
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Supply: {collateralAPRData.supplyApr.toFixed(2)}% | Incentive: {collateralAPRData.supplyIncentiveApr.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs text-red-600 font-medium">
                    Liquidation: ${pos.liquidatePrice}
                  </div>
                </div>

                {/* Rewards для мобильных */}
                {rewardsData[pos.address] && rewardsData[pos.address].collateral.length > 0 && (
                  <div className="bg-muted p-2 rounded">
                    <div className="text-xs font-medium text-foreground mb-1">💰 Supply Rewards</div>
                    <div className="space-y-1">
                      {rewardsData[pos.address].collateral.map((reward, rewardIdx) => {
                        if (!reward || !reward.key || !reward.value) return null;
                        const tokenInfo = getRewardTokenInfoHelper(reward.key);
                        if (!tokenInfo) return null;
                        const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                        const rewardValue = tokenInfo.price ? (amount * parseFloat(tokenInfo.price)).toFixed(2) : 'N/A';
                        return (
                          <div key={rewardIdx} className="flex items-center justify-between text-xs">
                            <span>{amount.toFixed(4)} {tokenInfo.symbol}</span>
                            <span className="font-medium">{rewardValue !== 'N/A' ? `$${rewardValue}` : amount.toFixed(4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Borrow Rewards для мобильных - если нет debt */}
                {!hasDebt && rewardsData[pos.address] && rewardsData[pos.address].borrow.length > 0 && (
                  <div className="bg-muted p-2 rounded">
                    <div className="text-xs font-medium text-foreground mb-1">💳 Borrow Rewards</div>
                    <div className="space-y-1">
                      {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                        if (!reward || !reward.key || !reward.value) return null;
                        const tokenInfo = getRewardTokenInfoHelper(reward.key);
                        if (!tokenInfo) return null;
                        const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                        const borrowRewardValue = tokenInfo.price ? (amount * parseFloat(tokenInfo.price)).toFixed(2) : 'N/A';
                        return (
                          <div key={rewardIdx} className="flex items-center justify-between text-xs">
                            <span>{amount.toFixed(4)} {tokenInfo.symbol}</span>
                            <span className="font-medium">{borrowRewardValue !== 'N/A' ? `$${borrowRewardValue}` : amount.toFixed(4)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Action buttons for mobile */}
                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={() => handleDepositClick(pos)}
                    disabled={isDepositing}
                    size="sm"
                    variant="default"
                    className="h-10"
                  >
                    {isDepositing ? 'Depositing...' : 'Deposit'}
                  </Button>
                  {!hasDebt && (
                    <Button
                      onClick={() => handleWithdrawClick(pos)}
                      disabled={isWithdrawing}
                      size="sm"
                      variant="outline"
                      className="h-10"
                    >
                      {isWithdrawing ? 'Withdrawing...' : 'Withdraw'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Desktop layout - Debt позиция */}
              {hasDebt && (
                <div className="hidden md:flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-8 h-8 relative cursor-help">
                            {debtLogo && (
                              <Image 
                                src={debtLogo} 
                                alt={debtSymbol}
                                width={32}
                                height={32}
                                className="object-contain"
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="w-[768px] p-4 bg-popover text-popover-foreground border-border">
                          <div className="space-y-3">
                            <div className="font-semibold text-sm text-white">{debtSymbol} Borrow</div>
                            <div className="text-xs space-y-2 text-foreground">
                              <div><span className="font-medium text-white">Position ID:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">{pos.address}</code></div>
                              <div><span className="font-medium text-white">Pool ID:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">{pos.poolAddress}</code></div>
                              <div><span className="font-medium text-white">Liquidation Price:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">${pos.liquidatePrice}</code></div>
                              {debtAPRData.rewardPoolAddress && (
                                <div><span className="font-medium text-white">Reward Pool:</span> <code className="bg-card px-2 py-1 rounded text-xs text-foreground block mt-1">{debtAPRData.rewardPoolAddress}</code></div>
                              )}
                            </div>

                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg">{debtSymbol}</div>
                        <Badge 
                          variant="outline" 
                          className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5"
                        >
                          Borrow
                        </Badge>
                      </div>
                      <div className="text-base text-muted-foreground mt-0.5">
                        ${debtPrice}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs font-normal px-2 py-0.5 h-5 cursor-help",
                                debtAPRData.totalApr > 0 
                                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                                  : "bg-red-500/10 text-red-600 border-red-500/20"
                              )}
                            >
                              APR: {debtAPRData.totalApr.toFixed(2)}%
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="w-80 p-3 bg-popover text-popover-foreground border-border">
                            <div className="space-y-2">
                              <div className="font-semibold text-sm text-white">APR Breakdown</div>
                              <div className="text-xs space-y-1 text-foreground">
                                <div><span className="font-medium text-white">Borrow APR:</span> -{debtAPRData.borrowApr.toFixed(2)}%</div>
                                <div><span className="font-medium text-white">Incentive APR:</span> +{debtAPRData.borrowIncentiveApr.toFixed(2)}%</div>
                                <div className="border-t border-border pt-1 mt-1">
                                  <span className="font-semibold text-white">Net APR: {debtAPRData.totalApr.toFixed(2)}%</span>
                                </div>
                                {debtAPRData.rewardPoolAddress && (
                                  <div className="mt-2">
                                    <span className="font-medium text-white">Reward Pool:</span>
                                    <code className="bg-card px-1 rounded text-xs text-foreground block mt-1">{debtAPRData.rewardPoolAddress}</code>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="text-lg font-bold text-red-600 text-right w-24">-${debtValue}</div>
                  </div>
                  <div className="text-base text-muted-foreground font-semibold">
                    {formatNumber(parseFloat(debt), 4)} {debtSymbol}
                  </div>
                    
                    {/* Rewards section для debt позиции */}
                    {rewardsData[pos.address] && rewardsData[pos.address].borrow.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        {/* Borrow Rewards для debt позиции */}
                        <div>
                          <div className="text-xs font-medium text-foreground mb-1">💳 Borrow Rewards</div>
                          <div className="space-y-1">
                            {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                              if (!reward || !reward.key || !reward.value) return null;
                              const tokenInfo = getRewardTokenInfoHelper(reward.key);
                              if (!tokenInfo) return null;
                              const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                              const borrowRewardValue = tokenInfo.price ? (amount * parseFloat(tokenInfo.price)).toFixed(2) : 'N/A';
                              return (
                                <TooltipProvider key={rewardIdx}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center justify-between text-xs cursor-help">
                                        <div className="flex items-center gap-1">
                                        </div>
                                        <div className="text-right">
                                          {borrowRewardValue !== 'N/A' ? (
                                            <div className="font-medium">${borrowRewardValue}</div>
                                          ) : (
                                            <div className="font-medium">{amount.toFixed(4)}</div>
                                          )}
                                        </div>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-popover text-popover-foreground border-border">
                                      <div className="text-xs">
                                        <div className="text-gray-300">{amount.toFixed(6)} {tokenInfo.symbol}</div>
                                        {borrowRewardValue !== 'N/A' && (
                                          <div className="text-gray-300">${borrowRewardValue}</div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile layout - Debt позиция */}
              {hasDebt && (
                <div className="md:hidden space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {debtLogo && (
                        <div className="w-8 h-8 relative">
                          <Image 
                            src={debtLogo} 
                            alt={debtSymbol}
                            width={32}
                            height={32}
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="text-lg">{debtSymbol}</div>
                          <Badge 
                            variant="outline" 
                            className="bg-red-500/10 text-red-600 border-red-500/20 text-xs font-normal px-2 py-0.5 h-5"
                          >
                            Borrow
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${debtPrice}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-600 w-24 ml-auto">-${debtValue}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatNumber(parseFloat(debt), 4)} {debtSymbol}
                      </div>
                    </div>
                  </div>

                  {/* APR и ликвидационная цена */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs font-normal px-2 py-0.5 h-5",
                          debtAPRData.totalApr > 0 
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : "bg-red-500/10 text-red-600 border-red-500/20"
                        )}
                      >
                        APR: {debtAPRData.totalApr.toFixed(2)}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Borrow: -{debtAPRData.borrowApr.toFixed(2)}% | Incentive: +{debtAPRData.borrowIncentiveApr.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs text-red-600 font-medium">
                      Liquidation: ${pos.liquidatePrice}
                    </div>
                  </div>

                  {/* Rewards для мобильных */}
                  {rewardsData[pos.address] && rewardsData[pos.address].borrow.length > 0 && (
                    <div className="bg-muted p-2 rounded">
                      <div className="text-xs font-medium text-foreground mb-1">💳 Borrow Rewards</div>
                      <div className="space-y-1">
                        {rewardsData[pos.address].borrow.map((reward, rewardIdx) => {
                          if (!reward || !reward.key || !reward.value) return null;
                          const tokenInfo = getRewardTokenInfoHelper(reward.key);
                          if (!tokenInfo) return null;
                          const amount = parseFloat(reward.value) / Math.pow(10, tokenInfo.decimals || 8);
                          const borrowRewardValue = tokenInfo.price ? (amount * parseFloat(tokenInfo.price)).toFixed(2) : 'N/A';
                          return (
                            <div key={rewardIdx} className="flex items-center justify-between text-xs">
                              <span>{amount.toFixed(4)} {tokenInfo.symbol}</span>
                              <span className="font-medium">{borrowRewardValue !== 'N/A' ? `$${borrowRewardValue}` : amount.toFixed(4)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </ScrollArea>
      
      {/* Desktop layout - Total Assets */}
      <div className="hidden md:flex items-center justify-between pt-6 pb-6">
        <span className="text-xl">Total assets in Auro Finance:</span>
        <div className="text-right">
          <span className="text-xl text-primary font-bold">{formatCurrency(totalValue, 2)}</span>
          {totalRewardsValue > 0 && (
            <div className="text-sm text-muted-foreground mt-1 flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <span>💰</span>
                <span>including rewards {formatCurrency(totalRewardsValue, 2)}</span>
              </div>
              {totalClaimableRewards > 0 && (
                <button
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
                  onClick={handleClaimAllRewards}
                  disabled={isClaiming || totalClaimableRewards === 0}
                >
                  {isClaiming ? 'Claiming...' : `Claim rewards`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout - Total Assets */}
      <div className="md:hidden pt-6 pb-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg">Total assets in Auro Finance:</span>
          <span className="text-lg text-primary font-bold">{formatCurrency(totalValue, 2)}</span>
        </div>
        {totalRewardsValue > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <span>💰</span>
              <span>including rewards {formatCurrency(totalRewardsValue, 2)}</span>
            </div>
            {totalClaimableRewards > 0 && (
              <button
                className="w-full py-2 bg-green-600 text-white rounded text-sm font-semibold disabled:opacity-60"
                onClick={handleClaimAllRewards}
                disabled={isClaiming || totalClaimableRewards === 0}
              >
                {isClaiming ? 'Claiming...' : `Claim rewards`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Custom Auro Deposit Modal */}
        {selectedDepositPosition && (
          <AuroDepositModal
            isOpen={showDepositModal}
            onClose={() => {
              setShowDepositModal(false);
              setSelectedDepositPosition(null);
            }}
            position={selectedDepositPosition}
            onDeposit={handleDepositConfirm}
            isDepositing={isDepositing}
            getTokenPrice={getTokenPrice}
            getCollateralAPRData={getCollateralAPRData}
          />
        )}

      {/* Withdraw Modal */}
      {selectedWithdrawPosition && (
        <WithdrawModal
          isOpen={showWithdrawModal}
          onClose={() => {
            setShowWithdrawModal(false);
            setSelectedWithdrawPosition(null);
          }}
          onConfirm={handleWithdrawConfirm}
          position={{
            coin: selectedWithdrawPosition.collateralTokenAddress,
            supply: Math.floor(parseFloat(selectedWithdrawPosition.collateralAmount) * Math.pow(10, selectedWithdrawPosition.collateralTokenInfo?.decimals || 8)).toString(),
            market: selectedWithdrawPosition.address
          }}
          tokenInfo={{
            symbol: selectedWithdrawPosition.collateralSymbol,
            logoUrl: selectedWithdrawPosition.collateralTokenInfo?.logoUrl,
            decimals: selectedWithdrawPosition.collateralTokenInfo?.decimals || 8,
            usdPrice: getTokenPrice(selectedWithdrawPosition.collateralTokenAddress)
          }}
          isLoading={isWithdrawing}
          userAddress={walletAddress?.toString()}
        />
      )}

      {/* Claim Rewards Confirmation Modal */}
      <Dialog open={showClaimRewardsModal} onOpenChange={handleClaimRewardsCancel}>
        <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              Claim Rewards Required
            </DialogTitle>
            <DialogDescription className="text-sm">
              Before withdrawing 100% of your position, you need to claim your accumulated rewards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted border border-border rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800">
                    Important Notice
                  </p>
                  <p className="text-sm text-gray-700">
                    To ensure you don't lose any accumulated rewards, we'll automatically claim them before exiting your position. This process includes:
                  </p>
                  <ul className="text-sm text-gray-700 space-y-1 ml-4">
                    <li>• Claiming all available collateral rewards</li>
                    <li>• Exiting the position completely</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 mb-1">
                    What happens next?
                  </p>
                  <p className="text-sm text-blue-700">
                    After claiming rewards, your position will be completely closed and all funds will be returned to your wallet.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={handleClaimRewardsCancel} 
              disabled={isClaiming || isWithdrawing}
              className="w-full sm:w-auto h-10"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleClaimRewardsConfirm}
              disabled={isClaiming || isWithdrawing}
              className="w-full sm:w-auto h-10 bg-blue-600 hover:bg-blue-700"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming Rewards...
                </>
              ) : isWithdrawing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exiting Position...
                </>
              ) : (
                'Claim Rewards & Exit Position'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Auro Deposit Modal Component - максимально похожий на оригинальный DepositModal
interface AuroDepositModalProps {
  isOpen: boolean;
  onClose(): void;
  position: any;
  onDeposit: (amount: bigint) => Promise<void>;
  isDepositing: boolean;
  getTokenPrice: (tokenAddress: string) => string;
  getCollateralAPRData: (poolAddress: string) => any;
}

function AuroDepositModal({
  isOpen,
  onClose,
  position,
  onDeposit,
  isDepositing,
  getTokenPrice,
  getCollateralAPRData,
}: AuroDepositModalProps) {
  const { tokens, refreshPortfolio } = useWalletData();
  const [isYieldExpanded, setIsYieldExpanded] = useState(false);

  // Получаем информацию о токене из списка токенов
  const getTokenInfo = (address: string): Token | undefined => {
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    
    const normalizedAddress = normalizeAddress(address);
    
    return (tokenList.data.data as Token[]).find(token => {
      const normalizedTokenAddress = normalizeAddress(token.tokenAddress || '');
      const normalizedFaAddress = normalizeAddress(token.faAddress || '');
      
      return normalizedTokenAddress === normalizedAddress || 
             normalizedFaAddress === normalizedAddress;
    });
  };

  // Находим текущий токен в кошельке по адресу
  const currentToken = tokens?.find(t => {
    const tokenInfo = getTokenInfo(t.address);
    if (!tokenInfo) return false;
    
    const normalizeAddress = (addr: string) => {
      if (!addr || !addr.startsWith('0x')) return addr;
      return '0x' + addr.slice(2).replace(/^0+/, '') || '0x0';
    };
    
    const normalizedPositionTokenAddress = normalizeAddress(position.collateralTokenAddress);
    const normalizedTokenInfoAddress = normalizeAddress(tokenInfo.tokenAddress || '');
    const normalizedFaAddress = normalizeAddress(tokenInfo.faAddress || '');
    
    return normalizedTokenInfoAddress === normalizedPositionTokenAddress || 
           normalizedFaAddress === normalizedPositionTokenAddress;
  });

  // Используем реальный баланс из кошелька
  const walletBalance = currentToken ? BigInt(currentToken.amount) : BigInt(0);
  
  const {
    amount,
    amountString,
    setAmountFromString,
    setHalf,
    setMax,
    isValid,
  } = useAmountInput({
    balance: walletBalance,
    decimals: position.collateralTokenInfo?.decimals || 8,
  });

  // Символы для токенов
  const tokenInfo = getTokenInfo(position.collateralTokenAddress);
  const displaySymbol = tokenInfo?.symbol || position.collateralSymbol;
  
  // Доходность
  const poolAPRData = getCollateralAPRData(position.poolAddress);
  const yieldResult = calcYield(poolAPRData.totalApr, amount, position.collateralTokenInfo?.decimals || 8);

  // Устанавливаем максимальное значение при открытии модального окна
  useEffect(() => {
    if (isOpen && currentToken) {
      setMax();
    }
  }, [isOpen, currentToken, setMax]);

  // Refresh portfolio data when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[AuroDepositModal] Refreshing portfolio data on modal open');
      refreshPortfolio();
    }
  }, [isOpen, refreshPortfolio]);

  const handleDeposit = async () => {
    if (isDepositing) return;
    
    try {
      await onDeposit(amount);
      onClose();
    } catch (error) {
      console.error('Deposit error:', error);
    }
  };

  const priceUSD = parseFloat(getTokenPrice(position.collateralTokenAddress));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Image
              src="/protocols/auro.svg"
              alt="Auro Finance"
              width={24}
              height={24}
              className="rounded-full"
            />
            <DialogTitle>Deposit to Auro Finance</DialogTitle>
          </div>
          <DialogDescription>
            Add liquidity to your {displaySymbol} position
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-2 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 relative">
              <Image
                src={position.collateralTokenInfo?.logoUrl || '/file.svg'}
                alt={displaySymbol}
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span>{displaySymbol}</span>
          </div>
          <span>→</span>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 relative">
              <Image
                src={position.collateralTokenInfo?.logoUrl || '/file.svg'}
                alt={displaySymbol}
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
            <span>{displaySymbol}</span>
          </div>
        </div>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id="amount"
                type="number"
                value={amountString}
                onChange={(e) => setAmountFromString(e.target.value)}
                className={`flex-1 ${amount > walletBalance ? 'text-red-500' : ''}`}
                placeholder="0.00"
              />
              <div className="flex items-center gap-1">
                <Image
                  src={position.collateralTokenInfo?.logoUrl || '/file.svg'}
                  alt={position.collateralSymbol}
                  width={16}
                  height={16}
                  className="rounded-full"
                />
                <span className="text-sm">{displaySymbol}</span>
                {amountString && (
                  <span className={`text-sm ml-2 ${amount > walletBalance ? 'text-red-500' : 'text-muted-foreground'}`}>
                    ≈ ${(parseFloat(amountString) * priceUSD).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {amount > walletBalance && (
            <div className="flex items-center justify-between text-sm text-red-500 mt-1">
              <span>
                Amount exceeds wallet balance of {displaySymbol}. Please reduce the amount.
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setHalf}>
              Half
            </Button>
            <Button variant="outline" size="sm" onClick={setMax}>
              Max
            </Button>
          </div>

          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsYieldExpanded(!isYieldExpanded)}
          >
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                APR {poolAPRData.totalApr.toFixed(2)}%
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">
                  ≈ ${yieldResult.daily.toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground">/day</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground ml-1" />
              </div>
            </div>
          </div>
          {isYieldExpanded && (
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>≈ ${yieldResult.weekly.toFixed(2)} /week</div>
              <div>≈ ${yieldResult.monthly.toFixed(2)} /month</div>
              <div>≈ ${yieldResult.yearly.toFixed(2)} /year</div>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleDeposit}
            disabled={!isValid || isDepositing || amount === BigInt(0)}
          >
            {isDepositing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Deposit"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 