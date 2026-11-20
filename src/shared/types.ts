export type SubjectType = 'company' | 'individual';

export type MeetingPurpose =
  | 'Sales Meeting'
  | 'Partnership Discussion'
  | 'Investor Meeting'
  | 'Business Development'
  | 'Job Interview'
  | 'Networking'
  | 'General Meeting'
  | 'Other';

export type VerificationStatus =
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'UNVERIFIED'
  | 'CONFLICTING';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type ResearchStageStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface ResearchStage {
  id: string;
  stepNumber: number;
  label: string;
  detail?: string;
  status: ResearchStageStatus;
  updatedAt?: string;
  error?: string;
}

export interface SearchQueryExecution {
  id: string;
  category: string;
  query: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  resultsCount: number;
  error?: string;
  executedAt?: string;
}

export interface RawTavilyResult {
  title: string;
  url: string;
  canonicalUrl: string;
  content: string;
  score?: number;
  publishedDate: string | null; // null if unavailable
  queryCategory: string;
  queryUsed: string;
  retrievedAt: string;
}

export interface ResearchFinding {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  category:
    | 'Announcement & Launch'
    | 'Leadership & Hires'
    | 'Financial & Business'
    | 'Partnerships & Deals'
    | 'Industry & Strategy'
    | 'Risk & Controversy'
    | 'Background Context';
  sourceTitle: string;
  sourceName: string;
  sourceUrl: string;
  publicationDate: string; // Either ISO/formatted date or "Publication date unavailable"
  hasValidPublicationDate: boolean;
  isWithin30Days: boolean;
  retrievalDate: string;
  evidenceText: string;
  relevanceScore?: number;
  verificationStatus: VerificationStatus;
  verificationReason: string;
  confidenceLevel: ConfidenceLevel;
  isPrimarySource: boolean;
}

export interface OpportunityOrRisk {
  id: string;
  type: 'OPPORTUNITY' | 'RISK';
  basis: 'EVIDENCE_BASED' | 'ANALYTICAL_INFERENCE';
  title: string;
  description: string;
  relatedSourceUrl?: string;
  relatedSourceTitle?: string;
}

export interface MeetingQuestion {
  id: string;
  question: string;
  rationale: string;
  category: string;
  relatedFindingTitle?: string;
}

export interface TalkingPoint {
  id: string;
  headline: string;
  detail: string;
  suggestedAngle: string;
}

export interface SourceReference {
  id: string;
  sourceName: string;
  articleTitle: string;
  url: string;
  publicationDate: string;
  retrievedAt: string;
  verificationStatus: VerificationStatus;
  isPrimarySource: boolean;
}

export interface BriefingReport {
  generatedAt: string;
  researchStartDate: string;
  researchEndDate: string;
  modelGatewayUsed: 'bifrost' | 'gemini-direct' | 'evidence-fallback';
  modelNameUsed: string;
  tavilyStatus: 'live_results' | 'no_results' | 'api_key_missing' | 'api_error';
  tavilyStatusMessage?: string;
  subjectOverview: string;
  executiveSummaryOneLiner: string;
  recentDevelopments: ResearchFinding[]; // Confirmed within 30 days or dated
  undatedContextFindings: ResearchFinding[]; // Separated undated context items per Part 9
  keyInsights: string[];
  opportunitiesAndRisks: OpportunityOrRisk[];
  questionsToAsk: MeetingQuestion[];
  talkingPoints: TalkingPoint[];
  topFiveFactsForPrep: string[];
  sourceReferences: SourceReference[];
}

export interface ResearchRefreshDiff {
  refreshedAt: string;
  previousResearchDate: string;
  newResearchDate: string;
  hasNewInformation: boolean;
  statusMessage: string;
  newFindings: ResearchFinding[];
  previouslyKnownFindings: ResearchFinding[];
  changedFindings: {
    findingTitle: string;
    previousSummary: string;
    updatedSummary: string;
    changeNote: string;
  }[];
  newSourcesCount: number;
  queriesExecuted: number;
}

export interface BriefingVersionSnapshot {
  versionId: string;
  savedAt: string;
  researchStartDate: string;
  researchEndDate: string;
  briefing: BriefingReport;
  findingsCount: number;
  verifiedCount: number;
  searchesPerformed: number;
}

export type MeetingResearchStatus =
  | 'draft'
  | 'researching'
  | 'completed'
  | 'failed'
  | 'partial';

export interface MeetingRecord {
  id: string;
  subjectType: SubjectType;
  subjectName: string;
  meetingDate: string; // YYYY-MM-DD
  meetingTime: string; // HH:mm
  meetingTimeZone: string;
  purpose: MeetingPurpose;
  context: string;
  additionalInterests: string[];
  isSampleDemo?: boolean;
  researchStatus: MeetingResearchStatus;
  researchStartDate: string;
  researchEndDate: string;
  stages: ResearchStage[];
  queryExecutions: SearchQueryExecution[];
  rawResults: RawTavilyResult[];
  findings: ResearchFinding[];
  briefing: BriefingReport | null;
  history: BriefingVersionSnapshot[];
  lastRefreshDiff: ResearchRefreshDiff | null;
  searchUsage: {
    searchesPerformed: number;
    searchBudgetMax: number;
    deduplicatedUrlsCount: number;
    rawResultsReturned: number;
    creditsReported: number;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogItem {
  id: string;
  timestamp: string;
  meetingId?: string;
  subjectName: string;
  action: string;
  status: 'success' | 'warning' | 'error' | 'info';
  details: string;
}

export interface UsageStatistics {
  totalSearchesExecuted: number;
  totalCreditsReported: number;
  totalBriefingsGenerated: number;
  totalRefreshesExecuted: number;
  bifrostRequestsCount: number;
  geminiDirectRequestsCount: number;
  defaultSearchBudgetPerRun: number;
  lastSearchAt: string | null;
}

export interface IntegrationStatusResponse {
  gemini: {
    configured: boolean;
    status: 'connected' | 'missing_key' | 'error';
    model: string;
    message: string;
  };
  tavily: {
    configured: boolean;
    status: 'configured' | 'missing_key' | 'error';
    maskedKey: string | null;
    endpoint: string;
    message: string;
  };
  bifrost: {
    configured: boolean;
    status: 'configured' | 'not_configured' | 'unreachable';
    baseUrl: string | null;
    model: string | null;
    maskedKey: string | null;
    message: string;
  };
  storage: {
    adapterName: string;
    persistentFile: string;
    durableCloud: boolean;
    status: 'operational';
    totalMeetingsSaved: number;
    message: string;
  };
}
