import { BaseProfile } from '../BaseProfile.js'
import { reportFriction } from '../../content-scripts/friction.js'

const VIDEO_EMBED = /youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|wistia|brightcove|jwplayer|dailymotion/i

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
    badge.textContent = 'No captions available. The spoken words cannot be followed.'
    wrapper.appendChild(badge)
    this.elements.push(badge)
    reportFriction({
      kind: 'deaf-no-captions',
      profileId: 'deaf',
      target: video,
      headline: 'A video with no captions',
      detail: 'Whatever is said in it is lost. A Deaf visitor sees moving pictures and nothing else.'
    })
  }

  // Embedded players (YouTube, Vimeo...) cannot be inspected from here, so
  // they are named as something to check, never as missing captions.
  noticeEmbeds() {
    const embeds = Array.from(document.querySelectorAll('iframe[src]')).filter((f) => VIDEO_EMBED.test(f.src))
    if (embeds.length === 0 || this.embedsNoticed) return
    this.embedsNoticed = true
    reportFriction({
      kind: 'deaf-video-embed',
      profileId: 'deaf',
      target: embeds[0],
      headline: `${embeds.length} embedded video${embeds.length === 1 ? '' : 's'}: are captions on by default?`,
      detail: 'If the captions need to be found and switched on inside the player, many Deaf visitors will never get them.'
    })
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
