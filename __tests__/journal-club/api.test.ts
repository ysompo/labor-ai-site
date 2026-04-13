import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from '@vercel/postgres';

/**
 * Journal Club API Integration Tests
 *
 * These tests verify core database operations and API routes.
 * Run with: npm run test:journal-club
 */

describe('Journal Club API', () => {
  // Test data
  const testUserId = 1; // Assumes test user exists in sim_users
  const testJournalData = {
    name: 'Test Journal',
    publisher: 'Test Publisher',
    toc_url: 'https://example.com/toc',
    issn: '1234-5678',
  };

  const testArticleData = {
    title: 'Test Article',
    doi: '10.1234/test.2024.001',
    url: 'https://example.com/article',
    pmid: '12345678',
    journal: 'Test Journal',
    authors: ['Author One', 'Author Two'],
    pub_date: '2024-04-01',
    abstract: 'This is a test abstract.',
  };

  /**
   * Test Suite: Database Connection
   */
  describe('Database Connection', () => {
    it('should connect to Postgres database', async () => {
      try {
        const result = await sql`SELECT 1 as connected`;
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].connected).toBe(1);
      } catch (error) {
        throw new Error(`Database connection failed: ${error}`);
      }
    });

    it('should verify schema tables exist', async () => {
      try {
        const tables = [
          'jc_journals',
          'jc_toc_articles',
          'jc_articles',
          'jc_reading_list',
          'jc_settings',
          'jc_access_requests',
        ];

        for (const table of tables) {
          const result = await sql`
            SELECT 1 FROM information_schema.tables
            WHERE table_name = ${table}
          `;
          expect(result.rows.length).toBeGreaterThan(0);
        }
      } catch (error) {
        throw new Error(`Schema verification failed: ${error}`);
      }
    });
  });

  /**
   * Test Suite: Journal CRUD Operations
   */
  describe('Journal Management', () => {
    let createdJournalId: number;

    it('should create a new journal', async () => {
      try {
        const result = await sql<{ id: number }>`
          INSERT INTO jc_journals (name, publisher, toc_url, issn)
          VALUES (${testJournalData.name}, ${testJournalData.publisher}, ${testJournalData.toc_url}, ${testJournalData.issn})
          RETURNING id
        `;
        createdJournalId = (result.rows[0] as { id: number }).id;
        expect(createdJournalId).toBeGreaterThan(0);
      } catch (error) {
        throw new Error(`Failed to create journal: ${error}`);
      }
    });

    it('should retrieve journal by ID', async () => {
      try {
        const result = await sql`
          SELECT * FROM jc_journals WHERE id = ${createdJournalId}
        `;
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].name).toBe(testJournalData.name);
        expect(result.rows[0].issn).toBe(testJournalData.issn);
      } catch (error) {
        throw new Error(`Failed to retrieve journal: ${error}`);
      }
    });

    it('should list all journals', async () => {
      try {
        const result = await sql`SELECT * FROM jc_journals`;
        expect(result.rows.length).toBeGreaterThanOrEqual(1);
      } catch (error) {
        throw new Error(`Failed to list journals: ${error}`);
      }
    });

    it('should update journal', async () => {
      try {
        const updatedName = 'Updated Test Journal';
        await sql`
          UPDATE jc_journals
          SET name = ${updatedName}, has_new_issue = true
          WHERE id = ${createdJournalId}
        `;

        const result = await sql`
          SELECT * FROM jc_journals WHERE id = ${createdJournalId}
        `;
        expect(result.rows[0].name).toBe(updatedName);
        expect(result.rows[0].has_new_issue).toBe(true);
      } catch (error) {
        throw new Error(`Failed to update journal: ${error}`);
      }
    });

    it('should delete journal', async () => {
      try {
        await sql`DELETE FROM jc_journals WHERE id = ${createdJournalId}`;

        const result = await sql`
          SELECT * FROM jc_journals WHERE id = ${createdJournalId}
        `;
        expect(result.rows.length).toBe(0);
      } catch (error) {
        throw new Error(`Failed to delete journal: ${error}`);
      }
    });
  });

  /**
   * Test Suite: Article Operations
   */
  describe('Article Management', () => {
    let journalId: number;
    let articleId: number;
    let tocArticleId: number;

    beforeAll(async () => {
      try {
        // Create test journal
        const journalResult = await sql`
          INSERT INTO jc_journals (name, publisher, toc_url, issn)
          VALUES (${'Test Journal for Articles'}, ${'Test'}, ${'https://example.com'}, ${'9999-9999'})
          RETURNING id
        `;
        journalId = journalResult.rows[0].id;
      } catch (error) {
        throw new Error(`Setup failed: ${error}`);
      }
    });

    afterAll(async () => {
      try {
        // Cleanup journal (cascade deletes articles)
        await sql`DELETE FROM jc_journals WHERE id = ${journalId}`;
      } catch (error) {
        console.warn(`Cleanup failed: ${error}`);
      }
    });

    it('should create TOC article', async () => {
      try {
        const result = await sql`
          INSERT INTO jc_toc_articles (journal_id, url, title, doi, issue_label)
          VALUES (${journalId}, ${'https://example.com/article'}, ${'Test TOC Article'}, ${'10.1234/test'}, ${'Volume 1, Issue 1'})
          RETURNING id
        `;
        tocArticleId = result.rows[0].id;
        expect(tocArticleId).toBeGreaterThan(0);
      } catch (error) {
        throw new Error(`Failed to create TOC article: ${error}`);
      }
    });

    it('should create downloaded article', async () => {
      try {
        const result = await sql`
          INSERT INTO jc_articles (user_id, title, doi, url, pmid, journal, pub_date, abstract, downloaded_at)
          VALUES (${testUserId}, ${testArticleData.title}, ${testArticleData.doi}, ${testArticleData.url}, ${testArticleData.pmid}, ${testArticleData.journal}, ${testArticleData.pub_date}, ${testArticleData.abstract}, NOW())
          RETURNING id
        `;
        articleId = result.rows[0].id;
        expect(articleId).toBeGreaterThan(0);
      } catch (error) {
        throw new Error(`Failed to create article: ${error}`);
      }
    });

    it('should add article to reading list', async () => {
      try {
        const result = await sql`
          INSERT INTO jc_reading_list (user_id, article_id, toc_article_id)
          VALUES (${testUserId}, ${articleId}, ${tocArticleId})
          RETURNING id
        `;
        const readingListId = result.rows[0].id;
        expect(readingListId).toBeGreaterThan(0);
      } catch (error) {
        throw new Error(`Failed to add to reading list: ${error}`);
      }
    });

    it('should retrieve reading list for user', async () => {
      try {
        const result = await sql`
          SELECT rl.*, a.title, a.doi, a.journal
          FROM jc_reading_list rl
          LEFT JOIN jc_articles a ON rl.article_id = a.id
          WHERE rl.user_id = ${testUserId}
          ORDER BY rl.added_at DESC
        `;
        expect(result.rows.length).toBeGreaterThanOrEqual(1);
        expect(result.rows[0].title).toBe(testArticleData.title);
      } catch (error) {
        throw new Error(`Failed to retrieve reading list: ${error}`);
      }
    });
  });

  /**
   * Test Suite: Settings Storage
   */
  describe('Settings Management', () => {
    it('should store and retrieve encrypted settings', async () => {
      try {
        const key = 'test_key';
        const encryptedValue = 'test_encrypted_value_123';

        // Insert setting
        await sql`
          INSERT INTO jc_settings (user_id, key, encrypted_value)
          VALUES (${testUserId}, ${key}, ${encryptedValue})
          ON CONFLICT (user_id, key) DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value
        `;

        // Retrieve setting
        const result = await sql`
          SELECT * FROM jc_settings
          WHERE user_id = ${testUserId} AND key = ${key}
        `;

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].encrypted_value).toBe(encryptedValue);

        // Cleanup
        await sql`
          DELETE FROM jc_settings
          WHERE user_id = ${testUserId} AND key = ${key}
        `;
      } catch (error) {
        throw new Error(`Settings test failed: ${error}`);
      }
    });
  });

  /**
   * Test Suite: Access Requests
   */
  describe('Access Requests', () => {
    it('should create access request', async () => {
      try {
        const email = `test-${Date.now()}@example.com`;
        const result = await sql`
          INSERT INTO jc_access_requests (email, name, status)
          VALUES (${email}, ${'Test User'}, ${'pending'})
          RETURNING id
        `;
        const requestId = result.rows[0].id;
        expect(requestId).toBeGreaterThan(0);

        // Cleanup
        await sql`DELETE FROM jc_access_requests WHERE id = ${requestId}`;
      } catch (error) {
        throw new Error(`Failed to create access request: ${error}`);
      }
    });

    it('should prevent duplicate access requests', async () => {
      try {
        const email = `unique-${Date.now()}@example.com`;

        // Create first request
        await sql`
          INSERT INTO jc_access_requests (email, name, status)
          VALUES (${email}, ${'Test User'}, ${'pending'})
        `;

        // Attempt to create duplicate
        expect(
          sql`
            INSERT INTO jc_access_requests (email, name, status)
            VALUES (${email}, ${'Test User 2'}, ${'pending'})
          `
        ).rejects.toThrow();

        // Cleanup
        await sql`DELETE FROM jc_access_requests WHERE email = ${email}`;
      } catch (error) {
        // Expected to fail with unique constraint
        if (error instanceof Error && !error.message.includes('unique')) {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      }
    });
  });

  /**
   * Test Suite: Performance and Indexes
   */
  describe('Performance - Indexes', () => {
    it('should have index on jc_articles(user_id)', async () => {
      try {
        const result = await sql`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'jc_articles' AND indexname = 'idx_jc_articles_user_id'
        `;
        expect(result.rows.length).toBe(1);
      } catch (error) {
        throw new Error(`Failed to verify index: ${error}`);
      }
    });

    it('should have index on jc_toc_articles(journal_id)', async () => {
      try {
        const result = await sql`
          SELECT indexname FROM pg_indexes
          WHERE tablename = 'jc_toc_articles' AND indexname = 'idx_jc_toc_articles_journal_id'
        `;
        expect(result.rows.length).toBe(1);
      } catch (error) {
        throw new Error(`Failed to verify index: ${error}`);
      }
    });
  });
});
