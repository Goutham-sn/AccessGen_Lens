// Injected into the page's own world (MAIN) at document_start for the
// session's site, and on every page the session goes to: see
// issues/clickRecorder.js.
import { installClickRecorder } from '../issues/clickRecorder.js'

installClickRecorder()
