import type { CourseId, UserId } from "../shared/types";
import type { QuizRepository } from "../../ports/persistence/QuizRepository";
import { updateSm2State } from "./Sm2Algorithm";

export interface SubmitReviewCommand {
  userId: UserId;
  courseId: CourseId;
  questionId: string;
  isCorrect: boolean;
  /** Wall-clock seconds from question paint to answer click (float). */
  responseLatencySeconds: number;
  clientToday?: string | null;
}

export class SpacedRepetitionService {
  constructor(private readonly quizRepository: QuizRepository) {}

  calculateQuality(isCorrect: boolean, responseLatencySeconds: number): number {
    if (!isCorrect) return 0;
    if (responseLatencySeconds <= 10) return 5;
    if (responseLatencySeconds <= 20) return 4;
    return 3;
  }

  async submitReview(command: SubmitReviewCommand): Promise<void> {
    const quality = this.calculateQuality(
      command.isCorrect,
      command.responseLatencySeconds,
    );

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
      responseLatencySeconds: command.responseLatencySeconds,
      isCorrect: command.isCorrect,
      qualityScoreQ: quality,
      repetitionN: updated.repetitions,
      easinessFactorEf: updated.easeFactor,
      nextIntervalI: updated.interval,
      nextReviewDate,
    });
  }
}

