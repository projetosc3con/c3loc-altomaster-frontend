export function getApiErrorMessage(err: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  const status = (err as any)?.response?.status;
  const data = (err as any)?.response?.data;
  const rawMsg = String(data?.asaas?.errors?.[0]?.description || data?.error || (err as any)?.message || '');

  // Instabilidades conhecidas da API do Banco do Brasil (503 ou 403 falso de AppKey)
  if (
    status === 503 ||
    status === 403 ||
    rawMsg.includes('503') ||
    rawMsg.includes('403') ||
    rawMsg.includes('serviço subjacente') ||
    rawMsg.includes('chave de aplicacao') ||
    rawMsg.includes('AppKey')
  ) {
    return 'Serviço inacessível no momento. Tente novamente mais tarde.';
  }

  return rawMsg || fallback;
}
