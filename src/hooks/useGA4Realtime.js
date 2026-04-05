import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchGA4Realtime } from '../api/ga4'

const FIVE_MINUTES = 5 * 60 * 1000

export function useGA4Realtime() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchGA4Realtime()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, FIVE_MINUTES)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  return { data, loading, error, refresh }
}
