import React from 'react';
import {
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  ActivityLogItem,
  MeetingRecord,
  UsageStatistics,
} from '../shared/types.ts';

interface OverviewPageProps {
  meetings: MeetingRecord[];
  activities: ActivityLogItem[];
  usage: UsageStatistics | null;
  onNavigateNewMeeting: () => void;
  onOpenMeeting: (meetingId: string) => void;
  onRunResearch: (meetingId: string) => void;
  onRefreshResearch: (meetingId: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  meetings,
  activities,
  usage,
  onNavigateNewMeeting,
  onOpenMeeting,
  onRunResearch,
  onRefreshResearch,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const totalMeetings = meetings.length;
  const briefingsGenerated = meetings.filter((m) => Boolean(m.briefing)).length;
  const researchUpdatesCount =
    (usage?.totalRefreshesExecuted || 0) +
    meetings.reduce((acc, m) => acc + m.history.length, 0);
  const upcomingMeetings = meetings.filter((m) => m.meetingDate >= todayStr);

  const recentBriefings = meetings.filter((m) => Boolean(m.briefing)).slice(0, 5);
  const mostRecentWithBriefing = recentBriefings[0];

  return (
    <div className="space-y-8">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Good day! Ready for your next meeting?
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Your research assistant keeps you informed about the people and companies you are
            meeting.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateNewMeeting}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Prepare a New Meeting
          </button>
        </div>
      </div>

      {/* 4 Summary Metric Cards (Single-Elevation, Tabular Numerals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Meetings</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {totalMeetings}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Saved records in workspace
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Briefings Generated</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {briefingsGenerated}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            30-day intelligence briefs compiled
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Research Updates</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {researchUpdatesCount}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Smart refreshes &amp; version snapshots
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Upcoming Meetings</div>
          <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 mt-2">
            {upcomingMeetings.length}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Scheduled on or after {todayStr}
          </div>
        </div>
      </div>

      {/* Empty State if workspace has 0 meetings */}
      {meetings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold text-slate-900">
              No meetings scheduled yet
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Enter a company or individual name, meeting date, and purpose to execute 30-day
              Tavily web research and generate a verified one-page briefing.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateNewMeeting}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Your First Meeting
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: A. Upcoming Meetings & B. Recent Briefings */}
          <div className="lg:col-span-8 space-y-6">
            {/* A. Upcoming Meetings */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Upcoming Meetings</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Scheduled sessions and pre-meeting research status
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {upcomingMeetings.length} scheduled
                </span>
              </div>

              {upcomingMeetings.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500">
                    No future meetings scheduled. Prepare a new meeting to get started.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {upcomingMeetings.map((m) => (
                    <div
                      key={m.id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {m.subjectType === 'company' ? 'Company' : 'Individual'}
                          </span>
                          <span>&middot;</span>
                          <span>{m.purpose}</span>
                          {m.isSampleDemo && (
                            <>
                              <span>&middot;</span>
                              <span className="text-indigo-600 font-medium">
                                Demo Scenario
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-base font-bold text-slate-900 mt-0.5 truncate">
                          {m.subjectName}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1 font-mono tabular-nums">
                          <span>
                            {m.meetingDate} at {m.meetingTime} ({m.meetingTimeZone})
                          </span>
                          <span>&middot;</span>
                          <span className="font-sans">
                            Status:{' '}
                            <strong
                              className={
                                m.researchStatus === 'completed'
                                  ? 'text-emerald-700'
                                  : m.researchStatus === 'researching'
                                  ? 'text-indigo-600'
                                  : m.researchStatus === 'partial'
                                  ? 'text-amber-700'
                                  : 'text-slate-700'
                              }
                            >
                              {m.researchStatus === 'completed'
                                ? 'Briefing Ready'
                                : m.researchStatus === 'researching'
                                ? 'Researching...'
                                : m.researchStatus === 'partial'
                                ? 'Briefing Ready (Limited Evidence)'
                                : 'Ready to Research'}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {m.briefing ? (
                          <button
                            type="button"
                            onClick={() => onOpenMeeting(m.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Open Briefing
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRunResearch(m.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Generate Briefing
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* B. Recent Briefings */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Recent Briefings</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Saved intelligence reports with source verification counts
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {recentBriefings.length} saved
                </span>
              </div>

              {recentBriefings.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500">
                    No briefings generated yet. Select a meeting above or create a new meeting to
                    run 30-day Tavily research.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-3 pr-4 font-semibold">Subject</th>
                        <th className="py-3 px-3 font-semibold">30-Day Window</th>
                        <th className="py-3 px-3 font-semibold text-right">Verified</th>
                        <th className="py-3 px-3 font-semibold text-right">Uncertain</th>
                        <th className="py-3 px-3 font-semibold">Last Updated</th>
                        <th className="py-3 pl-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {recentBriefings.map((m) => {
                        const verifiedCount = m.findings.filter(
                          (f) => f.verificationStatus === 'VERIFIED'
                        ).length;
                        const uncertainCount = m.findings.filter(
                          (f) => f.verificationStatus !== 'VERIFIED'
                        ).length;
                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80">
                            <td className="py-3 pr-4">
                              <div className="font-semibold text-slate-900">{m.subjectName}</div>
                              <div className="text-slate-500">{m.purpose}</div>
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                              {m.researchStartDate} &rarr; {m.researchEndDate}
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-right font-semibold text-emerald-700">
                              {verifiedCount}
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-right text-amber-700">
                              {uncertainCount}
                            </td>
                            <td className="py-3 px-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {new Date(m.updatedAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 pl-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => onOpenMeeting(m.id)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                View Brief
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Right 4 Columns: C. Quick Actions & D. Research Activity */}
          <div className="lg:col-span-4 space-y-6">
            {/* C. Quick Actions */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-200">
                Quick Actions
              </h2>
              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={onNavigateNewMeeting}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Prepare a New Meeting
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={!mostRecentWithBriefing}
                  onClick={() =>
                    mostRecentWithBriefing && onOpenMeeting(mostRecentWithBriefing.id)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
                >
                  <span className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {mostRecentWithBriefing
                        ? `Open Briefing: ${mostRecentWithBriefing.subjectName}`
                        : 'Open Previous Briefing'}
                    </span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>

                <button
                  type="button"
                  disabled={meetings.length === 0}
                  onClick={() => {
                    const target = mostRecentWithBriefing || meetings[0];
                    if (target) {
                      if (target.briefing) {
                        onRefreshResearch(target.id);
                      } else {
                        onRunResearch(target.id);
                      }
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
                >
                  <span className="flex items-center gap-2 truncate">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {mostRecentWithBriefing
                        ? `Refresh Research: ${mostRecentWithBriefing.subjectName}`
                        : meetings[0]
                        ? `Run Research: ${meetings[0].subjectName}`
                        : 'Refresh Research'}
                    </span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </section>

            {/* D. Research Activity */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h2 className="text-base font-bold text-slate-900">Research Activity</h2>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>

              {activities.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  No research activity recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 mt-2">
                  {activities.slice(0, 7).map((act) => (
                    <div key={act.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900 truncate">
                          {act.subjectName}
                        </span>
                        <span className="font-mono tabular-nums text-slate-400 shrink-0">
                          {new Date(act.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                        <ShieldCheck
                          className={`w-3.5 h-3.5 shrink-0 ${
                            act.status === 'success'
                              ? 'text-emerald-600'
                              : act.status === 'warning'
                              ? 'text-amber-600'
                              : act.status === 'error'
                              ? 'text-red-600'
                              : 'text-slate-400'
                          }`}
                        />
                        <span>{act.action}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{act.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
