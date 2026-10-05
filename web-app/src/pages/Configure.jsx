import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { ProfileSelector } from '../components/simulator/ProfileSelector.jsx'
import { ProfileStack } from '../components/simulator/ProfileStack.jsx'
import { PersonaPicker } from '../components/simulator/PersonaPicker.jsx'
import { StartSession } from '../components/simulator/StartSession.jsx'
import { useExtension } from '../hooks/useExtension.js'

export default function Configure() {
  useExtension() // populate extension detection state for StartSession

  return (
    <PageWrapper title="Choose your experience">
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-12">
          <ProfileSelector />
          <PersonaPicker />
        </div>
        <div className="lg:sticky lg:top-6 self-start space-y-4">
          <ProfileStack />
          <StartSession />
        </div>
      </div>
    </PageWrapper>
  )
}
