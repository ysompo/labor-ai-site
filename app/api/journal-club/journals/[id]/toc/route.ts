import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/journal-club/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await verifyJWT(token);

    const journalId = parseInt(id);

    // Get journal
    const journalResult = await sql`
      SELECT id, name, current_issue_label FROM jc_journals WHERE id = ${journalId}
    `;

    if (journalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const journal = journalResult.rows[0];

    // Get articles for this journal
    const articlesResult = await sql`
      SELECT id, url, title, authors, article_type, doi, abstract, issue_label
      FROM jc_toc_articles
      WHERE journal_id = ${journalId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json(articlesResult.rows);
  } catch (error) {
    console.error('Get TOC error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch TOC' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('sim_auth')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await verifyJWT(token);

    const journalId = parseInt(id);

    // Parse issues query param (default 1, max 4)
    const { searchParams } = new URL(request.url);
    const issuesParam = parseInt(searchParams.get('issues') || '1');
    const issues = Math.min(Math.max(issuesParam, 1), 4);

    // Get journal ISSN and toc_url
    const journalResult = await sql`
      SELECT id, name, issn, toc_url FROM jc_journals WHERE id = ${journalId}
    `;

    if (journalResult.rows.length === 0) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const journal = journalResult.rows[0];

    if (!journal.issn) {
      return NextResponse.json(
        { error: 'Journal has no ISSN — cannot refresh via PubMed' },
        { status: 400 }
      );
    }

    const issn = journal.issn as string;
    const retmax = issues > 1 ? issues * 15 : 40;

    // Step A — esearch
    const esearchParams = new URLSearchParams({
      db: 'pubmed',
      term: `${issn}[ISSN]`,
      sort: 'pub date',
      retmax: String(retmax),
      retmode: 'json',
    });
    if (issues > 1) {
      esearchParams.set('reldate', String(issues * 7));
      esearchParams.set('datetype', 'edat');
    }

    const esearchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${esearchParams}`
    );
    if (!esearchRes.ok) {
      throw new Error(`PubMed esearch failed: ${esearchRes.status}`);
    }
    const esearchData = await esearchRes.json();
    const idlist: string[] = esearchData?.esearchresult?.idlist ?? [];

    if (idlist.length === 0) {
      return NextResponse.json({ success: true, count: 0, issue_label: null });
    }

    // Step B — esummary
    const esummaryParams = new URLSearchParams({
      db: 'pubmed',
      id: idlist.join(','),
      retmode: 'json',
    });

    const esummaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${esummaryParams}`
    );
    if (!esummaryRes.ok) {
      throw new Error(`PubMed esummary failed: ${esummaryRes.status}`);
    }
    const esummaryData = await esummaryRes.json();
    const summaryResult = esummaryData?.result ?? {};

    // Step C — efetch for abstracts
    const efetchParams = new URLSearchParams({
      db: 'pubmed',
      id: idlist.join(','),
      retmode: 'xml',
      rettype: 'abstract',
    });

    const efetchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${efetchParams}`
    );
    const xmlText = efetchRes.ok ? await efetchRes.text() : '';

    // Parse abstracts from XML: find PubmedArticle blocks, extract PMID + AbstractText
    const abstracts: Record<string, string> = {};
    if (xmlText) {
      const articleBlocks = xmlText.split('<PubmedArticle>').slice(1);
      for (const block of articleBlocks) {
        const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
        if (!pmidMatch) continue;
        const pmid = pmidMatch[1];
        const abstractTexts: string[] = [];
        const abstractMatches = block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
        for (const m of abstractMatches) {
          abstractTexts.push(m[1].replace(/<[^>]+>/g, '').trim());
        }
        if (abstractTexts.length > 0) {
          abstracts[pmid] = abstractTexts.join(' ');
        }
      }
    }

    // Build articles array
    interface ArticleRecord {
      url: string;
      title: string;
      authors: string[];
      article_type: string | null;
      doi: string | null;
      abstract: string | null;
      issue_label: string;
    }

    const articles: ArticleRecord[] = [];
    let issueLabel = '';

    for (const pmid of idlist) {
      const doc = summaryResult[pmid];
      if (!doc || doc.error || !doc.title) continue;

      // Extract DOI from articleids
      let doi: string | null = null;
      if (Array.isArray(doc.articleids)) {
        const doiEntry = doc.articleids.find(
          (a: { idtype: string; value: string }) => a.idtype === 'doi'
        );
        if (doiEntry) doi = doiEntry.value;
      }

      // Build URL
      const url = doi
        ? `https://doi.org/${doi}`
        : `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

      // Extract authors (authtype == Author)
      const authors: string[] = [];
      if (Array.isArray(doc.authors)) {
        for (const a of doc.authors) {
          if (a.authtype === 'Author') {
            authors.push(a.name);
          }
        }
      }

      // Extract pubtype
      let article_type: string | null = null;
      if (Array.isArray(doc.pubtype) && doc.pubtype.length > 0) {
        const first = doc.pubtype[0];
        article_type = typeof first === 'object' && first !== null && 'value' in first
          ? String((first as { value: string }).value)
          : String(first);
      }

      // Build issue_label from first article
      if (!issueLabel) {
        const parts: string[] = [];
        if (doc.volume) parts.push(`Vol ${doc.volume}`);
        if (doc.issue) parts.push(`Issue ${doc.issue}`);
        if (doc.pubdate) parts.push(doc.pubdate);
        issueLabel = parts.join(' · ');
      }

      articles.push({
        url,
        title: doc.title as string,
        authors,
        article_type,
        doi,
        abstract: abstracts[pmid] ?? null,
        issue_label: issueLabel,
      });
    }

    // Clear existing TOC articles for this journal
    await sql`DELETE FROM jc_toc_articles WHERE journal_id = ${journalId}`;

    // Insert new articles
    for (const a of articles) {
      await sql`
        INSERT INTO jc_toc_articles (journal_id, url, title, authors, article_type, doi, abstract, issue_label)
        VALUES (
          ${journalId},
          ${a.url},
          ${a.title},
          ${a.authors as unknown as string},
          ${a.article_type},
          ${a.doi},
          ${a.abstract},
          ${a.issue_label}
        )
      `;
    }

    // Update journal metadata
    await sql`
      UPDATE jc_journals
      SET current_issue_label = ${issueLabel || null},
          has_new_issue = TRUE,
          updated_at = NOW()
      WHERE id = ${journalId}
    `;

    return NextResponse.json({
      success: true,
      count: articles.length,
      issue_label: issueLabel || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Refresh TOC error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
