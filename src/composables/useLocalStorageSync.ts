interface PersistedEnvelope<T> {
  version: number
  data: T
}

export const useLocalStorageSync = <T>(key: string, seedValue: T, version = 1) => {
  const read = (): T => {
    if (typeof window === 'undefined') {
      return seedValue
    }

    const raw = window.localStorage.getItem(key)

    if (!raw) {
      return seedValue
    }

    try {
      const parsed = JSON.parse(raw) as PersistedEnvelope<T> | T

      if (typeof parsed === 'object' && parsed !== null && 'data' in parsed) {
        return parsed.version === version ? parsed.data : seedValue
      }

      return parsed as T
    } catch {
      return seedValue
    }
  }

  const write = (value: T): void => {
    if (typeof window === 'undefined') {
      return
    }

    const payload: PersistedEnvelope<T> = {
      version,
      data: value,
    }

    window.localStorage.setItem(key, JSON.stringify(payload))
  }

  const clear = (): void => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.removeItem(key)
  }

  return {
    read,
    write,
    clear,
  }
}
