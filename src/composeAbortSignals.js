export function composeAbortSignals(callerSignal, timeoutSignal) {
  if (!callerSignal) return { signal: timeoutSignal, cleanup: () => {} }
  if (callerSignal.aborted) return { signal: callerSignal, cleanup: () => {} }

  const controller = new AbortController()
  const abortFrom = source => {
    if (!controller.signal.aborted) controller.abort(source?.reason)
  }

  callerSignal.addEventListener('abort', abortFrom, { once: true })
  timeoutSignal.addEventListener('abort', abortFrom, { once: true })

  return {
    signal: controller.signal,
    cleanup: () => {
      callerSignal.removeEventListener('abort', abortFrom)
      timeoutSignal.removeEventListener('abort', abortFrom)
    },
  }
}
