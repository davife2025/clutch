/**
 * Clutch Extension — content script.
 *
 * Runs in every page (MAIN world so it can access window).
 * Injects Clutch as a Wallet Standard provider so dApps see it.
 * Bridges signing requests between the page and the background service worker.
 */

// ── Inject Wallet Standard ────────────────────────────────────────────────────

(function injectClutchWallet() {
  // Don't inject twice
  if ((window as any).__clutchInjected) return
  ;(window as any).__clutchInjected = true

  const origin = window.location.origin

  // Minimal Wallet Standard implementation
  const clutchWallet = {
    version:   '1.0.0' as const,
    name:      'Clutch',
    icon:      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjMjJjNTVlIi8+PHRleHQgeD0iOCIgeT0iMjIiIGZvbnQtc2l6ZT0iMTYiPvCfq5k8L3RleHQ+PC9zdmc+',
    chains:    ['solana:mainnet', 'solana:devnet'],
    features:  {
      'standard:connect': {
        version: '1.0.0',
        connect: async (input?: { silent?: boolean }) => {
          if (input?.silent) {
            // Try to return existing accounts without showing popup
            const accounts = await getAccounts()
            return { accounts }
          }
          return requestConnect()
        },
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: async () => { /* nothing to do */ },
      },
      'standard:events': {
        version: '1.0.0',
        on: (event: string, listener: (...args: any[]) => void) => {
          window.addEventListener(`clutch:${event}`, (e: any) => listener(e.detail))
          return () => window.removeEventListener(`clutch:${event}`, listener as any)
        },
      },
      'solana:signTransaction': {
        version: '1.0.0',
        signTransaction: async (...inputs: any[]) => {
          return requestSignTransaction(inputs)
        },
      },
      'solana:signAllTransactions': {
        version: '1.0.0',
        signAllTransactions: async (inputs: any[]) => {
          return Promise.all(inputs.map(tx => requestSignTransaction([tx])))
        },
      },
      'solana:signMessage': {
        version: '1.0.0',
        signMessage: async (input: { message: Uint8Array; account: any }) => {
          return requestSignMessage(input)
        },
      },
      'solana:signAndSendTransaction': {
        version: '1.0.0',
        signAndSendTransaction: async (...inputs: any[]) => {
          return requestSignTransaction(inputs)
        },
      },
    },
    accounts: [] as any[],
  }

  // ── Wallet Standard event ─────────────────────────────────────────────────

  const registerEvent = new CustomEvent('wallet-standard:register-wallet', {
    detail: {
      register: (registerWallet: (wallet: any) => void) => {
        registerWallet(clutchWallet)
      },
    },
    bubbles: false,
    cancelable: false,
    composed: false,
  })
  window.dispatchEvent(registerEvent)

  // ── Request helpers ───────────────────────────────────────────────────────

  async function getAccounts(): Promise<any[]> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_ACCOUNTS' }, (res) => {
        const accounts = (res?.accounts ?? []).map((address: string) => ({
          address,
          publicKey: new Uint8Array(32),
          chains:    ['solana:mainnet'],
          features:  ['solana:signTransaction', 'solana:signMessage'],
        }))
        clutchWallet.accounts = accounts
        resolve(accounts)
      })
    })
  }

  async function requestConnect(): Promise<{ accounts: any[] }> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID()

      // Listen for response
      const handler = (msg: any) => {
        if (msg.type !== 'CONNECT_RESPONSE') return
        cleanup()
        if (!msg.approved) { reject(new Error('User rejected connection')); return }
        const accounts = (msg.result?.accounts ?? []).map((address: string) => ({
          address,
          publicKey: new Uint8Array(32),
          chains:    ['solana:mainnet'],
          features:  ['solana:signTransaction', 'solana:signMessage'],
        }))
        clutchWallet.accounts = accounts
        resolve({ accounts })
      }

      chrome.runtime.onMessage.addListener(handler)
      const cleanup = () => chrome.runtime.onMessage.removeListener(handler)

      chrome.runtime.sendMessage({
        type: 'CONNECT_REQUEST',
        payload: { origin, name: document.title || origin },
      })

      setTimeout(() => { cleanup(); reject(new Error('Connection request timed out')) }, 120_000)
    })
  }

  async function requestSignTransaction(inputs: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID()

      const handler = (msg: any) => {
        if (msg.requestId !== requestId) return
        cleanup()
        if (!msg.approved) { reject(new Error('User rejected transaction')); return }
        resolve(msg.result ?? inputs)
      }

      chrome.runtime.onMessage.addListener(handler)
      const cleanup = () => chrome.runtime.onMessage.removeListener(handler)

      chrome.runtime.sendMessage({
        type:    'SIGN_TX_REQUEST',
        requestId,
        payload: { transactions: inputs.map(i => btoa(String.fromCharCode(...(i.transaction ?? [])))), origin },
      })

      setTimeout(() => { cleanup(); reject(new Error('Sign request timed out')) }, 120_000)
    })
  }

  async function requestSignMessage(input: { message: Uint8Array }): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID()

      const handler = (msg: any) => {
        if (msg.requestId !== requestId) return
        cleanup()
        if (!msg.approved) { reject(new Error('User rejected sign')); return }
        resolve(msg.result)
      }

      chrome.runtime.onMessage.addListener(handler)
      const cleanup = () => chrome.runtime.onMessage.removeListener(handler)

      chrome.runtime.sendMessage({
        type:    'SIGN_MSG_REQUEST',
        requestId,
        payload: {
          message:   btoa(String.fromCharCode(...input.message)),
          origin,
        },
      })

      setTimeout(() => { cleanup(); reject(new Error('Sign request timed out')) }, 120_000)
    })
  }
})()
