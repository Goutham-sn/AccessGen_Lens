// Every threshold and timing the runner uses, with the reason for it in
// plain words. The report shows these reasons as footnotes, so they are
// written for the people reading it.
export const MEASURING_STICK = {
  evidence: {
    holdMs: {
      value: 1200,
      reason: 'Each moment stays on screen for about a second, long enough to read the caption without slowing the video down.'
    },
    maxHolds: {
      value: 8,
      reason: 'Only the first eight moments pause the video. Later ones are kept as pictures, so a long page still makes a short video.'
    },
    closeupPaddingPx: {
      value: 40,
      reason: 'The close-up includes a little of what surrounds the element, so you can see where it sits on the page.'
    },
    largeElementShare: {
      value: 0.5,
      reason: 'When an element covers more than half the screen, the ring is drawn inside the screen edge so it stays visible.'
    },
    maxExamples: {
      value: 3,
      reason: 'When the same thing happens many times, three examples are enough to recognise the pattern.'
    }
  },
  keyboard: {
    nearbyPx: {
      value: 24,
      reason: 'A sign of focus sits on the element or right next to it. Looking 24 px around it takes in an outline or a glow, and stays close enough that a change there belongs to it.'
    },
    settleCapMs: {
      value: 1000,
      reason: 'Before measuring we wait for scrolling and short animations to finish, for at most a second, so a slow transition is not missed and a page that never stops moving does not hold up the walk.'
    },
    caretGapMs: {
      value: 530,
      reason: 'A text cursor blinks about twice a second. Two pictures taken just over half a second apart always catch it showing at least once.'
    },
    cornerInsetPx: {
      value: 4,
      reason: 'The corner points are taken 4 px inside the element, so a rounded corner or a thin border does not count as something on top.'
    },
    longWayStops: {
      value: 10,
      reason: 'We describe the way to the content once ten or more presses come before it, not counting the cookie notice. Fewer presses than that are common and quick.'
    },
    maxStopNames: {
      value: 10,
      reason: 'The first ten places Tab stops on are enough to show what comes before the content.'
    },
    trapRounds: {
      value: 3,
      reason: 'Going round the same places in the same order three times rules out a page that was still moving focus while it loaded.'
    }
  },
  calibration: {
    toleranceMs: {
      value: 100,
      reason: 'A moment marker is placed within a tenth of a second of where it happens in the video.'
    },
    maxCorrectionMs: {
      value: 400,
      reason: 'A timing correction bigger than this is more likely a misread than a real delay, so it is not used.'
    }
  }
}

export const stick = (group, name) => MEASURING_STICK[group][name].value
