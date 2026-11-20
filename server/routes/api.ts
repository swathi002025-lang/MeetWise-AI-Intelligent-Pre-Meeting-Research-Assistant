import express, { Request, Response } from 'express';
import {
  IntegrationStatusResponse,
  MeetingPurpose,
  MeetingRecord,
  SubjectType,
} from '../../src/shared/types.ts';
import { bifrostService } from '../services/bifrostService.ts';
import { geminiService } from '../services/geminiService.ts';
import { runMeetingResearch } from '../services/researchOrchestrator.ts';
import {
  compute30DayWindow,
  createInitialStages,
  storageService,
} from '../services/storageService.ts';
import { tavilyService } from '../services/tavilyService.ts';

export const apiRouter = express.Router();

const VALID_PURPOSES: MeetingPurpose[] = [
  'Sales Meeting',
  'Partnership Discussion',
  'Investor Meeting',
  'Business Development',
  'Job Interview',
  'Networking',
  'General Meeting',
  'Other',
];

// GET /api/meetings
apiRouter.get('/meetings', (_req: Request, res: Response) => {
  const meetings = storageService.getAllMeetings();
  res.json({ meetings });
});

// GET /api/meetings/:id
// IMPORTANT: Opening an existing meeting retrieves its saved report and NEVER triggers new Tavily searches.
apiRouter.get('/meetings/:id', (req: Request, res: Response) => {
  const meeting = storageService.getMeetingById(req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting record not found.' });
    return;
  }
  res.json({ meeting });
});

