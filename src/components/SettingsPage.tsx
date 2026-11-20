import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Loader2,
  Network,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import {
  IntegrationStatusResponse,
  UsageStatistics,
} from '../shared/types.ts';
import { apiClient } from '../services/apiClient.ts';

interface SettingsPageProps {
  status: IntegrationStatusResponse | null;
  usage: UsageStatistics | null;
  onRefreshStatus: () => Promise<void>;
  onUpdateBudget: (newBudget: number) => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  status,
  usage,
  onRefreshStatus,
  onUpdateBudget,
}) => {
  const [testingTavily, setTestingTavily] = useState(false);
  const [tavilyTestResult, setTavilyTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [testingBifrost, setTestingBifrost] = useState(false);
  const [bifrostTestResult, setBifrostTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [savingBudget, setSavingBudget] = useState(false);

  const handleTestTavily = async () => {
    setTestingTavily(true);
    setTavilyTestResult(null);
    try {
      const res = await apiClient.testTavilyConnection();
      setTavilyTestResult(res);
      await onRefreshStatus();
    } catch (err: unknown) {
      setTavilyTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed.',
      });
    } finally {
      setTestingTavily(false);
    }
  };

  const handleTestBifrost = async () => {
    setTestingBifrost(true);
    setBifrostTestResult(null);
    try {
      const res = await apiClient.testBifrostConnection();
      setBifrostTestResult(res);
      await onRefreshStatus();
    } catch (err: unknown) {
      setBifrostTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Bifrost test failed.',
      });
    } finally {
      setTestingBifrost(false);
    }
  };

  const handleBudgetChange = async (budget: number) => {
    setSavingBudget(true);
    try {
      await onUpdateBudget(budget);
    } finally {
      setSavingBudget(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Integrations &amp; System Settings
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            All API keys remain strictly server-side via the Google AI Studio Secrets panel and are
            never exposed to browser JavaScript.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshStatus}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Status
        </button>
      </div>

      {/* 4 Integration Status Cards */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
        {/* 1. Tavily Search API */}
        <div className="p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-slate-100 text-slate-800 shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Tavily Web Search API
                  </h2>
                  <span className="text-xs text-slate-400">&middot;</span>
                  <span
                    className={`text-xs font-semibold ${
                      status?.tavily.configured ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {status?.tavily.configured ? 'Key Configured' : 'Key Not Configured'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {status?.tavily.message || 'Checking Tavily status...'}
                </p>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
                  Endpoint: {status?.tavily.endpoint || 'https://api.tavily.com/search'} &middot;{' '}
                  Secret Variable: TAVILY_API_KEY{' '}
                  {status?.tavily.maskedKey ? `(${status.tavily.maskedKey})` : '(Unset)'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestTavily}
              disabled={testingTavily}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {testingTavily ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Test Connection
            </button>
          </div>

          {tavilyTestResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                tavilyTestResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {tavilyTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{tavilyTestResult.message}</span>
            </div>
          )}
        </div>

        {/* 2. Gemini API (Server-Side Native Integration) */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-slate-100 text-slate-800 shrink-0">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Gemini Reasoning Engine (Server-Side)
                  </h2>
                  <span className="text-xs text-slate-400">&middot;</span>
                  <span
                    className={`text-xs font-semibold ${
                      status?.gemini.configured ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {status?.gemini.configured ? 'Connected' : 'Missing Key'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {status?.gemini.message || 'Checking server-side Gemini configuration...'}
                </p>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
                  Active Model: {status?.gemini.model || 'gemini-4-hydrogen'} &middot; Managed
                  automatically via Google AI Studio server environment
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bifrost AI Model Gateway */}
        <div className="p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-slate-100 text-slate-800 shrink-0">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Bifrost AI Model Gateway
                  </h2>
                  <span className="text-xs text-slate-400">&middot;</span>
                  <span
                    className={`text-xs font-semibold ${
                      status?.bifrost.configured ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    {status?.bifrost.configured
                      ? 'Configured'
                      : 'Bifrost not configured'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {status?.bifrost.message}
                </p>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
                  Gateway URL: {status?.bifrost.baseUrl || 'Not configured (Using direct Gemini fallback)'}{' '}
                  &middot; Model: {status?.bifrost.model || 'N/A'} &middot; Secret Variables:
                  BIFROST_BASE_URL, BIFROST_API_KEY, BIFROST_MODEL
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestBifrost}
              disabled={testingBifrost}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {testingBifrost ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Test Gateway
            </button>
          </div>

          {bifrostTestResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                bifrostTestResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {bifrostTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{bifrostTestResult.message}</span>
            </div>
          )}
        </div>

        {/* 4. Database & Persistence Layer */}
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-800 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Storage &amp; Persistence Layer
                </h2>
                <span className="text-xs text-slate-400">&middot;</span>
                <span className="text-xs font-semibold text-emerald-700">Operational</span>
              </div>
              <div className="text-xs font-medium text-slate-800 mt-1">
                {status?.storage.adapterName || 'Local JSON File Storage Adapter'}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {status?.storage.message}
              </p>
              <div className="text-xs text-slate-500 font-mono tabular-nums mt-1">
                File Path: {status?.storage.persistentFile || 'data/meetwise-storage.json'} &middot;{' '}
                Saved Meetings: {status?.storage.totalMeetingsSaved ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Optimization & Search Budget Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-bold text-slate-900">
              Tavily Credit Optimization &amp; Usage Telemetry
            </h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Search Depth: basic (default)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">Total Tavily Searches</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {usage?.totalSearchesExecuted ?? 0}
            </div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">Tavily Credits Used</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {usage?.totalCreditsReported ?? 0}
            </div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">Bifrost Routed Calls</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {usage?.bifrostRequestsCount ?? 0}
            </div>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs text-slate-500">Direct Gemini Calls</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {usage?.geminiDirectRequestsCount ?? 0}
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Configurable Focused Search Budget per Research Run
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Controls how many targeted Tavily queries execute per briefing (recommended: 4 to 6
              focused searches). Opening a saved briefing never triggers additional searches.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {[4, 5, 6].map((b) => (
              <button
                key={b}
                type="button"
                disabled={savingBudget}
                onClick={() => handleBudgetChange(b)}
                className={`px-3 py-1.5 text-xs font-mono tabular-nums font-semibold rounded-md transition-colors ${
                  (usage?.defaultSearchBudgetPerRun || 5) === b
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {b} Searches
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
