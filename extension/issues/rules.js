// What each axe-core rule means for a person, in plain words, and whose
// experience it breaks. Shared by the extension (Manual sessions) and the
// runner (Automated runs), so both say the same thing about the same issue.
//
// Every axe rule is reported, written here or not: a rule missing from this
// list falls back to axe's own help text and its tags (see describeRule).
// Profiles are the ids used across the app.

const SR = 'screen-reader'
const KB = 'keyboard-only'
const LV = 'low-vision'
const CB = 'deuteranopia'
const TR = 'tremor'
const COG = 'dyslexia'
const DEAF = 'deaf'
const SW = 'switch-access'

export const RULES = {
  'color-contrast': { title: 'Text too faint to read', why: 'The text and its background are too close in colour. With low vision, cataracts or in sunlight it disappears.', who: [LV, CB, 'cataracts'] },
  'color-contrast-enhanced': { title: 'Text hard to read for low vision', why: 'Readable for most, but not for someone with low vision.', who: [LV, 'cataracts'] },
  'link-in-text-block': { title: 'Links that look like plain text', why: 'The link is told apart from the text around it by colour alone.', who: [CB, LV] },
  'image-alt': { title: 'Pictures with no description', why: 'A screen reader skips them or reads out a file name. Whatever they show is lost.', who: [SR] },
  'input-image-alt': { title: 'Image buttons with no name', why: 'A screen reader announces just "button".', who: [SR] },
  'role-img-alt': { title: 'Graphics with no description', why: 'Marked as an image, but nothing says what it shows.', who: [SR] },
  'svg-img-alt': { title: 'Icons with no description', why: 'Marked as an image, but nothing says what it shows.', who: [SR] },
  'area-alt': { title: 'Image map areas with no name', why: 'Each clickable area is announced with no name.', who: [SR] },
  'object-alt': { title: 'Embedded content with no description', why: 'A screen reader cannot say what it is.', who: [SR] },
  'button-name': { title: 'Buttons with no name', why: 'A screen reader says only "button". Nobody can tell what it does without pressing it.', who: [SR, KB, SW] },
  'link-name': { title: 'Links with no name', why: 'A screen reader says only "link", with no idea where it goes.', who: [SR, KB] },
  label: { title: 'Form fields with no label', why: 'A screen reader announces "edit text" and nothing else. Nobody knows what to type.', who: [SR] },
  'label-title-only': { title: 'Fields named only by a tooltip', why: 'The name appears only on hover, so most people never see it.', who: [SR, KB] },
  'select-name': { title: 'Drop-downs with no label', why: 'Announced as "combo box", with no idea what is being chosen.', who: [SR] },
  'input-button-name': { title: 'Buttons with no text', why: 'Announced as "button", with nothing to say what it does.', who: [SR] },
  'aria-input-field-name': { title: 'Custom fields with no name', why: 'A screen reader cannot say what goes in it.', who: [SR] },
  'aria-toggle-field-name': { title: 'Switches and check boxes with no name', why: 'Announced as "check box" or "switch" with no idea what it turns on.', who: [SR] },
  'aria-command-name': { title: 'Custom buttons and links with no name', why: 'Announced only by their role.', who: [SR] },
  'aria-meter-name': { title: 'Meters with no name', why: 'A value is read out with no idea what it measures.', who: [SR] },
  'aria-progressbar-name': { title: 'Progress bars with no name', why: 'Progress is read out with no idea what it is for.', who: [SR] },
  'aria-tooltip-name': { title: 'Tooltips with no text', why: 'The help it should give is silent.', who: [SR] },
  'aria-dialog-name': { title: 'Dialogs with no name', why: 'A dialog opens and nobody is told what it is about.', who: [SR] },
  'frame-title': { title: 'Embedded frames with no title', why: 'A screen reader announces "frame" with no idea what is inside.', who: [SR] },
  'document-title': { title: 'The page has no title', why: 'The first thing a screen reader says, and the name of the tab. Without it, nobody knows where they are.', who: [SR, COG] },
  'html-has-lang': { title: 'The page does not say its language', why: 'A screen reader may read it with the wrong voice and accent, making it hard to understand.', who: [SR] },
  'html-lang-valid': { title: 'The page names a language that does not exist', why: 'A screen reader may read it with the wrong voice.', who: [SR] },
  'valid-lang': { title: 'Text marked with a wrong language', why: 'A screen reader may switch to the wrong voice there.', who: [SR] },
  'page-has-heading-one': { title: 'No main heading', why: 'Screen reader users jump to the main heading first. There is nothing to jump to.', who: [SR, COG] },
  'heading-order': { title: 'Headings skip levels', why: 'The outline of the page jumps around, so moving by headings feels broken.', who: [SR] },
  'empty-heading': { title: 'Empty headings', why: 'A screen reader announces a heading with nothing in it.', who: [SR] },
  'landmark-one-main': { title: 'No main area marked', why: 'Screen reader users cannot jump straight to the content.', who: [SR, KB] },
  region: { title: 'Content outside any page region', why: 'Moving by regions skips this content entirely.', who: [SR] },
  'landmark-unique': { title: 'Page regions with the same name', why: 'Two regions sound identical, so it is unclear which is which.', who: [SR] },
  'landmark-no-duplicate-main': { title: 'More than one main area', why: 'Jumping to the main content lands in the wrong place.', who: [SR] },
  'landmark-banner-is-top-level': { title: 'Page regions nested wrongly', why: 'The page structure a screen reader describes is confused.', who: [SR] },
  'landmark-contentinfo-is-top-level': { title: 'Page regions nested wrongly', why: 'The page structure a screen reader describes is confused.', who: [SR] },
  'landmark-main-is-top-level': { title: 'Page regions nested wrongly', why: 'The page structure a screen reader describes is confused.', who: [SR] },
  'landmark-complementary-is-top-level': { title: 'Page regions nested wrongly', why: 'The page structure a screen reader describes is confused.', who: [SR] },
  bypass: { title: 'No way to skip the menus', why: 'Every visit starts by stepping through all of the navigation, one key press at a time.', who: [KB, SR, SW] },
  'skip-link': { title: 'A skip link that goes nowhere', why: 'The link to skip to the content points at something that is not there.', who: [KB, SR] },
  tabindex: { title: 'Tab order forced out of order', why: 'Focus jumps around the page instead of following it.', who: [KB, SR, SW] },
  'focus-order-semantics': { title: 'Focusable things with no role', why: 'Tab stops on it, but a screen reader cannot say what it is.', who: [SR, KB] },
  'scrollable-region-focusable': { title: 'Scrolling areas the keyboard cannot scroll', why: 'Content inside it cannot be reached without a mouse.', who: [KB, SW] },
  'nested-interactive': { title: 'Controls inside controls', why: 'A button inside a link (or similar) is unreachable or announced wrongly.', who: [SR, KB] },
  'frame-focusable-content': { title: 'Frames the keyboard cannot enter', why: 'The content inside cannot be reached without a mouse.', who: [KB] },
  'server-side-image-map': { title: 'Image maps only a mouse can use', why: 'Clicking a spot on a picture cannot be done from a keyboard.', who: [KB, SR] },
  'aria-hidden-focus': { title: 'Hidden things Tab still stops on', why: 'Focus lands on something a screen reader is told is not there: silence.', who: [SR, KB] },
  'aria-hidden-body': { title: 'The whole page is hidden from screen readers', why: 'A screen reader hears nothing at all.', who: [SR] },
  'aria-allowed-attr': { title: 'Controls that describe themselves wrongly', why: 'A screen reader may announce the wrong state or nothing.', who: [SR] },
  'aria-required-attr': { title: 'Controls missing their state', why: 'A screen reader cannot say whether it is on, off, open or closed.', who: [SR] },
  'aria-required-children': { title: 'Lists and menus missing their items', why: 'A screen reader describes a broken structure.', who: [SR] },
  'aria-required-parent': { title: 'Items outside their list or menu', why: 'A screen reader cannot say which list they belong to.', who: [SR] },
  'aria-roles': { title: 'Made-up roles', why: 'A screen reader does not know what these elements are.', who: [SR] },
  'aria-valid-attr': { title: 'Misspelled accessibility attributes', why: 'They do nothing, so the information is lost.', who: [SR] },
  'aria-valid-attr-value': { title: 'Accessibility attributes with wrong values', why: 'A screen reader may announce the wrong thing.', who: [SR] },
  'aria-prohibited-attr': { title: 'Names on things that cannot have one', why: 'The name is ignored, so a screen reader says nothing.', who: [SR] },
  'aria-deprecated-role': { title: 'Out-of-date roles', why: 'Some screen readers no longer understand them.', who: [SR] },
  'aria-braille-equivalent': { title: 'Braille text with no spoken text', why: 'Braille users and speech users get different information.', who: [SR] },
  'aria-text': { title: 'Controls flattened into text', why: 'Buttons or links inside it can no longer be used with a screen reader.', who: [SR, KB] },
  'presentation-role-conflict': { title: 'Decoration that is still focusable', why: 'Marked as decoration, but Tab still stops on it.', who: [SR, KB] },
  list: { title: 'Lists built wrongly', why: 'A screen reader cannot say how many items there are.', who: [SR] },
  listitem: { title: 'List items outside a list', why: 'A screen reader cannot group them.', who: [SR] },
  'definition-list': { title: 'Definition lists built wrongly', why: 'Terms and their meanings are not read together.', who: [SR] },
  dlitem: { title: 'Definitions outside their list', why: 'Terms and their meanings are not read together.', who: [SR] },
  'td-headers-attr': { title: 'Table cells pointing at missing headers', why: 'A screen reader cannot say which column a value is in.', who: [SR] },
  'th-has-data-cells': { title: 'Table headers with nothing under them', why: 'The table is read out in a confusing way.', who: [SR] },
  'table-duplicate-name': { title: 'Tables with a repeated caption', why: 'The same text is read twice.', who: [SR] },
  'duplicate-id-aria': { title: 'Labels pointing at the wrong element', why: 'Two elements share an id, so a label can name the wrong field.', who: [SR] },
  'form-field-multiple-labels': { title: 'Fields with more than one label', why: 'A screen reader may read only one of them, or both, confusingly.', who: [SR] },
  'autocomplete-valid': { title: 'Fields that cannot be filled in automatically', why: 'People who rely on autofill (tremor, memory, dyslexia) must type everything.', who: [TR, COG, SR] },
  'meta-viewport': { title: 'Zoom is switched off', why: 'On a phone, someone with low vision cannot pinch to zoom in.', who: [LV, 'cataracts'] },
  'meta-viewport-large': { title: 'Zoom is limited', why: 'Someone with low vision cannot zoom in far enough.', who: [LV] },
  'meta-refresh': { title: 'The page reloads by itself', why: 'Whatever was being read or typed is lost, without warning.', who: [SR, COG, KB] },
  'meta-refresh-no-exceptions': { title: 'The page reloads by itself', why: 'Whatever was being read or typed is lost, without warning.', who: [SR, COG] },
  blink: { title: 'Blinking text', why: 'Hard to read and very distracting.', who: [COG, LV] },
  marquee: { title: 'Scrolling text', why: 'Hard to read and very distracting.', who: [COG, LV] },
  'video-caption': { title: 'Video with no captions', why: 'Everything said in it is lost to a Deaf viewer.', who: [DEAF] },
  'audio-caption': { title: 'Audio with no transcript', why: 'Everything said in it is lost to a Deaf listener.', who: [DEAF] },
  'no-autoplay-audio': { title: 'Sound that plays by itself', why: 'It drowns out the screen reader and cannot easily be stopped.', who: [SR, COG] },
  'p-as-heading': { title: 'Bold text pretending to be a heading', why: 'It looks like a heading, but a screen reader cannot jump to it.', who: [SR] },
  'target-size': { title: 'Targets too small to hit', why: 'With a tremor, or on a phone, small buttons close together get missed.', who: [TR, SW] },
  'css-orientation-lock': { title: 'The page only works one way up', why: 'Someone with a mounted tablet or phone cannot turn it.', who: [TR, SW] },
  'avoid-inline-spacing': { title: 'Text spacing that cannot be changed', why: 'People with dyslexia who widen letter spacing break the layout.', who: [COG] },
  'identical-links-same-purpose': { title: 'Links with the same name going different places', why: 'Two links sound the same but go to different pages.', who: [SR, COG] },
  'label-content-name-mismatch': { title: 'Visible text and spoken name differ', why: 'Voice control users say what they see, and it does not work.', who: [SR, 'voice-control'] },
  'empty-table-header': { title: 'Table headers with no text', why: 'A screen reader cannot say what a column holds.', who: [SR] },
  'scope-attr-valid': { title: 'Table headers marked wrongly', why: 'Values may be read out under the wrong header.', who: [SR] },
  accesskeys: { title: 'Shortcut keys used twice', why: 'A keyboard shortcut does something unexpected.', who: [KB] },
  'image-redundant-alt': { title: 'Pictures that repeat their caption', why: 'A screen reader reads the same words twice.', who: [SR] },
  'summary-name': { title: 'Expandable sections with no name', why: 'Announced with no idea what opens.', who: [SR] },
  'duplicate-id': { title: 'Repeated ids', why: 'Labels and descriptions can attach to the wrong element.', who: [SR] }
}

