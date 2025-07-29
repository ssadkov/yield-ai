import tokenList from '@/lib/data/tokenList.json';
import { Token } from '../types/panora';

interface TokenListData {
  data: {
    data: Token[];
    status: number;
  };
}

export const getTokenList = (chainId: number = 1): Token[] => {
  return (tokenList as TokenListData).data.data.filter((token: Token) => token.chainId === chainId);
}; 