import React, { useState } from 'react';
import { Building2, Calendar, Clock, Globe, Sparkles, User } from 'lucide-react';
import { MeetingPurpose, SubjectType } from '../shared/types.ts';

interface NewMeetingPageProps {
  isSubmitting: boolean;
  onCreateAndResearch: (payload: {
    subjectType: SubjectType;
    subjectName: string;
    meetingDate: string;
    meetingTime: string;
    meetingTimeZone: string;
    purpose: MeetingPurpose;
    context: string;
    additionalInterests: string[];
  }) => void;
}

const MEETING_PURPOSES: MeetingPurpose[] = [
  'Sales Meeting',
  'Partnership Discussion',
  'Investor Meeting',
  'Business Development',
  'Job Interview',
  'Networking',
  'General Meeting',
  'Other',
];

const SUGGESTED_INTERESTS = [
  'Recent leadership changes',
  'Product launches',
  'Company financial performance',
  'Competitor activity',
  'New partnerships',
  'Funding and investment',
  'Technology developments',
];

const COMMON_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export const NewMeetingPage: React.FC<NewMeetingPageProps> = ({
  isSubmitting,
  onCreateAndResearch,
}) => {
  const detectedTz =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';

  const defaultTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const thirtyDaysAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const [subjectType, setSubjectType] = useState<SubjectType>('company');
  const [subjectName, setSubjectName] = useState('');
  const [meetingDate, setMeetingDate] = useState(defaultTomorrow);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingTimeZone, setMeetingTimeZone] = useState(detectedTz);
  const [purpose, setPurpose] = useState<MeetingPurpose>('Partnership Discussion');
  const [context, setContext] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    'Product launches',
    'New partnerships',
  ]);
  const [customInterestInput, setCustomInterestInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const timeZoneOptions = Array.from(new Set([detectedTz, ...COMMON_TIMEZONES]));

  const toggleInterest = (item: string) => {
    setSelectedInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleAddCustomInterest = () => {
    const trimmed = customInterestInput.trim();
    if (!trimmed) return;
    if (!selectedInterests.includes(trimmed)) {
      setSelectedInterests((prev) => [...prev, trimmed]);
    }
    setCustomInterestInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = subjectName.trim();
    if (cleanName.length < 2) {
      setValidationError(
        `Please enter a valid ${
          subjectType === 'company' ? 'company' : 'individual'
        } name (at least 2 characters).`
      );
      return;
    }
    if (!meetingDate) {
      setValidationError('Please select a scheduled meeting date.');
      return;
    }
    if (!meetingTime) {
      setValidationError('Please select a scheduled meeting time.');
      return;
    }
    setValidationError(null);

    onCreateAndResearch({
      subjectType,
      subjectName: cleanName,
      meetingDate,
      meetingTime,
      meetingTimeZone,
      purpose,
      context: context.trim(),
      additionalInterests: selectedInterests,
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Prepare a New Meeting Briefing
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Enter your counterpart details and meeting purpose. MeetWise AI will execute focused
          Tavily searches covering the past 30 days (
          <span className="font-mono tabular-nums text-slate-800">{thirtyDaysAgoStr()}</span> to{' '}
          <span className="font-mono tabular-nums text-slate-800">{todayStr}</span>) and verify all
          claims before generating your one-page brief.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        {validationError && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
            {validationError}
          </div>
        )}

        {/* 1. Subject Type */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
            1. Subject Type *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSubjectType('company')}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-semibold transition-colors ${
                subjectType === 'company'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Company
            </button>
            <button
              type="button"
              onClick={() => setSubjectType('individual')}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border text-sm font-semibold transition-colors ${
                subjectType === 'individual'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <User className="w-4 h-4" />
              Individual
            </button>
          </div>
        </div>

        {/* 2. Company / Individual Name */}
        <div>
          <label
            htmlFor="subject-name-input"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
          >
            2. {subjectType === 'company' ? 'Company Name' : 'Individual Name'} *
          </label>
          <input
            id="subject-name-input"
            type="text"
            required
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder={
              subjectType === 'company'
                ? 'e.g., Anthropic, Stripe, Cloudflare, Databricks'
                : 'e.g., Jensen Huang (CEO at NVIDIA), Fidji Simo'
            }
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
          />
        </div>

        {/* 3, 4, 5: Meeting Date, Time, and Time Zone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label
              htmlFor="meeting-date-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
            >
              3. Meeting Date *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="meeting-date-input"
                type="date"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="meeting-time-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
            >
              4. Meeting Time *
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="meeting-time-input"
                type="time"
                required
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="meeting-tz-select"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
            >
              5. Time Zone *
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id="meeting-tz-select"
                value={meetingTimeZone}
                onChange={(e) => setMeetingTimeZone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-600"
              >
                {timeZoneOptions.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 6. Meeting Purpose */}
        <div className="pt-2 border-t border-slate-100">
          <label
            htmlFor="meeting-purpose-select"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
          >
            6. Meeting Purpose *
          </label>
          <select
            id="meeting-purpose-select"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as MeetingPurpose)}
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-indigo-600"
          >
            {MEETING_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">
            Search queries and briefing talking points automatically adapt to your selected meeting
            purpose.
          </p>
        </div>

        {/* 7. Optional Meeting Context */}
        <div className="pt-2 border-t border-slate-100">
          <label
            htmlFor="meeting-context-textarea"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2"
          >
            7. Meeting Context (Optional)
          </label>
          <textarea
            id="meeting-context-textarea"
            rows={3}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Add agenda items, role of the person you are meeting, your product offering, or specific hypotheses to test..."
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
          />
        </div>

        {/* 8. Additional Research Interests */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
            8. Additional Research Interests (Optional)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTED_INTERESTS.map((interest) => {
              const active = selectedInterests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    active
                      ? 'bg-indigo-50 text-indigo-900 border-indigo-300 font-semibold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {active ? `✓ ${interest}` : `+ ${interest}`}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customInterestInput}
              onChange={(e) => setCustomInterestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomInterest();
                }
              }}
              placeholder="Add a custom research topic (e.g., EU AI Act compliance, Q3 cloud margins)..."
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
            />
            <button
              type="button"
              onClick={handleAddCustomInterest}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Add Topic
            </button>
          </div>
        </div>

        {/* Research Window Notice & Primary Submit CTA */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Active 30-day research window:{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {thirtyDaysAgoStr()}
            </span>{' '}
            to{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-800">
              {todayStr}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            {isSubmitting ? 'Starting Research...' : 'Generate Meeting Briefing'}
          </button>
        </div>
      </form>
    </div>
  );
};
