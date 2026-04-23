import type { CourseId, UserId } from "../shared/types";
import type { QuizRepository } from "../../ports/persistence/QuizRepository";
import { updateSm2State } from "./Sm2Algorithm";

export interface SubmitReviewCommand {
  userId: UserId;
  courseId: CourseId;
  questionId: string;
  isCorrect: boolean;
  /**
   * Wall-clock milliseconds from question paint to answer click.
   * Saved for telemetry only; not used for SM-2 math.
   */
  latencyMs: number;
  /** User-provided metacognitive quality score (0-5). */
  qualityScore: number;
  /** Exact answer text the student clicked (telemetry only). */
  selectedAnswer: string | null;
  clientToday?: string | null;
}

export class SpacedRepetitionService {
  constructor(private readonly quizRepository: QuizRepository) {}

  async submitReview(command: SubmitReviewCommand): Promise<void> {
    const quality = Number(command.qualityScore);

    const previous = await this.quizRepository.getProgressState(
      command.userId,
      command.questionId,
    );

    const updated = updateSm2State({
      previous: previous
        ? {
            interval: previous.interval,
            easeFactor: previous.easeFactor,
            repetitions: previous.repetitions,
          }
        : null,
      quality,
    });

    const baseDate = command.clientToday
      ? new Date(command.clientToday + "T00:00:00")
      : new Date();
    baseDate.setDate(baseDate.getDate() + updated.interval);
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
    const dd = String(baseDate.getDate()).padStart(2, "0");
    const nextReviewDate = `${yyyy}-${mm}-${dd}`;

    await this.quizRepository.persistReviewTransaction({
      userId: command.userId,
      courseId: command.courseId,
      questionId: command.questionId,
      responseLatencySeconds: Number(command.latencyMs),
      isCorrect: command.isCorrect,
      qualityScoreQ: quality,
      selectedAnswer: command.selectedAnswer,
      repetitionN: updated.repetitions,
      easinessFactorEf: updated.easeFactor,
      nextIntervalI: updated.interval,
      nextReviewDate,
    });
  }
}

