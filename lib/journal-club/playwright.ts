import { Browser, BrowserContext, Page } from 'playwright';

/**
 * HUJI credentials for PDF download authentication
 */
export interface HUJICredentials {
  email: string;
  password: string;
}

/**
 * Authenticate user with Elsevier (placeholder for future enhancement)
 * TODO: Implement Elsevier auth flow similar to auth_elsevier.py
 */
async function authenticateElsevier(
  page: Page,
  creds: HUJICredentials,
  timeout: number
): Promise<void> {
  console.log('Elsevier auth: TBD');
  // Placeholder for Elsevier authentication flow
  // To be implemented in future tasks
}

/**
 * Authenticate user with NEJM (placeholder for future enhancement)
 * TODO: Implement NEJM auth flow similar to huji_login.py
 */
async function authenticateNEJM(
  page: Page,
  creds: HUJICredentials,
  timeout: number
): Promise<void> {
  console.log('NEJM auth: TBD');
  // Placeholder for NEJM authentication flow
  // To be implemented in future tasks
}

/**
 * Extract PDF URL from the current page using JavaScript evaluation
 * Looks for PDF links by href attribute or text content
 */
async function extractPDFUrl(page: Page): Promise<string | null> {
  try {
    const pdfUrl = await page.evaluate(() => {
      // Look for links with 'pdf' in href
      const links = document.querySelectorAll('a[href*="pdf"]');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href.includes('pdf')) {
          // Make absolute URL if relative
          try {
            return new URL(href, window.location.href).href;
          } catch {
            return href;
          }
        }
      }

      // Look for links ending with .pdf
      const allLinks = document.querySelectorAll('a[href$=".pdf"]');
      if (allLinks.length > 0) {
        const href = allLinks[0].getAttribute('href');
        if (href) {
          try {
            return new URL(href, window.location.href).href;
          } catch {
            return href;
          }
        }
      }

      // Look for buttons or links with 'pdf' in text content
      const candidates = document.querySelectorAll('a, button');
      for (const elem of candidates) {
        if (elem.textContent && elem.textContent.toLowerCase().includes('pdf')) {
          const href = elem.getAttribute('href');
          if (href) {
            try {
              return new URL(href, window.location.href).href;
            } catch {
              return href;
            }
          }
        }
      }

      return null;
    });

    return pdfUrl;
  } catch (error) {
    console.error('Error extracting PDF URL:', error);
    return null;
  }
}

/**
 * Download PDF from article URL using Playwright with HUJI authentication
 *
 * @param articleUrl - URL of the article to download
 * @param hujiCreds - HUJI credentials for authentication
 * @param timeout - Timeout in milliseconds (default: 120000)
 * @returns Buffer containing PDF data, or null if download failed
 */
export async function downloadPDFWithAuth(
  articleUrl: string,
  hujiCreds: HUJICredentials,
  timeout: number = 120000
): Promise<Buffer | null> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    // Dynamically import playwright
    const { chromium } = await import('playwright');

    // Launch chromium browser in headless mode
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    });

    // Create browser context with user agent
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Create new page
    page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    // Navigate to article URL
    await page.goto(articleUrl, { waitUntil: 'domcontentloaded' });

    // Detect publisher and authenticate if needed
    const urlLower = articleUrl.toLowerCase();

    if (
      urlLower.includes('sciencedirect.com') ||
      urlLower.includes('elsevier.com')
    ) {
      await authenticateElsevier(page, hujiCreds, timeout);
    } else if (urlLower.includes('nejm.org')) {
      await authenticateNEJM(page, hujiCreds, timeout);
    }

    // Extract PDF URL from page
    const pdfUrl = await extractPDFUrl(page);

    if (!pdfUrl) {
      console.error('Failed to extract PDF URL from page');
      return null;
    }

    // Navigate to PDF URL and get response
    const response = await page.goto(pdfUrl, {
      waitUntil: 'domcontentloaded',
    });

    if (!response) {
      console.error('Failed to navigate to PDF URL');
      return null;
    }

    if (!response.ok()) {
      console.error(`PDF download failed with status ${response.status()}`);
      return null;
    }

    // Get PDF buffer from response
    const buffer = await response.body();

    if (!buffer) {
      console.error('No response body from PDF URL');
      return null;
    }

    return buffer;
  } catch (error) {
    console.error('Error downloading PDF with Playwright:', error);
    return null;
  } finally {
    // Always close browser and context
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
