const Session = require('../models/session.model');
const logger = require('./logger.util');

class SessionUtil {
  /**
   * Save browser session data for a user
   * @param {string} userId - User ID
   * @param {Object} page - Puppeteer page object
   */
  async saveSession(userId, page) {
    try {
      // Get cookies
      const cookies = await page.cookies();

      // Get localStorage and sessionStorage data
      const storageData = await page.evaluate(() => {
        const localStorage = Object.entries(window.localStorage).map(([key, value]) => ({ key, value }));
        const sessionStorage = Object.entries(window.sessionStorage).map(([key, value]) => ({ key, value }));
        return { localStorage, sessionStorage };
      });

      // Create or update session
      await Session.findOneAndUpdate(
        { userId },
        {
          userId,
          cookies,
          localStorage: storageData.localStorage,
          sessionStorage: storageData.sessionStorage,
          lastUsed: new Date()
        },
        { upsert: true, new: true }
      );

      logger.info('Session saved successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error saving session:', {
        error: error.message,
        stack: error.stack,
        userId
      });
      return false;
    }
  }

  /**
   * Restore browser session for a user
   * @param {string} userId - User ID
   * @param {Object} page - Puppeteer page object
   */
  async restoreSession(userId, page) {
    try {
      // Get latest session
      const session = await Session.findOne({ userId })
        .sort({ lastUsed: -1 })
        .lean();

      if (!session) {
        logger.debug('No existing session found', { userId });
        return false;
      }

      // First navigate to the login page to ensure we have a valid context
      await page.goto(process.env.SCRAPING_WEBSITE_URL, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Set cookies
      if (session.cookies && session.cookies.length > 0) {
        await page.setCookie(...session.cookies);
      }

      // Set localStorage and sessionStorage
      if (session.localStorage && session.localStorage.length > 0) {
        await page.evaluate((data) => {
          try {
            // Clear existing storage
            localStorage.clear();
            
            // Restore localStorage
            data.forEach(({ key, value }) => {
              localStorage.setItem(key, value);
            });
          } catch (e) {
            console.error('localStorage restoration error:', e);
          }
        }, session.localStorage);
      }

      if (session.sessionStorage && session.sessionStorage.length > 0) {
        await page.evaluate((data) => {
          try {
            // Clear existing storage
            sessionStorage.clear();
            
            // Restore sessionStorage
            data.forEach(({ key, value }) => {
              sessionStorage.setItem(key, value);
            });
          } catch (e) {
            console.error('sessionStorage restoration error:', e);
          }
        }, session.sessionStorage);
      }

      // Refresh the page to apply the restored session
      await page.reload({ waitUntil: 'networkidle0' });

      // Update last used timestamp
      await Session.findByIdAndUpdate(session._id, {
        lastUsed: new Date()
      });

      logger.info('Session restored successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Error restoring session:', {
        error: error.message,
        stack: error.stack,
        userId
      });
      return false;
    }
  }

  /**
   * Validate if a session is still valid
   * @param {string} userId - User ID
   */
  async isSessionValid(userId) {
    try {
      const session = await Session.findOne({ userId })
        .sort({ lastUsed: -1 })
        .lean();

      if (!session) return false;

      // Check if session is within expiry window (6 hours)
      const expiryTime = new Date(session.lastUsed);
      expiryTime.setHours(expiryTime.getHours() + 6);

      return expiryTime > new Date();
    } catch (error) {
      logger.error('Error validating session:', {
        error: error.message,
        stack: error.stack,
        userId
      });
      return false;
    }
  }

  /**
   * Delete expired sessions for cleanup
   */
  async cleanupExpiredSessions() {
    try {
      const expiryTime = new Date();
      expiryTime.setHours(expiryTime.getHours() - 6);

      const result = await Session.deleteMany({
        lastUsed: { $lt: expiryTime }
      });

      logger.info('Cleaned up expired sessions');
      return result.deletedCount;
    } catch (error) {
      logger.error('Error cleaning up sessions:', {
        error: error.message,
        stack: error.stack
      });
      return 0;
    }
  }
}

// Export singleton instance
module.exports = new SessionUtil(); 