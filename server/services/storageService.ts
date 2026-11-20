import fs from 'fs';
import path from 'path';
import {
  ActivityLogItem,
  MeetingRecord,
  ResearchStage,
  UsageStatistics,
} from '../../src/shared/types.ts';

interface DatabaseSchema {
  meetings: MeetingRecord[];
  activities: ActivityLogItem[];
  usage: UsageStatistics;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'meetwise-storage.json');

export function createInitialStages(): ResearchStage[] {
  const stageLabels = [
    'Understanding meeting context',
    'Creating research queries',
    'Searching recent developments with Tavily',
    'Collecting source evidence',
    'Removing duplicate results',
    'Evaluating evidence and dates',
    'Analyzing meeting relevance with Gemini',
    'Generating the briefing',
    'Saving the final report',
  ];

  return stageLabels.map((label, idx) => ({
    id: `stage-${idx + 1}`,
    stepNumber: idx + 1,
    label,
    status: 'pending',
  }));
}

export function compute30DayWindow(referenceDate: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - 30);

  const formatYMD = (d: Date) => d.toISOString().split('T')[0];
  return {
    startDate: formatYMD(start),
    endDate: formatYMD(end),
  };
}

function createInitialSampleMeeting(): MeetingRecord {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 2);
  const { startDate, endDate } = compute30DayWindow(now);

  return {
    id: 'demo-nvidia-partnership',
    subjectType: 'company',
    subjectName: 'NVIDIA',
    meetingDate: tomorrow.toISOString().split('T')[0],
    meetingTime: '14:00',
    meetingTimeZone: 'America/Los_Angeles',
    purpose: 'Partnership Discussion',
    context:
      'Strategic partnership discussion exploring enterprise AI infrastructure integration, accelerated inference deployment, and joint go-to-market initiatives.',
    additionalInterests: [
      'Product launches',
      'New partnerships',
      'Technology developments',
      'Leadership changes',
    ],
    isSampleDemo: true,
    researchStatus: 'draft',
    researchStartDate: startDate,
    researchEndDate: endDate,
    stages: createInitialStages(),
    queryExecutions: [],
    rawResults: [],
    findings: [],
    briefing: null,
    history: [],
    lastRefreshDiff: null,
    searchUsage: {
      searchesPerformed: 0,
      searchBudgetMax: 5,
      deduplicatedUrlsCount: 0,
      rawResultsReturned: 0,
      creditsReported: 0,
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

class StorageService {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.meetings)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read local storage file, initializing clean state:', err);
    }

    const sampleMeeting = createInitialSampleMeeting();
    const initial: DatabaseSchema = {
      meetings: [sampleMeeting],
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString(),
          meetingId: sampleMeeting.id,
          subjectName: 'NVIDIA (Sample Scenario)',
          action: 'Demo Scenario Initialized',
          status: 'info',
          details:
            'Sample meeting created without preloaded fake news. Run live Tavily research to generate verified 30-day briefing.',
        },
      ],
      usage: {
        totalSearchesExecuted: 0,
        totalCreditsReported: 0,
        totalBriefingsGenerated: 0,
        totalRefreshesExecuted: 0,
        bifrostRequestsCount: 0,
        geminiDirectRequestsCount: 0,
        defaultSearchBudgetPerRun: 5,
        lastSearchAt: null,
      },
    };

    this.saveToDisk(initial);
    return initial;
  }

  private saveToDisk(dataToSave: DatabaseSchema = this.data): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempPath = `${DB_FILE_PATH}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(dataToSave, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE_PATH);
    } catch (err) {
      console.error('Warning: Failed to persist state to disk:', err);
    }
  }

  public getAllMeetings(): MeetingRecord[] {
    return [...this.data.meetings].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getMeetingById(id: string): MeetingRecord | undefined {
    return this.data.meetings.find((m) => m.id === id);
  }

  public createMeeting(meeting: MeetingRecord): MeetingRecord {
    this.data.meetings.unshift(meeting);
    this.saveToDisk();
    return meeting;
  }

  public updateMeeting(
    id: string,
    updater: (current: MeetingRecord) => MeetingRecord
  ): MeetingRecord | undefined {
    const idx = this.data.meetings.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    const updated = updater(this.data.meetings[idx]);
    updated.updatedAt = new Date().toISOString();
    this.data.meetings[idx] = updated;
    this.saveToDisk();
    return updated;
  }

  public deleteMeeting(id: string): boolean {
    const initialLen = this.data.meetings.length;
    this.data.meetings = this.data.meetings.filter((m) => m.id !== id);
    if (this.data.meetings.length !== initialLen) {
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public logActivity(item: Omit<ActivityLogItem, 'id' | 'timestamp'>): ActivityLogItem {
    const entry: ActivityLogItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.activities.unshift(entry);
    if (this.data.activities.length > 50) {
      this.data.activities = this.data.activities.slice(0, 50);
    }
    this.saveToDisk();
    return entry;
  }

  public getActivities(): ActivityLogItem[] {
    return this.data.activities;
  }

  public getUsage(): UsageStatistics {
    return this.data.usage;
  }

  public updateUsage(updater: (u: UsageStatistics) => UsageStatistics): UsageStatistics {
    this.data.usage = updater(this.data.usage);
    this.saveToDisk();
    return this.data.usage;
  }

  public setDefaultSearchBudget(budget: number): UsageStatistics {
    const clamped = Math.max(3, Math.min(8, Math.round(budget)));
    this.data.usage.defaultSearchBudgetPerRun = clamped;
    this.saveToDisk();
    return this.data.usage;
  }

  public getStorageMetadata() {
    return {
      adapterName: 'Local JSON File Storage Adapter (Prototype Persistence)',
      persistentFile: 'data/meetwise-storage.json',
      durableCloud: false,
      status: 'operational' as const,
      totalMeetingsSaved: this.data.meetings.length,
      message:
        'Persists meetings, evidence records, version history, and usage metrics to the local server filesystem (data/meetwise-storage.json). Data persists across server restarts within the active container instance; container re-provisioning resets local disk files.',
    };
  }
}

export const storageService = new StorageService();
