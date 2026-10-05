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
