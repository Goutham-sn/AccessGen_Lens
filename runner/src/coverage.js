// What we could and could not look at on a page, measured in the hidden
// measure pass (no overlay exists there, so our own shadow root is never
// counted). Shown in the report as "What we could and could not look at".
export async function measureCoverage(page) {
  const result = { elementsRead: 0, closedShadowRoots: 0, crossOriginFramesSkipped: 0 }

  const cdp = await page.context().newCDPSession(page)
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true })
    const stack = [root]
    while (stack.length) {
      const node = stack.pop()
      if (node.nodeType === 1) result.elementsRead++
      for (const sr of node.shadowRoots || []) {
        if (sr.shadowRootType === 'closed') result.closedShadowRoots++
        stack.push(sr)
      }
      if (node.contentDocument) stack.push(node.contentDocument)
      for (const child of node.children || []) stack.push(child)
    }
  } catch {
    // A page that changes mid-read: keep the counts gathered so far.
  } finally {
    await cdp.detach().catch(() => {})
  }

  let mainOrigin = null
  try { mainOrigin = new URL(page.url()).origin } catch { /* leave null */ }
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    const url = frame.url()
    if (!url || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) continue
    try {
      if (new URL(url).origin !== mainOrigin) result.crossOriginFramesSkipped++
    } catch {
      result.crossOriginFramesSkipped++
    }
  }
  return result
}
