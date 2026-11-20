import {
  ConfidenceLevel,
  RawTavilyResult,
  ResearchFinding,
  SourceReference,
  VerificationStatus,
} from '../../src/shared/types.ts';

const PRIMARY_SOURCE_PATTERNS = [
  'sec.gov',
  'investor.',
  'ir.',
  'newsroom.',
  'press.',
  'nvidianews.nvidia.com',
  'prnewswire.com',
  'businesswire.com',
  'globenewswire.com',
  '.gov',
];

const REPUTABLE_PUBLICATIONS = [
  'reuters.com',
  'bloomberg.com',
  'wsj.com',
  'ft.com',
  'cnbc.com',
  'techcrunch.com',
  'theverge.com',
  'forbes.com',
  'nytimes.com',
  'BBC',
  'axios.com',
  'fortune.com',
  'venturebeat.com',
  'arstechnica.com',
  'wired.com',
  'statnews.com',
  'semafor.com',
  'theinformation.com',
];

export function extractDomainName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return 'External Web Source';
  }
}

export function isPrimarySourceDomain(url: string, subjectName: string): boolean {
  const lowerUrl = url.toLowerCase();
  const normalizedSubject = subjectName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (
    normalizedSubject.length >= 3 &&
    extractDomainName(lowerUrl).replace(/[^a-z0-9]/g, '').includes(normalizedSubject)
  ) {
    return true;
  }

  return PRIMARY_SOURCE_PATTERNS.some((p) => lowerUrl.includes(p));
}

export function isReputablePublication(url: string): boolean {
  const domain = extractDomainName(url).toLowerCase();
  return REPUTABLE_PUBLICATIONS.some((pub) => domain.includes(pub.toLowerCase()));
}

/**
 * Attempts to parse a publication date from Tavily metadata or explicit date patterns in the snippet.
 * Never fabricates a date. If unavailable, returns { formatted: 'Publication date unavailable', valid: false, within30Days: false }.
 */
export function evaluatePublicationDate(
  rawDate: string | null,
  contentSnippet: string,
  researchStartDate: string,
  researchEndDate: string
): {
  publicationDate: string;
  hasValidPublicationDate: boolean;
  isWithin30Days: boolean;
} {
  let candidateDateStr = rawDate?.trim() || null;

  // If Tavily did not supply published_date, check if the article snippet begins with an explicit date stamp (e.g., "Oct 24, 2026 —")
  if (!candidateDateStr && contentSnippet) {
    const explicitMatch = contentSnippet.match(
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+20\d{2}|\d{4}-\d{2}-\d{2})\b/i
    );
    if (explicitMatch) {
      candidateDateStr = explicitMatch[1];
    }
  }

  if (!candidateDateStr) {
    return {
      publicationDate: 'Publication date unavailable',
      hasValidPublicationDate: false,
      isWithin30Days: false,
    };
  }

  const parsedMs = Date.parse(candidateDateStr);
  if (Number.isNaN(parsedMs)) {
    return {
      publicationDate: 'Publication date unavailable',
      hasValidPublicationDate: false,
      isWithin30Days: false,
    };
  }

  const parsedDate = new Date(parsedMs);
  const formatted = parsedDate.toISOString().split('T')[0];

  const startMs = Date.parse(`${researchStartDate}T00:00:00Z`);
  const endMs = Date.parse(`${researchEndDate}T23:59:59Z`);
  // Allow slight 24h timezone tolerance on endMs
  const within30Days = parsedMs >= startMs && parsedMs <= endMs + 86400000;

  return {
    publicationDate: formatted,
    hasValidPublicationDate: true,
    isWithin30Days: within30Days,
  };
}

/**
 * Evaluates a candidate finding against the raw Tavily results to enforce strict verification rules:
 * - Never equates Tavily score alone with truth
 * - Requires a real source URL from the retrieved Tavily corpus
 * - Separates undated sources from confirmed 30-day developments
 */
