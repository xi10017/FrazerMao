

export interface FamatTestBase {
  year: number;
  month: string;
  division: string;
  test_type: string;
  document_type: 'Test' | 'Solution';
  format: 'Individual' | 'Team';
  name: string;
  url: string;
}

export interface FamatTest extends FamatTestBase {
  id: string;
  document_type: 'Test';
}

export interface FamatSolution extends FamatTestBase {
  document_type: 'Solution';
  answers: string[];
}

export type AnyFamatTest = FamatTest | FamatSolution;

export type UserAnswers = { [key: number]: string | null | undefined };

export type ScoreReport = {
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  omitCount: number;
};

export type ReviewData = {
  [key: number]: {
    userAnswer?: string | null;
    correctAnswer: string;
    isCorrect: boolean;
  };
};

export type TestSubmission = {
  id: string; // locally unique id
  testId: string;
  userId: string;
  answers: UserAnswers;
  score: ScoreReport;
  submittedAt: Date; // Using native Date for localStorage
};

export interface FamatTestWithHistory extends FamatTest {
    history: TestSubmission[];
    inProgress: boolean;
}
