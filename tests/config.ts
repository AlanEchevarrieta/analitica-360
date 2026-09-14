export const TEST_USER = {
  email: process.env.TEST_EMAIL || '',
  password: process.env.TEST_PASSWORD || '',
}

export const TEST_ACACIA = {
  email: process.env.TEST_ACACIA_EMAIL || '',
  password: process.env.TEST_ACACIA_PASSWORD || '',
}

export function hayCredencialesAdmin() {
  return Boolean(TEST_USER.email && TEST_USER.password)
}