export function verifyAndEnrichFinding(params: {
  rawFinding: {
    title: string;
    summary: string;
    whyItMatters: string;
    category: ResearchFinding['category'];
    sourceUrl: string;
    evidenceQuote?: string;
    aiSuggestedStatus?: VerificationStatus;
    aiVerificationReason?: string;
  };
  index: number;
  rawResults: RawTavilyResult[];
  subjectName: string;
  researchStartDate: string;
  researchEndDate: string;
}): ResearchFinding | null {
  const { rawFinding, index, rawResults, subjectName, researchStartDate, researchEndDate } =
    params;

  // Match against actual Tavily result URL so Gemini can NEVER invent a source URL
  const matchedSource =
    rawResults.find(
      (r) =>
        r.url === rawFinding.sourceUrl ||
        r.canonicalUrl === rawFinding.sourceUrl.trim().toLowerCase()
    ) ||
    rawResults.find((r) =>
      r.title.toLowerCase().includes(rawFinding.title.slice(0, 20).toLowerCase())
    );

  // If the finding does not trace back to an actual retrieved Tavily URL, reject it to prevent hallucination
  if (!matchedSource) {
    return null;
  }

  const dateEval = evaluatePublicationDate(
    matchedSource.publishedDate,
    matchedSource.content,
    researchStartDate,
    researchEndDate
  );

  const isPrimary = isPrimarySourceDomain(matchedSource.url, subjectName);
  const isReputable = isReputablePublication(matchedSource.url);
  const sourceDomain = extractDomainName(matchedSource.url);

  const evidenceText =
    rawFinding.evidenceQuote &&
    rawFinding.evidenceQuote.length > 20 &&
    matchedSource.content
      .toLowerCase()
      .includes(rawFinding.evidenceQuote.slice(0, 25).toLowerCase())
      ? rawFinding.evidenceQuote
      : matchedSource.content.slice(0, 340);

  let verificationStatus: VerificationStatus =
    rawFinding.aiSuggestedStatus || 'PARTIALLY_VERIFIED';
  let confidenceLevel: ConfidenceLevel = 'MEDIUM';
  let verificationReason =
    rawFinding.aiVerificationReason ||
    'Evaluated against retrieved source text and publication metadata.';

  // Rule enforcement:
  // 1. If conflicting was identified by AI analysis, preserve CONFLICTING
  if (rawFinding.aiSuggestedStatus === 'CONFLICTING') {
    verificationStatus = 'CONFLICTING';
    confidenceLevel = 'LOW';
    verificationReason =
      rawFinding.aiVerificationReason ||
      'Materially different claims or figures reported across retrieved sources.';
  } else if (!dateEval.hasValidPublicationDate) {
    // 2. If publication date is missing, cannot be VERIFIED as a confirmed 30-day development
    if (verificationStatus === 'VERIFIED') {
      verificationStatus = 'PARTIALLY_VERIFIED';
    }
    confidenceLevel = isPrimary || isReputable ? 'MEDIUM' : 'LOW';
    verificationReason =
      'Source content supports the claim, but exact publication date is unavailable in metadata; separated from confirmed 30-day timeline.';
  } else if (!dateEval.isWithin30Days) {
    verificationStatus = 'PARTIALLY_VERIFIED';
    confidenceLevel = 'MEDIUM';
    verificationReason = `Published on ${dateEval.publicationDate}, outside the strict ${researchStartDate} to ${researchEndDate} window; retained for background context.`;
  } else if (isPrimary) {
    verificationStatus = 'VERIFIED';
    confidenceLevel = 'HIGH';
    verificationReason = `Directly supported by primary/official source (${sourceDomain}) published ${dateEval.publicationDate}.`;
  } else if (isReputable && evidenceText.length >= 60) {
    verificationStatus =
      rawFinding.aiSuggestedStatus === 'UNVERIFIED' ? 'PARTIALLY_VERIFIED' : 'VERIFIED';
    confidenceLevel = 'HIGH';
    verificationReason = `Supported by reputable independent publication (${sourceDomain}) with explicit publication date (${dateEval.publicationDate}).`;
  } else if (evidenceText.length < 45) {
    verificationStatus = 'UNVERIFIED';
    confidenceLevel = 'LOW';
    verificationReason =
      'Snippet contains limited supporting detail; treat as unverified until primary documentation is reviewed.';
  } else {
    verificationStatus =
      rawFinding.aiSuggestedStatus === 'VERIFIED' ? 'PARTIALLY_VERIFIED' : verificationStatus;
    confidenceLevel = 'MEDIUM';
    verificationReason = `Reported by ${sourceDomain} (${dateEval.publicationDate}); single secondary source without primary filing corroboration.`;
  }

  return {
    id: `finding-${Date.now()}-${index}`,
    title: rawFinding.title.trim(),
    summary: rawFinding.summary.trim(),
    whyItMatters: rawFinding.whyItMatters.trim(),
    category: rawFinding.category || 'Industry & Strategy',
    sourceTitle: matchedSource.title,
    sourceName: sourceDomain,
    sourceUrl: matchedSource.url,
    publicationDate: dateEval.publicationDate,
    hasValidPublicationDate: dateEval.hasValidPublicationDate,
    isWithin30Days: dateEval.isWithin30Days,
    retrievalDate: matchedSource.retrievedAt.split('T')[0],
    evidenceText,
    relevanceScore: matchedSource.score,
    verificationStatus,
    verificationReason,
    confidenceLevel,
    isPrimarySource: isPrimary,
  };
}

/**
 * Fallback deterministic evidence builder if AI model is unavailable, ensuring every Tavily result
 * is still verified and presented honestly without fabricated claims.
 */
