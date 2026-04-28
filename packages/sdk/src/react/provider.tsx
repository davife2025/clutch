import { useMemo, type ReactNode } from 'react'
import { ClutchClient, type ClutchClientConfig } from '../client/index.js'
import { ClutchContext } from '../hooks/index.js'

interface ClutchProviderProps extends ClutchClientConfig {
  children: ReactNode
}

/**
 * ClutchProvider — wraps your app with a configured ClutchClient.
 *
 * Usage:
 *   <ClutchProvider apiUrl="https://api.clutch.app" token={userToken}>
 *     <App />
 *   </ClutchProvider>
 */
export function ClutchProvider({ children, ...config }: ClutchProviderProps) {
  const client = useMemo(() => new ClutchClient(config), [config.apiUrl, config.token])
  return (
    <ClutchContext.Provider value={client}>
      {children}
    </ClutchContext.Provider>
  )
}
