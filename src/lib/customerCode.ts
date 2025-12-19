/**
 * Generates a customer code from a name or business name
 * - Removes spaces and special characters
 * - Converts to uppercase
 * - Truncates to 10 characters max
 */
export function generateCustomerCode(name: string, businessName?: string): string {
  const source = businessName?.trim() || name?.trim() || '';
  
  // Remove spaces and special characters, keep only alphanumeric
  const cleaned = source
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  
  // Truncate to 10 characters
  return cleaned.substring(0, 10);
}

/**
 * Generates a unique customer code by appending a number if needed
 * @param baseCode - The base code to make unique
 * @param existingCodes - Array of existing codes for this user
 * @returns A unique code (max 10 chars)
 */
export function makeCodeUnique(baseCode: string, existingCodes: string[]): string {
  if (!existingCodes.includes(baseCode)) {
    return baseCode;
  }
  
  // Try appending numbers
  for (let i = 2; i <= 99; i++) {
    const suffix = i.toString();
    // Shorten base to fit suffix within 10 chars
    const maxBaseLength = 10 - suffix.length;
    const shortened = baseCode.substring(0, maxBaseLength);
    const candidate = shortened + suffix;
    
    if (!existingCodes.includes(candidate)) {
      return candidate;
    }
  }
  
  // Fallback: return base with random suffix
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return baseCode.substring(0, 7) + randomSuffix;
}

/**
 * Sanitizes user input for customer code
 * - Uppercase, no spaces, alphanumeric only
 * - Max 10 characters
 */
export function sanitizeCustomerCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 10);
}

