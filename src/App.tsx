import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  History,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import {
  ActivityLogItem,
  IntegrationStatusResponse,
  MeetingPurpose,
  MeetingRecord,
  SubjectType,
  UsageStatistics,
} from './shared/types.ts';
import { apiClient } from './services/apiClient.ts';
import { OverviewPage } from './components/OverviewPage.tsx';
import { NewMeetingPage } from './components/NewMeetingPage.tsx';
import { MyMeetingsPage } from './components/MyMeetingsPage.tsx';
import { SettingsPage } from './components/SettingsPage.tsx';
import { ResearchProgressView } from './components/ResearchProgressView.tsx';
import { BriefingReportView } from './components/BriefingReportView.tsx';

type NavSection =
  | 'overview'
  | 'new-meeting'
  | 'my-meetings'
  | 'research-history'
  | 'settings'
  | 'briefing-detail';

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [usage, setUsage] = useState<UsageStatistics | null>(null);
  const [integrationStatus, setIntegrationStatus] =
    useState<IntegrationStatusResponse | null>(null);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState(false);
  const [isRefreshingBriefing, setIsRefreshingBriefing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async () => {
    try {
      const [meetingsList, usageData, intStatus] = await Promise.all([
        apiClient.getMeetings(),
        apiClient.getUsageAndActivities(),
        apiClient.getIntegrationStatus(),
      ]);
      setMeetings(meetingsList);
      setUsage(usageData.usage);
      setActivities(usageData.activities);
      setIntegrationStatus(intStatus);
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Unable to load workspace data.'
      );
    } finally {
      setIsLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const selectedMeeting =
    meetings.find((m) => m.id === selectedMeetingId) || null;

  // Poll live 9-stage research progress whenever the selected meeting is actively researching
  useEffect(() => {
    if (!selectedMeetingId || !selectedMeeting) return;
    if (selectedMeeting.researchStatus !== 'researching') return;

    const timer = setInterval(async () => {
      try {
        const updated = await apiClient.getMeeting(selectedMeetingId);
        setMeetings((prev) =>
          prev.map((m) => (m.id === updated.id ? updated : m))
        );

        if (updated.researchStatus !== 'researching') {
          setIsRefreshingBriefing(false);
          // Refresh usage and activity logs when research finishes
          const usageData = await apiClient.getUsageAndActivities();
          setUsage(usageData.usage);
          setActivities(usageData.activities);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 450);

    return () => clearInterval(timer);
  }, [selectedMeetingId, selectedMeeting?.researchStatus]);

  const handleNavigate = (section: NavSection) => {
    setActiveNav(section);
    setMobileMenuOpen(false);
    setGlobalError(null);
  };

  // Opening an existing meeting strictly retrieves its saved state and NEVER triggers Tavily
  const handleOpenMeetingBriefing = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    setActiveNav('briefing-detail');
    setMobileMenuOpen(false);
  };

  const handleCreateAndResearch = async (payload: {
    subjectType: SubjectType;
    subjectName: string;
    meetingDate: string;
    meetingTime: string;
    meetingTimeZone: string;
    purpose: MeetingPurpose;
    context: string;
    additionalInterests: string[];
  }) => {
    setIsSubmittingMeeting(true);
    setGlobalError(null);
    try {
      const created = await apiClient.createMeeting(payload);
      setMeetings((prev) => [created, ...prev]);
      setSelectedMeetingId(created.id);
      setActiveNav('briefing-detail');

      const started = await apiClient.startResearch(created.id, false);
      setMeetings((prev) =>
        prev.map((m) => (m.id === started.id ? started : m))
      );
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to create meeting.'
      );
    } finally {
      setIsSubmittingMeeting(false);
    }
  };

  const handleRunInitialResearch = async (meetingId: string) => {
    setGlobalError(null);
    setSelectedMeetingId(meetingId);
    setActiveNav('briefing-detail');
    setIsRefreshingBriefing(true);
    try {
      const started = await apiClient.startResearch(meetingId, false);
      setMeetings((prev) =>
        prev.map((m) => (m.id === started.id ? started : m))
      );
    } catch (err: unknown) {
      setIsRefreshingBriefing(false);
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to start research.'
      );
    }
  };

  const handleRefreshResearch = async (meetingId: string) => {
    setGlobalError(null);
    setSelectedMeetingId(meetingId);
    setActiveNav('briefing-detail');
    setIsRefreshingBriefing(true);
    try {
      const started = await apiClient.refreshResearch(meetingId, false);
      setMeetings((prev) =>
        prev.map((m) => (m.id === started.id ? started : m))
      );
    } catch (err: unknown) {
      setIsRefreshingBriefing(false);
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to refresh research.'
      );
    }
  };

  const handleUpdateMeeting = async (
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
  ) => {
    try {
      const updated = await apiClient.updateMeeting(id, payload);
      setMeetings((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to update meeting.'
      );
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    try {
      await apiClient.deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      if (selectedMeetingId === id) {
        setSelectedMeetingId(null);
        setActiveNav('my-meetings');
      }
      const usageData = await apiClient.getUsageAndActivities();
      setActivities(usageData.activities);
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to delete meeting.'
      );
    }
  };

  const handleUpdateBudget = async (newBudget: number) => {
    try {
      const updatedUsage = await apiClient.updateSearchBudget(newBudget);
      setUsage(updatedUsage);
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to update search budget.'
      );
    }
  };

  const navItems: {
    id: Exclude<NavSection, 'briefing-detail'>;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'new-meeting', label: 'New Meeting', icon: Plus },
    { id: 'my-meetings', label: 'My Meetings', icon: Calendar },
    { id: 'research-history', label: 'Research History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const getBreadcrumbLabel = () => {
    if (activeNav === 'overview') return 'Overview';
    if (activeNav === 'new-meeting') return 'New Meeting';
    if (activeNav === 'my-meetings') return 'My Meetings';
    if (activeNav === 'research-history') return 'Research History';
    if (activeNav === 'settings') return 'Settings';
    if (activeNav === 'briefing-detail' && selectedMeeting) {
      return `Briefings / ${selectedMeeting.subjectName}`;
    }
    return 'Workspace';
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar Navigation (256px width) */}
      <aside className="no-print hidden md:flex md:flex-col md:w-64 bg-slate-900 text-slate-100 shrink-0 border-r border-slate-800">
        <div className="px-6 py-5 border-b border-slate-800">
          <button
            type="button"
            onClick={() => handleNavigate('overview')}
            className="text-left focus:outline-none"
          >
            <div className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              MeetWise AI
            </div>
            <div className="text-xs text-slate-400 mt-0.5 leading-snug">
              Research smarter. Prepare better.
            </div>
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeNav === item.id ||
              (activeNav === 'briefing-detail' && item.id === 'my-meetings');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Workspace Info */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="font-medium text-slate-300">
            Pre-Meeting Intelligence
          </div>
          <div>
            Walk into every meeting informed with verified 30-day web evidence.
          </div>
          {usage && (
            <div className="pt-1 font-mono tabular-nums text-slate-400">
              Searches used: {usage.totalSearchesExecuted}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: 3-zone header */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Brand / Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <div className="text-sm font-semibold text-slate-900 truncate whitespace-nowrap">
              MeetWise AI <span className="text-slate-300 mx-1.5">/</span>{' '}
              <span className="text-slate-600 font-medium">
                {getBreadcrumbLabel()}
              </span>
            </div>
          </div>

          {/* Zone 2: Concise Top Nav Links on Desktop */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => handleNavigate('overview')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('my-meetings')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Saved Briefings ({meetings.length})
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('research-history')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              History
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('settings')}
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Integrations
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate('new-meeting')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Prepare New Meeting
            </button>
          </div>
        </header>

        {/* Collapsible Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="no-print md:hidden bg-slate-900 text-slate-100 border-b border-slate-800 px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Viewport Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {globalError && (
            <div className="no-print mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4 text-xs text-red-800">
              <span>{globalError}</span>
              <button
                type="button"
                onClick={() => setGlobalError(null)}
                className="font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {isLoadingInitial ? (
            <div className="space-y-4 py-8">
              <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 bg-white border border-slate-200 rounded-xl p-5 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              {activeNav === 'overview' && (
                <OverviewPage
                  meetings={meetings}
                  activities={activities}
                  usage={usage}
                  onNavigateNewMeeting={() => handleNavigate('new-meeting')}
                  onOpenMeeting={handleOpenMeetingBriefing}
                  onRunResearch={handleRunInitialResearch}
                  onRefreshResearch={handleRefreshResearch}
                />
              )}

              {activeNav === 'new-meeting' && (
                <NewMeetingPage
                  isSubmitting={isSubmittingMeeting}
                  onCreateAndResearch={handleCreateAndResearch}
                />
              )}

              {activeNav === 'my-meetings' && (
                <MyMeetingsPage
                  meetings={meetings}
                  mode="meetings"
                  onOpenMeeting={handleOpenMeetingBriefing}
                  onRefreshMeeting={handleRefreshResearch}
                  onRunInitialResearch={handleRunInitialResearch}
                  onUpdateMeeting={handleUpdateMeeting}
                  onDeleteMeeting={handleDeleteMeeting}
                  onNavigateNewMeeting={() => handleNavigate('new-meeting')}
                />
              )}

              {activeNav === 'research-history' && (
                <MyMeetingsPage
                  meetings={meetings}
                  mode="history"
                  onOpenMeeting={handleOpenMeetingBriefing}
                  onRefreshMeeting={handleRefreshResearch}
                  onRunInitialResearch={handleRunInitialResearch}
                  onUpdateMeeting={handleUpdateMeeting}
                  onDeleteMeeting={handleDeleteMeeting}
                  onNavigateNewMeeting={() => handleNavigate('new-meeting')}
                />
              )}

              {activeNav === 'settings' && (
                <SettingsPage
                  status={integrationStatus}
                  usage={usage}
                  onRefreshStatus={loadWorkspaceData}
                  onUpdateBudget={handleUpdateBudget}
                />
              )}

              {activeNav === 'briefing-detail' && selectedMeeting && (
                <>
                  {selectedMeeting.researchStatus === 'researching' ||
                  selectedMeeting.researchStatus === 'failed' ? (
                    <ResearchProgressView
                      meeting={selectedMeeting}
                      onRetryResearch={() =>
                        handleRunInitialResearch(selectedMeeting.id)
                      }
                      onOpenPartialBriefing={() => {
                        setMeetings((prev) =>
                          prev.map((m) =>
                            m.id === selectedMeeting.id
                              ? { ...m, researchStatus: 'partial' }
                              : m
                          )
                        );
                      }}
                    />
                  ) : (
                    <BriefingReportView
                      meeting={selectedMeeting}
                      isRefreshing={isRefreshingBriefing}
                      onBack={() => handleNavigate('my-meetings')}
                      onRefreshResearch={() =>
                        handleRefreshResearch(selectedMeeting.id)
                      }
                      onStartInitialResearch={() =>
                        handleRunInitialResearch(selectedMeeting.id)
                      }
                      onOpenSettings={() => handleNavigate('settings')}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
