(function () {
  var page = location.pathname.replace(/^\//, '') || 'index.html';

  var org = {
    '@type': 'Organization',
    name: 'Avennex',
    url: 'https://avennex.com',
    logo: 'https://avennex.com/img/og-image.png',
    description: 'AI-powered product studio from Lahore building its own software.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lahore',
      addressCountry: 'PK'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@avennex.com',
      contactType: 'customer support'
    }
  };

  function inject(data) {
    var el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(Object.assign({ '@context': 'https://schema.org' }, data));
    document.head.appendChild(el);
  }

  if (page === 'index.html') {
    inject(org);
    inject({
      '@type': 'WebSite',
      name: 'Avennex',
      url: 'https://avennex.com',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://avennex.com/blog.html?q={search_term_string}',
        'query-input': 'required name=search_term_string'
      }
    });

    var faqEl = document.getElementById('faq-list');
    if (faqEl) {
      var observer = new MutationObserver(function () {
        var items = faqEl.querySelectorAll('.faq-item');
        if (!items.length) return;
        observer.disconnect();
        var entries = [];
        items.forEach(function (item) {
          var q = item.querySelector('.faq-question');
          var a = item.querySelector('.faq-answer');
          if (q && a) {
            entries.push({
              '@type': 'Question',
              name: q.textContent.trim(),
              acceptedAnswer: {
                '@type': 'Answer',
                text: a.textContent.trim()
              }
            });
          }
        });
        if (entries.length) {
          inject({ '@type': 'FAQPage', mainEntity: entries });
        }
      });
      observer.observe(faqEl, { childList: true, subtree: true });
    }
  }

  if (page === 'products.html') {
    var prodEl = document.getElementById('products-list');
    if (prodEl) {
      var observer = new MutationObserver(function () {
        var cards = prodEl.querySelectorAll('.product-detail');
        if (!cards.length) return;
        observer.disconnect();
        cards.forEach(function (card) {
          var name = card.querySelector('h2, h3');
          var desc = card.querySelector('p');
          if (name) {
            inject({
              '@type': 'Product',
              name: name.textContent.trim(),
              description: desc ? desc.textContent.trim() : '',
              brand: { '@type': 'Organization', name: 'Avennex' }
            });
          }
        });
      });
      observer.observe(prodEl, { childList: true, subtree: true });
    }
  }

  if (page === 'blog.html') {
    inject({
      '@type': 'CollectionPage',
      name: 'Avennex Blog',
      url: 'https://avennex.com/blog.html',
      description: 'Product decisions, technical tradeoffs, and the messy reality of building AI software from Lahore.',
      publisher: org
    });
  }

  if (page === 'blog-post.html') {
    var contentEl = document.getElementById('blog-content');
    if (contentEl) {
      var observer = new MutationObserver(function () {
        var h1 = contentEl.querySelector('h1');
        if (!h1) return;
        observer.disconnect();
        var date = contentEl.querySelector('time, .blog-date, .post-date');
        var body = contentEl.querySelector('.blog-body, .post-body, article');
        inject({
          '@type': 'BlogPosting',
          headline: h1.textContent.trim(),
          datePublished: date ? (date.getAttribute('datetime') || date.textContent.trim()) : '',
          author: { '@type': 'Organization', name: 'Avennex' },
          publisher: org,
          description: body ? body.textContent.trim().substring(0, 200) : '',
          url: location.href
        });
      });
      observer.observe(contentEl, { childList: true, subtree: true });
    }
  }

  if (page === 'careers.html') {
    var jobsEl = document.getElementById('jobs-list');
    if (jobsEl) {
      var observer = new MutationObserver(function () {
        var rows = jobsEl.querySelectorAll('tr[data-slug], .job-card');
        if (!rows.length) return;
        observer.disconnect();
        rows.forEach(function (row) {
          var title = row.querySelector('td:first-child, .job-title, h3');
          var loc = row.querySelector('td:nth-child(2), .job-location');
          var type = row.querySelector('td:nth-child(3), .job-type');
          if (title) {
            inject({
              '@type': 'JobPosting',
              title: title.textContent.trim(),
              hiringOrganization: org,
              jobLocation: {
                '@type': 'Place',
                address: {
                  '@type': 'PostalAddress',
                  addressLocality: loc ? loc.textContent.trim() : 'Lahore',
                  addressCountry: 'PK'
                }
              },
              employmentType: type ? type.textContent.trim().toUpperCase().replace(/\s+/g, '_') : 'FULL_TIME',
              datePosted: (row.dataset.created || '').substring(0, 10) || new Date().toISOString().split('T')[0]
            });
          }
        });
      });
      observer.observe(jobsEl, { childList: true, subtree: true });
    }
  }

  if (page === 'academy.html') {
    var acadEl = document.getElementById('academy-content');
    if (acadEl) {
      var observer = new MutationObserver(function () {
        var playlists = acadEl.querySelectorAll('.playlist-card');
        if (!playlists.length) return;
        observer.disconnect();
        playlists.forEach(function (pl) {
          var name = pl.querySelector('h2, h3');
          var desc = pl.querySelector('p');
          if (name) {
            inject({
              '@type': 'Course',
              name: name.textContent.trim(),
              description: desc ? desc.textContent.trim() : '',
              provider: org,
              isAccessibleForFree: true
            });
          }
        });
      });
      observer.observe(acadEl, { childList: true, subtree: true });
    }
  }

  if (page === 'about.html') {
    var members = [];
    var cards = document.querySelectorAll('.team-card');
    cards.forEach(function (card) {
      var name = card.querySelector('.team-name');
      var role = card.querySelector('.team-role');
      if (name) {
        members.push({
          '@type': 'Person',
          name: name.textContent.trim(),
          jobTitle: role ? role.textContent.trim() : ''
        });
      }
    });
    var aboutOrg = Object.assign({}, org);
    if (members.length) aboutOrg.member = members;
    inject(aboutOrg);
  }

  if (page === 'contact.html') {
    inject({
      '@type': 'ContactPage',
      name: 'Contact Avennex',
      url: 'https://avennex.com/contact.html',
      description: 'Reach the Avennex team in Lahore.',
      mainEntity: org
    });
  }
})();
