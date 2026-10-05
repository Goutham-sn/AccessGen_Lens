import { ColorMatrixProfile } from './ColorMatrixProfile.js'

export class Deuteranopia extends ColorMatrixProfile {
  constructor(severity) {
    super(severity, 'accessgen-deuteranopia', [
      0.367, 0.861, -0.228, 0, 0,
      0.280, 0.673, 0.047, 0, 0,
      -0.012, 0.043, 0.969, 0, 0,
      0, 0, 0, 1, 0
    ])
  }
}
