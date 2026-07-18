/**
 * Grade boundary configuration.
 * Sorted in descending order by minScore — first match wins.
 *
 * To customize the grading scale for your institution, edit this array.
 * You can add/remove rows, change thresholds, letter labels, or point values.
 * The fallback for scores below the last entry is always "F" / 0.0.
 */
export interface GradeBoundary {
  minScore: number;
  letterGrade: string;
  gradePoints: number;
}

export const GRADE_BOUNDARIES: GradeBoundary[] = [
  { minScore: 80, letterGrade: "A",  gradePoints: 4.0 },
  { minScore: 75, letterGrade: "B+", gradePoints: 3.5 },
  { minScore: 70, letterGrade: "B",  gradePoints: 3.0 },
  { minScore: 65, letterGrade: "C+", gradePoints: 2.5 },
  { minScore: 60, letterGrade: "C",  gradePoints: 2.0 },
  { minScore: 50, letterGrade: "D",  gradePoints: 1.0 },
  // Scores below 50 → "F", 0.0 (handled by fallback)
];

/**
 * Resolves a numeric score to its letter grade and grade points
 * using the configured GRADE_BOUNDARIES array.
 */
export function resolveGrade(score: number): { letterGrade: string; gradePoints: number } {
  for (const boundary of GRADE_BOUNDARIES) {
    if (score >= boundary.minScore) {
      return { letterGrade: boundary.letterGrade, gradePoints: boundary.gradePoints };
    }
  }
  return { letterGrade: "F", gradePoints: 0.0 };
}
