// Every threshold and timing the runner uses, with the reason for it in
// plain words. The report shows these reasons as footnotes, so they are
// written for the people reading it.
export const MEASURING_STICK = {
  evidence: {
    holdMs: {
      value: 5000,
      reason: 'Each moment stays on screen for five seconds, with the element and the problem written out, long enough to read it all.'
    },
    maxHolds: {
      value: 60,
      reason: 'Every moment pauses the video (up to sixty), so none flashes past unread.'
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
  botWall: {
    maxOwnTextChars: {
      value: 1000,
      reason: 'A page counts as a check that the visitor is a person only when it has almost nothing else on it: under 1000 characters of its own text (about 170 words), so a normal page that merely includes a CAPTCHA box is still looked at.'
    },
    maxOwnControls: {
      value: 5,
      reason: 'Such a check page has at most a few links or buttons of its own, such as a help link; five or fewer counts as almost nothing.'
    }
  },
  task: {
    matchScore: {
      value: 0.6,
      reason: 'A place counts as what the person was looking for when its words cover most of what they were looking for. A shorter or longer label for the same thing, such as “Plans and pricing” for “pricing”, still counts.'
    },
    tunnelRadiusPx: {
      value: 300,
      reason: 'With tunnel vision only a small area around where the person is looking can be made out. 300 px is about a quarter of the screen width, measured from the middle of the screen and from the place they were just at.'
    }
  },
  precheck: {
    fewStops: {
      value: 5,
      reason: 'With five or fewer places to land, a person pressing Tab reaches the end of the page in a few presses, so there is little to find or lose.'
    },
    // How many places Tab reaches sit out of view with tunnel vision, going from
    // one to the next. By count, not by share: a page with one link has 100% of
    // them out of view and almost nothing to miss, so share ranks small pages
    // above large ones. Measured on real pages (out of view / places): 1/1, 1/4,
    // 1/8, 3/12, 4/25, 4/26, 6/16, 7/31, 9/48, 10/55, 11/57, 13/67, 14/149, 17/230,
    // 33/172, 44/289. Three and eight split them into a handful, a middle band,
    // and a good many.
    fewOutOfSight: {
      value: 3,
      reason: 'Up to three places out of view means that, going through the page with Tab, at most three presses land on something the person cannot make out, so there is little for them to miss.'
    },
    lotsOutOfSight: {
      value: 8,
      reason: 'Eight or more places out of view means eight or more presses of Tab land on something the person cannot make out, enough that whatever they came to find can easily be one of them.'
    },
    noTextChars: {
      value: 20,
      reason: 'A page with 20 characters of text or fewer has a label or two and nothing to read.'
    },
    littleTextChars: {
      value: 600,
      reason: 'About a hundred words, less than one screen of reading. Below this there is little for someone who reads slowly or with difficulty to read.'
    },
    bigMediaPx: {
      value: 40000,
      reason: 'A picture, video or canvas of about 200 by 200 px or more can carry what the text count does not see, so a page with little text and one of these is not called short of things to read.'
    },
    colourDelta: {
      value: 20,
      reason: 'A colour counts as changed when its red, green or blue moves by 20 out of 255 or more: about a twelfth of the range, enough to see when the two are side by side.'
    },
    littleColourShare: {
      value: 0.02,
      reason: 'When fewer than one in fifty of the places on the first screen change colour, what changes is a few links or a thin bar, and nearly everything looks the same.'
    },
    lotsColourShare: {
      value: 0.15,
      reason: 'When more than about one in six places on the first screen change colour, a large banner or photo looks different, so much of the page does.'
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
