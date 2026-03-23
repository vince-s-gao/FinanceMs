export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "admin123",
]);

export function getPasswordPolicyError(password: string): string | null {
  const value = String(password || "");

  if (value.length < PASSWORD_MIN_LENGTH) {
    return `密码长度至少为 ${PASSWORD_MIN_LENGTH} 位`;
  }

  if (value.length > PASSWORD_MAX_LENGTH) {
    return `密码长度不能超过 ${PASSWORD_MAX_LENGTH} 位`;
  }

  if (COMMON_WEAK_PASSWORDS.has(value.toLowerCase())) {
    return "密码过于常见，请更换更安全的密码";
  }

  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(value);
  if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
    return "密码必须包含大小写字母、数字和特殊字符";
  }

  if (/\s/.test(value)) {
    return "密码不能包含空白字符";
  }

  return null;
}

export function assertPasswordPolicy(
  password: string,
  createError: (message: string) => Error,
): void {
  const message = getPasswordPolicyError(password);
  if (message) {
    throw createError(message);
  }
}
