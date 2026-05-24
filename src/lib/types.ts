
export interface FamatTestBase {
  year: number;
  month: string | null;
  division: string;
  test_type: string;
  document_type: 'Test' | 'Solution';
  format: 'Individual' | 'Team';
  name: string;
  url: string;
  source?: string;
}

export interface FamatTest extends FamatTestBase {
  id: string;
  document_type: 'Test';
}

export interface FamatSolution extends FamatTestBase {
  document_type: 'Solution';
  answers: (string | string[])[];
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
    correctAnswer: string | string[];
    isCorrect: boolean;
  };
};

export type TestSubmission = {
  id: string;
  testId: string;
  userId: string;
  answers: UserAnswers;
  score: ScoreReport;
  submittedAt: Date;
  division: string;
  testName: string;
  completionDate: string;
  isRetake?: boolean;
};

export interface FamatTestWithHistory extends FamatTest {
  history: TestSubmission[];
  inProgress?: UserAnswers;
  markedForReview: MarkedQuestions;
  inProgressFlags?: MarkedQuestions;
  timerState?: TimerState;
}

export type LeaderboardEntry = {
  userId: string;
  division: string;
  testsCompleted: number;
  displayName: string;
  photoURL: string | null;
  showOnLeaderboard: boolean; // Field is now used for filtering reads
};

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  showOnLeaderboard: boolean;
  bookmarkedTestIds?: string[];
};

export type StudyGroup = {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  memberCount: number;
  createdAt: Date;
};

export type GroupMember = {
  userId: string;
  displayName: string;
  photoURL: string | null;
  testsCompleted: number;
  showOnLeaderboard: boolean;
};

export type GroupMembership = {
  groupId: string;
  groupName: string;
  inviteCode: string;
  joinedAt: Date;
};

// A question number mapped to the note string. The presence of the key means it's marked.
export type MarkedQuestions = { [questionNumber: number]: string };


export type TimerState = {
  timeRemaining: number;
  isRunning: boolean;
};
