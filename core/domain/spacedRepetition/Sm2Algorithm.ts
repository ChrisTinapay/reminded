export interface Sm2State {
  interval: number;
  easeFactor: number;
  repetitions: number;
}

export interface Sm2UpdateInput {
  previous?: Sm2State | null;
  quality: number;
}

export interface Sm2UpdateResult extends Sm2State {}

export function updateSm2State(input: Sm2UpdateInput): Sm2UpdateResult {
  const prevEase = input.previous?.easeFactor ?? 2.5;
  const prevInterval = input.previous?.interval ?? 0;

  let prevReps = input.previous?.repetitions ?? 0;
  if (!input.previous) {
    prevReps = 0;
  }

  let newEase = prevEase;
  let newInterval = 0;
  let newReps = 0;

  if (input.quality >= 3) {
    if (prevReps === 0) {
      newInterval = 1;
    } else if (prevReps === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(prevInterval * prevEase);
    }

    newReps = prevReps + 1;

    newEase =
      prevEase +
      (0.1 - (5 - input.quality) * (0.08 + (5 - input.quality) * 0.02));
    if (newEase < 1.3) newEase = 1.3;
  } else {
    newReps = 0;
    newInterval = 1;
  }

  return {
    interval: newInterval,
    easeFactor: newEase,
    repetitions: newReps,
  };
}

