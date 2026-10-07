const statusEl = document.getElementById('status')
const activeInfo = document.getElementById('active-info')
const idleInfo = document.getElementById('idle-info')

async function refresh() {
  try {
    const state = await chrome.runtime.sendMessage({ type: 'ACCESSGEN_GET_STATUS' })
    if (state?.isActive) {
      statusEl.textContent = '● Simulation active'
      statusEl.style.color = '#86efac'
      activeInfo.hidden = false
      idleInfo.hidden = true
      document.getElementById('active-url').textContent = state.url || ''
      const list = document.getElementById('active-profiles')
      list.innerHTML = ''
      for (const p of state.activeProfiles || []) {
        const li = document.createElement('li')
        li.textContent = p.name || p.id
        list.appendChild(li)
      }
      await renderRecording(state)
    } else {
      statusEl.textContent = 'Idle'
      statusEl.style.color = ''
      activeInfo.hidden = true
      idleInfo.hidden = false
    }
  } catch {
    statusEl.textContent = 'Could not reach the extension background.'
  }
}

const recordingStatus = document.getElementById('recording-status')
const recordBtn = document.getElementById('record-btn')
const shortcutHint = document.getElementById('shortcut-hint')
let activeTabId = null

async function renderRecording(state) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  activeTabId = tab?.id ?? null
  const onTarget = activeTabId != null && activeTabId === state.targetTabId

  shortcutHint.textContent = state.recordShortcut
    ? `Shortcut: ${state.recordShortcut} (change it at chrome://extensions/shortcuts)`
    : 'No shortcut set. Assign one at chrome://extensions/shortcuts'

  if (state.isRecording) {
    recordingStatus.textContent = 'Recording'
    recordBtn.hidden = true
  } else if (onTarget) {
    recordingStatus.textContent = 'Not recording yet.'
    recordBtn.hidden = false
  } else {
    recordingStatus.textContent = 'Not recording yet. Switch to the simulated tab, then open this again.'
    recordBtn.hidden = true
  }
}

recordBtn.addEventListener('click', async () => {
  recordBtn.disabled = true
  recordingStatus.textContent = 'Starting recording…'
  try {
    const result = await chrome.runtime.sendMessage({
      type: 'ACCESSGEN_START_RECORDING',
      payload: { tabId: activeTabId }
    })
    if (result?.ok) {
      recordingStatus.textContent = 'Recording'
      recordBtn.hidden = true
    } else {
      recordingStatus.textContent = `Could not start recording: ${result?.error || 'unknown error'}`
    }
  } catch {
    // Popup closed mid-await; the background still handles the request.
  } finally {
    recordBtn.disabled = false
  }
})

document.getElementById('stop-btn').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'ACCESSGEN_STOP_SIMULATION' })
    refresh()
  } catch {
    // Popups close as soon as they lose focus (very easy to trigger by
    // clicking this button and then clicking anywhere else), which tears
    // down this whole context mid-await and would otherwise surface as an
    // unhandled "message channel closed" rejection. The stop request still
    // reached the background either way; there's nothing left to update.
  }
})

document.getElementById('open-app').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' })
})

refresh()
