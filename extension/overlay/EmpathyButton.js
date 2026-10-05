export const EMPATHY_LABELS = [
  'Got completely stuck here',
  'Could not find this',
  'Would have given up',
  'This took too long',
  'This makes no sense',
  'I felt excluded'
]

// Wires the "I Felt This" button + quick-select menu inside the panel.
export class EmpathyButtonView {
  constructor(shadowRoot, onSelect) {
    this.menu = shadowRoot.querySelector('.empathy-menu')
    this.toast = shadowRoot.querySelector('.toast')

    shadowRoot.querySelector('.empathy-btn').addEventListener('click', () => {
      this.menu.classList.toggle('open')
    })

    for (const label of EMPATHY_LABELS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = label
      btn.addEventListener('click', () => {
        this.menu.classList.remove('open')
        onSelect(label)
      })
      this.menu.appendChild(btn)
    }
  }

  confirm(label) {
    this.toast.textContent = `✓ Logged: "${label}"`
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => { this.toast.textContent = '' }, 3000)
  }
}
