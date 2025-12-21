export interface FamatTestBase {
  id: string;
  year: number;
  month: string;
  division: string;
  test_type: 'Test' | 'Solution';
  competition: string;
}

export interface FamatTest extends FamatTestBase {
  test_type: 'Test';
  url: string;
}

export interface FamatSolution extends FamatTestBase {
  test_type: 'Solution';
  answers: string[];
}

export type AnyFamatTest = FamatTest | FamatSolution;

export type UserAnswers = { [key: number]: string };

export type ScoreReport = {
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  omitCount: number;
};

export type ReviewData = {
  [key: number]: {
    userAnswer?: string;
    correctAnswer: string;
    isCorrect: boolean;
  };
};
