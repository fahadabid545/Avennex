const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://avennex.com/#organization",
      "name": "Avennex",
      "url": "https://avennex.com/",
      "logo": {
        "@type": "ImageObject",
        "@id": "https://avennex.com/#logo",
        "inLanguage": "en-US",
        "url": "https://avennex.com/assets/img/logo.png",
        "contentUrl": "https://avennex.com/assets/img/logo.png",
        "width": 500,
        "height": 200,
        "caption": "Avennex"
      },
      "image": {
        "@id": "https://avennex.com/#logo"
      },
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "6060 South Street",
        "addressLocality": "Halifax",
        "addressRegion": "NS",
        "postalCode": "",
        "addressCountry": "CA"
      },
      "sameAs": [
        "https://twitter.com/avennex",
        "https://facebook.com/avennex",
        "https://instagram.com/avennex",
        "https://linkedin.com/company/avennex"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://avennex.com/#website",
      "url": "https://avennex.com/",
      "name": "Avennex | AI Development & Custom Software Solutions",
      "description": "Avennex offers cutting-edge AI solutions, web & mobile app development, data analytics, and cloud services. Custom software solutions built to accelerate your business growth.",
      "publisher": {
        "@id": "https://avennex.com/#organization"
      },
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://avennex.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      },
      "inLanguage": "en-US"
    },
    {
      "@type": "WebPage",
      "@id": "https://avennex.com/#webpage",
      "url": "https://avennex.com/",
      "name": "Avennex | AI Development & Custom Software Solutions | Halifax, Canada",
      "isPartOf": {
        "@id": "https://avennex.com/#website"
      },
      "about": {
        "@id": "https://avennex.com/#organization"
      },
      "description": "Avennex offers cutting-edge AI solutions, web & mobile app development, data analytics, and cloud services. Custom software solutions built to accelerate your business growth.",
      "inLanguage": "en-US",
      "potentialAction": [
        {
          "@type": "ReadAction",
          "target": [
            "https://avennex.com/"
          ]
        }
      ]
    },
    {
      "@type": "Service",
      "name": "AI Development & Deployment",
      "description": "From custom machine learning models to computer vision and NLP, we build AI solutions tailored to your business goals.",
      "provider": {
        "@id": "https://avennex.com/#organization"
      },
      "serviceType": "AI Development",
      "areaServed": {
        "@type": "Country",
        "name": "Canada"
      }
    },
    {
      "@type": "Service",
      "name": "Web Application Development",
      "description": "Custom web solutions that combine functionality, performance and intuitive design to meet your specific business requirements.",
      "provider": {
        "@id": "https://avennex.com/#organization"
      },
      "serviceType": "Web Development",
      "areaServed": {
        "@type": "Country",
        "name": "Canada"
      }
    },
    {
      "@type": "Service",
      "name": "Mobile App Development",
      "description": "Native and cross-platform mobile applications that deliver exceptional user experiences across iOS and Android devices.",
      "provider": {
        "@id": "https://avennex.com/#organization"
      },
      "serviceType": "Mobile Development",
      "areaServed": {
        "@type": "Country",
        "name": "Canada"
      }
    }
  ]
};

// Add this to your site's JavaScript to dynamically add the structured data
document.addEventListener('DOMContentLoaded', function() {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(structuredData);
  document.head.appendChild(script);
});
