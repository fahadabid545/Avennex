/* Cookie consent. Nothing optional runs until the visitor says yes.
   Analytics is Google Analytics 4, loaded only on avennex.com and only
   after the visitor accepts the analytics category. A browser that sends
   Global Privacy Control is treated as a no. */
(function () {
  var GA_ID = '';
  var PROD = location.hostname === 'avennex.com' || location.hostname === 'www.avennex.com';

  if (typeof CookieConsent === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });

  var gaLoaded = false;
  function startAnalytics() {
    if (!PROD || !GA_ID) return;
    gtag('consent', 'update', { analytics_storage: 'granted' });
    if (gaLoaded) return;
    gaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  function stopAnalytics() {
    gtag('consent', 'update', { analytics_storage: 'denied' });
  }

  function apply() {
    if (CookieConsent.acceptedCategory('analytics')) startAnalytics();
    else stopAnalytics();
  }

  var en = {
    consentModal: {
      title: 'Cookies, briefly',
      description: 'We\'d like to count visits so we know which pages help people. That only starts if you say yes. You can change your mind any time from the footer.',
      acceptAllBtn: 'Accept',
      acceptNecessaryBtn: 'Reject',
      showPreferencesBtn: 'Settings',
      footer: '<a href="privacy.html#cookies">Privacy and cookies</a>',
    },
    preferencesModal: {
      title: 'Cookie settings',
      acceptAllBtn: 'Accept all',
      acceptNecessaryBtn: 'Reject all',
      savePreferencesBtn: 'Save my choice',
      closeIconLabel: 'Close',
      sections: [
        {
          title: 'What we store',
          description: 'The site keeps a few small things in your browser so it works properly. Anything beyond that waits for your permission.',
        },
        {
          title: 'Needed for the site',
          description: 'Your cookie choice, your motion setting and the state of the chat window. These never leave your browser and can\'t be turned off.',
          linkedCategory: 'necessary',
        },
        {
          title: 'Analytics',
          description: 'Google Analytics counts visits and shows which pages get read. It sets the _ga cookies, kept for up to 13 months. Off unless you turn it on.',
          linkedCategory: 'analytics',
        },
        {
          title: 'Questions',
          description: 'Email <a href="mailto:hello@avennex.com">hello@avennex.com</a> or read the <a href="privacy.html#cookies">privacy policy</a>.',
        },
      ],
    },
  };

  var fr = {
    consentModal: {
      title: 'Les témoins, en bref',
      description: 'Nous aimerions compter les visites pour savoir quelles pages aident les gens. Rien ne démarre sans votre accord. Vous pouvez changer d\'avis en tout temps depuis le pied de page.',
      acceptAllBtn: 'Accepter',
      acceptNecessaryBtn: 'Refuser',
      showPreferencesBtn: 'Paramètres',
      footer: '<a href="privacy.html#cookies">Confidentialité et témoins</a>',
    },
    preferencesModal: {
      title: 'Paramètres des témoins',
      acceptAllBtn: 'Tout accepter',
      acceptNecessaryBtn: 'Tout refuser',
      savePreferencesBtn: 'Enregistrer mon choix',
      closeIconLabel: 'Fermer',
      sections: [
        {
          title: 'Ce que nous conservons',
          description: 'Le site garde quelques petites informations dans votre navigateur pour bien fonctionner. Tout le reste attend votre permission.',
        },
        {
          title: 'Nécessaires au site',
          description: 'Votre choix de témoins, votre réglage d\'animation et l\'état de la fenêtre de clavardage. Ces données restent dans votre navigateur et ne peuvent pas être désactivées.',
          linkedCategory: 'necessary',
        },
        {
          title: 'Statistiques',
          description: 'Google Analytics compte les visites et montre quelles pages sont lues. Il dépose les témoins _ga, conservés jusqu\'à 13 mois. Désactivé sauf si vous l\'activez.',
          linkedCategory: 'analytics',
        },
        {
          title: 'Questions',
          description: 'Écrivez à <a href="mailto:hello@avennex.com">hello@avennex.com</a> ou lisez la <a href="privacy.html#cookies">politique de confidentialité</a>.',
        },
      ],
    },
  };

  var ready = CookieConsent.run({
    revision: 1,
    cookie: { name: 'avx_consent', expiresAfterDays: 182 },
    guiOptions: {
      consentModal: { layout: 'box', position: 'bottom left', equalWeightButtons: true },
      preferencesModal: { layout: 'box', equalWeightButtons: true },
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {
        autoClear: { cookies: [{ name: /^_ga/ }, { name: '_gid' }] },
      },
    },
    language: {
      default: 'en',
      autoDetect: 'browser',
      translations: { en: en, fr: fr },
    },
    onConsent: apply,
    onChange: apply,
  });

  // Global Privacy Control counts as a refusal, so the banner doesn't ask
  Promise.resolve(ready).then(function () {
    if (!CookieConsent.validConsent() && navigator.globalPrivacyControl) {
      CookieConsent.acceptCategory([]);
      CookieConsent.hide();
    }
  });
})();
