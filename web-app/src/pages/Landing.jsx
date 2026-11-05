import { Link } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { LiveLens } from '../components/landing/LiveLens.jsx'

// "Try the lens": the simulation on a small made-up shop, right here, before
// pointing it at a real page.
export default function Landing() {
  return (
    <PageWrapper wide eyebrow="Try the lens" title="One small task, seven different people">
      <p className="-mt-3 mb-8 max-w-3xl text-ink-700">
        The shop below is made up, and built with mistakes real shops make. Put a pair of shoes that is in
        stock in the basket as yourself, then do it again as Ravi, Meera or David. The clock runs from the
        moment you move into the shop. Nothing is recorded.{' '}
        <Link to="/start" className="text-brand-700 underline underline-offset-2">Use it on your own page</Link>.
      </p>
      <LiveLens />
    </PageWrapper>
  )
}
