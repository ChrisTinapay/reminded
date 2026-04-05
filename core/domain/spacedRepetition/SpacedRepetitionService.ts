import type { CourseId, MaterialId, Timestamp, UserId } from "../shared/types";
import type { QuizRepository } from "../../ports/persistence/QuizRepository";
import { updateSm2State } from "./Sm2Algorithm";

export interface SubmitReviewCommand {
  userId: UserId;
  courseId: CourseId;
  questionId: string;
  isCorrect: boolean;
  timeTakenSeconds: number;
  clientToday?: string | null;
}

export class SpacedRepetitionService {
  constructor(private readonly quizRepository: QuizRepository) {}

  calculateQuality(isCorrect: boolean, timeTakenSeconds: number): number {
    if (!isCorrect) return 0;
    if (timeTakenSeconds <= 10) return 5;
    if (timeTakenSeconds <= 20) return 4;
    return 3;
  }

  async submitReview(command: SubmitReviewCommand): Promise<void> {
    const quality = this.calculateQuality(
      command.isCorrect,
      command.timeTakenSeconds,
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

    await this.quizRepository.upsertProgress({
      userId: command.userId,
      courseId: command.courseId,
      questionId: command.questionId,
      interval: updated.interval,
      easeFactor: updated.easeFactor,
      repetitions: updated.repetitions,
      nextReviewDate,
    });

    const reviewedAt: Timestamp =
      command.clientToday ?? new Date().toISOString().substring(0, 10);
    await this.quizRepository.saveReviewOutcome({
      questionId: command.questionId,
      userId: command.userId,
      wasCorrect: command.isCorrect,
      responseTimeMs: command.timeTakenSeconds * 1000,
      reviewedAt,
    });
  }
}

