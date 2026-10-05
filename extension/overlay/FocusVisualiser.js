// Canvas overlay that draws the tab-order path: numbered circles on every
// element that has received focus, connected by dashed lines.
export class FocusOrderVisualiser {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.setAttribute('aria-hidden', 'true')
    this.canvas.dataset.accessgen = 'true'
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none; z-index: 2147483646;
    `
    this.ctx = this.canvas.getContext('2d')
    this.focusedElements = []
    this.currentIndex = -1

    this.resize = this.resize.bind(this)
    this.redraw = this.redraw.bind(this)
  }

  mount() {
    document.documentElement.appendChild(this.canvas)
    this.resize()
    window.addEventListener('resize', this.resize)
    window.addEventListener('scroll', this.redraw, { passive: true, capture: true })
  }

  unmount() {
    window.removeEventListener('resize', this.resize)
    window.removeEventListener('scroll', this.redraw, { capture: true })
    this.canvas.remove()
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.redraw()
  }

  addElement(element, index) {
    this.focusedElements.push({
      index,
      element,
      label: element.getAttribute('aria-label')
        || element.textContent?.trim().slice(0, 20)
        || element.tagName
    })
    // Keep the trail readable — show the last 40 stops.
    if (this.focusedElements.length > 40) this.focusedElements.shift()
    this.redraw()
  }

  setCurrentIndex(index) {
    this.currentIndex = index
    this.redraw()
  }

  reset() {
    this.focusedElements = []
    this.currentIndex = -1
    this.redraw()
  }

  redraw() {
    const { ctx } = this
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Re-derive positions each draw so scrolling stays accurate.
    const points = this.focusedElements
      .map((el) => {
        if (!el.element.isConnected) return null
        const rect = el.element.getBoundingClientRect()
        return { ...el, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      })
      .filter(Boolean)

    ctx.strokeStyle = 'rgba(0, 102, 255, 0.3)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 5])
    points.forEach((el, i) => {
      if (i === 0) return
      const prev = points[i - 1]
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(el.x, el.y)
      ctx.stroke()
    })
    ctx.setLineDash([])

    points.forEach((el) => {
      const isCurrent = el.index === this.currentIndex
      ctx.fillStyle = isCurrent ? '#0066FF' : 'rgba(0,102,255,0.6)'
      ctx.beginPath()
      ctx.arc(el.x, el.y, isCurrent ? 14 : 10, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = 'white'
      ctx.font = `${isCurrent ? 'bold ' : ''}11px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(el.index + 1), el.x, el.y)
    })
  }
}
