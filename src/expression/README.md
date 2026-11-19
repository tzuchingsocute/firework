# Expression engine

Open Developer Console → Expression Debug after starting the camera.
Calibration steps are Neutral, Smile, then Laugh, each held for about two seconds.
The reset button restores defaults and restarts calibration. Calibration is
session-local. Failed or interrupted samples do not replace active thresholds.

Import `expressions` from `./panel.js` to subscribe:
```js
expressions.addEventListener('expression:smile:start', event => {
  console.log(event.detail)
})
const snapshot = { ...expressions.snapshot }
```
Event names include smile:start/update/end, laugh:start/end, face:lost/recovered
under the expression: prefix. Timestamps are performance.now() milliseconds.
The state manager can also be instantiated independently from manager.js.

Smile Intensity uses baseline-adjusted mouth, cheek, eye and jaw scores.
Mouth score is the two-sided mean minus 0.2 times asymmetry. Default normalized
weights are 0.82, 0.10, 0.05 and 0.03. Supporting contributions are gated by
mouth evidence and funnel/pucker reduce the whole score. These are initial
engineering parameters, not validated optimal weights.

Default intensity thresholds are Smile 0.32/0.24 and Strong Smile 0.68/0.56
(enter/exit). Public state and events keep the name LAUGH. A closed-mouth
strong smile can trigger LAUGH. Enter holds are 300/380 ms, lower-state
release is 420 ms, smoothing is 100 ms. The Console allows configuration
and shows smoothed additive contributions.

Calibration compares medians and the 20th/80th percentiles. Overlapping tails
can still yield a personalized threshold when a typical strong smile is
clearly stronger. Low separation retains the first two samples and applies
a conservative threshold. You can repeat only the strong smile step.
The Console shows both raw and personal baseline-adjusted intensity.
Sensitivity scales the strong-smile threshold gap and preserves Smile thresholds.

In the rain panel, choose 表情联动 to opt in. The effect controller receives
expression events and adjusts emission on the existing rain instance.
Rain starts on Smile, settles on Laugh or Neutral, and stops emission
immediately on face loss. Existing drops run to expiry.

Frozen diagnostic frames invalidate expression output. Missing coefficients,
face loss, or a frame gap over 350 ms clear the state.

Run `npm run test:stage2`. The report distinguishes mock logic tests from
real model inference. The replay fixture has no expression annotations.
To evaluate accuracy, collect consented clips with timestamped NEUTRAL,
SMILE, LAUGH, speaking, mouth-open-only and NO_FACE labels. Keep subjects
and clips used for calibration separate from acceptance clips. Real PC
and mobile camera validation, inference overhead, and classification
accuracy remain pending.
