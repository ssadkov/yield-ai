'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { DragData, DragDropState, DropValidationResult } from '@/types/dragDrop';
import { InvestmentData } from '@/types/investments';
import { DepositModal } from '@/components/ui/deposit-modal';
import { SwapAndDepositModal } from '@/components/ui/swap-and-deposit-modal';
import { getProtocolByName } from '@/lib/protocols/getProtocolsList';
import { ProtocolKey } from '@/lib/transactions/types';
import tokenList from '@/lib/data/tokenList.json';

interface DragDropContextType {
  state: DragDropState;
  startDrag: (data: DragData) => void;
  endDrag: () => void;
  validateDrop: (dragData: DragData, dropTarget: InvestmentData | 'wallet') => DropValidationResult;
  handleDrop: (dragData: DragData, dropTarget: InvestmentData | 'wallet') => void;
  // Модальные окна
  isDepositModalOpen: boolean;
  isSwapModalOpen: boolean;
  closeDepositModal: () => void;
  closeSwapModal: () => void;
  depositModalData: {
    protocol: any;
    tokenIn: any;
    tokenOut: any;
    priceUSD: number;
  } | null;
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined);

export function DragDropProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    dragData: null,
    validationResult: null,
  });

  // Состояние модальных окон
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [depositModalData, setDepositModalData] = useState<any>(null);

  const startDrag = (data: DragData) => {
    setState(prev => ({
      ...prev,
      isDragging: true,
      dragData: data,
    }));
  };

  const endDrag = () => {
    setState(prev => ({
      ...prev,
      isDragging: false,
      dragData: null,
      validationResult: null,
    }));
  };

  const validateDrop = (dragData: DragData, dropTarget: InvestmentData | 'wallet'): DropValidationResult => {
    // Если перетаскиваем токен
    if (dragData.type === 'token') {
      // Если dropTarget это wallet, то токены нельзя перетаскивать в wallet
      if (dropTarget === 'wallet') {
        return {
          isValid: false,
          reason: 'Cannot drop tokens into wallet',
        };
      }
      
      // Проверяем совместимость токена с пулом
      const isCompatible = dropTarget.token === dragData.address || 
                          dropTarget.asset.toLowerCase() === dragData.symbol.toLowerCase();
      
      if (!isCompatible) {
        return {
          isValid: false,
          reason: 'Token is not compatible with this pool',
          requiresSwap: true,
        };
      }

      // Проверяем, что у пользователя достаточно баланса
      const tokenValue = parseFloat(dragData.value);
      if (tokenValue <= 0) {
        return {
          isValid: false,
          reason: 'Insufficient balance',
        };
      }

      return {
        isValid: true,
        requiresSwap: false,
      };
    }

    // Если перетаскиваем позицию
    if (dragData.type === 'position') {
      // Если dropTarget это wallet, проверяем возможность withdraw
      if (dropTarget === 'wallet') {
        // Проверяем, что это позиция Echelon
        if (dragData.protocol !== 'Echelon') {
          return {
            isValid: false,
            reason: 'Only Echelon positions can be withdrawn to wallet',
          };
        }
        
        // Проверяем, что позиция имеет положительный баланс
        if (parseFloat(dragData.amount) <= 0) {
          return {
            isValid: false,
            reason: 'Position has no balance to withdraw',
          };
        }
        
        return {
          isValid: true,
          action: 'withdraw',
        };
      }
      
      // Если dropTarget это пул, пока не поддерживаем
      return {
        isValid: false,
        reason: 'Position dragging to pools not implemented yet',
      };
    }

    return {
      isValid: false,
      reason: 'Unknown drag data type',
    };
  };

  const getTokenInfo = (address: string) => {
    return (tokenList.data.data as any[]).find(token => 
      token.tokenAddress === address || token.faAddress === address
    );
  };

  const handleDrop = (dragData: DragData, dropTarget: InvestmentData | 'wallet') => {
    const validation = validateDrop(dragData, dropTarget);
    
    if (validation.isValid && dragData.type === 'token' && dropTarget !== 'wallet') {
      const protocol = getProtocolByName(dropTarget.protocol);
      const tokenInfo = getTokenInfo(dropTarget.token);
      
      if (protocol && protocol.depositType === 'native') {
        // Открываем модальное окно депозита
        const modalData = {
          protocol: {
            name: protocol.name,
            logo: protocol.logoUrl,
            apy: dropTarget.totalAPY || 8.4,
            key: protocol.name.toLowerCase() as ProtocolKey
          },
          tokenIn: {
            symbol: dragData.symbol,
            logo: dragData.logoUrl || '/file.svg',
            decimals: dragData.decimals,
            address: dragData.address
          },
          tokenOut: {
            symbol: tokenInfo?.symbol || dropTarget.asset,
            logo: tokenInfo?.logoUrl || '/file.svg',
            decimals: tokenInfo?.decimals || 8,
            address: dropTarget.token
          },
          priceUSD: parseFloat(dragData.price) || 0
        };
        
        setDepositModalData(modalData);
        setIsDepositModalOpen(true);
      } else if (protocol && protocol.depositType === 'external' && protocol.depositUrl) {
        // Открываем внешний сайт
        window.open(protocol.depositUrl, '_blank');
      }
    } else if (validation.requiresSwap && dragData.type === 'token' && dropTarget !== 'wallet') {
      // Открываем модальное окно swap + deposit
      const protocol = getProtocolByName(dropTarget.protocol);
      const tokenInfo = getTokenInfo(dropTarget.token);
      
      if (protocol && protocol.depositType === 'native') {
        const modalData = {
          protocol: {
            name: protocol.name,
            logo: protocol.logoUrl,
            apy: dropTarget.totalAPY || 8.4,
            key: protocol.name.toLowerCase() as ProtocolKey
          },
          tokenIn: {
            symbol: dragData.symbol,
            logo: dragData.logoUrl || '/file.svg',
            decimals: dragData.decimals,
            address: dragData.address
          },
          tokenOut: {
            symbol: tokenInfo?.symbol || dropTarget.asset,
            logo: tokenInfo?.logoUrl || '/file.svg',
            decimals: tokenInfo?.decimals || 8,
            address: dropTarget.token
          },
          priceUSD: parseFloat(dragData.price) || 0
        };
        
        setDepositModalData(modalData);
        setIsSwapModalOpen(true);
      }
    } else if (validation.isValid && dragData.type === 'position' && validation.action === 'withdraw' && dropTarget === 'wallet') {
      // Для позиций Echelon открываем локальную модалку через событие
      if (dragData.protocol === 'Echelon') {
        // Создаем событие для открытия withdraw модалки
        const event = new CustomEvent('openWithdrawModal', {
          detail: {
            position: {
              coin: dragData.asset,
              supply: dragData.supply,
              market: dragData.market,
            },
            tokenInfo: dragData.tokenInfo,
          }
        });
        window.dispatchEvent(event);
      }
    } else {
      // Показываем ошибку
      alert(`Cannot drop: ${validation.reason}`);
    }

    endDrag();
  };

  const closeDepositModal = () => {
    setIsDepositModalOpen(false);
    setDepositModalData(null);
  };

  const closeSwapModal = () => {
    setIsSwapModalOpen(false);
    setDepositModalData(null);
  };

  const value: DragDropContextType = {
    state,
    startDrag,
    endDrag,
    validateDrop,
    handleDrop,
    isDepositModalOpen,
    isSwapModalOpen,
    closeDepositModal,
    closeSwapModal,
    depositModalData,
  };

  return (
    <DragDropContext.Provider value={value}>
      {children}
      
      {/* Модальные окна */}
      {depositModalData && (
        <>
          <DepositModal
            isOpen={isDepositModalOpen}
            onClose={closeDepositModal}
            protocol={depositModalData.protocol}
            tokenIn={depositModalData.tokenIn}
            tokenOut={depositModalData.tokenOut}
            priceUSD={depositModalData.priceUSD}
          />
          
          <SwapAndDepositModal
            isOpen={isSwapModalOpen}
            onClose={closeSwapModal}
            protocol={depositModalData.protocol}
            tokenIn={depositModalData.tokenIn}
            amount={BigInt(depositModalData.tokenIn.amount || 0)}
            priceUSD={depositModalData.priceUSD}
          />
        </>
      )}
      

    </DragDropContext.Provider>
  );
}

export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (context === undefined) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return context;
} 