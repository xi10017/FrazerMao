export interface FamatTestBase {
  year: number;
  month: string;
  division: string;
  competition: string;
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

export type TestSubmission = {
  id: string; // submission id
  testId: string;
  userId: string;
  answers: UserAnswers;
  score: ScoreReport;
  submittedAt: {
    seconds: number;
    nanoseconds: number;
  };
};

export interface FamatTestWithHistory extends FamatTest {
    history?: TestSubmission[];
}
