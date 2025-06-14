import type { Meta, StoryObj } from '@storybook/react';
import { DepositModal } from '@/components/ui/deposit-modal';

const meta: Meta<typeof DepositModal> = {
  title: 'UI/DepositModal',
  component: DepositModal,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof DepositModal>;

export const Demo: Story = {
  args: {
    isOpen: true,
    onClose: () => console.log('Close'),
    onConfirm: (data) => console.log('Confirm', data),
    protocol: {
      name: 'Joule',
      logo: 'https://app.joule.finance/favicon.ico',
      apy: 8.4,
    },
    tokenIn: {
      symbol: 'USDC',
      logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      decimals: 6,
    },
    tokenOut: {
      symbol: 'USDC',
      logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
      decimals: 6,
    },
    balance: BigInt(1000000000), // 1000 USDC
    priceUSD: 1.0,
  },
}; 