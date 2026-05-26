// Máscara e validação de telefone brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
export const formatPhoneBR = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length < 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const isValidPhoneBR = (value: string): boolean => {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
};
