import { BaseProfile } from '../BaseProfile.js'

// Silence, immediately and permanently, then make visible what that
// silence costs: videos without captions get flagged as blockers.
export class Deaf extends BaseProfile {
  init() {
    this.mutedByUs = new Set()

    document.querySelectorAll('audio, video').forEach((el) => this.mute(el))

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') this.mute(node)
          if (node.querySelectorAll) {
            node.querySelectorAll('audio, video').forEach((el) => this.mute(el))
          }
        }
      }
    })
    this.addObserver(observer, document.body, { childList: true, subtree: true })

    // Keep media muted even if the page tries to unmute.
    this.addInterval(() => {
      document.querySelectorAll('audio, video').forEach((el) => {
        if (!el.muted) el.muted = true
      })
    }, 1000)

    this.injectStyle(`
      .accessgen-no-captions {
        position: absolute; top: 8px; left: 8px;
        background: rgba(190, 18, 60, 0.95); color: #fff;
        padding: 6px 12px; border-radius: 8px;
        font: 600 13px/1.3 -apple-system, sans-serif;
        z-index: 2147483630; pointer-events: none;
      }
    `, 'accessgen-deaf-css')
  }

  mute(el) {
    el.muted = true
    this.mutedByUs.add(el)
    if (el.tagName === 'VIDEO') this.flagIfUncaptioned(el)
  }

  flagIfUncaptioned(video) {
    if (video.dataset.accessgenFlagged) return
    const hasCaptions = Array.from(video.querySelectorAll('track'))
      .some((t) => ['captions', 'subtitles'].includes(t.kind))
    if (hasCaptions) return

    video.dataset.accessgenFlagged = 'true'
    const wrapper = video.parentElement
    if (!wrapper) return
    if (getComputedStyle(wrapper).position === 'static') {
      wrapper.style.position = 'relative'
    }
    const badge = document.createElement('div')
    badge.className = 'accessgen-no-captions'
    badge.dataset.accessgen = 'true'
    badge.textContent = 'No captions available. This video is silence.'
    wrapper.appendChild(badge)
    this.elements.push(badge)
  }

  destroy() {
    for (const el of this.mutedByUs) {
      if (el.isConnected) el.muted = false
    }
    document.querySelectorAll('[data-accessgen-flagged]')
      .forEach((el) => delete el.dataset.accessgenFlagged)
    super.destroy()
  }
}
