import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  History,
  Play,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  BriefingVersionSnapshot,
  MeetingRecord,
  ResearchFinding,
  VerificationStatus,
} from '../shared/types.ts';
import { generateDownloadableBriefingHtml } from '../services/apiClient.ts';

interface BriefingReportViewProps {
  meeting: MeetingRecord;
  isRefreshing: boolean;
  onBack: () => void;
  onRefreshResearch: () => void;
  onStartInitialResearch: () => void;
  onOpenSettings: () => void;
}

type ViewMode = 'executive' | 'prep' | 'appendix' | 'compare';

export const BriefingReportView: React.FC<BriefingReportViewProps> = ({
  meeting,
  isRefreshing,
  onBack,
  onRefreshResearch,
  onStartInitialResearch,
  onOpenSettings,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('executive');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedQuestions, setCopiedQuestions] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] =
    useState<BriefingVersionSnapshot | null>(meeting.history[0] || null);

  const briefing = meeting.briefing;

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    meeting.findings.forEach((f) => set.add(f.category));
    return ['ALL', ...Array.from(set)];
  }, [meeting.findings]);

  const filterFinding = (f: ResearchFinding) => {
    if (statusFilter !== 'ALL' && f.verificationStatus !== statusFilter) {
      return false;
    }
    if (categoryFilter !== 'ALL' && f.category !== categoryFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const hay = `${f.title} ${f.summary} ${f.whyItMatters} ${f.sourceName} ${f.sourceTitle} ${f.evidenceText}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filteredRecentDevelopments = useMemo(() => {
    if (!briefing) return [];
    return briefing.recentDevelopments.filter(filterFinding);
  }, [briefing, statusFilter, categoryFilter, searchTerm]);

  const filteredUndatedFindings = useMemo(() => {
    if (!briefing) return [];
    return briefing.undatedContextFindings.filter(filterFinding);
  }, [briefing, statusFilter, categoryFilter, searchTerm]);

  const verificationCounts = useMemo(() => {
    const counts = {
      VERIFIED: 0,
      PARTIALLY_VERIFIED: 0,
      UNVERIFIED: 0,
      CONFLICTING: 0,
    };
    meeting.findings.forEach((f) => {
      counts[f.verificationStatus] = (counts[f.verificationStatus] || 0) + 1;
    });
    return counts;
  }, [meeting.findings]);

  const handleCopySummary = async () => {
    if (!briefing) return;
    const text = [
      `MEETWISE AI — PRE-MEETING BRIEF: ${meeting.subjectName}`,
      `Purpose: ${meeting.purpose} | Scheduled: ${meeting.meetingDate} ${meeting.meetingTime} (${meeting.meetingTimeZone})`,
      `30-Day Research Window: ${briefing.researchStartDate} to ${briefing.researchEndDate}`,
      '',
      `SUBJECT OVERVIEW:`,
      briefing.subjectOverview,
      '',
      `KEY DEVELOPMENTS (${briefing.recentDevelopments.length}):`,
      ...briefing.recentDevelopments.map(
        (f, idx) =>
          `${idx + 1}. [${f.verificationStatus}] ${f.title} (${f.publicationDate}) — ${f.summary} Source: ${f.sourceUrl}`
      ),
      '',
      `KEY INSIGHTS:`,
      ...briefing.keyInsights.map((i) => `- ${i}`),
    ].join('\n');

    await navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyQuestions = async () => {
    if (!briefing) return;
    const text = briefing.questionsToAsk
      .map(
        (q, idx) =>
          `${idx + 1}. ${q.question}\n   Context: ${q.rationale}`
      )
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopiedQuestions(true);
    setTimeout(() => setCopiedQuestions(false), 2000);
  };

  const handleDownloadHtmlReport = () => {
    const html = generateDownloadableBriefingHtml(meeting);
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = meeting.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `meetwise-briefing-${safeName}-${meeting.researchEndDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const renderVerificationMeta = (status: VerificationStatus) => {
    if (status === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
          <ShieldCheck className="w-3.5 h-3.5" />
          VERIFIED
        </span>
      );
    }
    if (status === 'PARTIALLY_VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
          <HelpCircle className="w-3.5 h-3.5" />
          PARTIALLY VERIFIED
        </span>
      );
    }
    if (status === 'CONFLICTING') {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
          <ShieldAlert className="w-3.5 h-3.5" />
          CONFLICTING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
        <AlertTriangle className="w-3.5 h-3.5" />
        UNVERIFIED
      </span>
    );
  };

  // If this meeting has not yet run live research (e.g. pre-seeded NVIDIA Demo scenario or draft)
  if (!briefing) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Meetings
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="text-xs font-medium text-slate-500">
            {meeting.isSampleDemo ? 'Demonstration Scenario' : 'Unresearched Meeting Record'}{' '}
            &middot; {meeting.subjectType === 'company' ? 'Company' : 'Individual'}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {meeting.subjectName} — {meeting.purpose}
          </h1>
          <p className="text-sm text-slate-600 mt-2 max-w-2xl">
            {meeting.context ||
              'No additional meeting context entered. Ready to run 30-day web intelligence.'}
          </p>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Zero Fabricated Preloads — Ready for Live Tavily Research
            </h2>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
              In compliance with MeetWise AI’s strict factual verification protocol, sample and draft
              meetings never preload fabricated news, synthetic financial numbers, or invented source
              links. Click below to execute real 30-day Tavily web searches (
              <span className="font-mono tabular-nums">{meeting.researchStartDate}</span> to{' '}
              <span className="font-mono tabular-nums">{meeting.researchEndDate}</span>) and generate
              the verified briefing.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStartInitialResearch}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4" />
                Run Live 30-Day Research Now
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Verify API Keys in Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Action Toolbar (Hidden when printing A4 report) */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            All Meetings
          </button>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          {/* Segmented View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setViewMode('executive')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'executive'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              One-Page Brief
            </button>
            <button
              type="button"
              onClick={() => setViewMode('prep')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'prep'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Meeting Prep Mode
            </button>
            <button
              type="button"
              onClick={() => setViewMode('appendix')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'appendix'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Evidence Appendix ({meeting.findings.length})
            </button>
            {(meeting.lastRefreshDiff || meeting.history.length > 0) && (
              <button
                type="button"
                onClick={() => setViewMode('compare')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'compare'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Research Diff &amp; History ({meeting.history.length})
              </button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyQuestions}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {copiedQuestions ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedQuestions ? 'Questions Copied' : 'Copy Questions'}
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {copiedSummary ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            {copiedSummary ? 'Summary Copied' : 'Copy Summary'}
          </button>

          <button
            type="button"
            onClick={handleDownloadHtmlReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download Report
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Export PDF / Print A4
          </button>

          <button
            type="button"
            onClick={onRefreshResearch}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Latest Research'}
          </button>
        </div>
      </div>

      {/* Honest API Warning Banner if Tavily key was missing or returned an error */}
      {briefing.tavilyStatus !== 'live_results' && (
        <div className="no-print bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">
                {briefing.tavilyStatus === 'api_key_missing'
                  ? 'Live Tavily Search Key Not Configured: '
                  : briefing.tavilyStatus === 'api_error'
                  ? 'Tavily Search API Notice: '
                  : 'Zero Indexed Web Results in 30-Day Window: '}
              </span>
              {briefing.tavilyStatusMessage ||
                'No external web sources were returned. MeetWise AI strictly enforces zero hallucination and has not invented any synthetic news or financial figures.'}
            </div>
          </div>
          {briefing.tavilyStatus === 'api_key_missing' && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/70 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Check Integration Settings
            </button>
          )}
        </div>
      )}

      {/* Smart Refresh Notification Banner if recently refreshed */}
      {meeting.lastRefreshDiff && viewMode !== 'compare' && (
        <div className="no-print bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-700">
            <span className="font-semibold text-slate-900">Latest Research Refresh:</span>{' '}
            {meeting.lastRefreshDiff.statusMessage}{' '}
            <span className="text-slate-500 font-mono tabular-nums">
              ({new Date(meeting.lastRefreshDiff.refreshedAt).toLocaleString()})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('compare')}
            className="text-indigo-600 hover:text-indigo-800 font-semibold whitespace-nowrap shrink-0"
          >
            Compare Previous &amp; Latest Research &rarr;
          </button>
        </div>
      )}

      {/* VIEW MODE 2: MEETING PREPARATION MODE (Rapid Pre-Call Review) */}
      {viewMode === 'prep' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8">
          <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Meeting Preparation Mode &middot; 2-Minute Rapid Review
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                {meeting.subjectName} — {meeting.purpose}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                Scheduled: {meeting.meetingDate} at {meeting.meetingTime} ({meeting.meetingTimeZone})
                &middot; Research Period: {briefing.researchStartDate} to {briefing.researchEndDate}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('executive')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Switch to Full One-Page Brief
            </button>
          </div>

          {/* 1. Subject Overview */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              01. Subject Overview
            </h2>
            <p className="text-base text-slate-800 leading-relaxed">
              {briefing.subjectOverview}
            </p>
          </div>

          {/* 2. Five Most Important Facts */}
          <div className="pt-6 border-t border-slate-200">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              02. Five Most Important Facts to Know Before Joining
            </h2>
            <ol className="space-y-2.5">
              {briefing.topFiveFactsForPrep.slice(0, 5).map((fact, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-800">
                  <span className="font-mono tabular-nums font-semibold text-indigo-600 shrink-0">
                    0{idx + 1}.
                  </span>
                  <span>{fact}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* 3. Questions to Ask & Potential Discussion Opportunities */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                03. High-Impact Questions to Ask
              </h2>
              <div className="divide-y divide-slate-100">
                {briefing.questionsToAsk.map((q, idx) => (
                  <div key={q.id} className="py-3 first:pt-0">
                    <div className="text-sm font-semibold text-slate-900">
                      {idx + 1}. {q.question}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{q.rationale}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                04. Potential Discussion Opportunities
              </h2>
              <div className="divide-y divide-slate-100">
                {briefing.talkingPoints.map((tp) => (
                  <div key={tp.id} className="py-3 first:pt-0">
                    <div className="text-sm font-semibold text-slate-900">{tp.headline}</div>
                    <div className="text-xs text-slate-600 mt-1">{tp.detail}</div>
                    <div className="text-xs text-indigo-700 mt-1 font-medium">
                      Angle: {tp.suggestedAngle}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Important Developments to Remember */}
          <div className="pt-6 border-t border-slate-200">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              05. Verified Developments to Remember ({briefing.recentDevelopments.length})
            </h2>
            {briefing.recentDevelopments.length === 0 ? (
              <p className="text-sm text-slate-500">
                No dated developments confirmed within the 30-day window.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {briefing.recentDevelopments.slice(0, 5).map((f) => (
                  <div key={f.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{f.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{f.whyItMatters}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0 font-mono tabular-nums">
                      <span>{f.publicationDate}</span>
                      <span>&middot;</span>
                      {renderVerificationMeta(f.verificationStatus)}
                      <span>&middot;</span>
                      <a
                        href={f.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline inline-flex items-center gap-1 font-sans"
                      >
                        {f.sourceName}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 4: RESEARCH DIFF & VERSION COMPARISON */}
      {viewMode === 'compare' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Smart Research Refresh &amp; Version History
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                Comparing Previous vs. Latest Research for {meeting.subjectName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onRefreshResearch}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Run Another Refresh
            </button>
          </div>

          {meeting.lastRefreshDiff ? (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  Previous Run:{' '}
                  {new Date(meeting.lastRefreshDiff.previousResearchDate).toLocaleString()}{' '}
                  &rarr; Latest Run:{' '}
                  {new Date(meeting.lastRefreshDiff.newResearchDate).toLocaleString()}
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-1">
                  {meeting.lastRefreshDiff.statusMessage}
                </div>
              </div>

              {/* Newly Discovered Developments */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Newly Discovered Developments ({meeting.lastRefreshDiff.newFindings.length})
                </h3>
                {meeting.lastRefreshDiff.newFindings.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No additional developments found in this research run.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                    {meeting.lastRefreshDiff.newFindings.map((f) => (
                      <div key={f.id} className="py-3.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-emerald-700">NEW FINDING</span>
                          <span>&middot;</span>
                          <span className="font-mono tabular-nums">{f.publicationDate}</span>
                          <span>&middot;</span>
                          {renderVerificationMeta(f.verificationStatus)}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {f.title}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{f.summary}</p>
                        <a
                          href={f.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1.5"
                        >
                          {f.sourceTitle} ({f.sourceName})
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Changes in Existing Evidence */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Changes in Existing Information ({meeting.lastRefreshDiff.changedFindings.length})
                </h3>
                {meeting.lastRefreshDiff.changedFindings.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No material changes detected in previously saved source claims.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                    {meeting.lastRefreshDiff.changedFindings.map((chg, i) => (
                      <div key={i} className="py-3.5 space-y-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {chg.findingTitle}
                        </div>
                        <div className="text-xs text-amber-700 font-medium">{chg.changeNote}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                          <div className="text-slate-500">
                            <span className="font-semibold text-slate-700">Previous: </span>
                            {chg.previousSummary}
                          </div>
                          <div className="text-slate-800">
                            <span className="font-semibold text-slate-900">Updated: </span>
                            {chg.updatedSummary}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Previously Known Findings */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Previously Known Findings Retained (
                  {meeting.lastRefreshDiff.previouslyKnownFindings.length})
                </h3>
                {meeting.lastRefreshDiff.previouslyKnownFindings.length === 0 ? (
                  <p className="text-sm text-slate-500">None.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {meeting.lastRefreshDiff.previouslyKnownFindings.map((f) => (
                      <div
                        key={f.id}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-medium text-slate-800">{f.title}</span>
                        <span className="text-slate-500 font-mono tabular-nums shrink-0">
                          {f.sourceName} &middot; {f.publicationDate}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No refresh diff recorded yet. Click &ldquo;Refresh Latest Research&rdquo; to compare
              new search results against this baseline briefing.
            </p>
          )}

          {/* Archived Snapshots */}
          {meeting.history.length > 0 && (
            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Saved Historical Briefing Versions ({meeting.history.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {meeting.history.map((h, idx) => (
                  <button
                    key={h.versionId}
                    type="button"
                    onClick={() => setSelectedHistoryVersion(h)}
                    className={`px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border transition-colors ${
                      selectedHistoryVersion?.versionId === h.versionId
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    v{meeting.history.length - idx} &middot;{' '}
                    {new Date(h.savedAt).toLocaleString()}
                  </button>
                ))}
              </div>
              {selectedHistoryVersion && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                  <div className="font-semibold text-slate-900">
                    Archived Snapshot ({new Date(selectedHistoryVersion.savedAt).toLocaleString()})
                  </div>
                  <div className="text-slate-600">
                    Window: {selectedHistoryVersion.researchStartDate} to{' '}
                    {selectedHistoryVersion.researchEndDate} &middot;{' '}
                    {selectedHistoryVersion.findingsCount} findings (
                    {selectedHistoryVersion.verifiedCount} verified)
                  </div>
                  <p className="text-slate-700 pt-1">
                    {selectedHistoryVersion.briefing.subjectOverview}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search & Verification Filter Bar for One-Page Brief & Appendix */}
      {(viewMode === 'executive' || viewMode === 'appendix') && (
        <div className="no-print bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search within briefing */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search findings, sources, or evidence quotes..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Interactive Verification Status Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: `All (${meeting.findings.length})` },
                  { id: 'VERIFIED', label: `Verified (${verificationCounts.VERIFIED})` },
                  {
                    id: 'PARTIALLY_VERIFIED',
                    label: `Partial (${verificationCounts.PARTIALLY_VERIFIED})`,
                  },
                  { id: 'UNVERIFIED', label: `Unverified (${verificationCounts.UNVERIFIED})` },
                  { id: 'CONFLICTING', label: `Conflicting (${verificationCounts.CONFLICTING})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category Dropdown Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by research category"
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-600"
            >
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'ALL' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* VIEW MODE 1 & 3: THE ONE-PAGE INTELLIGENCE BRIEF / APPENDIX */}
      {(viewMode === 'executive' || viewMode === 'appendix') && (
        <article className="print-container bg-white border border-slate-200 rounded-xl p-6 sm:p-10 space-y-8">
          {/* REPORT HEADER */}
          <header className="border-b-2 border-slate-900 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">
                MEETWISE AI &middot; PRE-MEETING INTELLIGENCE BRIEF
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                {meeting.subjectName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">{briefing.executiveSummaryOneLiner}</p>
            </div>

            <div className="text-xs text-slate-500 sm:text-right space-y-0.5 font-mono tabular-nums shrink-0">
              <div>
                30-Day Window: <span className="text-slate-900 font-semibold">{briefing.researchStartDate}</span> to{' '}
                <span className="text-slate-900 font-semibold">{briefing.researchEndDate}</span>
              </div>
              <div>
                Generated: {new Date(briefing.generatedAt).toLocaleString()}
              </div>
              <div>
                Model Gateway:{' '}
                {briefing.modelGatewayUsed === 'bifrost'
                  ? `Bifrost (${briefing.modelNameUsed})`
                  : briefing.modelGatewayUsed === 'gemini-direct'
                  ? `Gemini Direct (${briefing.modelNameUsed})`
                  : briefing.modelNameUsed}
              </div>
              <div>
                Tavily Usage: {meeting.searchUsage.searchesPerformed} searches &middot;{' '}
                {meeting.searchUsage.deduplicatedUrlsCount} unique sources
              </div>
            </div>
          </header>

          {/* SECTION A: MEETING DETAILS */}
          <section className="print-break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              A. Meeting Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <div className="text-slate-500">Company / Person</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {meeting.subjectName} ({meeting.subjectType === 'company' ? 'Company' : 'Individual'})
                </div>
              </div>
              <div>
                <div className="text-slate-500">Meeting Purpose</div>
                <div className="font-semibold text-slate-900 mt-0.5">{meeting.purpose}</div>
              </div>
              <div>
                <div className="text-slate-500">Scheduled Date &amp; Time</div>
                <div className="font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
                  {meeting.meetingDate} at {meeting.meetingTime} ({meeting.meetingTimeZone})
                </div>
              </div>
              <div>
                <div className="text-slate-500">30-Day Research Period</div>
                <div className="font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
                  {briefing.researchStartDate} &rarr; {briefing.researchEndDate}
                </div>
              </div>
            </div>
            {(meeting.context || meeting.additionalInterests.length > 0) && (
              <div className="mt-2.5 text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                {meeting.context && (
                  <span>
                    <strong className="text-slate-800">Context:</strong> {meeting.context}
                  </span>
                )}
                {meeting.additionalInterests.length > 0 && (
                  <span>
                    <strong className="text-slate-800">Research Focus:</strong>{' '}
                    {meeting.additionalInterests.join(' · ')}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* SECTION B: SUBJECT OVERVIEW */}
          <section className="print-break-inside-avoid pt-6 border-t border-slate-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              B. Subject Overview
            </h2>
            <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
              {briefing.subjectOverview}
            </p>
          </section>

          {/* SECTION C: WHAT'S NEW — LAST 30 DAYS */}
          <section className="pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                C. What&rsquo;s New — Last 30 Days ({briefing.researchStartDate} to{' '}
                {briefing.researchEndDate})
              </h2>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                Showing {filteredRecentDevelopments.length} dated 30-day development(s)
              </div>
            </div>

            {filteredRecentDevelopments.length === 0 ? (
              <div className="py-6 px-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                {briefing.recentDevelopments.length === 0
                  ? `No developments with confirmed publication dates between ${briefing.researchStartDate} and ${briefing.researchEndDate} were established. See Undated / Background Context below if undated sources were retrieved.`
                  : 'No developments match your current search or verification filter.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {(viewMode === 'executive'
                  ? filteredRecentDevelopments.slice(0, 6)
                  : filteredRecentDevelopments
                ).map((finding) => (
                  <div key={finding.id} className="py-4 print-break-inside-avoid space-y-2">
                    {/* Unboxed clean metadata line */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      {renderVerificationMeta(finding.verificationStatus)}
                      <span aria-hidden="true">&middot;</span>
                      <span>Confidence: {finding.confidenceLevel}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span>{finding.category}</span>
                      <span aria-hidden="true">&middot;</span>
                      <span className="font-mono tabular-nums text-slate-700 font-medium">
                        Published: {finding.publicationDate}
                      </span>
                      {finding.isPrimarySource && (
                        <>
                          <span aria-hidden="true">&middot;</span>
                          <span className="text-indigo-700 font-medium">Primary Source</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{finding.title}</h3>

                    <p className="text-sm text-slate-700 leading-relaxed">{finding.summary}</p>

                    <div className="text-xs text-slate-800">
                      <span className="font-semibold text-slate-900">
                        Why it matters for this {meeting.purpose}:
                      </span>{' '}
                      {finding.whyItMatters}
                    </div>

                    {(viewMode === 'appendix' || finding.verificationStatus !== 'VERIFIED') && (
                      <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Verification Audit:</span>{' '}
                        {finding.verificationReason}
                      </div>
                    )}

                    {viewMode === 'appendix' && finding.evidenceText && (
                      <blockquote className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
                        &ldquo;{finding.evidenceText}&rdquo;
                      </blockquote>
                    )}

                    {/* Direct Clickable Source Link */}
                    <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="text-slate-500">Source Citation:</span>
                      <a
                        href={finding.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {finding.sourceTitle} ({finding.sourceName})
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Clearly Separated Undated / Outside-30-Day Context Section per Part 9 */}
            {filteredUndatedFindings.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Separated Context — Publication Date Unavailable or Outside 30-Day Window (
                    {filteredUndatedFindings.length})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Excluded from confirmed 30-day timeline per verification rules
                  </span>
                </div>

                <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                  {filteredUndatedFindings.map((finding) => (
                    <div key={finding.id} className="py-3.5 space-y-1.5 print-break-inside-avoid">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                        {renderVerificationMeta(finding.verificationStatus)}
                        <span aria-hidden="true">&middot;</span>
                        <span>{finding.category}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span className="font-mono tabular-nums text-amber-800 font-medium">
                          {finding.publicationDate}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{finding.title}</h4>
                      <p className="text-xs text-slate-700 leading-relaxed">{finding.summary}</p>
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">Meeting Relevance:</span>{' '}
                        {finding.whyItMatters}
                      </div>
                      <div className="text-xs">
                        <a
                          href={finding.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
                        >
                          Source: {finding.sourceTitle} ({finding.sourceName})
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* SECTION D: KEY INSIGHTS */}
          <section className="print-break-inside-avoid pt-6 border-t border-slate-200">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              D. Key Insights
            </h2>
            <ul className="space-y-2">
              {briefing.keyInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* SECTION E: OPPORTUNITIES AND RISKS */}
          <section className="print-break-inside-avoid pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                E. Opportunities and Risks
              </h2>
              <span className="text-xs text-slate-500">
                Distinguishing direct evidence-based observations from analytical inferences
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {briefing.opportunitiesAndRisks.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-bold ${
                        item.type === 'OPPORTUNITY' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-slate-400">&middot;</span>
                    <span className="text-slate-600 font-medium">
                      {item.basis === 'EVIDENCE_BASED'
                        ? 'Evidence-Based Observation'
                        : 'Analytical Inference'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <p className="text-xs text-slate-700 leading-relaxed">{item.description}</p>
                  {item.relatedSourceUrl && (
                    <a
                      href={item.relatedSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline pt-1"
                    >
                      Supporting Source
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* SECTION F: QUESTIONS TO ASK & SECTION G: TALKING POINTS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-slate-200 print-break-inside-avoid">
            <section className="lg:col-span-7">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                F. Questions to Ask During the Meeting ({briefing.questionsToAsk.length})
              </h2>
              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {briefing.questionsToAsk.map((q, idx) => (
                  <div key={q.id} className="py-3 space-y-1">
                    <div className="text-xs text-slate-500">
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        Q{idx + 1}
                      </span>{' '}
                      &middot; {q.category}
                      {q.relatedFindingTitle ? ` · Re: ${q.relatedFindingTitle}` : ''}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{q.question}</div>
                    <div className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Why ask:</span> {q.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                G. Discussion &amp; Talking Points ({briefing.talkingPoints.length})
              </h2>
              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {briefing.talkingPoints.map((tp, idx) => (
                  <div key={tp.id} className="py-3 space-y-1">
                    <div className="text-xs font-mono tabular-nums text-slate-400">
                      Point 0{idx + 1}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{tp.headline}</div>
                    <p className="text-xs text-slate-700 leading-relaxed">{tp.detail}</p>
                    <div className="text-xs text-indigo-700">
                      <span className="font-semibold">Suggested Angle:</span> {tp.suggestedAngle}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* SECTION H: SOURCE REFERENCES */}
          <section className="pt-6 border-t border-slate-200 print-break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                H. Direct Source References ({briefing.sourceReferences.length})
              </h2>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                Deduplicated by canonical URL
              </span>
            </div>

            {briefing.sourceReferences.length === 0 ? (
              <p className="text-xs text-slate-500">
                No external source references were recorded in this run.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">Source</th>
                      <th className="py-2.5 px-3 font-semibold">Article Title &amp; Direct Link</th>
                      <th className="py-2.5 px-3 font-semibold">Publication Date</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {briefing.sourceReferences.map((src, idx) => (
                      <tr key={src.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 whitespace-nowrap">
                          {src.sourceName}
                          {src.isPrimarySource && (
                            <span className="text-indigo-600 ml-1.5 font-normal">
                              (Primary)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1 font-medium"
                          >
                            {src.articleTitle}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {src.publicationDate}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {renderVerificationMeta(src.verificationStatus)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </article>
      )}
    </div>
  );
};
