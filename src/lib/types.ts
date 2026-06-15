
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
  /** Original attempt this retake was based on (stored on submit). */
  retakeSourceSubmissionId?: string;
};

export interface FamatTestWithHistory extends FamatTest {
  history: TestSubmission[];
  inProgress?: UserAnswers;
  markedForReview: MarkedQuestions;
  inProgressFlags?: MarkedQuestions;
  timerState?: TimerState;
  retakeInProgress?: UserAnswers;
  retakeTimerState?: TimerState;
  retakeSourceAnswers?: UserAnswers;
  retakeOmittedQuestions?: number[];
  retakeInProgressFlags?: MarkedQuestions;
}

export type LeaderboardEntry = {
  userId: string;
  division: string;
  testsCompleted: number;
  displayName: string;
  photoURL: string | null;
  showOnLeaderboard: boolean;
};

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  showOnLeaderboard: boolean;
  bookmarkedTestIds?: string[];
  weeklyTestGoal?: number;
  streakGoal?: number;
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

export type MarkedQuestions = { [questionNumber: number]: string };

export type TimerState = {
  timeRemaining: number;
  isRunning: boolean;
};

export type InProgressChecked = { [key: number]: true };

/** In-progress session synced between localStorage and Firestore. */
export type InProgressTestState = {
  answers: UserAnswers;
  flags: MarkedQuestions;
  checked: InProgressChecked;
  timerState: TimerState | null;
  updatedAt: Date;
  sessionMode?: 'practice' | 'retake';
  sourceSubmissionId?: string;
  sourceAnswers?: UserAnswers;
  /** Questions explicitly cleared during a retake (survives Firestore null stripping). */
  retakeOmittedQuestions?: number[];
};

export type AnswerKeyReportStatus = 'pending' | 'approved' | 'rejected';

export type AnswerKeyReport = {
  id: string;
  testId: string;
  testName: string;
  questionNumber: number;
  currentAnswer: string | string[];
  proposedAnswer: string | string[];
  userAnswer?: string | null;
  message: string;
  userId: string;
  userDisplayName: string;
  status: AnswerKeyReportStatus;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  adminNote?: string;
};

export type AnswerKeyOverrideDoc = {
  byTest: Record<string, Record<string, string | string[]>>;
  updatedAt: Date;
  updatedBy: string;
  lastSourceReportId?: string;
};
