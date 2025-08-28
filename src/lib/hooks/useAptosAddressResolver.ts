import { useState, useEffect } from 'react';
import { 
  resolveNameFromAddress, 
  resolveAddressFromName, 
  isValidAptosAddress, 
  isPotentialDomainName 
} from '@/lib/utils/aptosNames';

interface UseAptosAddressResolverResult {
  resolvedAddress: string;
  resolvedName: string;
  isLoading: boolean;
  error: string;
}

export function useAptosAddressResolver(input: string): UseAptosAddressResolverResult {
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [resolvedName, setResolvedName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const resolve = async () => {
      setIsLoading(true);
      setError('');
      
      if (!input) {
        setError('No address or domain provided');
        setIsLoading(false);
        return;
      }

      try {
        let finalAddress = input;
        let finalName = '';

        // Если это похоже на домен, разрешаем в адрес
        if (!isValidAptosAddress(input) && isPotentialDomainName(input)) {
          const addressFromName = await resolveAddressFromName(input);
          
          if (!addressFromName) {
            setError(`Domain "${input}" not found or invalid`);
            setIsLoading(false);
            return;
          }
          
          finalAddress = addressFromName;
          
          // Дополнительно получаем primary name для отображения
          const nameFromAddress = await resolveNameFromAddress(finalAddress);
          if (nameFromAddress) {
            finalName = nameFromAddress;
          }
        } 
        // Если это валидный адрес, получаем для него имя
        else if (isValidAptosAddress(input)) {
          finalAddress = input;
          
          const nameFromAddress = await resolveNameFromAddress(finalAddress);
          if (nameFromAddress) {
            finalName = nameFromAddress;
          }
        } 
        // Если невалидный формат
        else {
          setError('Invalid Aptos address or domain format');
          setIsLoading(false);
          return;
        }

        setResolvedAddress(finalAddress);
        setResolvedName(finalName);

      } catch (err) {
        setError('Error resolving address or domain');
        console.error('Resolution error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    resolve();
  }, [input]);

  return { resolvedAddress, resolvedName, isLoading, error };
}