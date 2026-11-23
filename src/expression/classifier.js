// Prototype rules, not trained probabilities. Laugh has its own score/threshold semantics.
export const classifierPolicy = Object.freeze({
  laughEnter: 0.65,
  laughExit: 0.45,
  mouthRange: [0.25, 0.65],
  smileCoreExponent: 1.2,
  eyeBonus: 0.1,
  openingJaw: [0.15, 0.55],
  openingGeometry: [0.08, 0.28],
  eyeRange: [0.1, 0.5],
  maxSideWeight: 0.6,
})

const smooth = (value, minimum, maximum) => {
  const progress = Math.max(
    0,
    Math.min(1, (value - minimum) / (maximum - minimum)),
  )
  return progress * progress * (3 - 2 * progress)
}

export function laughEvidence(raw, context, config) {
  const values = raw.values
  const pose = context?.pose
  const supportedPose =
    !pose?.available ||
    (pose.valid && Math.abs(pose.yaw) <= 55 && Math.abs(pose.pitch) <= 40)
  if (!supportedPose) {
    return { score: 0, reason: 'unsupported pose', policy: classifierPolicy }
  }

  const yaw = pose?.valid ? Math.abs(pose.yaw) : 0
  const side =
    values.mouthSmileLeft >= values.mouthSmileRight ? 'Left' : 'Right'
  const otherSide = side === 'Left' ? 'Right' : 'Left'
  const sideWeight = smooth(yaw, 10, 40) * classifierPolicy.maxSideWeight
  const mouthMean = (values.mouthSmileLeft + values.mouthSmileRight) / 2
  const mouth =
    mouthMean * (1 - sideWeight) + values['mouthSmile' + side] * sideWeight
  const eyeMean = (values.eyeSquintLeft + values.eyeSquintRight) / 2
  const eye =
    eyeMean * (1 - sideWeight) + values['eyeSquint' + side] * sideWeight
  const inhibition =
    1 - smooth(Math.max(values.mouthFunnel, values.mouthPucker), 0.1, 0.35)
  const smile =
    smooth(mouth, 0.25, 0.65) *
    smooth(values['mouthSmile' + otherSide], 0.03, 0.18) *
    inhibition
  const jaw = smooth(values.jawOpen, 0.15, 0.55)
  const geometry = Number.isFinite(context?.mouthOpenness)
    ? smooth(context.mouthOpenness, 0.08, 0.28)
    : null
  const opening =
    geometry === null ? jaw : Math.min(1, 0.6 * jaw + 0.4 * geometry)
  const support = smooth(eye, 0.1, 0.5)
  const smileCoreEvidence = Math.pow(smile, classifierPolicy.smileCoreExponent)
  const coreScore = Math.min(smileCoreEvidence, opening)
  const supportBonus = 0.1 * support * coreScore * (1 - coreScore)
  const openScore = Math.min(1, coreScore + supportBonus)

  // Strong grins use smile and eye evidence even when the mouth stays closed.
  const closedSupported =
    raw.smileIntensity >= config.laughEnter && raw.eyeSquintScore >= 0.15
  const closedScore = closedSupported ? 0.8 : 0

  return {
    score: Math.max(openScore, closedScore),
    smileEvidence: smile,
    openingEvidence: opening,
    eyeEvidence: support,
    otherSupportingEvidence: { eyeBonus: supportBonus, cheekRequired: false },
    coreScore,
    supportBonus,
    smileCoreEvidence,
    openingDisagreement: geometry === null ? null : Math.abs(jaw - geometry),
    openingFusion: {
      jawWeight: geometry === null ? 1 : 0.6,
      geometryWeight: geometry === null ? 0 : 0.4,
      reliability: 'not validated by pose-labeled paired samples',
    },
    p01GainAppliedToOpenLaugh: false,
    limitingFactor:
      smileCoreEvidence <= opening ? 'smile-core' : 'mouth-opening',
    legacyThreeWayScore: Math.min(smile, opening, support),
    openScore,
    closedScore,
    rawMouth: mouthMean,
    finalMouth: mouth,
    side,
    sideWeight,
    jawEvidence: jaw,
    geometryEvidence: geometry,
    poseValid: supportedPose,
    reason:
      'open laugh = minimum of smile and opening plus bounded optional eye bonus; P0-1 gain is not reapplied',
    policy: classifierPolicy,
  }
}