export function buildDeterministicFindingsFromRaw(
  rawResults: RawTavilyResult[],
  subjectName: string,
  purpose: string,
  researchStartDate: string,
  researchEndDate: string
): ResearchFinding[] {
  return rawResults.slice(0, 8).map((raw, idx) => {
    const dateEval = evaluatePublicationDate(
      raw.publishedDate,
      raw.content,
      researchStartDate,
      researchEndDate
    );
    const isPrimary = isPrimarySourceDomain(raw.url, subjectName);
    const isReputable = isReputablePublication(raw.url);
    const domain = extractDomainName(raw.url);

    let status: VerificationStatus = 'PARTIALLY_VERIFIED';
    let confidence: ConfidenceLevel = 'MEDIUM';
    let reason = `Retrieved from ${domain}; verify full context directly in source article.`;

    if (dateEval.hasValidPublicationDate && dateEval.isWithin30Days && (isPrimary || isReputable)) {
      status = 'VERIFIED';
      confidence = 'HIGH';
      reason = `Dated source (${dateEval.publicationDate}) from ${domain} within the 30-day research window.`;
    } else if (!dateEval.hasValidPublicationDate) {
      status = 'PARTIALLY_VERIFIED';
      confidence = 'LOW';
      reason =
        'Publication date unavailable in source metadata; placed in undated context section.';
    }

    return {
      id: `finding-det-${Date.now()}-${idx}`,
      title: raw.title,
      summary:
        raw.content.length > 260 ? `${raw.content.slice(0, 257).trim()}...` : raw.content,
      whyItMatters: `Retrieved under "${raw.queryCategory}" for your ${purpose} with ${subjectName}.`,
      category: mapQueryCategoryToFindingCategory(raw.queryCategory),
      sourceTitle: raw.title,
      sourceName: domain,
      sourceUrl: raw.url,
      publicationDate: dateEval.publicationDate,
      hasValidPublicationDate: dateEval.hasValidPublicationDate,
      isWithin30Days: dateEval.isWithin30Days,
      retrievalDate: raw.retrievedAt.split('T')[0],
      evidenceText: raw.content.slice(0, 340),
      relevanceScore: raw.score,
      verificationStatus: status,
      verificationReason: reason,
      confidenceLevel: confidence,
      isPrimarySource: isPrimary,
    };
  });
}

function mapQueryCategoryToFindingCategory(
  queryCat: string
): ResearchFinding['category'] {
  const lower = queryCat.toLowerCase();
  if (lower.includes('launch') || lower.includes('product') || lower.includes('announcement')) {
    return 'Announcement & Launch';
  }
  if (lower.includes('leader') || lower.includes('executive') || lower.includes('role') || lower.includes('hire')) {
    return 'Leadership & Hires';
  }
  if (lower.includes('financ') || lower.includes('funding') || lower.includes('investor')) {
    return 'Financial & Business';
  }
  if (lower.includes('partner') || lower.includes('acqui') || lower.includes('deal')) {
    return 'Partnerships & Deals';
  }
  return 'Industry & Strategy';
}

export function buildSourceReferencesList(
  findings: ResearchFinding[],
  rawResults: RawTavilyResult[],
  subjectName: string,
  researchStartDate: string,
  researchEndDate: string
): SourceReference[] {
  const seenUrls = new Set<string>();
  const refs: SourceReference[] = [];

  for (const f of findings) {
    if (!seenUrls.has(f.sourceUrl)) {
      seenUrls.add(f.sourceUrl);
      refs.push({
        id: `src-${refs.length + 1}`,
        sourceName: f.sourceName,
        articleTitle: f.sourceTitle,
        url: f.sourceUrl,
        publicationDate: f.publicationDate,
        retrievedAt: f.retrievalDate,
        verificationStatus: f.verificationStatus,
        isPrimarySource: f.isPrimarySource,
      });
    }
  }

  for (const r of rawResults) {
    if (!seenUrls.has(r.url) && refs.length < 15) {
      seenUrls.add(r.url);
      const dateEval = evaluatePublicationDate(
        r.publishedDate,
        r.content,
        researchStartDate,
        researchEndDate
      );
      const isPrimary = isPrimarySourceDomain(r.url, subjectName);
      refs.push({
        id: `src-${refs.length + 1}`,
        sourceName: extractDomainName(r.url),
        articleTitle: r.title,
        url: r.url,
        publicationDate: dateEval.publicationDate,
        retrievedAt: r.retrievedAt.split('T')[0],
        verificationStatus: dateEval.hasValidPublicationDate
          ? 'PARTIALLY_VERIFIED'
          : 'UNVERIFIED',
        isPrimarySource: isPrimary,
      });
    }
  }

  return refs;
}
