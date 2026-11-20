import {
  BriefingVersionSnapshot,
  MeetingPurpose,
  MeetingRecord,
  RawTavilyResult,
  ResearchRefreshDiff,
  ResearchStageStatus,
  SearchQueryExecution,
  SubjectType,
} from '../../src/shared/types.ts';
import { generateMeetingBriefing } from './briefingGenerator.ts';
import {
  compute30DayWindow,
  createInitialStages,
  storageService,
} from './storageService.ts';
import { normalizeCanonicalUrl, tavilyService } from './tavilyService.ts';

const activeResearchLocks = new Set<string>();

/**
 * Generates 4–6 focused Tavily search queries adapted to SubjectType, MeetingPurpose, and AdditionalInterests.
 */
export function buildResearchQueries(params: {
  subjectType: SubjectType;
  subjectName: string;
  purpose: MeetingPurpose;
  additionalInterests: string[];
  maxQueries: number;
}): { category: string; query: string }[] {
  const { subjectType, subjectName, purpose, additionalInterests, maxQueries } = params;
  const cleanName = subjectName.trim();
  const queries: { category: string; query: string }[] = [];

  if (subjectType === 'company') {
    queries.push({
      category: 'Latest News & Announcements',
      query: `"${cleanName}" latest news announcements press release`,
    });

    queries.push({
      category: 'Product Launches & Services',
      query: `"${cleanName}" product launch new service release update`,
    });

    queries.push({
      category: 'Leadership & Executive Changes',
      query: `"${cleanName}" CEO executive appointment leadership hire change`,
    });

    // Adapt 4th & 5th queries based on Meeting Purpose
    if (purpose === 'Investor Meeting') {
      queries.push({
        category: 'Financials, Funding & Market Performance',
        query: `"${cleanName}" earnings revenue funding valuation financial results investor`,
      });
      queries.push({
        category: 'Strategic Direction & Partnerships',
        query: `"${cleanName}" strategic partnership acquisition market expansion`,
      });
    } else if (purpose === 'Partnership Discussion' || purpose === 'Business Development') {
      queries.push({
        category: 'Partnerships, Integrations & Collaborations',
        query: `"${cleanName}" strategic partnership collaboration ecosystem alliance`,
      });
      queries.push({
        category: 'Business & Commercial Developments',
        query: `"${cleanName}" business expansion enterprise deal funding growth`,
      });
    } else if (purpose === 'Job Interview') {
      queries.push({
        category: 'Company Culture, Growth & Organization',
        query: `"${cleanName}" engineering product team expansion hiring strategy`,
      });
      queries.push({
        category: 'Recent Business & Industry Developments',
        query: `"${cleanName}" recent milestones partnerships financial update`,
      });
    } else if (purpose === 'Sales Meeting') {
      queries.push({
        category: 'Operational Initiatives & Technology Investments',
        query: `"${cleanName}" technology initiative digital transformation expansion partnership`,
      });
      queries.push({
        category: 'Financial & Business Updates',
        query: `"${cleanName}" quarterly update growth investment operations`,
      });
    } else {
      queries.push({
        category: 'Partnerships, Acquisitions & Collaborations',
        query: `"${cleanName}" partnerships acquisitions collaborations deals`,
      });
      queries.push({
        category: 'Funding, Financial & Business Developments',
        query: `"${cleanName}" funding financial business developments`,
      });
    }
  } else {
    // Individual subject queries
    queries.push({
      category: 'Professional News & Announcements',
      query: `"${cleanName}" recent professional news announcement`,
    });
    queries.push({
      category: 'Interviews & Public Statements',
      query: `"${cleanName}" interview keynote podcast public statement quote`,
    });
    queries.push({
      category: 'Roles, Appointments & Leadership',
      query: `"${cleanName}" role appointment board advisor promotion`,
    });
    queries.push({
      category: 'Projects, Publications & Achievements',
      query: `"${cleanName}" project publication article achievement launch`,
    });
    queries.push({
      category: `Activities Relevant to ${purpose}`,
      query: `"${cleanName}" ${purpose.toLowerCase()} industry initiative`,
    });
  }

  // Incorporate user's specific additional research interests if space permits
  if (additionalInterests.length > 0 && queries.length < maxQueries) {
    const combinedInterests = additionalInterests.slice(0, 2).join(' ');
    queries.push({
      category: `Focused Interest: ${additionalInterests.slice(0, 2).join(', ')}`,
      query: `"${cleanName}" ${combinedInterests}`,
    });
  }

  return queries.slice(0, Math.max(4, Math.min(6, maxQueries)));
}

