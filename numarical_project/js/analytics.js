(function () {
  const STORAGE_KEY = 'analytics_events';
  const MAX_EVENTS = 5000;

  const Analytics = {
    getEvents() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch (e) { return []; }
    },

    saveEvents(events) {
      if (events.length > MAX_EVENTS) events = events.slice(events.length - MAX_EVENTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    },

    track(type, data) {
      const user = (function () {
        try {
          const u = localStorage.getItem('loggedInUser');
          if (u) return JSON.parse(u);
        } catch (e) { }
        return null;
      })();

      const event = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        type,
        data,
        timestamp: new Date().toISOString(),
        user: user ? { username: user.username, email: user.email } : null,
        url: window.location.href,
        page: window.location.pathname.split('/').pop() || 'index'
      };

      const events = Analytics.getEvents();
      events.push(event);
      Analytics.saveEvents(events);
      return event;
    },

    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },

    getSummary() {
      const events = Analytics.getEvents();
      const total = events.length;

      const byType = {};
      const byMethod = {};
      const byPage = {};
      const byDate = {};
      let errors = 0;
      let converged = 0;
      let totalIterations = 0;
      let solveCount = 0;

      let firstEvent = null;
      let lastEvent = null;

      events.forEach(function (e) {
        if (!firstEvent || e.timestamp < firstEvent) firstEvent = e.timestamp;
        if (!lastEvent || e.timestamp > lastEvent) lastEvent = e.timestamp;

        byType[e.type] = (byType[e.type] || 0) + 1;

        byPage[e.page] = (byPage[e.page] || 0) + 1;

        var day = e.timestamp ? e.timestamp.slice(0, 10) : 'unknown';
        byDate[day] = (byDate[day] || 0) + 1;

        if (e.type === 'solver_run') {
          solveCount++;
          if (e.data) {
            var method = e.data.method || 'unknown';
            byMethod[method] = (byMethod[method] || 0) + 1;
            if (e.data.iterations) totalIterations += Number(e.data.iterations);
            if (e.data.converged) converged++;
          }
        }

        if (e.type === 'solver_error') errors++;
      });

      var avgIterations = solveCount > 0 ? (totalIterations / solveCount) : 0;

      return {
        total,
        byType,
        byMethod,
        byPage,
        byDate,
        errors,
        converged,
        solveCount,
        avgIterations: Math.round(avgIterations * 100) / 100,
        firstEvent,
        lastEvent,
        duration: firstEvent && lastEvent
          ? (new Date(lastEvent) - new Date(firstEvent))
          : 0
      };
    },

    getRecentEvents(limit) {
      limit = limit || 50;
      var events = Analytics.getEvents();
      return events.slice(-limit).reverse();
    }
  };

  window.Analytics = Analytics;

  var page = window.location.pathname.split('/').pop() || 'index';
  Analytics.track('page_view', { title: document.title });
})();
