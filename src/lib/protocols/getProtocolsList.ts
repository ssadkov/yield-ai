import protocolsList from '../data/protocolsList.json';

export interface Protocol {
  name: string;
  category: string;
  url: string;
  logoUrl: string;
  description: string;
}

export function getProtocolsList(): Protocol[] {
  return protocolsList;
}

export function getProtocolByName(name: string): Protocol | undefined {
  return protocolsList.find(protocol => protocol.name === name);
} 