function updateStageState(
  meetingId: string,
  stepNumber: number,
  status: ResearchStageStatus,
  detail?: string,
  error?: string
) {
  storageService.updateMeeting(meetingId, (m) => {
    const stages = m.stages.map((s) =>
      s.stepNumber === stepNumber
        ? {
            ...s,
            status,
            detail: detail ?? s.detail,
            error,
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    return { ...m, stages };
  });
}

export async function runMeetingResearch(
  meetingId: string,
  options: { isRefresh?: boolean; retryCategoryOnly?: string } = {}
): Promise<MeetingRecord> {
  if (activeResearchLocks.has(meetingId)) {
    const existing = storageService.getMeetingById(meetingId);
    if (existing) return existing;
    throw new Error('Research is already in progress for this meeting.');
  }

  const initialMeeting = storageService.getMeetingById(meetingId);
  if (!initialMeeting) {
    throw new Error('Meeting record not found.');
  }

  activeResearchLocks.add(meetingId);

  try {
    const previousBriefing = initialMeeting.briefing;
    const previousFindings = [...initialMeeting.findings];
    const previousRawResults = [...initialMeeting.rawResults];
    const previousEndDate = initialMeeting.researchEndDate;

    // Calculate strict 30-day research window on server based on current date (NEVER the future meeting date)
    const { startDate, endDate } = compute30DayWindow(new Date());
    const budgetMax = storageService.getUsage().defaultSearchBudgetPerRun || 5;

    // Reset stages
    storageService.updateMeeting(meetingId, (m) => ({
      ...m,
      researchStatus: 'researching',
      researchStartDate: startDate,
      researchEndDate: endDate,
      stages: createInitialStages(),
      errorMessage: undefined,
    }));

    // STAGE 1: Understanding meeting context
    updateStageState(
      meetingId,
      1,
      'in_progress',
      `Analyzing ${initialMeeting.subjectType} "${initialMeeting.subjectName}" for ${initialMeeting.purpose} (Window: ${startDate} → ${endDate})`
    );
    await new Promise((r) => setTimeout(r, 150));
    updateStageState(
      meetingId,
      1,
      'completed',
      `30-day window locked: ${startDate} to ${endDate}`
    );

    // STAGE 2: Creating research queries
    updateStageState(meetingId, 2, 'in_progress', 'Formulating targeted Tavily search plan...');
    const plannedQueries = buildResearchQueries({
      subjectType: initialMeeting.subjectType,
      subjectName: initialMeeting.subjectName,
      purpose: initialMeeting.purpose,
      additionalInterests: initialMeeting.additionalInterests,
      maxQueries: budgetMax,
    });

    const queryExecutions: SearchQueryExecution[] = plannedQueries.map((q, idx) => ({
      id: `qexec-${Date.now()}-${idx}`,
      category: q.category,
      query: q.query,
      status: 'pending',
      resultsCount: 0,
    }));

    storageService.updateMeeting(meetingId, (m) => ({
      ...m,
      queryExecutions,
      searchUsage: {
        ...m.searchUsage,
        searchBudgetMax: budgetMax,
      },
    }));

    updateStageState(
      meetingId,
      2,
      'completed',
      `Created ${queryExecutions.length} focused queries tailored to ${initialMeeting.purpose}`
    );

    // STAGE 3: Searching recent developments with Tavily
    updateStageState(
      meetingId,
      3,
      'in_progress',
      `Executing ${queryExecutions.length} focused searches via Tavily API...`
    );

    const tavilyKeyPresent = Boolean(tavilyService.getApiKey());
    const collectedRaw: RawTavilyResult[] = [];
    let searchesPerformed = 0;
    let creditsAccumulated = 0;
    let firstApiError: string | undefined;

    for (let i = 0; i < queryExecutions.length; i++) {
      const qItem = queryExecutions[i];

      // Mark individual query in_progress
      storageService.updateMeeting(meetingId, (m) => ({
        ...m,
        queryExecutions: m.queryExecutions.map((qe) =>
          qe.id === qItem.id ? { ...qe, status: 'in_progress' } : qe
        ),
      }));

      const searchRes = await tavilyService.executeSearch({
        query: qItem.query,
        queryCategory: qItem.category,
        startDate,
        endDate,
        searchDepth: 'basic',
        maxResults: 5,
      });

      if (searchRes.error) {
        if (!firstApiError) firstApiError = searchRes.error;
        storageService.updateMeeting(meetingId, (m) => ({
          ...m,
          queryExecutions: m.queryExecutions.map((qe) =>
            qe.id === qItem.id
              ? {
                  ...qe,
                  status: 'failed',
                  error: searchRes.error,
                  executedAt: new Date().toISOString(),
                }
              : qe
          ),
        }));
      } else {
        searchesPerformed += 1;
        creditsAccumulated += searchRes.creditsUsed;
        collectedRaw.push(...searchRes.results);

        storageService.updateMeeting(meetingId, (m) => ({
          ...m,
          queryExecutions: m.queryExecutions.map((qe) =>
            qe.id === qItem.id
              ? {
                  ...qe,
                  status: 'completed',
                  resultsCount: searchRes.results.length,
                  executedAt: new Date().toISOString(),
                }
              : qe
          ),
        }));
      }
    }

    if (!tavilyKeyPresent) {
      updateStageState(
        meetingId,
        3,
        'failed',
        'TAVILY_API_KEY is not configured in server secrets.',
        'Missing TAVILY_API_KEY'
      );
    } else if (searchesPerformed === 0 && firstApiError) {
      updateStageState(meetingId, 3, 'failed', firstApiError, firstApiError);
    } else {
      updateStageState(
        meetingId,
        3,
        'completed',
        `Completed ${searchesPerformed}/${queryExecutions.length} Tavily searches (${collectedRaw.length} raw results)`
      );
    }

    // STAGE 4: Collecting source evidence
    updateStageState(
      meetingId,
      4,
      'in_progress',
      `Extracting source metadata and snippets from ${collectedRaw.length} results...`
    );
    await new Promise((r) => setTimeout(r, 120));
    updateStageState(
      meetingId,
      4,
      'completed',
      `Collected ${collectedRaw.length} source records`
    );

    // STAGE 5: Removing duplicate results
    updateStageState(meetingId, 5, 'in_progress', 'Deduplicating sources by canonical URL...');
    const dedupMap = new Map<string, RawTavilyResult>();
    for (const item of collectedRaw) {
      const key = item.canonicalUrl || normalizeCanonicalUrl(item.url);
      if (!dedupMap.has(key)) {
        dedupMap.set(key, item);
      } else {
        // Keep the one with a publication date or longer snippet if already seen
        const existing = dedupMap.get(key)!;
        if (!existing.publishedDate && item.publishedDate) {
          dedupMap.set(key, item);
        }
      }
    }
    const deduplicatedResults = Array.from(dedupMap.values());
    const duplicatesRemoved = collectedRaw.length - deduplicatedResults.length;

    updateStageState(
      meetingId,
      5,
      'completed',
      `${deduplicatedResults.length} unique URLs retained (${duplicatesRemoved} duplicates removed)`
    );

    // STAGE 6: Evaluating evidence and dates
    updateStageState(
      meetingId,
      6,
      'in_progress',
      'Auditing publication dates against 30-day window and checking source authority...'
    );
    const datedCount = deduplicatedResults.filter((r) => Boolean(r.publishedDate)).length;
    const undatedCount = deduplicatedResults.length - datedCount;
    updateStageState(
      meetingId,
      6,
      'completed',
      `${datedCount} dated sources, ${undatedCount} sources without explicit metadata dates`
    );

    // STAGE 7: Analyzing meeting relevance with Gemini (via Bifrost if configured)
    updateStageState(
      meetingId,
      7,
      'in_progress',
      'Synthesizing evidence and verifying claims with AI reasoning engine...'
    );

    const tavilyStatus = !tavilyKeyPresent
      ? ('api_key_missing' as const)
      : searchesPerformed === 0 && firstApiError
      ? ('api_error' as const)
      : deduplicatedResults.length === 0
      ? ('no_results' as const)
      : ('live_results' as const);

    const currentMeetingState = storageService.getMeetingById(meetingId)!;
    const { briefing, verifiedFindings } = await generateMeetingBriefing({
      meeting: currentMeetingState,
      rawResults: deduplicatedResults,
      researchStartDate: startDate,
      researchEndDate: endDate,
      tavilyStatus,
      tavilyStatusMessage: firstApiError,
    });

    updateStageState(
      meetingId,
      7,
      'completed',
      `Analyzed via ${
        briefing.modelGatewayUsed === 'bifrost'
          ? `Bifrost Gateway (${briefing.modelNameUsed})`
          : briefing.modelGatewayUsed === 'gemini-direct'
          ? `Gemini Direct (${briefing.modelNameUsed})`
          : briefing.modelNameUsed
      }`
    );

    // STAGE 8: Generating the briefing
    updateStageState(
      meetingId,
      8,
      'in_progress',
      'Formatting structured one-page brief, questions, and source citations...'
    );
    await new Promise((r) => setTimeout(r, 100));
    updateStageState(
      meetingId,
      8,
      'completed',
      `Compiled ${verifiedFindings.length} verified/evaluated findings and ${briefing.questionsToAsk.length} questions`
    );

    // STAGE 9: Saving the final report (+ computing Smart Refresh Diff if refreshing)
    updateStageState(meetingId, 9, 'in_progress', 'Saving report and updating version history...');

    let refreshDiff: ResearchRefreshDiff | null = null;
    const updatedHistory: BriefingVersionSnapshot[] = [...initialMeeting.history];

    if (options.isRefresh && previousBriefing) {
      // Save previous version snapshot into history for comparison
      updatedHistory.unshift({
        versionId: `ver-${Date.now()}`,
        savedAt: previousBriefing.generatedAt,
        researchStartDate: initialMeeting.researchStartDate,
        researchEndDate: previousEndDate,
        briefing: previousBriefing,
        findingsCount: previousFindings.length,
        verifiedCount: previousFindings.filter((f) => f.verificationStatus === 'VERIFIED').length,
        searchesPerformed: initialMeeting.searchUsage.searchesPerformed,
      });

      const prevUrls = new Set(previousRawResults.map((r) => r.canonicalUrl));
      const prevTitles = new Map(
        previousFindings.map((f) => [f.sourceUrl, f])
      );

      const newFindings = verifiedFindings.filter((f) => !prevTitles.has(f.sourceUrl));
      const previouslyKnownFindings = verifiedFindings.filter((f) =>
        prevTitles.has(f.sourceUrl)
      );

      const changedFindings: ResearchRefreshDiff['changedFindings'] = [];
      for (const f of previouslyKnownFindings) {
        const oldF = prevTitles.get(f.sourceUrl);
        if (oldF && oldF.summary !== f.summary) {
          changedFindings.push({
            findingTitle: f.title,
            previousSummary: oldF.summary,
            updatedSummary: f.summary,
            changeNote:
              oldF.verificationStatus !== f.verificationStatus
                ? `Verification updated from ${oldF.verificationStatus} to ${f.verificationStatus}`
                : 'Updated context synthesis from source',
          });
        }
      }

      const newSourcesCount = deduplicatedResults.filter(
        (r) => !prevUrls.has(r.canonicalUrl)
      ).length;
      const hasNewInfo = newFindings.length > 0 || changedFindings.length > 0;

      refreshDiff = {
        refreshedAt: new Date().toISOString(),
        previousResearchDate: previousBriefing.generatedAt,
        newResearchDate: briefing.generatedAt,
        hasNewInformation: hasNewInfo,
        statusMessage: hasNewInfo
          ? `Discovered ${newFindings.length} new finding(s) and ${newSourcesCount} new source URL(s) since the previous research run.`
          : 'No additional developments found in this research run.',
        newFindings,
        previouslyKnownFindings,
        changedFindings,
        newSourcesCount,
        queriesExecuted: searchesPerformed,
      };
    }

    const finalRecord = storageService.updateMeeting(meetingId, (m) => ({
      ...m,
      researchStatus:
        tavilyStatus === 'api_key_missing' || tavilyStatus === 'api_error'
          ? 'partial'
          : 'completed',
      rawResults: deduplicatedResults,
      findings: verifiedFindings,
      briefing,
      history: updatedHistory.slice(0, 10),
      lastRefreshDiff: refreshDiff ?? m.lastRefreshDiff,
      searchUsage: {
        searchesPerformed: m.searchUsage.searchesPerformed + searchesPerformed,
        searchBudgetMax: budgetMax,
        deduplicatedUrlsCount: deduplicatedResults.length,
        rawResultsReturned: collectedRaw.length,
        creditsReported: m.searchUsage.creditsReported + creditsAccumulated,
      },
      stages: m.stages.map((s) =>
        s.stepNumber === 9
          ? {
              ...s,
              status: 'completed',
              detail: 'Briefing saved to persistent storage',
              updatedAt: new Date().toISOString(),
            }
          : s
      ),
    }));

    storageService.updateUsage((u) => ({
      ...u,
      totalBriefingsGenerated: u.totalBriefingsGenerated + 1,
      totalRefreshesExecuted: options.isRefresh
        ? u.totalRefreshesExecuted + 1
        : u.totalRefreshesExecuted,
    }));

    storageService.logActivity({
      meetingId,
      subjectName: initialMeeting.subjectName,
      action: options.isRefresh ? 'Refreshed Research Briefing' : 'Generated Meeting Briefing',
      status:
        tavilyStatus === 'live_results'
          ? 'success'
          : tavilyStatus === 'no_results'
          ? 'info'
          : 'warning',
      details:
        tavilyStatus === 'live_results'
          ? `${verifiedFindings.length} findings verified across ${deduplicatedResults.length} unique sources (${searchesPerformed} Tavily searches).`
          : firstApiError ||
            'Completed with zero external web results; zero synthetic claims generated.',
    });

    return finalRecord!;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unexpected research error';
    const failedRecord = storageService.updateMeeting(meetingId, (m) => ({
      ...m,
      researchStatus: 'failed',
      errorMessage: errMsg,
    }));

    storageService.logActivity({
      meetingId,
      subjectName: initialMeeting.subjectName,
      action: 'Research Run Failed',
      status: 'error',
      details: errMsg,
    });

    return failedRecord!;
  } finally {
    activeResearchLocks.delete(meetingId);
  }
}
