export function isUserRejectedError(err: any): boolean {
  if (!err) return false;
  const code = (err as any).code;
  const name = ((err as any).name || '').toString().toLowerCase();
  const message = ((err as any).message || '').toString().toLowerCase();
  return (
    code === 4001 ||
    code === 'USER_REJECTED' ||
    name.includes('userrejected') ||
    message.includes('user rejected') ||
    message.includes('rejected by user') ||
    message.includes('request rejected') ||
    message.includes('rejected request') ||
    message.includes('user cancel') ||
    message.includes('cancelled')
  );
}


