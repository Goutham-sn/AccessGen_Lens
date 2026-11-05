import { Navigate, useLocation, useParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { SessionResults } from '../components/results/SessionResults.jsx'

export default function Results() {
  const { id } = useParams()
  return (
    <PageWrapper wide>
      <SessionResults sessionId={id} />
    </PageWrapper>
  )
}

// The old Playback and Report addresses lead to the one results page.
export function ToResults() {
  const { id } = useParams()
  const { search } = useLocation()
  return <Navigate to={`/results/${id}${search}`} replace />
}