// POST /api/meetings
apiRouter.post('/meetings', (req: Request, res: Response) => {
  const {
    subjectType,
    subjectName,
    meetingDate,
    meetingTime,
    meetingTimeZone,
    purpose,
    context,
    additionalInterests,
  } = req.body || {};

  const cleanType: SubjectType = subjectType === 'individual' ? 'individual' : 'company';
  const cleanName = typeof subjectName === 'string' ? subjectName.trim() : '';

  if (!cleanName || cleanName.length < 2) {
    res.status(400).json({ error: 'Please provide a valid company or individual name.' });
    return;
  }
  if (!meetingDate || typeof meetingDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate.trim())) {
    res.status(400).json({ error: 'Please select a valid meeting date in YYYY-MM-DD format.' });
    return;
  }
  if (!meetingTime || typeof meetingTime !== 'string' || !/^\d{2}:\d{2}$/.test(meetingTime.trim())) {
    res.status(400).json({ error: 'Please select a valid meeting time in HH:mm format.' });
    return;
  }

  const cleanPurpose: MeetingPurpose = VALID_PURPOSES.includes(purpose)
    ? purpose
    : 'General Meeting';

  const now = new Date();
  const { startDate, endDate } = compute30DayWindow(now);
  const budgetMax = storageService.getUsage().defaultSearchBudgetPerRun || 5;

  const newMeeting: MeetingRecord = {
    id: `mtg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    subjectType: cleanType,
    subjectName: cleanName.slice(0, 120),
    meetingDate,
    meetingTime,
    meetingTimeZone:
      typeof meetingTimeZone === 'string' && meetingTimeZone.trim()
        ? meetingTimeZone.trim()
        : 'UTC',
    purpose: cleanPurpose,
    context: typeof context === 'string' ? context.trim().slice(0, 2000) : '',
    additionalInterests: Array.isArray(additionalInterests)
      ? additionalInterests.map((i) => String(i).trim()).filter(Boolean)
      : [],
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
      searchBudgetMax: budgetMax,
      deduplicatedUrlsCount: 0,
      rawResultsReturned: 0,
      creditsReported: 0,
    },
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  storageService.createMeeting(newMeeting);
  storageService.logActivity({
    meetingId: newMeeting.id,
    subjectName: newMeeting.subjectName,
    action: 'Created Meeting Record',
    status: 'info',
    details: `${newMeeting.purpose} scheduled for ${newMeeting.meetingDate} at ${newMeeting.meetingTime}.`,
  });

  res.status(201).json({ meeting: newMeeting });
});

// PUT /api/meetings/:id
apiRouter.put('/meetings/:id', (req: Request, res: Response) => {
  const existing = storageService.getMeetingById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Meeting record not found.' });
    return;
  }

  const {
    subjectType,
    subjectName,
    meetingDate,
    meetingTime,
    meetingTimeZone,
    purpose,
    context,
    additionalInterests,
  } = req.body || {};

  const updated = storageService.updateMeeting(req.params.id, (m) => ({
    ...m,
    subjectType:
      subjectType === 'company' || subjectType === 'individual' ? subjectType : m.subjectType,
    subjectName:
      typeof subjectName === 'string' && subjectName.trim().length >= 2
        ? subjectName.trim().slice(0, 120)
        : m.subjectName,
    meetingDate: typeof meetingDate === 'string' && meetingDate ? meetingDate : m.meetingDate,
    meetingTime: typeof meetingTime === 'string' && meetingTime ? meetingTime : m.meetingTime,
    meetingTimeZone:
      typeof meetingTimeZone === 'string' && meetingTimeZone ? meetingTimeZone : m.meetingTimeZone,
    purpose: VALID_PURPOSES.includes(purpose) ? purpose : m.purpose,
    context: typeof context === 'string' ? context.trim().slice(0, 2000) : m.context,
    additionalInterests: Array.isArray(additionalInterests)
      ? additionalInterests.map((i) => String(i).trim()).filter(Boolean)
      : m.additionalInterests,
  }));

  storageService.logActivity({
    meetingId: updated!.id,
    subjectName: updated!.subjectName,
    action: 'Updated Meeting Details',
    status: 'info',
    details: `Updated details for ${updated!.subjectName} (${updated!.purpose}).`,
  });

  res.json({ meeting: updated });
});

// DELETE /api/meetings/:id
apiRouter.delete('/meetings/:id', (req: Request, res: Response) => {
  const existing = storageService.getMeetingById(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Meeting record not found.' });
    return;
  }
  storageService.deleteMeeting(req.params.id);
  storageService.logActivity({
    subjectName: existing.subjectName,
    action: 'Deleted Meeting',
    status: 'info',
    details: `Removed meeting record and saved briefing for ${existing.subjectName}.`,
  });
  res.json({ success: true, deletedId: req.params.id });
});

// POST /api/meetings/:id/research
apiRouter.post('/meetings/:id/research', async (req: Request, res: Response) => {
  const meeting = storageService.getMeetingById(req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting record not found.' });
    return;
  }

  const waitForCompletion = req.body?.wait === true;

  if (waitForCompletion) {
    try {
      const completed = await runMeetingResearch(meeting.id, { isRefresh: false });
      res.json({ meeting: completed });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to execute research.',
      });
    }
    return;
  }

  // Launch research in background so client can poll live stage progress
  runMeetingResearch(meeting.id, { isRefresh: false }).catch((err) => {
    console.error('Background research error:', err);
  });

  const current = storageService.getMeetingById(meeting.id);
  res.status(202).json({
    message: 'Research started',
    meeting: current,
  });
});

// POST /api/meetings/:id/refresh
apiRouter.post('/meetings/:id/refresh', async (req: Request, res: Response) => {
  const meeting = storageService.getMeetingById(req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting record not found.' });
    return;
  }

  const waitForCompletion = req.body?.wait === true;

  if (waitForCompletion) {
    try {
      const completed = await runMeetingResearch(meeting.id, { isRefresh: true });
      res.json({ meeting: completed });
    } catch (err: unknown) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to refresh research.',
      });
    }
    return;
  }

  runMeetingResearch(meeting.id, { isRefresh: true }).catch((err) => {
    console.error('Background refresh error:', err);
  });

  const current = storageService.getMeetingById(meeting.id);
  res.status(202).json({
    message: 'Smart research refresh started',
    meeting: current,
  });
});

// GET /api/meetings/:id/briefing
apiRouter.get('/meetings/:id/briefing', (req: Request, res: Response) => {
  const meeting = storageService.getMeetingById(req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting record not found.' });
    return;
  }
  res.json({
    meetingId: meeting.id,
    subjectName: meeting.subjectName,
    researchStatus: meeting.researchStatus,
    researchStartDate: meeting.researchStartDate,
    researchEndDate: meeting.researchEndDate,
    briefing: meeting.briefing,
    findings: meeting.findings,
    searchUsage: meeting.searchUsage,
  });
});

// GET /api/meetings/:id/history
apiRouter.get('/meetings/:id/history', (req: Request, res: Response) => {
  const meeting = storageService.getMeetingById(req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting record not found.' });
    return;
  }
  res.json({
    meetingId: meeting.id,
    subjectName: meeting.subjectName,
    history: meeting.history,
    lastRefreshDiff: meeting.lastRefreshDiff,
  });
});

// GET /api/integrations/status
apiRouter.get('/integrations/status', (_req: Request, res: Response) => {
  const statusPayload: IntegrationStatusResponse = {
    gemini: geminiService.getStatus(),
    tavily: tavilyService.getStatus(),
    bifrost: bifrostService.getStatus(),
    storage: storageService.getStorageMetadata(),
  };
  res.json(statusPayload);
});

// POST /api/integrations/tavily/test
apiRouter.post('/integrations/tavily/test', async (_req: Request, res: Response) => {
  const result = await tavilyService.testConnection();
  res.json(result);
});

// POST /api/integrations/bifrost/test
apiRouter.post('/integrations/bifrost/test', async (_req: Request, res: Response) => {
  const result = await bifrostService.testConnection();
  res.json(result);
});

// GET /api/usage
apiRouter.get('/usage', (_req: Request, res: Response) => {
  res.json({
    usage: storageService.getUsage(),
    activities: storageService.getActivities(),
  });
});

// PUT /api/usage/budget
apiRouter.put('/usage/budget', (req: Request, res: Response) => {
  const rawBudget = Number(req.body?.defaultSearchBudgetPerRun);
  if (Number.isNaN(rawBudget) || rawBudget < 3 || rawBudget > 8) {
    res.status(400).json({ error: 'Search budget must be between 3 and 8 queries per run.' });
    return;
  }
  const usage = storageService.setDefaultSearchBudget(rawBudget);
  res.json({ usage });
});
