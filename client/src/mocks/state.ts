export const MOCK_SESSION_KEY = 'spd.mock.session'

export function hasMockSession(): boolean {
  try {
    return sessionStorage.getItem(MOCK_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function setMockSession(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(MOCK_SESSION_KEY, '1')
    else sessionStorage.removeItem(MOCK_SESSION_KEY)
  } catch {
    return
  }
}

export function clearMockSession(): void {
  setMockSession(false)
}
