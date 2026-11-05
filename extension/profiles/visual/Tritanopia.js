import { ColorMatrixProfile } from './ColorMatrixProfile.js'

// Blue-yellow colour blindness: blues look green, yellows look pink or grey.
// Machado, Oliveira and Fernandes (2009), severity 1.0.
export class Tritanopia extends ColorMatrixProfile {
  constructor(severity) {
    super(severity, 'accessgen-tritanopia', [
      1.256, -0.077, -0.179, 0, 0,
      -0.078, 0.931, 0.148, 0, 0,
      0.005, 0.691, 0.304, 0, 0,
      0, 0, 0, 1, 0
    ])
  }
}
