import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api.js'
import { requestPrecheck } from '../services/precheckClient.js'

const IDLE = { status: 'idle', url: null, result: null }

// The pre-check for the address in the field. It runs only when asked
// (check(url)), never as a side effect of typing. `state.url` is the address
// the result is for, so the page can tell when the field has moved on.
export function usePrecheck() {
  const [state, setState] = useState(IDLE)
  const current = useRef(0) // which request is the live one; a new one or reset() retires the rest

  const reset = useCallback(() => {
    current.current++
    setState(IDLE)
  }, [])

  const check = useCallback(async (url) => {
    const mine = ++current.current
    setState({ status: 'checking', url, result: null })
    try {
      const result = await requestPrecheck(api, url, { isCurrent: () => current.current === mine })
      if (result && current.current === mine) setState({ status: 'done', url, result })
    } catch (err) {
      if (current.current === mine) setState({ status: 'done', url, result: { ok: false, reason: err.message } })
    }
  }, [])

  useEffect(() => () => { current.current++ }, [])
  return { state, check, reset }
}
