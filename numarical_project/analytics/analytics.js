(function () {
  function $(id) { return document.getElementById(id); }

  function render() {
    var summary = window.Analytics.getSummary();
    var events = window.Analytics.getRecentEvents(100);

    $('totalEvents').textContent = summary.total;
    $('solveCount').textContent = summary.solveCount;
    $('errorCount').textContent = summary.errors;
    $('convergedCount').textContent = summary.converged;
    $('avgIterations').textContent = summary.avgIterations;

    var duration = summary.duration;
    if (duration > 0) {
      var hours = Math.floor(duration / 3600000);
      var mins = Math.floor((duration % 3600000) / 60000);
      $('sessionDuration').textContent = hours + 'h ' + mins + 'm';
    } else {
      $('sessionDuration').textContent = '—';
    }

    renderMethodsChart(summary.byMethod);
    renderPagesChart(summary.byPage);
    renderEventsChart(summary.byType);
    renderRecentActivity(events);
  }

  function renderMethodsChart(byMethod) {
    var container = $('methodsChart');
    var keys = Object.keys(byMethod);
    if (!keys.length) { container.innerHTML = '<div class="empty-chart">No solver runs yet.</div>'; return; }

    var total = keys.reduce(function (s, k) { return s + byMethod[k]; }, 0);
    var colors = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899'];
    var html = '<div class="bar-chart">';

    keys.forEach(function (key, i) {
      var pct = (byMethod[key] / total * 100).toFixed(1);
      html += '<div class="bar-row">';
      html += '<span class="bar-label">' + key + '</span>';
      html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + (colors[i % colors.length]) + '"></div></div>';
      html += '<span class="bar-value">' + byMethod[key] + ' (' + pct + '%)</span>';
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  function renderPagesChart(byPage) {
    var container = $('pagesChart');
    var keys = Object.keys(byPage);
    if (!keys.length) { container.innerHTML = '<div class="empty-chart">No page views yet.</div>'; return; }

    var total = keys.reduce(function (s, k) { return s + byPage[k]; }, 0);
    var colors = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899'];
    var html = '<div class="bar-chart">';

    keys.forEach(function (key, i) {
      var pct = (byPage[key] / total * 100).toFixed(1);
      var label = key.replace('index.html', 'Nonlinear Solver').replace('auth.html', 'Auth').replace('linearindex.html', 'Linear Solver');
      html += '<div class="bar-row">';
      html += '<span class="bar-label">' + label + '</span>';
      html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + (colors[i % colors.length]) + '"></div></div>';
      html += '<span class="bar-value">' + byPage[key] + ' (' + pct + '%)</span>';
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  function renderEventsChart(byType) {
    var container = $('eventsChart');
    var keys = Object.keys(byType);
    if (!keys.length) { container.innerHTML = '<div class="empty-chart">No events yet.</div>'; return; }

    var total = keys.reduce(function (s, k) { return s + byType[k]; }, 0);
    var colorMap = { page_view: '#2563eb', solver_run: '#16a34a', solver_error: '#dc2626', login: '#8b5cf6', logout: '#ec4899', reset: '#f59e0b', step_navigate: '#06b6d4' };
    var html = '<div class="bar-chart">';

    keys.forEach(function (key) {
      var pct = (byType[key] / total * 100).toFixed(1);
      html += '<div class="bar-row">';
      html += '<span class="bar-label">' + key.replace(/_/g, ' ') + '</span>';
      html += '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + (colorMap[key] || '#6b7280') + '"></div></div>';
      html += '<span class="bar-value">' + byType[key] + ' (' + pct + '%)</span>';
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  function renderRecentActivity(events) {
    var container = $('recentActivity');
    if (!events.length) { container.innerHTML = '<div class="empty-chart">No activity yet.</div>'; return; }

    var html = '<div class="activity-list">';
    events.slice(0, 50).forEach(function (e) {
      var time = new Date(e.timestamp);
      var timeStr = time.toLocaleString();
      var icon = getEventIcon(e.type);
      var detail = getEventDetail(e);
      html += '<div class="activity-item">';
      html += '<span class="activity-icon">' + icon + '</span>';
      html += '<span class="activity-text"><strong>' + e.type.replace(/_/g, ' ') + '</strong> ' + detail + '</span>';
      html += '<span class="activity-time">' + timeStr + '</span>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function getEventIcon(type) {
    var icons = {
      page_view: '\u{1F4CB}',
      solver_run: '\u{2699}',
      solver_error: '\u{274C}',
      login: '\u{1F510}',
      logout: '\u{1F6AA}',
      reset: '\u{1F504}',
      step_navigate: '\u{1F3AF}'
    };
    return icons[type] || '\u{2022}';
  }

  function getEventDetail(e) {
    if (!e.data) return '';
    if (e.type === 'solver_run') return e.data.method + (e.data.converged ? ' (converged' : ' (failed') + ', ' + e.data.iterations + ' iters)';
    if (e.type === 'solver_error') return e.data.method + ': ' + (e.data.error || '');
    if (e.type === 'login') return e.user ? e.user.username : '';
    if (e.type === 'logout') return e.user ? e.user.username : '';
    if (e.type === 'step_navigate') return 'Step ' + e.data.step + ' / ' + e.data.total;
    return '';
  }

  $('refreshBtn').addEventListener('click', render);
  $('clearBtn').addEventListener('click', function () {
    if (confirm('Clear all analytics data?')) {
      window.Analytics.clear();
      render();
    }
  });

  document.addEventListener('DOMContentLoaded', render);
})();
