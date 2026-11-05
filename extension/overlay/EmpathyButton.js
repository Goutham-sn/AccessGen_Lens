export const EMPATHY_LABELS = [
  'Got completely stuck here',
  'Could not find this',
  'Would have given up',
  'This took too long',
  'This makes no sense',
  'I felt excluded'
]

// Wires the "I felt this" button and its quick-select menu inside the panel.
// Each choice can carry a short note in the tester's own words.
export class EmpathyButtonView {
  constructor(shadowRoot, onSelect) {
    this.menu = shadowRoot.querySelector('.empathy-menu')
    this.toast = shadowRoot.querySelector('.toast')
    this.button = shadowRoot.querySelector('.empathy-btn')

    this.button.addEventListener('click', () => {
      const open = this.menu.classList.toggle('open')
      this.button.setAttribute('aria-expanded', String(open))
      if (open) this.note.focus()
    })

    this.note = document.createElement('input')
    this.note.type = 'text'
    this.note.className = 'note-input'
    this.note.maxLength = 300
    this.note.placeholder = 'What happened? (optional)'
    this.note.setAttribute('aria-label', 'What happened, in your own words (optional)')
    // Typing a note must reach the input even under profiles that swallow
    // keys for the page (Switch Access blocks every key but Space).
    this.note.addEventListener('keydown', (e) => e.stopPropagation())
    this.menu.appendChild(this.note)

    for (const label of EMPATHY_LABELS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = label
      btn.addEventListener('click', () => {
        const note = this.note.value.trim() || null
        this.note.value = ''
        this.menu.classList.remove('open')
        this.button.setAttribute('aria-expanded', 'false')
        onSelect({ label, note })
      })
      this.menu.appendChild(btn)
    }
  }

  confirm(label) {
    this.toast.textContent = `Logged: "${label}"`
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => { this.toast.textContent = '' }, 3000)
  }
}
