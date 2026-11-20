import {
  ActivityLogItem,
  IntegrationStatusResponse,
  MeetingPurpose,
  MeetingRecord,
  SubjectType,
  UsageStatistics,
} from '../shared/types.ts';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed with HTTP ${res.status}`);
  }
  return data as T;
}

export const apiClient = {
  async getMeetings(): Promise<MeetingRecord[]> {
    const res = await fetch('/api/meetings');
    const data = await handleResponse<{ meetings: MeetingRecord[] }>(res);
    return data.meetings;
  },

  async getMeeting(id: string): Promise<MeetingRecord> {
    const res = await fetch(`/api/meetings/${encodeURIComponent(id)}`);
    const data = await handleResponse<{ meeting: MeetingRecord }>(res);
    return data.meeting;
  },

  async createMeeting(payload: {
    subjectType: SubjectType;
    subjectName: string;
    meetingDate: string;
    meetingTime: string;
    meetingTimeZone: string;
    purpose: MeetingPurpose;
    context: string;
    additionalInterests: string[];
  }): Promise<MeetingRecord> {
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<{ meeting: MeetingRecord }>(res);
    return data.meeting;
  },

  async updateMeeting(
    id: string,
    payload: Partial<{
      subjectType: SubjectType;
      subjectName: string;
      meetingDate: string;
      meetingTime: string;
      meetingTimeZone: string;
      purpose: MeetingPurpose;
      context: string;
      additionalInterests: string[];
    }>
  ): Promise<MeetingRecord> {
    const res = await fetch(`/api/meetings/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<{ meeting: MeetingRecord }>(res);
    return data.meeting;
  },

  async deleteMeeting(id: string): Promise<void> {
    const res = await fetch(`/api/meetings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    await handleResponse<{ success: boolean }>(res);
  },

  async startResearch(id: string, wait = false): Promise<MeetingRecord> {
    const res = await fetch(`/api/meetings/${encodeURIComponent(id)}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wait }),
    });
    const data = await handleResponse<{ meeting: MeetingRecord }>(res);
    return data.meeting;
  },

  async refreshResearch(id: string, wait = false): Promise<MeetingRecord> {
    const res = await fetch(`/api/meetings/${encodeURIComponent(id)}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wait }),
    });
    const data = await handleResponse<{ meeting: MeetingRecord }>(res);
    return data.meeting;
  },

  async getIntegrationStatus(): Promise<IntegrationStatusResponse> {
    const res = await fetch('/api/integrations/status');
    return handleResponse<IntegrationStatusResponse>(res);
  },

  async testTavilyConnection(): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
  }> {
    const res = await fetch('/api/integrations/tavily/test', {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async testBifrostConnection(): Promise<{
    success: boolean;
    message: string;
    latencyMs?: number;
    endpoint?: string;
  }> {
    const res = await fetch('/api/integrations/bifrost/test', {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async getUsageAndActivities(): Promise<{
    usage: UsageStatistics;
    activities: ActivityLogItem[];
  }> {
    const res = await fetch('/api/usage');
    return handleResponse(res);
  },

  async updateSearchBudget(defaultSearchBudgetPerRun: number): Promise<UsageStatistics> {
    const res = await fetch('/api/usage/budget', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultSearchBudgetPerRun }),
    });
    const data = await handleResponse<{ usage: UsageStatistics }>(res);
    return data.usage;
  },
};

export function generateDownloadableBriefingHtml(meeting: MeetingRecord): string {
  const b = meeting.briefing;
  if (!b) return '';

  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const devRows = b.recentDevelopments
    .map(
      (f) => `
      <div style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
          ${esc(f.category)} &middot; ${esc(f.publicationDate)} &middot; Verification: <strong>${esc(
        f.verificationStatus
      )}</strong> (${esc(f.confidenceLevel)} confidence)
        </div>
        <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">
          ${esc(f.title)}
        </div>
        <div style="font-size: 13px; color: #334155; line-height: 1.5; margin-bottom: 6px;">
          ${esc(f.summary)}
        </div>
        <div style="font-size: 12px; color: #1e293b; margin-bottom: 4px;">
          <strong>Meeting Relevance:</strong> ${esc(f.whyItMatters)}
        </div>
        <div style="font-size: 12px; color: #475569;">
          Source: <a href="${esc(f.sourceUrl)}" style="color: #1d4ed8;">${esc(
        f.sourceTitle
      )} (${esc(f.sourceName)})</a>
        </div>
      </div>`
    )
    .join('');

  const undatedRows = b.undatedContextFindings
    .map(
      (f) => `
      <div style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 11px; color: #64748b;">
          ${esc(f.category)} &middot; ${esc(f.publicationDate)} &middot; ${esc(
        f.verificationStatus
      )}
        </div>
        <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin: 2px 0;">
          ${esc(f.title)}
        </div>
        <div style="font-size: 12.5px; color: #334155;">${esc(f.summary)}</div>
        <div style="font-size: 11.5px; color: #475569; margin-top: 3px;">
          Source: <a href="${esc(f.sourceUrl)}" style="color: #1d4ed8;">${esc(
        f.sourceTitle
      )}</a>
        </div>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MeetWise AI Briefing — ${esc(meeting.subjectName)}</title>
  <style>
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #0f172a;
      max-width: 820px;
      margin: 24px auto;
      padding: 0 24px;
      line-height: 1.5;
    }
    h1 { font-size: 22px; margin: 0 0 4px 0; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-top: 24px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 24px; font-size: 13px; background: #f8fafc; padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; margin-top: 12px; }
    ul { padding-left: 18px; font-size: 13px; }
    li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
    <div>
      <div style="font-size: 11px; font-weight: 600; color: #475569;">MEETWISE AI &middot; PRE-MEETING INTELLIGENCE BRIEF</div>
      <h1>${esc(meeting.subjectName)}</h1>
    </div>
    <div style="font-size: 12px; color: #475569; text-align: right;">
      Research Window: ${esc(b.researchStartDate)} to ${esc(b.researchEndDate)}
    </div>
  </div>

  <div class="meta-grid">
    <div><strong>Subject:</strong> ${esc(meeting.subjectName)} (${esc(meeting.subjectType)})</div>
    <div><strong>Meeting Purpose:</strong> ${esc(meeting.purpose)}</div>
    <div><strong>Scheduled Date & Time:</strong> ${esc(meeting.meetingDate)} at ${esc(
    meeting.meetingTime
  )} (${esc(meeting.meetingTimeZone)})</div>
    <div><strong>Briefing Generated:</strong> ${esc(b.generatedAt.split('T')[0])}</div>
  </div>

  <h2>B. Subject Overview</h2>
  <p style="font-size: 13.5px; color: #1e293b;">${esc(b.subjectOverview)}</p>

  <h2>C. What's New — Last 30 Days (${esc(b.researchStartDate)} to ${esc(b.researchEndDate)})</h2>
  ${
    devRows ||
    '<p style="font-size:13px; color:#64748b;">No confirmed dated developments within the 30-day window.</p>'
  }

  ${
    undatedRows
      ? `<h2>Undated / Background Context Sources</h2>${undatedRows}`
      : ''
  }

  <h2>D. Key Insights</h2>
  <ul>
    ${b.keyInsights.map((i) => `<li>${esc(i)}</li>`).join('')}
  </ul>

  <h2>E. Opportunities and Risks</h2>
  <ul>
    ${b.opportunitiesAndRisks
      .map(
        (or) =>
          `<li><strong>[${esc(or.type)} &middot; ${
            or.basis === 'EVIDENCE_BASED' ? 'Evidence-Based' : 'Analytical Inference'
          }] ${esc(or.title)}:</strong> ${esc(or.description)}</li>`
      )
      .join('')}
  </ul>

  <h2>F. Questions to Ask</h2>
  <ul>
    ${b.questionsToAsk
      .map(
        (q) =>
          `<li><strong>${esc(q.question)}</strong><br/><span style="color:#475569; font-size:12px;">Rationale: ${esc(
            q.rationale
          )}</span></li>`
      )
      .join('')}
  </ul>

  <h2>G. Talking Points</h2>
  <ul>
    ${b.talkingPoints
      .map(
        (tp) =>
          `<li><strong>${esc(tp.headline)}:</strong> ${esc(tp.detail)} <em>(${esc(
            tp.suggestedAngle
          )})</em></li>`
      )
      .join('')}
  </ul>

  <h2>H. Source References</h2>
  <ul>
    ${b.sourceReferences
      .map(
        (s) =>
          `<li><strong>${esc(s.sourceName)}</strong> — <a href="${esc(
            s.url
          )}" style="color:#1d4ed8;">${esc(s.articleTitle)}</a> (${esc(
            s.publicationDate
          )} &middot; ${esc(s.verificationStatus)})</li>`
      )
      .join('')}
  </ul>
</body>
</html>`;
}
