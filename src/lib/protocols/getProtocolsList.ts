import protocolsList from '../data/protocolsList.json';

export interface Protocol {
  name: string;
  category: string;
  url: string;
  logoUrl: string;
  description: string;
  depositType: 'native' | 'external' | 'none';
  depositUrl?: string;
  isDepositEnabled: boolean;
}

export function getProtocolsList(): Protocol[] {
  return protocolsList as Protocol[];
}

export function getProtocolByName(name: string): Protocol | undefined {
  return (protocolsList as Protocol[]).find(protocol => protocol.name === name);
} 