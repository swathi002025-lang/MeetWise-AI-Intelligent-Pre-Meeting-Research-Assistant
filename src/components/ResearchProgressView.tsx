import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { MeetingRecord } from '../shared/types.ts';

interface ResearchProgressViewProps {
  meeting: MeetingRecord;
  onRetryResearch: () => void;
  onOpenPartialBriefing?: () => void;
}

export const ResearchProgressView: React.FC<ResearchProgressViewProps> = ({
  meeting,
  onRetryResearch,
  onOpenPartialBriefing,
}) => {
  const completedCount = meeting.stages.filter((s) => s.status === 'completed').length;
  const failedStages = meeting.stages.filter((s) => s.status === 'failed');
  const failedQueries = meeting.queryExecutions.filter((q) => q.status === 'failed');

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Live Research Orchestrator &middot; 30-Day Window:{' '}
              <span className="font-mono tabular-nums text-slate-700">
                {meeting.researchStartDate}
              </span>{' '}
              to{' '}
              <span className="font-mono tabular-nums text-slate-700">
                {meeting.researchEndDate}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Researching {meeting.subjectName}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {meeting.purpose} &middot; Scheduled for{' '}
              <span className="font-mono tabular-nums">{meeting.meetingDate}</span> at{' '}
              <span className="font-mono tabular-nums">{meeting.meetingTime}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-xs text-slate-500">Stage Progress</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                {completedCount} / {meeting.stages.length}
              </div>
            </div>
          </div>
        </div>

        {/* 9-Stage Real-time Checklist */}
        <div className="divide-y divide-slate-100 mt-2">
          {meeting.stages.map((stage) => {
            return (
              <div
                key={stage.id}
                className="py-3.5 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {stage.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    {stage.status === 'in_progress' && (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    )}
                    {stage.status === 'failed' && (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    {stage.status === 'pending' && (
                      <Clock className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono tabular-nums text-slate-400">
                        0{stage.stepNumber}.
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          stage.status === 'completed'
                            ? 'text-slate-900'
                            : stage.status === 'in_progress'
                            ? 'text-indigo-950 font-semibold'
                            : stage.status === 'failed'
                            ? 'text-red-700 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                    {stage.detail && (
                      <p className="text-xs text-slate-500 mt-0.5">{stage.detail}</p>
                    )}
                    {stage.error && (
                      <p className="text-xs text-red-600 mt-1">{stage.error}</p>
                    )}
                  </div>
                </div>

                <div className="text-xs font-mono tabular-nums shrink-0 text-slate-500">
                  {stage.status === 'completed' && 'Completed'}
                  {stage.status === 'in_progress' && 'In progress'}
                  {stage.status === 'failed' && 'Failed'}
                  {stage.status === 'pending' && 'Pending'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Focused Tavily Queries Breakdown */}
        {meeting.queryExecutions.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Focused Tavily Search Queries ({meeting.queryExecutions.length})
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Budget: {meeting.searchUsage.searchBudgetMax} searches max
              </span>
            </div>

            <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
              {meeting.queryExecutions.map((q) => (
                <div
                  key={q.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800">{q.category}</span>
                    <span className="text-slate-400 mx-1.5">&middot;</span>
                    <span className="font-mono text-slate-500 truncate">{q.query}</span>
                    {q.error && (
                      <div className="text-red-600 mt-0.5">{q.error}</div>
                    )}
                  </div>
                  <div className="font-mono tabular-nums text-slate-600 shrink-0">
                    {q.status === 'completed' && `${q.resultsCount} results`}
                    {q.status === 'in_progress' && 'Searching Tavily...'}
                    {q.status === 'failed' && 'Query failed'}
                    {q.status === 'pending' && 'Queued'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error & Retry Interface if any stage or query failed */}
        {(failedStages.length > 0 ||
          failedQueries.length > 0 ||
          meeting.researchStatus === 'failed') && (
          <div className="mt-6 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-red-700">
              {meeting.errorMessage ||
                failedQueries[0]?.error ||
                'One or more research queries encountered an issue. Check your Tavily API configuration in Settings or retry.'}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {onOpenPartialBriefing && meeting.briefing && (
                <button
                  type="button"
                  onClick={onOpenPartialBriefing}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Open Available Briefing
                </button>
              )}
              <button
                type="button"
                onClick={onRetryResearch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Research Run
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
