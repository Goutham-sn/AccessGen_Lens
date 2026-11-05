import { ColorMatrixProfile } from './ColorMatrixProfile.js'

// Red-blind: reds look dark and dull, and red and green are easily confused.
// Machado, Oliveira and Fernandes (2009), severity 1.0, as for Deuteranopia.
export class Protanopia extends ColorMatrixProfile {
  constructor(severity) {
    super(severity, 'accessgen-protanopia', [
      0.152, 1.053, -0.205, 0, 0,
      0.115, 0.786, 0.099, 0, 0,
      -0.004, -0.048, 1.052, 0, 0,
      0, 0, 0, 1, 0
    ])
  }
}
