export type UserId = string;
export type CourseId = string;
export type QuestionId = string;
export type MaterialId = string;
export type ProfileId = string;

export type Timestamp = string;

export interface Identifiable<TId> {
  id: TId;
}
