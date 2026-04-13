import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { sql } from '@vercel/postgres';

/**
 * Journal Club API Integration Tests
 *
 * These tests verify core database operations and API routes.
 * Run with: npm run test:journal-club
 *
 * ⚠️ WARNING: This test suite expects TEST_DATABASE_URL or a separate test database.
 * DO NOT RUN AGAINST PRODUCTION. Set TEST_DATABASE_URL environment variable before running.
 */

describe('Journal Club API', () => {
  // Test data - module scope to allow reset in beforeEach
  let testUserId: number;
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
   * Before all tests: verify test user exists in sim_users
   */
  beforeAll(async () => {
    try {
      // Use a fixed test user ID for consistency
      testUserId = 1;

      // Verify test user exists
      const userResult = await sql`
        SELECT id FROM sim_users WHERE id = ${testUserId}
      `;

      if (userResult.rows.length === 0) {
        throw new Error(
          `Test user with ID ${testUserId} not found in sim_users table. ` +
          'Please create a test user or update testUserId in api.test.ts'
        );
      }
    } catch (error) {
      throw new Error(`Setup failed: ${error}`);
    }
  });

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

    // Create a unique test journal for each test
    beforeEach(async () => {
      try {
        const uniqueName = `Test Journal ${Date.now()}`;
        const result = await sql<{ id: number }>`
          INSERT INTO jc_journals (name, publisher, toc_url, issn)
          VALUES (${uniqueName}, ${testJournalData.publisher}, ${testJournalData.toc_url}, ${testJournalData.issn})
          RETURNING id
        `;
        createdJournalId = (result.rows[0] as { id: number }).id;
      } catch (error) {
        throw new Error(`beforeEach setup failed: ${error}`);
      }
    });

    // Always clean up test data, even if test fails
    afterEach(async () => {
      try {
        if (createdJournalId) {
          await sql`DELETE FROM jc_journals WHERE id = ${createdJournalId}`;

          // Verify cleanup succeeded
          const verifyResult = await sql`
            SELECT id FROM jc_journals WHERE id = ${createdJournalId}
          `;
          if (verifyResult.rows.length > 0) {
            throw new Error('Cleanup verification failed: journal still exists after delete');
          }
        }
      } catch (error) {
        console.error(`afterEach cleanup failed: ${error}`);
        throw error;
      }
    });

    it('should create a new journal', async () => {
      // Journal already created in beforeEach, just verify it exists
      expect(createdJournalId).toBeGreaterThan(0);

      const result = await sql`
        SELECT * FROM jc_journals WHERE id = ${createdJournalId}
      `;
      expect(result.rows.length).toBe(1);
    });

    it('should retrieve journal by ID', async () => {
      expect(createdJournalId).toBeGreaterThan(0);

      const result = await sql`
        SELECT * FROM jc_journals WHERE id = ${createdJournalId}
      `;
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].publisher).toBe(testJournalData.publisher);
      expect(result.rows[0].issn).toBe(testJournalData.issn);
    });

    it('should list all journals', async () => {
      const result = await sql`SELECT * FROM jc_journals`;
      expect(result.rows.length).toBeGreaterThanOrEqual(1);

      // Verify our test journal is in the list
      const found = result.rows.some(
        (j: Record<string, unknown>) => (j as { id: number }).id === createdJournalId
      );
      expect(found).toBe(true);
    });

    it('should update journal', async () => {
      expect(createdJournalId).toBeGreaterThan(0);

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
    });

    it('should delete journal via explicit delete', async () => {
      expect(createdJournalId).toBeGreaterThan(0);

      await sql`DELETE FROM jc_journals WHERE id = ${createdJournalId}`;

      const result = await sql`
        SELECT * FROM jc_journals WHERE id = ${createdJournalId}
      `;
      expect(result.rows.length).toBe(0);

      // Reset so afterEach doesn't try to delete again
      createdJournalId = 0;
    });
  });

  /**
   * Test Suite: Article Operations
   */
  describe('Article Management', () => {
    let journalId: number;
    let articleId: number;
    let tocArticleId: number;

    beforeEach(async () => {
      try {
        // Create test journal for each test
        const journalResult = await sql`
          INSERT INTO jc_journals (name, publisher, toc_url, issn)
          VALUES (${'Test Journal for Articles ' + Date.now()}, ${'Test'}, ${'https://example.com'}, ${'9999-9999'})
          RETURNING id
        `;
        journalId = journalResult.rows[0].id;
      } catch (error) {
        throw new Error(`beforeEach setup failed: ${error}`);
      }
    });

    afterEach(async () => {
      try {
        // Cleanup journal (cascade deletes articles, toc_articles, reading_list entries)
        if (journalId) {
          await sql`DELETE FROM jc_journals WHERE id = ${journalId}`;

          // Verify cleanup succeeded
          const verifyResult = await sql`
            SELECT id FROM jc_journals WHERE id = ${journalId}
          `;
          if (verifyResult.rows.length > 0) {
            throw new Error('Cleanup verification failed: journal still exists after delete');
          }
        }
      } catch (error) {
        console.error(`afterEach cleanup failed: ${error}`);
        throw error;
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
    const settingsKey = `test_key_${Date.now()}`;

    afterEach(async () => {
      try {
        // Cleanup settings for this user
        await sql`
          DELETE FROM jc_settings
          WHERE user_id = ${testUserId} AND key = ${settingsKey}
        `;
      } catch (error) {
        console.warn(`Settings cleanup failed: ${error}`);
      }
    });

    it('should store and retrieve encrypted settings', async () => {
      expect(testUserId).toBeGreaterThan(0);

      const encryptedValue = 'test_encrypted_value_123';

      // Insert setting
      await sql`
        INSERT INTO jc_settings (user_id, key, encrypted_value)
        VALUES (${testUserId}, ${settingsKey}, ${encryptedValue})
        ON CONFLICT (user_id, key) DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value
      `;

      // Retrieve setting
      const result = await sql`
        SELECT * FROM jc_settings
        WHERE user_id = ${testUserId} AND key = ${settingsKey}
      `;

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].encrypted_value).toBe(encryptedValue);
    });
  });

  /**
   * Test Suite: Access Requests
   */
  describe('Access Requests', () => {
    let createdRequestId: number | null = null;
    let createdEmail: string | null = null;

    afterEach(async () => {
      try {
        // Clean up created request
        if (createdRequestId) {
          await sql`DELETE FROM jc_access_requests WHERE id = ${createdRequestId}`;
          createdRequestId = null;
        }

        // Clean up any remaining email-based entries (in case test partially failed)
        if (createdEmail) {
          await sql`DELETE FROM jc_access_requests WHERE email = ${createdEmail}`;
          createdEmail = null;
        }
      } catch (error) {
        console.warn(`Access request cleanup failed: ${error}`);
      }
    });

    it('should create access request', async () => {
      const email = `test-${Date.now()}@example.com`;
      createdEmail = email;

      const result = await sql`
        INSERT INTO jc_access_requests (email, name, status)
        VALUES (${email}, ${'Test User'}, ${'pending'})
        RETURNING id
      `;
      createdRequestId = result.rows[0].id;
      expect(createdRequestId).toBeGreaterThan(0);
    });

    it('should prevent duplicate access requests', async () => {
      const email = `unique-${Date.now()}@example.com`;
      createdEmail = email;

      // Create first request
      const firstResult = await sql`
        INSERT INTO jc_access_requests (email, name, status)
        VALUES (${email}, ${'Test User'}, ${'pending'})
        RETURNING id
      `;
      createdRequestId = firstResult.rows[0].id;

      // Attempt to create duplicate - properly await and expect rejection
      await expect(
        sql`
          INSERT INTO jc_access_requests (email, name, status)
          VALUES (${email}, ${'Test User 2'}, ${'pending'})
        `
      ).rejects.toThrow();
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
