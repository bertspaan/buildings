type UmamiValue = string | number | boolean | null
type UmamiPayload = Record<string, UmamiValue>

type UmamiTracker = {
  track?: (eventName: string, payload?: UmamiPayload) => void
}

export function trackEvent(eventName: string, payload?: UmamiPayload) {
  if (typeof window === 'undefined') {
    return
  }

  const tracker = (window as Window & { umami?: UmamiTracker }).umami

  tracker?.track?.(eventName, payload)
}