const TAG_WHO = [
  ['cat.color', [LV, CB]],
  ['cat.keyboard', [KB, SW]],
  ['cat.text-alternatives', [SR]],
  ['cat.name-role-value', [SR]],
  ['cat.forms', [SR]],
  ['cat.aria', [SR]],
  ['cat.structure', [SR]],
  ['cat.semantics', [SR]],
  ['cat.tables', [SR]],
  ['cat.language', [SR]],
  ['cat.parsing', [SR]],
  ['cat.sensory-and-visual-cues', [LV, COG]],
  ['cat.time-and-media', [DEAF, COG]]
]

// The person-facing description of an axe result (violation or incomplete).
export function describeRule(result) {
  const known = RULES[result.id]
  const who = known?.who || [...new Set(TAG_WHO.filter(([tag]) => (result.tags || []).includes(tag)).flatMap(([, w]) => w))]
  return {
    rule: result.id,
    title: known?.title || result.help || result.id,
    why: known?.why || result.description || '',
    who: who.length ? who : [SR],
    impact: result.impact || 'moderate',
    helpUrl: result.helpUrl || null,
    tags: (result.tags || []).filter((t) => WCAG_TAGS.includes(t))
  }
}

export const IMPACT_RANK = { critical: 0, serious: 1, moderate: 2, minor: 3 }

