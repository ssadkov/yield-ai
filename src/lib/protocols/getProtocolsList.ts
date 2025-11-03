import protocolsList from '../data/protocolsList.json';
import { ProtocolKey } from '../transactions/types';

export interface Protocol {
  name: string;
  key: ProtocolKey;
  category: string;
  url: string;
  logoUrl: string;
  description: string;
  depositType: 'native' | 'external' | 'none';
  depositUrl?: string;
  isDepositEnabled: boolean;
  managedType: 'native' | 'external';
  socialMedia?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    github?: string;
  };
  airdrop?: string;
  airdropInfo?: {
    title: string;
    description: string;
    links: Array<{
      text: string;
      url: string;
      type: 'twitter' | 'app' | 'docs' | 'website';
    }>;
    requirements: string[];
    additionalInfo?: string;
  };
  panoraConfig?: {
    integratorFeeAddress: string;
    integratorFeePercentage: string;
    apiKey: string;
    rpcUrl: string;
  };
  contractAddresses?: string[];
}

export function getProtocolsList(): Protocol[] {
  return protocolsList as Protocol[];
}

export function getProtocolByName(name: string): Protocol | undefined {
  return (protocolsList as Protocol[]).find(protocol => protocol.name === name);
} 