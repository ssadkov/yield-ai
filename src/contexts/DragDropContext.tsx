'use client';

import React, { createContext, useContext, useState, ReactNode, useRef } from 'react';
import { DragData, DragDropState, DropValidationResult } from '@/types/dragDrop';
import { InvestmentData } from '@/types/investments';
import { DepositModal } from '@/components/ui/deposit-modal';
import { SwapAndDepositModal } from '@/components/ui/swap-and-deposit-modal';
import { WithdrawModal } from '@/components/ui/withdraw-modal';
import { ConfirmRemoveModal } from '@/components/ui/confirm-remove-modal';
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
  closePositionModal: (positionId: string) => void;
  closeAllModals: () => void;
  depositModalData: {
    protocol: any;
    tokenIn: any;
    tokenOut: any;
    priceUSD: number;
  } | null;
  // Модалки позиций
  isPositionModalOpen: boolean;
  positionModalData: {
    type: 'withdraw' | 'removeLiquidity';
    position: any;
    protocol: string;
  } | null;
  closePositionModalDirect: () => void;
  // Функция для установки обработчика подтверждения транзакции
  setPositionConfirmHandler: (handler: (() => Promise<void>) | null) => void;
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
  
  // Состояние модалок позиций
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
  const [positionModalData, setPositionModalData] = useState<any>(null);
  // Обработчик подтверждения транзакции для позиций
  const [positionConfirmHandler, setPositionConfirmHandler] = useState<(() => Promise<void>) | null>(null);
  
  // Глобальный флаг для предотвращения повторного срабатывания событий
  const globalEventTriggerRef = useRef(false);
  // Отслеживание открытых модалок по positionId
  const openModalsRef = useRef<Set<string>>(new Set());
  // Отслеживание времени последних событий для debounce
  const lastEventTimeRef = useRef<Map<string, number>>(new Map());

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
      // Если dropTarget это wallet, проверяем возможность withdraw/removeLiquidity
      if (dropTarget === 'wallet') {
        // Проверяем, что это позиция Echelon или Hyperion
        if (dragData.protocol === 'Echelon') {
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
        } else if (dragData.protocol === 'Hyperion') {
          // Проверяем, что позиция имеет положительную стоимость
          if (parseFloat(dragData.value || '0') <= 0) {
            return {
              isValid: false,
              reason: 'Position has no value to remove',
            };
          }
          
          return {
            isValid: true,
            action: 'removeLiquidity',
          };
        } else {
          return {
            isValid: false,
            reason: 'Only Echelon and Hyperion positions can be processed',
          };
        }
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
    } else if (validation.isValid && dragData.type === 'position' && dropTarget === 'wallet') {
      // Для позиций Echelon открываем withdraw модалку напрямую
      if (dragData.protocol === 'Echelon' && validation.action === 'withdraw') {
        console.log('DragDropContext: Opening Echelon withdraw modal directly', {
          positionId: dragData.positionId
        });
        
        setPositionModalData({
          type: 'withdraw',
          position: dragData,
          protocol: 'Echelon'
        });
        setIsPositionModalOpen(true);
      }
      // Для позиций Hyperion открываем remove liquidity модалку напрямую
      else if (dragData.protocol === 'Hyperion' && validation.action === 'removeLiquidity') {
        console.log('DragDropContext: Opening Hyperion remove liquidity modal directly', {
          positionId: dragData.positionId
        });
        
        setPositionModalData({
          type: 'removeLiquidity',
          position: dragData,
          protocol: 'Hyperion'
        });
        setIsPositionModalOpen(true);
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

  // Функция для закрытия модалки позиции
  const closePositionModal = (positionId: string) => {
    openModalsRef.current.delete(positionId);
    console.log('DragDropContext: Closed modal for position', positionId);
  };

  // Функция для закрытия всех модалок
  const closeAllModals = () => {
    // Закрываем все модалки депозита и свопа
    setIsDepositModalOpen(false);
    setIsSwapModalOpen(false);
    setDepositModalData(null);
    
    // Закрываем модалки позиций
    setIsPositionModalOpen(false);
    setPositionModalData(null);
    
    // Очищаем все открытые модалки позиций
    const openModalsCount = openModalsRef.current.size;
    openModalsRef.current.clear();
    
    // Очищаем историю событий
    lastEventTimeRef.current.clear();
    
    console.log('DragDropContext: Closed all modals', {
      closedModalsCount: openModalsCount,
      timestamp: new Date().toISOString()
    });
  };

  // Функция для прямого закрытия модалки позиции
  const closePositionModalDirect = () => {
    setIsPositionModalOpen(false);
    setPositionModalData(null);
    setPositionConfirmHandler(null); // Очищаем обработчик при закрытии
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
    closePositionModal,
    closeAllModals,
    depositModalData,
    isPositionModalOpen,
    positionModalData,
    closePositionModalDirect,
    setPositionConfirmHandler,
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
      
      {/* Модальные окна позиций */}
      {positionModalData && (
        <>
          {/* Withdraw Modal для Echelon */}
          {positionModalData.type === 'withdraw' && positionModalData.protocol === 'Echelon' && (
            <WithdrawModal
              isOpen={isPositionModalOpen}
              onClose={closePositionModalDirect}
              onConfirm={async (amount: bigint) => {
                if (positionConfirmHandler) {
                  try {
                    await positionConfirmHandler();
                  } catch (error) {
                    console.error('Error in position confirm handler:', error);
                  }
                } else {
                  console.log('No confirm handler set for position:', positionModalData.position);
                }
                closePositionModalDirect();
              }}
              position={positionModalData.position}
              tokenInfo={positionModalData.position.tokenInfo}
              isLoading={false}
              userAddress={undefined} // Нужно будет передать адрес пользователя
            />
          )}
          
          {/* Remove Liquidity Modal для Hyperion */}
          {positionModalData.type === 'removeLiquidity' && positionModalData.protocol === 'Hyperion' && (
            <ConfirmRemoveModal
              isOpen={isPositionModalOpen}
              onClose={closePositionModalDirect}
              onConfirm={async () => {
                if (positionConfirmHandler) {
                  try {
                    await positionConfirmHandler();
                  } catch (error) {
                    console.error('Error in position confirm handler:', error);
                  }
                } else {
                  console.log('No confirm handler set for position:', positionModalData.position);
                }
                closePositionModalDirect();
              }}
              isLoading={false}
              position={positionModalData.position}
            />
          )}
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