// Every rule axe runs, in the order people feel them, with the person's
// current conditions first (relevantTo: profile ids).
export function sortIssues(issues, relevantTo = []) {
  const rel = new Set(relevantTo)
  return issues.slice().sort((a, b) => {
    const ra = a.who.some((w) => rel.has(w)) ? 0 : 1
    const rb = b.who.some((w) => rel.has(w)) ? 0 : 1
    if (ra !== rb) return ra - rb
    return (IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9) || b.count - a.count
  })
}

// The options every audit runs with: WCAG 2.0, 2.1 and 2.2, levels A and
// AA only. No AAA, no best practice, no experimental rules.
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']
export const AXE_OPTIONS = {
  resultTypes: ['violations'],
  runOnly: { type: 'tag', values: WCAG_TAGS }
}

// True when an axe result belongs to WCAG A or AA (a second guard, for
// results that come from somewhere other than an AXE_OPTIONS run).
export function isWcagAorAA(result) {
  return (result.tags || []).some((t) => WCAG_TAGS.includes(t))
}

// What axe measured on a node, when it measured something people can see:
// the colours and contrast of text (color-contrast), or a target's size.
export function measuredOf(node) {
  const checks = [...(node.any || []), ...(node.all || []), ...(node.none || [])]
  for (const c of checks) {
    const d = c?.data
    if (d && d.contrastRatio !== undefined) {
      return {
        kind: 'contrast',
        fg: d.fgColor || null,
        bg: d.bgColor || null,
        ratio: Number(d.contrastRatio) || null,
        needs: Number(String(d.expectedContrastRatio || '').replace(/:1$/, '')) || null,
        fontSize: d.fontSize || null,
        fontWeight: d.fontWeight || null
      }
    }
    if (d && d.width !== undefined && d.height !== undefined && /target/.test(c.id || '')) {
      return { kind: 'size', width: Math.round(d.width), height: Math.round(d.height), needs: d.minSize || 24 }
    }
  }
  return node.measured || null
}

// The page's own markup, without anything the simulation added to it
// (the fading of low vision marks elements with data-ag-* and --ag-*).
export function cleanHtml(html) {
  return String(html || '')
    .replace(/\s+data-ag-[\w-]+(="[^"]*")?/g, '')
    .replace(/--ag-[\w-]+:\s*[^;"]*;?\s*/g, '')
    .replace(/\s+style="\s*"/g, '')
}

// One axe result node, kept small: where it is and what it is.
export function nodeSummary(node, rectOf) {
  const target = Array.isArray(node.target) ? node.target.flat().join(' ') : String(node.target || '')
  return {
    selector: target.slice(0, 300),
    html: cleanHtml(node.html).slice(0, 300),
    summary: String(node.failureSummary || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    rect: rectOf ? rectOf(target) : null,
    measured: measuredOf(node)
  }
}
