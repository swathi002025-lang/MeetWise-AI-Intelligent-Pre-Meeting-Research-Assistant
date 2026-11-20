import React, { useState } from 'react';
import {
  ArrowRight,
  Download,
  Edit3,
  History,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  MeetingPurpose,
  MeetingRecord,
  SubjectType,
} from '../shared/types.ts';
import { generateDownloadableBriefingHtml } from '../services/apiClient.ts';

interface MyMeetingsPageProps {
  meetings: MeetingRecord[];
  mode: 'meetings' | 'history';
  onOpenMeeting: (meetingId: string) => void;
  onRefreshMeeting: (meetingId: string) => void;
  onRunInitialResearch: (meetingId: string) => void;
  onUpdateMeeting: (
    id: string,
    payload: {
      subjectType: SubjectType;
      subjectName: string;
      meetingDate: string;
      meetingTime: string;
      meetingTimeZone: string;
      purpose: MeetingPurpose;
      context: string;
    }
  ) => Promise<void>;
  onDeleteMeeting: (id: string) => Promise<void>;
  onNavigateNewMeeting: () => void;
}

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

export const MyMeetingsPage: React.FC<MyMeetingsPageProps> = ({
  meetings,
  mode,
  onOpenMeeting,
  onRefreshMeeting,
  onRunInitialResearch,
  onUpdateMeeting,
  onDeleteMeeting,
  onNavigateNewMeeting,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMeeting, setEditingMeeting] = useState<MeetingRecord | null>(null);
  const [deletingMeeting, setDeletingMeeting] = useState<MeetingRecord | null>(null);

  // Edit form states
  const [editType, setEditType] = useState<SubjectType>('company');
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editTz, setEditTz] = useState('');
  const [editPurpose, setEditPurpose] = useState<MeetingPurpose>('General Meeting');
  const [editContext, setEditContext] = useState('');

  const startEdit = (m: MeetingRecord) => {
    setEditingMeeting(m);
    setEditType(m.subjectType);
    setEditName(m.subjectName);
    setEditDate(m.meetingDate);
    setEditTime(m.meetingTime);
    setEditTz(m.meetingTimeZone);
    setEditPurpose(m.purpose);
    setEditContext(m.context);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeeting) return;
    await onUpdateMeeting(editingMeeting.id, {
      subjectType: editType,
      subjectName: editName,
      meetingDate: editDate,
      meetingTime: editTime,
      meetingTimeZone: editTz,
      purpose: editPurpose,
      context: editContext,
    });
    setEditingMeeting(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMeeting) return;
    await onDeleteMeeting(deletingMeeting.id);
    setDeletingMeeting(null);
  };

  const handleDownloadReport = (m: MeetingRecord) => {
    const html = generateDownloadableBriefingHtml(m);
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = m.subjectName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `meetwise-briefing-${safeName}-${m.researchEndDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredMeetings = meetings.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.subjectName.toLowerCase().includes(q) ||
      m.purpose.toLowerCase().includes(q) ||
      m.context.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'meetings' ? 'My Meetings' : 'Research History & Audit Log'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {mode === 'meetings'
              ? 'Opening a saved meeting retrieves its cached briefing without consuming additional Tavily credits.'
              : 'Review historical research runs, Tavily search usage, source verification counts, and version snapshots.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by company, person, or purpose..."
              className="pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 w-64"
            />
          </div>

          <button
            type="button"
            onClick={onNavigateNewMeeting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Meeting
          </button>
        </div>
      </div>

      {filteredMeetings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-slate-600">
            No saved meeting records match your filter.
          </p>
          <button
            type="button"
            onClick={onNavigateNewMeeting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Prepare a New Meeting
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {filteredMeetings.map((m) => {
            const verifiedCount = m.findings.filter(
              (f) => f.verificationStatus === 'VERIFIED'
            ).length;
            const partialCount = m.findings.filter(
              (f) => f.verificationStatus === 'PARTIALLY_VERIFIED'
            ).length;
            const unverifiedCount = m.findings.filter(
              (f) =>
                f.verificationStatus === 'UNVERIFIED' ||
                f.verificationStatus === 'CONFLICTING'
            ).length;

            return (
              <div
                key={m.id}
                className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  {/* Unboxed metadata row */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {m.subjectType === 'company' ? 'Company' : 'Individual'}
                    </span>
                    <span>&middot;</span>
                    <span>{m.purpose}</span>
                    <span>&middot;</span>
                    <span className="font-mono tabular-nums">
                      Scheduled: {m.meetingDate} {m.meetingTime} ({m.meetingTimeZone})
                    </span>
                    {m.isSampleDemo && (
                      <>
                        <span>&middot;</span>
                        <span className="text-indigo-600 font-semibold">
                          Sample Demo Scenario
                        </span>
                      </>
                    )}
                  </div>

                  <div className="text-lg font-bold text-slate-900">
                    {m.subjectName}
                  </div>

                  {m.context && (
                    <p className="text-xs text-slate-600 line-clamp-2 max-w-3xl">
                      {m.context}
                    </p>
                  )}

                  {/* Evidence & Usage Metadata Row */}
                  <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
                    <span>
                      Window: {m.researchStartDate} &rarr; {m.researchEndDate}
                    </span>
                    <span>&middot;</span>
                    <span className="font-sans">
                      Verified: <strong className="text-emerald-700 font-mono">{verifiedCount}</strong>
                    </span>
                    <span>&middot;</span>
                    <span className="font-sans">
                      Partial: <strong className="text-amber-700 font-mono">{partialCount}</strong>
                    </span>
                    <span>&middot;</span>
                    <span className="font-sans">
                      Uncertain/Conflicting:{' '}
                      <strong className="text-slate-700 font-mono">{unverifiedCount}</strong>
                    </span>
                    <span>&middot;</span>
                    <span>
                      Tavily Searches: {m.searchUsage.searchesPerformed} ({m.searchUsage.deduplicatedUrlsCount} unique URLs)
                    </span>
                    {m.history.length > 0 && (
                      <>
                        <span>&middot;</span>
                        <span className="inline-flex items-center gap-1 text-indigo-600 font-sans font-medium">
                          <History className="w-3 h-3" />
                          {m.history.length} previous version(s)
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {m.briefing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenMeeting(m.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Open Saved Briefing
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onRefreshMeeting(m.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        title="Execute a new Tavily search and compare with saved briefing"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh Research
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadReport(m)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        title="Download standalone HTML report"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRunInitialResearch(m.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Run 30-Day Research
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startEdit(m)}
                    className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit meeting details"
                    aria-label={`Edit ${m.subjectName}`}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingMeeting(m)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete meeting"
                    aria-label={`Delete ${m.subjectName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Meeting Modal */}
      {editingMeeting && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Edit Meeting Information
              </h2>
              <button
                type="button"
                onClick={() => setEditingMeeting(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company / Individual Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Meeting Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Meeting Time
                  </label>
                  <input
                    type="time"
                    required
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Meeting Purpose
                </label>
                <select
                  value={editPurpose}
                  onChange={(e) => setEditPurpose(e.target.value as MeetingPurpose)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {VALID_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Meeting Context
                </label>
                <textarea
                  rows={3}
                  value={editContext}
                  onChange={(e) => setEditContext(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingMeeting(null)}
                  className="px-4 py-2 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingMeeting && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Delete Meeting &amp; Saved Briefing?
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete the meeting record for{' '}
              <strong className="text-slate-900">{deletingMeeting.subjectName}</strong> and all of
              its saved briefing history?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMeeting(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
