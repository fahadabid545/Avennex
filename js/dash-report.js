/* The project report on a product or launchpad page. Everything here comes
   from the report the team fills in on the admin panel, and every block is
   left out until it has something in it. Each block carries one plain line
   saying what it means, so nobody needs to know the jargon to read it.

   Charts are drawn as SVG at the width they are shown at, and redrawn when
   that width changes, so text stays readable on a phone. */
(function (global) {
  'use strict';

  var DAY = 86400000;
  var SVGNS = 'http://www.w3.org/2000/svg';

  var HORIZONS = [
    { id: 'now', label: 'Now', hint: 'Being worked on' },
    { id: 'next', label: 'Next', hint: 'Lined up after that' },
    { id: 'later', label: 'Later', hint: 'Planned, not scheduled' },
  ];
  var ITEM_STATE = { planned: 'Planned', progress: 'In progress', shipped: 'Shipped' };
  var SCORES = [
    ['security', 'Security'], ['performance', 'Speed'], ['reliability', 'Reliability'],
    ['usability', 'Ease of use'], ['accessibility', 'Accessibility'],
    ['docs', 'Documentation'], ['testing', 'Testing'],
  ];
  var CHECKS = [
    ['transit', 'Data is encrypted while it moves'],
    ['rest', 'Data is encrypted where it\'s stored'],
    ['access', 'Access control and two-step sign-in'],
    ['backups', 'Automatic backups'],
    ['audit', 'A log of who changed what'],
  ];
  var CHECK_STATE = { yes: 'In place', progress: 'In progress', no: 'Not yet' };
  var COMPLY_STATE = { met: 'Meets it', progress: 'Working on it', planned: 'Planned' };
  var REQUEST_STATE = { considering: 'Considering', planned: 'Planned', done: 'Done', declined: 'Not doing' };
  var LOG_KIND = { new: 'New', improved: 'Improved', fixed: 'Fixed' };
  var PRODUCT_STAGE = { 'in-development': 'In development', launched: 'Live', paused: 'Paused' };
  var LAUNCH_STAGE = { concept: 'Concept', planning: 'Planning', 'open-for-feedback': 'Open for comments', building: 'Building' };

  // checked against the dark page surface: in the lightness band, apart under colour blindness
  var SERIES = { scope: '#9A7CF0', done: '#C2841E' };
  // severity is a state, so it wears the status colours with a neutral for the mildest
  var SEVERITY = [
    { id: 'critical', label: 'Critical', color: '#F2766B' },
    { id: 'major', label: 'Major', color: '#F2A33A' },
    { id: 'minor', label: 'Minor', color: '#8C84A8' },
  ];

  var ICONS = {
    ok: '<path d="M5 12.5l4.2 4L19 7"/>',
    warn: '<path d="M12 7v6"/><path d="M12 16.6v.4"/>',
    stop: '<path d="M7 7l10 10"/><path d="M17 7L7 17"/>',
    wait: '<circle cx="12" cy="12" r="1.6"/>',
  };

  function icon(kind) {
    return '<svg class="rep-icon" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[kind] || ICONS.wait) + '</svg>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v) {
    if (v === '' || v == null) return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }

  function text(v) {
    return typeof v === 'string' ? v.trim() : '';
  }

  function toDate(v) {
    if (!v) return null;
    var s = String(v).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    var d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function fullDate(d) {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function shortDate(d) {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function fmt(n, digits) {
    if (n == null) return '';
    return n.toLocaleString(undefined, { maximumFractionDigits: digits == null ? 1 : digits });
  }

  function list(v) {
    return Array.isArray(v) ? v : [];
  }

  function csv(v) {
    return String(v || '').split(/[,\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function plural(n, one, many) {
    return n === 1 ? one : (many || one + 's');
  }

  // ── model ──

  function normalize(item, kind) {
    var src = item && typeof item === 'object' ? item : {};
    var r = src.report && typeof src.report === 'object' ? src.report : {};
    var status = kind === 'launchpad' ? src.stage : src.status;

    var roadmap = list(r.roadmap).map(function (x) {
      return {
        title: text(x.title),
        note: text(x.note),
        horizon: ['now', 'next', 'later'].indexOf(x.horizon) >= 0 ? x.horizon : 'later',
        state: ITEM_STATE[x.state] ? x.state : 'planned',
      };
    }).filter(function (x) { return x.title; });

    var burnup = list(r.burnup).map(function (p) {
      var d = toDate(p.date);
      var planned = num(p.planned);
      var done = num(p.done);
      return d && planned != null && done != null ? { t: d.getTime(), planned: planned, done: done } : null;
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });

    var pace = r.pace || {};
    var quality = r.quality || {};
    var speed = r.speed || {};
    var security = r.security || {};
    var basics = r.basics || {};
    var team = r.team || {};
    var feedback = r.feedback || {};
    var pilots = r.pilots || {};

    var scores = SCORES.map(function (s) {
      var v = num((quality.scores || {})[s[0]]);
      return v == null ? null : { id: s[0], label: s[1], value: Math.max(1, Math.min(5, v)) };
    }).filter(Boolean);

    var issues = list(quality.issues).map(function (p) {
      var d = toDate(p.date);
      if (!d) return null;
      var row = { t: d.getTime() };
      var any = false;
      SEVERITY.forEach(function (s) {
        var v = num(p[s.id]);
        row[s.id] = v == null ? 0 : Math.max(0, v);
        if (v != null) any = true;
      });
      return any ? row : null;
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });

    var uptimeDays = list(speed.uptime_days).map(function (p) {
      var d = toDate(p.date);
      var v = num(p.pct);
      return d && v != null ? { t: d.getTime(), pct: Math.max(0, Math.min(100, v)) } : null;
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t; }).slice(-30);

    return {
      kind: kind,
      live: kind === 'product' && status === 'launched',
      stage: (kind === 'launchpad' ? LAUNCH_STAGE : PRODUCT_STAGE)[status] || '',
      target: toDate(src.target_date),
      status: r.status || {},
      roadmap: roadmap,
      burnup: burnup,
      pace: {
        releases: num(pace.releases_per_month),
        lead: num(pace.idea_to_live_days),
        fixes: num(pace.fix_rate),
        recovery: num(pace.recovery_hours),
      },
      scores: scores,
      coverage: num(quality.coverage),
      passRate: num(quality.pass_rate),
      issues: issues,
      speeds: list(speed.checks).map(function (c) {
        return { label: text(c.label), value: num(c.value_ms), target: num(c.target_ms) };
      }).filter(function (c) { return c.label && c.value != null; }),
      uptime: num(speed.uptime),
      uptimeDays: uptimeDays,
      checks: CHECKS.map(function (c) {
        var v = security[c[0]];
        return CHECK_STATE[v] ? { label: c[1], state: v } : null;
      }).filter(Boolean),
      dataLocation: text(security.data_location),
      compliance: list(security.compliance).map(function (c) {
        return { name: text(c.name), state: COMPLY_STATE[c.state] ? c.state : 'planned' };
      }).filter(function (c) { return c.name; }),
      basics: {
        problem: text(basics.problem),
        audience: text(basics.audience),
        platforms: csv(basics.platforms),
        integrations: csv(basics.integrations),
        pricing: text(basics.pricing),
        stack: list(basics.stack).map(function (s) {
          return { layer: text(s.layer), plain: text(s.plain), tools: text(s.tools) };
        }).filter(function (s) { return s.layer && (s.plain || s.tools); }),
      },
      team: {
        size: num(team.size),
        roles: list(team.roles).map(function (x) {
          return { role: text(x.role), count: num(x.count) || 0 };
        }).filter(function (x) { return x.role && x.count > 0; }),
      },
      questions: list(feedback.questions).map(text).filter(Boolean),
      requests: list(feedback.requests).map(function (x) {
        return { title: text(x.title), votes: Math.max(0, num(x.votes) || 0), state: REQUEST_STATE[x.state] ? x.state : 'considering' };
      }).filter(function (x) { return x.title; }).sort(function (a, b) { return b.votes - a.votes; }),
      signups: num(feedback.beta_signups),
      signupGoal: num(feedback.beta_goal),
      changelog: list(r.changelog).map(function (x) {
        var d = toDate(x.date);
        return { date: d, version: text(x.version), title: text(x.title), kind: LOG_KIND[x.kind] ? x.kind : 'new' };
      }).filter(function (x) { return x.title; }).sort(function (a, b) {
        return (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0);
      }),
      pilots: { count: num(pilots.count), note: text(pilots.note) },
    };
  }

  // ── derived figures ──

  // a weighted blend of whatever the team has filled in, nothing guessed
  function readiness(m) {
    var parts = [];
    var planned = m.roadmap.filter(function (x) { return x.horizon !== 'later'; });
    if (!planned.length) planned = m.roadmap;
    if (planned.length) {
      var built = planned.reduce(function (sum, x) {
        return sum + (x.state === 'shipped' ? 1 : x.state === 'progress' ? 0.5 : 0);
      }, 0);
      parts.push({ label: 'Plan built', value: built / planned.length, weight: 0.35 });
    }
    if (m.scores.length) {
      var avg = m.scores.reduce(function (s, x) { return s + x.value; }, 0) / m.scores.length;
      parts.push({ label: 'Quality checks', value: avg / 5, weight: 0.25 });
    }
    if (m.checks.length) {
      var sec = m.checks.reduce(function (s, x) { return s + (x.state === 'yes' ? 1 : x.state === 'progress' ? 0.5 : 0); }, 0);
      parts.push({ label: 'Security basics', value: sec / m.checks.length, weight: 0.2 });
    }
    var tests = [m.passRate, m.coverage].filter(function (v) { return v != null; });
    if (tests.length) {
      var t = tests.reduce(function (s, v) { return s + Math.max(0, Math.min(100, v)); }, 0) / tests.length;
      parts.push({ label: 'Tests', value: t / 100, weight: 0.2 });
    }
    if (!parts.length) return null;

    var weight = parts.reduce(function (s, p) { return s + p.weight; }, 0);
    var score = parts.reduce(function (s, p) { return s + p.value * p.weight; }, 0) / weight * 100;
    var critical = m.issues.length ? m.issues[m.issues.length - 1].critical : 0;
    if (critical > 0) score *= 1 - Math.min(0.3, critical * 0.1);
    return { score: Math.round(score), parts: parts, critical: critical };
  }

  // projects the finish from the recent pace of the burn-up, unless the
  // team has set the status by hand
  function schedule(m) {
    var mode = m.status.mode || 'auto';
    if (mode !== 'auto') {
      if (!{ 'on-track': 1, 'at-risk': 1, delayed: 1 }[mode]) return null;
      return { state: mode, days: num(m.status.slip_days), auto: false };
    }
    if (!m.target || m.burnup.length < 2 || m.live) return null;
    var recent = m.burnup.slice(-4);
    var a = recent[0];
    var b = recent[recent.length - 1];
    var span = (b.t - a.t) / DAY;
    var left = b.planned - b.done;
    var projected;
    if (left <= 0) projected = b.t;
    else {
      var rate = span > 0 ? (b.done - a.done) / span : 0;
      if (rate <= 0) return { state: 'delayed', days: null, auto: true, stalled: true };
      projected = b.t + (left / rate) * DAY;
    }
    var slip = Math.round((projected - m.target.getTime()) / DAY);
    return {
      state: slip <= 0 ? 'on-track' : slip <= 14 ? 'at-risk' : 'delayed',
      days: slip,
      projected: new Date(projected),
      auto: true,
    };
  }

  function daysLeft(m) {
    if (!m.target || m.live) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var d = Math.round((m.target.getTime() - today.getTime()) / DAY);
    return d >= 0 ? d : null;
  }

  // ── markup helpers ──

  function block(title, meaning, body, opts) {
    var o = opts || {};
    return '<section class="rep-block' + (o.wide ? ' is-wide' : '') + '">' +
      '<header class="rep-block-head"><h3>' + esc(title) + '</h3>' +
      (o.aside ? '<span class="rep-block-aside">' + o.aside + '</span>' : '') + '</header>' +
      '<p class="rep-means">' + esc(meaning) + '</p>' + body + '</section>';
  }

  function chip(kind, label) {
    return '<span class="rep-chip is-' + kind + '">' + icon(kind) + '<span>' + esc(label) + '</span></span>';
  }

  function meter(value, max, cls) {
    var pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
    return '<span class="rep-meter' + (cls ? ' ' + cls : '') + '"><span style="--w:' + pct.toFixed(1) + '%"></span></span>';
  }

  function tableView(caption, head, rows) {
    return '<details class="rep-table"><summary>Show the numbers</summary><table><caption class="visually-hidden">' + esc(caption) + '</caption>' +
      '<thead><tr>' + head.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></details>';
  }

  function legend(items) {
    return '<ul class="rep-legend">' + items.map(function (i) {
      return '<li><span class="rep-key' + (i.line ? ' is-line' : '') + (i.dotted ? ' is-dotted' : '') + '" style="--c:' + i.color + '"></span>' + esc(i.label) + '</li>';
    }).join('') + '</ul>';
  }

  // ── top strip ──

  function stripHtml(m) {
    var tiles = '';
    var ready = readiness(m);
    var sched = schedule(m);
    var left = daysLeft(m);

    if (m.stage) {
      tiles += '<div class="rep-tile"><span class="rep-tile-label">Stage</span>' +
        '<span class="rep-tile-value">' + esc(m.stage) + '</span>' +
        '<span class="rep-tile-means">Where this is right now.</span></div>';
    }

    if (ready) {
      var breakdown = ready.parts.map(function (p) {
        return '<li><span>' + esc(p.label) + '</span>' + meter(p.value, 1) + '<b>' + Math.round(p.value * 100) + '%</b></li>';
      }).join('');
      tiles += '<div class="rep-tile is-score"><span class="rep-tile-label">' + (m.live ? 'Health score' : 'Launch readiness') + '</span>' +
        '<span class="rep-tile-value"><b data-rep-count="' + ready.score + '">' + ready.score + '</b><i>/ 100</i></span>' +
        meter(ready.score, 100, 'is-big') +
        '<span class="rep-tile-means">' + (m.live
          ? 'How healthy it is today, worked out from the checks below.'
          : 'How close it is to being ready for real users, worked out from the checks below.') + '</span>' +
        '<details class="rep-why"><summary>How it\'s worked out</summary><ul>' + breakdown + '</ul>' +
        (ready.critical ? '<p>Lowered because ' + ready.critical + ' critical ' + plural(ready.critical, 'issue is', 'issues are') + ' still open.</p>' : '') +
        '</details></div>';
    }

    if (sched) {
      var label = sched.state === 'on-track' ? 'On track' : sched.state === 'at-risk' ? 'At risk' : 'Delayed';
      var kind = sched.state === 'on-track' ? 'ok' : sched.state === 'at-risk' ? 'warn' : 'stop';
      var detail;
      if (sched.stalled) detail = 'No work finished in the latest updates.';
      else if (sched.days == null) detail = '';
      else if (sched.days < -2) detail = 'About ' + -sched.days + ' ' + plural(-sched.days, 'day') + ' early.';
      else if (sched.days <= 0) detail = 'Right on the launch date.';
      else detail = 'About ' + sched.days + ' ' + plural(sched.days, 'day') + ' late.';
      tiles += '<div class="rep-tile"><span class="rep-tile-label">Schedule</span>' +
        '<span class="rep-tile-value">' + chip(kind, label) + '</span>' +
        (detail ? '<span class="rep-tile-sub">' + esc(detail) + '</span>' : '') +
        '<span class="rep-tile-means">' + (sched.auto
          ? 'Based on how fast work has been getting done lately.'
          : 'Set by the team.') + '</span></div>';
    }

    if (left != null) {
      tiles += '<div class="rep-tile"><span class="rep-tile-label">Launch</span>' +
        '<span class="rep-tile-value"><b>' + left + '</b><i>' + plural(left, 'day') + ' to go</i></span>' +
        '<span class="rep-tile-means">Planned for ' + esc(fullDate(m.target)) + '.</span></div>';
    }

    return tiles ? '<div class="rep-strip">' + tiles + '</div>' : '';
  }

  // ── plan ──

  function roadmapHtml(m) {
    if (!m.roadmap.length) return '';
    var shipped = m.roadmap.filter(function (x) { return x.state === 'shipped'; }).length;
    var cols = HORIZONS.map(function (h) {
      var items = m.roadmap.filter(function (x) { return x.horizon === h.id; });
      return '<div class="rep-lane"><header><b>' + h.label + '</b><span>' + h.hint + '</span></header>' +
        (items.length ? '<ul>' + items.map(function (x) {
          var kind = x.state === 'shipped' ? 'ok' : x.state === 'progress' ? 'warn' : 'wait';
          return '<li class="rep-item is-' + x.state + '"><span class="rep-item-title">' + esc(x.title) + '</span>' +
            (x.note ? '<span class="rep-item-note">' + esc(x.note) + '</span>' : '') +
            chip(kind, ITEM_STATE[x.state]) + '</li>';
        }).join('') + '</ul>' : '<p class="rep-lane-empty">Nothing here yet.</p>') + '</div>';
    }).join('');
    return block('Roadmap', 'What\'s being built now, what comes next, and what\'s further out.',
      '<div class="rep-lanes">' + cols + '</div>',
      { wide: true, aside: shipped + ' of ' + m.roadmap.length + ' shipped' });
  }

  function burnupHtml(m) {
    if (m.burnup.length < 2) return '';
    var last = m.burnup[m.burnup.length - 1];
    return block('Work planned vs work done',
      'The top line is everything planned. The lower line is what\'s finished. Once they meet, the work is done.',
      legend([
        { label: 'Planned', color: SERIES.scope, line: true },
        { label: 'Done', color: SERIES.done, line: true },
        { label: 'Where the current pace leads', color: SERIES.done, line: true, dotted: true },
      ]) +
      '<div class="rep-chart" data-rep-chart="burnup" role="img" aria-label="' +
      esc('Planned ' + fmt(last.planned) + ', done ' + fmt(last.done) + ' as of ' + fullDate(new Date(last.t))) + '"></div>' +
      tableView('Work planned and done by date', ['Date', 'Planned', 'Done'], m.burnup.map(function (p) {
        return [fullDate(new Date(p.t)), fmt(p.planned), fmt(p.done)];
      })),
      { wide: true, aside: fmt(last.done) + ' of ' + fmt(last.planned) + ' done' });
  }

  // ── quality ──

  function paceHtml(m) {
    var p = m.pace;
    var tiles = [
      [p.releases, 'Updates shipped', 'per month', 'How often new work reaches users.'],
      [p.lead, 'Idea to live', p.lead === 1 ? 'day' : 'days', 'How long a change takes from agreed to released.'],
      [p.fixes, 'Updates that needed a fix', '%', 'Lower is better. Most releases should just work.'],
      [p.recovery, 'Time to recover', p.recovery === 1 ? 'hour' : 'hours', 'How long it takes to fix things when something breaks.'],
    ].filter(function (t) { return t[0] != null; });
    if (!tiles.length) return '';
    return block('Delivery pace', 'How steadily changes get to users, and how quickly problems get fixed.',
      '<div class="rep-stats">' + tiles.map(function (t) {
        return '<div class="rep-stat"><span class="rep-stat-label">' + esc(t[1]) + '</span>' +
          '<span class="rep-stat-value">' + fmt(t[0]) + '<i>' + esc(t[2]) + '</i></span>' +
          '<span class="rep-stat-means">' + esc(t[3]) + '</span></div>';
      }).join('') + '</div>', { wide: true });
  }

  function scoresHtml(m) {
    if (!m.scores.length) return '';
    var body;
    if (m.scores.length >= 3) {
      body = '<div class="rep-chart is-radar" data-rep-chart="radar" role="img" aria-label="' +
        esc(m.scores.map(function (s) { return s.label + ' ' + s.value + ' of 5'; }).join(', ')) + '"></div>';
    } else {
      body = '<ul class="rep-bars">' + m.scores.map(function (s) {
        return '<li><span>' + esc(s.label) + '</span>' + meter(s.value, 5) + '<b>' + fmt(s.value) + ' / 5</b></li>';
      }).join('') + '</ul>';
    }
    return block('Quality checks', 'Scored by the team from 1 to 5, where 5 means ready for everyday use.',
      body + tableView('Quality scores', ['Area', 'Score out of 5'], m.scores.map(function (s) { return [s.label, fmt(s.value)]; })));
  }

  function testsHtml(m) {
    var rows = [];
    if (m.passRate != null) rows.push(['Tests passing', m.passRate, 'Of the automatic checks that run on every change.']);
    if (m.coverage != null) rows.push(['Code covered by tests', m.coverage, 'How much of the code those checks actually exercise.']);
    if (!rows.length) return '';
    return block('Testing', 'Automatic checks that catch mistakes before users do.',
      '<ul class="rep-bars is-tall">' + rows.map(function (r) {
        return '<li><span>' + esc(r[0]) + '<em>' + esc(r[2]) + '</em></span>' + meter(r[1], 100) + '<b>' + fmt(r[1]) + '%</b></li>';
      }).join('') + '</ul>');
  }

  function issuesHtml(m) {
    if (!m.issues.length) return '';
    var last = m.issues[m.issues.length - 1];
    var open = last.critical + last.major + last.minor;
    return block('Open issues', 'Known problems still waiting on a fix, by how serious they are. Falling bars are good.',
      legend(SEVERITY.map(function (s) { return { label: s.label, color: s.color }; })) +
      '<div class="rep-chart" data-rep-chart="issues" role="img" aria-label="' +
      esc(open + ' open issues as of ' + fullDate(new Date(last.t))) + '"></div>' +
      tableView('Open issues by date', ['Date', 'Critical', 'Major', 'Minor'], m.issues.map(function (p) {
        return [fullDate(new Date(p.t)), fmt(p.critical), fmt(p.major), fmt(p.minor)];
      })),
      { wide: true, aside: open + ' open now' });
  }

  function speedHtml(m) {
    var html = '';
    if (m.speeds.length) {
      html += '<ul class="rep-speeds">' + m.speeds.map(function (s) {
        var max = Math.max(s.value, s.target || 0) * 1.25 || 1;
        var under = s.target == null || s.value <= s.target;
        return '<li><span class="rep-speed-label">' + esc(s.label) + '</span>' +
          '<span class="rep-bullet' + (under ? ' is-ok' : ' is-warn') + '">' +
          '<span class="rep-bullet-bar" style="--w:' + (s.value / max * 100).toFixed(1) + '%"></span>' +
          (s.target != null ? '<span class="rep-bullet-target" style="--x:' + (s.target / max * 100).toFixed(1) + '%" title="Target"></span>' : '') +
          '</span><span class="rep-speed-value"><b>' + fmt(s.value, 0) + ' ms</b>' +
          (s.target != null ? chip(under ? 'ok' : 'warn', under ? 'Under target' : 'Over target') + '<em>target ' + fmt(s.target, 0) + ' ms</em>' : '') +
          '</span></li>';
      }).join('') + '</ul>';
    }
    if (m.uptime != null || m.uptimeDays.length) {
      html += '<div class="rep-uptime">' +
        (m.uptime != null ? '<span class="rep-uptime-value"><b>' + fmt(m.uptime, 2) + '%</b><i>up in the last 30 days</i></span>' : '') +
        (m.uptimeDays.length ? '<div class="rep-cells" data-rep-cells>' + m.uptimeDays.map(function (d, i) {
          var kind = d.pct >= 99.9 ? 'ok' : d.pct >= 99 ? 'warn' : 'stop';
          return '<button type="button" class="rep-cell is-' + kind + '" data-rep-cell="' + i + '" aria-label="' +
            esc(fullDate(new Date(d.t)) + ': ' + fmt(d.pct, 2) + '% up') + '"></button>';
        }).join('') + '</div>' +
          legend([
            { label: 'Fully up', color: 'var(--rep-ok)' },
            { label: 'Brief outage', color: 'var(--rep-warn)' },
            { label: 'Longer outage', color: 'var(--rep-stop)' },
          ]) : '') + '</div>';
    }
    if (!html) return '';
    return block('Speed and uptime', 'How quickly things respond, measured in milliseconds, and how often it was up.',
      '<div class="rep-split">' + html + '</div>', { wide: true });
  }

  // ── trust ──

  function securityHtml(m) {
    var html = '';
    if (m.checks.length) {
      html += '<ul class="rep-checks">' + m.checks.map(function (c) {
        var kind = c.state === 'yes' ? 'ok' : c.state === 'progress' ? 'warn' : 'stop';
        return '<li><span>' + esc(c.label) + '</span>' + chip(kind, CHECK_STATE[c.state]) + '</li>';
      }).join('') + '</ul>';
    }
    if (m.dataLocation) {
      html += '<p class="rep-kv"><span>Where the data lives</span><b>' + esc(m.dataLocation) + '</b></p>';
    }
    var sec = html ? block('Security and privacy', 'The basics that keep your data safe, and where each one stands.', html) : '';
    var comply = '';
    if (m.compliance.length) {
      comply = block('Standards', 'Outside rules for handling personal and sensitive data, and how far along each one is.',
        '<ul class="rep-badges">' + m.compliance.map(function (c) {
          var kind = c.state === 'met' ? 'ok' : c.state === 'progress' ? 'warn' : 'wait';
          return '<li class="rep-badge is-' + kind + '"><b>' + esc(c.name) + '</b>' + chip(kind, COMPLY_STATE[c.state]) + '</li>';
        }).join('') + '</ul>');
    }
    return sec + comply;
  }

  // ── basics ──

  function basicsHtml(m) {
    var b = m.basics;
    var rows = '';
    if (b.problem) rows += '<div class="rep-fact is-wide"><dt>The problem</dt><dd>' + esc(b.problem) + '</dd></div>';
    if (b.audience) rows += '<div class="rep-fact is-wide"><dt>Who it\'s for</dt><dd>' + esc(b.audience) + '</dd></div>';
    if (b.platforms.length) rows += '<div class="rep-fact"><dt>Works on</dt><dd>' + tags(b.platforms) + '</dd></div>';
    if (b.integrations.length) rows += '<div class="rep-fact"><dt>Connects with</dt><dd>' + tags(b.integrations) + '</dd></div>';
    if (b.pricing) rows += '<div class="rep-fact"><dt>How it\'s priced</dt><dd>' + esc(b.pricing) + '</dd></div>';
    var html = rows ? block('The basics', 'What it solves, who it\'s for, and what it works with.', '<dl class="rep-facts">' + rows + '</dl>', { wide: true }) : '';
    if (b.stack.length) {
      html += block('How it\'s built', 'Each layer of the system, what it does in plain words, and the tools behind it.',
        '<ol class="rep-stack">' + b.stack.map(function (s) {
          return '<li><b>' + esc(s.layer) + '</b><span>' + esc(s.plain) + '</span>' + (s.tools ? tags(csv(s.tools)) : '') + '</li>';
        }).join('') + '</ol>', { wide: true });
    }
    return html;
  }

  function tags(items) {
    return '<span class="rep-tags">' + items.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</span>';
  }

  function teamHtml(m) {
    var t = m.team;
    if (t.size == null && !t.roles.length) return '';
    var total = t.roles.reduce(function (s, r) { return s + r.count; }, 0);
    var max = t.roles.reduce(function (s, r) { return Math.max(s, r.count); }, 0);
    var size = t.size != null ? t.size : total;
    return block('Team', 'Who\'s working on it, by the kind of work they do.',
      '<p class="rep-team-size"><b>' + fmt(size, 0) + '</b><i>' + plural(size, 'person', 'people') + '</i></p>' +
      (t.roles.length ? '<ul class="rep-bars">' + t.roles.map(function (r) {
        return '<li><span>' + esc(r.role) + '</span>' + meter(r.count, max, 'is-royal') + '<b>' + fmt(r.count, 0) + '</b></li>';
      }).join('') + '</ul>' : ''), { wide: true });
  }

  // ── feedback and updates ──

  function feedbackHtml(m) {
    var html = '';
    if (m.signups != null) {
      html += block('Early access', 'People who asked to try it before launch.',
        '<p class="rep-team-size"><b>' + fmt(m.signups, 0) + '</b><i>' + (m.signupGoal ? 'of ' + fmt(m.signupGoal, 0) + ' wanted' : plural(m.signups, 'sign-up')) + '</i></p>' +
        (m.signupGoal ? meter(m.signups, m.signupGoal, 'is-big') : ''));
    }
    if (m.questions.length) {
      html += block('Questions for you', 'Things the team isn\'t sure about. Answer in the comments below.',
        '<ol class="rep-questions">' + m.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol>');
    }
    if (m.requests.length) {
      var top = m.requests[0].votes || 1;
      html += block('Most asked for', 'Improvements people have suggested, most requested first, and what\'s happening with each.',
        '<ul class="rep-requests">' + m.requests.map(function (r) {
          var kind = r.state === 'done' ? 'ok' : r.state === 'planned' ? 'warn' : r.state === 'declined' ? 'stop' : 'wait';
          return '<li><span class="rep-request-title">' + esc(r.title) + '</span>' +
            meter(r.votes, top, 'is-royal') + '<b>' + fmt(r.votes, 0) + ' ' + plural(r.votes, 'vote') + '</b>' +
            chip(kind, REQUEST_STATE[r.state]) + '</li>';
        }).join('') + '</ul>', { wide: true });
    }
    return html;
  }

  function updatesHtml(m) {
    var html = '';
    if (m.pilots.count != null || m.pilots.note) {
      html += block('Pilot users', 'Teams using it for real before the wider release.',
        (m.pilots.count != null ? '<p class="rep-team-size"><b>' + fmt(m.pilots.count, 0) + '</b><i>' + plural(m.pilots.count, 'pilot') + ' running</i></p>' : '') +
        (m.pilots.note ? '<p class="rep-note">' + esc(m.pilots.note) + '</p>' : ''));
    }
    if (m.changelog.length) {
      html += block('What changed', 'Recent updates, newest first.',
        '<ol class="rep-log">' + m.changelog.slice(0, 12).map(function (x) {
          var kind = x.kind === 'fixed' ? 'warn' : 'ok';
          return '<li><span class="rep-log-when">' + (x.date ? esc(fullDate(x.date)) : '') + (x.version ? '<i>' + esc(x.version) + '</i>' : '') + '</span>' +
            '<span class="rep-log-what">' + chip(kind, LOG_KIND[x.kind]) + esc(x.title) + '</span></li>';
        }).join('') + '</ol>', { wide: true });
    }
    return html;
  }

  // ── assembly ──

  function tabsOf(m) {
    var tabs = [
      { id: 'plan', label: 'Plan', html: roadmapHtml(m) + burnupHtml(m) },
      { id: 'quality', label: 'Quality', html: paceHtml(m) + scoresHtml(m) + testsHtml(m) + issuesHtml(m) + speedHtml(m) },
      { id: 'trust', label: 'Security', html: securityHtml(m) },
      { id: 'basics', label: 'Basics', html: basicsHtml(m) + teamHtml(m) },
    ];
    if (m.kind === 'launchpad') tabs.push({ id: 'feedback', label: 'Your input', html: feedbackHtml(m) });
    else tabs.push({ id: 'updates', label: 'Updates', html: updatesHtml(m) });
    return tabs.filter(function (t) { return t.html; });
  }

  function html(item, kind) {
    var m = normalize(item, kind || 'product');
    var strip = stripHtml(m);
    var tabs = tabsOf(m);
    if (!strip && !tabs.length) return '';

    var out = '<section class="rep" data-rep aria-label="Project report">';
    out += '<header class="rep-head"><span class="rep-eyebrow">Project report</span>' +
      '<p class="rep-intro">Filled in by the team building it. Tap any chart for the exact numbers.</p></header>';
    out += strip;
    if (tabs.length) {
      if (tabs.length > 1) {
        out += '<div class="rep-tabs" role="tablist" aria-label="Report sections">' + tabs.map(function (t, i) {
          return '<button type="button" role="tab" class="rep-tab" id="rep-tab-' + t.id + '" aria-controls="rep-panel-' + t.id + '" ' +
            'aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? '0' : '-1') + '" data-rep-tab="' + t.id + '">' + t.label + '</button>';
        }).join('') + '</div>';
      }
      out += tabs.map(function (t, i) {
        return '<div class="rep-panel" role="' + (tabs.length > 1 ? 'tabpanel' : 'group') + '" id="rep-panel-' + t.id + '"' +
          (tabs.length > 1 ? ' aria-labelledby="rep-tab-' + t.id + '"' : '') + (i === 0 ? '' : ' hidden') + '>' +
          '<div class="rep-grid">' + t.html + '</div></div>';
      }).join('');
    }
    return out + '</section>';
  }

  function hasContent(item, kind) {
    return html(item, kind) !== '';
  }

  // ── charts ──

  function el(name, attrs, parent) {
    var node = document.createElementNS(SVGNS, name);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  // a top value that splits into clean steps, so ticks read 0, 10, 20 rather than 0, 17, 33
  function niceMax(v, ticks) {
    var raw = Math.max(v, 1) / ticks;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] * mag >= raw) return Math.max(1, Math.ceil(steps[i] * mag)) * ticks;
    }
    return 10 * mag * ticks;
  }

  function yAxis(svg, box, max, ticks) {
    var g = el('g', { class: 'rep-axis' }, svg);
    for (var i = 0; i <= ticks; i++) {
      var v = max / ticks * i;
      var y = box.y + box.h - (v / max) * box.h;
      el('line', { x1: box.x, x2: box.x + box.w, y1: y, y2: y, class: i === 0 ? 'rep-base' : 'rep-gridline' }, g);
      var t = el('text', { x: box.x - 8, y: y + 4, 'text-anchor': 'end' }, g);
      t.textContent = fmt(v, 0);
    }
  }

  function xLabels(svg, box, from, to) {
    var g = el('g', { class: 'rep-axis' }, svg);
    var count = Math.max(2, Math.min(6, Math.floor(box.w / 90)));
    for (var i = 0; i < count; i++) {
      var t = from + (to - from) * (i / (count - 1));
      var x = box.x + box.w * (i / (count - 1));
      var label = el('text', { x: x, y: box.y + box.h + 20, 'text-anchor': i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle' }, g);
      label.textContent = shortDate(new Date(t));
    }
  }

  function drawBurnup(host, m, tip) {
    var w = host.clientWidth;
    if (!w) return;
    var h = Math.max(200, Math.min(300, w * 0.42));
    var box = { x: 44, y: 14, w: w - 44 - 16, h: h - 14 - 30 };
    var pts = m.burnup;
    var sched = schedule(m);
    var from = pts[0].t;
    var to = pts[pts.length - 1].t;
    var projection = sched && sched.projected && sched.projected.getTime() > to ? sched.projected.getTime() : null;
    if (projection) to = Math.min(projection, to + (to - from) * 1.5);
    if (m.target && m.target.getTime() > to && m.target.getTime() - to < (to - from) * 1.5) to = m.target.getTime();
    var max = niceMax(Math.max.apply(null, pts.map(function (p) { return Math.max(p.planned, p.done); })) * 1.05, 4);

    function X(t) { return box.x + (to === from ? 0 : (t - from) / (to - from)) * box.w; }
    function Y(v) { return box.y + box.h - (v / max) * box.h; }

    host.innerHTML = '';
    var svg = el('svg', { width: w, height: h, viewBox: '0 0 ' + w + ' ' + h }, host);
    yAxis(svg, box, max, 4);
    xLabels(svg, box, from, to);

    if (m.target && m.target.getTime() >= from && m.target.getTime() <= to) {
      var tx = X(m.target.getTime());
      el('line', { x1: tx, x2: tx, y1: box.y, y2: box.y + box.h, class: 'rep-target' }, svg);
      var tl = el('text', { x: tx - 6, y: box.y + 12, 'text-anchor': 'end', class: 'rep-target-label' }, svg);
      tl.textContent = 'Launch date';
    }

    var area = 'M' + X(pts[0].t) + ',' + Y(0);
    pts.forEach(function (p) { area += 'L' + X(p.t) + ',' + Y(p.done); });
    area += 'L' + X(pts[pts.length - 1].t) + ',' + Y(0) + 'Z';
    el('path', { d: area, fill: SERIES.done, 'fill-opacity': 0.1 }, svg);

    function line(key, color) {
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t) + ',' + Y(p[key]); }).join('');
      el('path', { d: d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'rep-line' }, svg);
    }
    line('planned', SERIES.scope);
    line('done', SERIES.done);

    var lastP = pts[pts.length - 1];
    if (projection) {
      var endT = Math.min(projection, to);
      var endV = lastP.done + (lastP.planned - lastP.done) * ((endT - lastP.t) / (projection - lastP.t));
      el('path', { d: 'M' + X(lastP.t) + ',' + Y(lastP.done) + 'L' + X(endT) + ',' + Y(endV), fill: 'none', stroke: SERIES.done, 'stroke-width': 2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }, svg);
      el('line', { x1: X(lastP.t), x2: X(to), y1: Y(lastP.planned), y2: Y(lastP.planned), stroke: SERIES.scope, 'stroke-width': 2, 'stroke-dasharray': '2 5', 'stroke-linecap': 'round' }, svg);
    }

    [['planned', SERIES.scope], ['done', SERIES.done]].forEach(function (s) {
      el('circle', { cx: X(lastP.t), cy: Y(lastP[s[0]]), r: 4, fill: s[1], class: 'rep-dot' }, svg);
    });

    var cross = el('line', { y1: box.y, y2: box.y + box.h, class: 'rep-cross', visibility: 'hidden' }, svg);
    var hot = [
      el('circle', { r: 5, fill: SERIES.scope, class: 'rep-dot', visibility: 'hidden' }, svg),
      el('circle', { r: 5, fill: SERIES.done, class: 'rep-dot', visibility: 'hidden' }, svg),
    ];
    var hit = el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, fill: 'transparent', tabindex: 0, class: 'rep-hit', 'aria-label': 'Step through the dates with the arrow keys' }, svg);
    var at = pts.length - 1;

    function show(i) {
      at = Math.max(0, Math.min(pts.length - 1, i));
      var p = pts[at];
      var x = X(p.t);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      hot[0].setAttribute('cx', x); hot[0].setAttribute('cy', Y(p.planned)); hot[0].setAttribute('visibility', 'visible');
      hot[1].setAttribute('cx', x); hot[1].setAttribute('cy', Y(p.done)); hot[1].setAttribute('visibility', 'visible');
      tip.show(host, x, Math.min(Y(p.planned), Y(p.done)), fullDate(new Date(p.t)), [
        { color: SERIES.scope, label: 'Planned', value: fmt(p.planned) },
        { color: SERIES.done, label: 'Done', value: fmt(p.done) },
      ]);
    }
    function hide() {
      cross.setAttribute('visibility', 'hidden');
      hot.forEach(function (c) { c.setAttribute('visibility', 'hidden'); });
      tip.hide();
    }
    function nearest(evt) {
      var rect = svg.getBoundingClientRect();
      var px = evt.clientX - rect.left;
      var best = 0;
      pts.forEach(function (p, i) { if (Math.abs(X(p.t) - px) < Math.abs(X(pts[best].t) - px)) best = i; });
      return best;
    }
    hit.addEventListener('pointermove', function (e) { show(nearest(e)); });
    hit.addEventListener('pointerdown', function (e) { show(nearest(e)); });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', function () { show(at); });
    hit.addEventListener('blur', hide);
    hit.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        show(at + (e.key === 'ArrowRight' ? 1 : -1));
      }
    });
  }

  function drawIssues(host, m, tip) {
    var w = host.clientWidth;
    if (!w) return;
    var h = Math.max(190, Math.min(260, w * 0.36));
    var box = { x: 36, y: 22, w: w - 36 - 8, h: h - 22 - 30 };
    var rows = m.issues.slice(-16);
    var totals = rows.map(function (r) { return r.critical + r.major + r.minor; });
    var max = niceMax(Math.max.apply(null, totals.concat([1])) * 1.05, 3);
    function Y(v) { return box.y + box.h - (v / max) * box.h; }

    host.innerHTML = '';
    var svg = el('svg', { width: w, height: h, viewBox: '0 0 ' + w + ' ' + h }, host);
    yAxis(svg, box, max, 3);

    var slot = box.w / rows.length;
    var bw = Math.min(24, slot * 0.6);
    var every = Math.ceil(rows.length / Math.max(1, Math.floor(box.w / 70)));
    var axis = el('g', { class: 'rep-axis' }, svg);

    rows.forEach(function (r, i) {
      var cx = box.x + slot * i + slot / 2;
      var g = el('g', { class: 'rep-col', tabindex: 0, role: 'img', 'aria-label': fullDate(new Date(r.t)) + ': ' +
        SEVERITY.map(function (s) { return r[s.id] + ' ' + s.label.toLowerCase(); }).join(', ') }, svg);
      el('rect', { x: cx - slot / 2, y: box.y, width: slot, height: box.h, fill: 'transparent' }, g);
      var base = 0;
      var segs = SEVERITY.slice().reverse().filter(function (s) { return r[s.id] > 0; });
      segs.forEach(function (s, k) {
        var y0 = Y(base);
        var y1 = Y(base + r[s.id]);
        base += r[s.id];
        var top = k === segs.length - 1;
        var hgt = Math.max(0, y0 - y1 - (k > 0 ? 2 : 0));
        var yy = y1;
        if (top && hgt > 4) {
          var rr = 4;
          var d = 'M' + (cx - bw / 2) + ',' + (yy + hgt) + 'V' + (yy + rr) + 'Q' + (cx - bw / 2) + ',' + yy + ' ' + (cx - bw / 2 + rr) + ',' + yy +
            'H' + (cx + bw / 2 - rr) + 'Q' + (cx + bw / 2) + ',' + yy + ' ' + (cx + bw / 2) + ',' + (yy + rr) + 'V' + (yy + hgt) + 'Z';
          el('path', { d: d, fill: s.color }, g);
        } else {
          el('rect', { x: cx - bw / 2, y: yy, width: bw, height: hgt, fill: s.color }, g);
        }
      });
      if (i === rows.length - 1 || totals[i] === Math.max.apply(null, totals)) {
        var lab = el('text', { x: cx, y: Y(totals[i]) - 6, 'text-anchor': 'middle', class: 'rep-cap' }, svg);
        lab.textContent = totals[i];
      }
      if (i % every === 0 || i === rows.length - 1) {
        var xl = el('text', { x: cx, y: box.y + box.h + 20, 'text-anchor': 'middle' }, axis);
        xl.textContent = shortDate(new Date(r.t));
      }
      function show() {
        g.classList.add('is-hot');
        tip.show(host, cx, Y(totals[i]), fullDate(new Date(r.t)), SEVERITY.map(function (s) {
          return { color: s.color, label: s.label, value: fmt(r[s.id], 0), box: true };
        }));
      }
      function hide() { g.classList.remove('is-hot'); tip.hide(); }
      g.addEventListener('pointerenter', show);
      g.addEventListener('pointerdown', show);
      g.addEventListener('pointerleave', hide);
      g.addEventListener('focus', show);
      g.addEventListener('blur', hide);
    });
  }

  function drawRadar(host, m, tip) {
    var w = host.clientWidth;
    if (!w) return;
    var size = Math.min(w, 380);
    var h = size * 0.86;
    var cx = w / 2;
    var cy = h / 2 + 4;
    var r = size * 0.28;
    var n = m.scores.length;
    function pt(i, v) {
      var a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * r * v / 5, cy + Math.sin(a) * r * v / 5];
    }

    host.innerHTML = '';
    var svg = el('svg', { width: w, height: h, viewBox: '0 0 ' + w + ' ' + h }, host);
    var grid = el('g', { class: 'rep-axis' }, svg);
    for (var ring = 1; ring <= 5; ring++) {
      el('polygon', { points: m.scores.map(function (s, i) { return pt(i, ring).join(','); }).join(' '), class: ring === 5 ? 'rep-base' : 'rep-gridline', fill: 'none' }, grid);
    }
    m.scores.forEach(function (s, i) {
      var end = pt(i, 5);
      el('line', { x1: cx, y1: cy, x2: end[0], y2: end[1], class: 'rep-gridline' }, grid);
      var lp = pt(i, 6.2);
      var anchor = Math.abs(lp[0] - cx) < 4 ? 'middle' : lp[0] > cx ? 'start' : 'end';
      var t = el('text', { x: lp[0], y: lp[1] + 4, 'text-anchor': anchor, class: 'rep-radar-label' }, svg);
      t.textContent = s.label;
    });
    el('polygon', {
      points: m.scores.map(function (s, i) { return pt(i, s.value).join(','); }).join(' '),
      fill: SERIES.done, 'fill-opacity': 0.12, stroke: SERIES.done, 'stroke-width': 2, 'stroke-linejoin': 'round', class: 'rep-radar-shape',
    }, svg);
    m.scores.forEach(function (s, i) {
      var p = pt(i, s.value);
      var g = el('g', { tabindex: 0, role: 'img', 'aria-label': s.label + ': ' + s.value + ' of 5', class: 'rep-radar-point' }, svg);
      el('circle', { cx: p[0], cy: p[1], r: 13, fill: 'transparent' }, g);
      el('circle', { cx: p[0], cy: p[1], r: 4, fill: SERIES.done, class: 'rep-dot' }, g);
      function show() { tip.show(host, p[0], p[1], s.label, [{ color: SERIES.done, label: 'Score', value: fmt(s.value) + ' / 5' }]); }
      g.addEventListener('pointerenter', show);
      g.addEventListener('pointerdown', show);
      g.addEventListener('focus', show);
      g.addEventListener('pointerleave', tip.hide);
      g.addEventListener('blur', tip.hide);
    });
  }

  function tooltip(root) {
    var box = document.createElement('div');
    box.className = 'rep-tip';
    box.setAttribute('role', 'status');
    box.hidden = true;
    root.appendChild(box);
    return {
      show: function (host, x, y, title, rows) {
        box.textContent = '';
        rows.forEach(function (r) {
          var row = document.createElement('div');
          row.className = 'rep-tip-row';
          var key = document.createElement('span');
          key.className = 'rep-key ' + (r.box ? '' : 'is-line');
          key.style.setProperty('--c', r.color);
          var val = document.createElement('b');
          val.textContent = r.value;
          var lab = document.createElement('span');
          lab.textContent = r.label;
          row.appendChild(key); row.appendChild(val); row.appendChild(lab);
          box.appendChild(row);
        });
        var head = document.createElement('div');
        head.className = 'rep-tip-head';
        head.textContent = title;
        box.insertBefore(head, box.firstChild);
        box.hidden = false;
        var rootRect = root.getBoundingClientRect();
        var hostRect = host.getBoundingClientRect();
        var left = hostRect.left - rootRect.left + x;
        var top = hostRect.top - rootRect.top + y;
        var bw = box.offsetWidth;
        left = Math.max(8, Math.min(rootRect.width - bw - 8, left - bw / 2));
        box.style.left = left + 'px';
        box.style.top = Math.max(0, top - box.offsetHeight - 14) + 'px';
      },
      hide: function () { box.hidden = true; },
    };
  }

  function init(root, item, kind) {
    var section = root && root.querySelector('[data-rep]');
    if (!section) return { destroy: function () {} };
    var m = normalize(item, kind || 'product');
    var tip = tooltip(section);
    var drawers = { burnup: drawBurnup, issues: drawIssues, radar: drawRadar };

    function drawVisible() {
      section.querySelectorAll('[data-rep-chart]').forEach(function (host) {
        if (host.offsetParent === null) return;
        var fn = drawers[host.dataset.repChart];
        if (fn) fn(host, m, tip);
      });
    }

    var tabs = section.querySelectorAll('[data-rep-tab]');
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = section.querySelector('#rep-panel-' + t.dataset.repTab);
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      tip.hide();
      drawVisible();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });

    section.querySelectorAll('[data-rep-cells]').forEach(function (strip) {
      strip.addEventListener('pointerover', function (e) {
        var cell = e.target.closest('[data-rep-cell]');
        if (!cell) return;
        var d = m.uptimeDays[Number(cell.dataset.repCell)];
        var r = cell.getBoundingClientRect();
        var sr = strip.getBoundingClientRect();
        tip.show(strip, r.left - sr.left + r.width / 2, 0, fullDate(new Date(d.t)), [
          { color: getComputedStyle(cell).backgroundColor, label: 'up', value: fmt(d.pct, 2) + '%', box: true },
        ]);
      });
      strip.addEventListener('focusin', function (e) {
        e.target.dispatchEvent(new Event('pointerover', { bubbles: true }));
      });
      strip.addEventListener('pointerleave', tip.hide);
      strip.addEventListener('focusout', tip.hide);
    });

    var timer = null;
    var lastWidth = section.clientWidth;
    function onResize() {
      if (section.clientWidth === lastWidth) return;
      lastWidth = section.clientWidth;
      clearTimeout(timer);
      timer = setTimeout(drawVisible, 120);
    }
    var observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (observer) observer.observe(section);
    else global.addEventListener('resize', onResize);

    drawVisible();

    return {
      destroy: function () {
        clearTimeout(timer);
        if (observer) observer.disconnect();
        else global.removeEventListener('resize', onResize);
      },
    };
  }

  global.DashReport = {
    html: html,
    init: init,
    hasContent: hasContent,
    readiness: function (item, kind) { return readiness(normalize(item, kind || 'product')); },
    schedule: function (item, kind) { return schedule(normalize(item, kind || 'product')); },
  };
})(window);
