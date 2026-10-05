import { useEffect } from 'react'
import { useExtensionStore } from '../store/extensionStore.js'

export function useExtension() {
  const { installed, status, check } = useExtensionStore()

  useEffect(() => {
    check()
  }, [check])

  return { installed, status, recheck: check }
}
