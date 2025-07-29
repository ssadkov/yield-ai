import React from 'react';
import { toast } from './use-toast';

interface TransactionToastProps {
  hash: string;
  title?: string;
}

export const showTransactionSuccessToast = ({ hash, title = "Deposit successful!" }: TransactionToastProps) => {
  toast({
    title,
    description: (
      <div>
        Transaction hash:{" "}
        <a
          href={`https://explorer.aptoslabs.com/txn/${hash}?network=mainnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          {hash.slice(0, 6)}...{hash.slice(-4)}
        </a>
      </div>
    ),
  });
}; 