/* =========================================================
   AIRIS CLI – Website Scripts
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  // --- Navbar scroll effect ---
  const navbar = document.getElementById('navbar');
  let lastScroll = 0;

  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 30) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
  });

  // --- Mobile nav toggle ---
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  // Close nav on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
    });
  });

  // --- Install tabs ---
  const tabsBar = document.getElementById('tabsBar');
  const tabPanes = {
    curl: document.getElementById('tab-curl'),
    npm: document.getElementById('tab-npm'),
    pnpm: document.getElementById('tab-pnpm'),
    bun: document.getElementById('tab-bun'),
  };

  tabsBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    // Deactivate all tabs
    tabsBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    Object.values(tabPanes).forEach(p => p.classList.remove('active'));

    // Activate clicked tab
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    if (tabPanes[tabId]) {
      tabPanes[tabId].classList.add('active');
    }
  });

  // --- Copy to clipboard ---
  const toast = document.getElementById('toast');

  function showToast(message, type = '') {
    toast.textContent = message;
    toast.className = 'toast ' + type;
    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  document.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.copy-btn');
    if (!copyBtn) return;

    const text = copyBtn.dataset.copy;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      copyBtn.classList.add('copied');
      showToast('✓ Copied to clipboard', 'success');
      setTimeout(() => copyBtn.classList.remove('copied'), 1500);
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('✓ Copied to clipboard', 'success');
    });
  });

  // --- Hero copy button ---
  const heroCopyBtn = document.getElementById('heroCopyBtn');
  if (heroCopyBtn) {
    heroCopyBtn.addEventListener('click', () => {
      const cmd = 'curl -fsSL https://airis-cli.netlify.app/install.sh | sh';
      navigator.clipboard.writeText(cmd).then(() => {
        showToast('✓ Install command copied', 'success');
      });
    });
  }

  // --- Terminal animation (sequential reveal) ---
  const terminalBody = document.getElementById('terminalBody');
  if (terminalBody) {
    const lines = terminalBody.querySelectorAll('.line');
    lines.forEach((line, index) => {
      line.style.opacity = '0';
      line.style.transform = 'translateY(4px)';
      line.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    });

    // Reveal lines sequentially on scroll into view
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        lines.forEach((line, index) => {
          setTimeout(() => {
            line.style.opacity = '1';
            line.style.transform = 'translateY(0)';
          }, 120 + index * 100);
        });
        observer.disconnect();
      }
    }, { threshold: 0.3 });

    observer.observe(terminalBody);
  }

  // --- Feature cards stagger animation ---
  const featureCards = document.querySelectorAll('.feature-card');
  if (featureCards.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const cards = entry.target.querySelectorAll('.feature-card');
          cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            setTimeout(() => {
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 100 + index * 80);
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    const featuresGrid = document.querySelector('.features-grid');
    if (featuresGrid) observer.observe(featuresGrid);
  }

  // --- Smooth anchor scroll ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const offset = navbar.offsetHeight;
        const targetPos = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: targetPos, behavior: 'smooth' });
      }
    });
  });

});
