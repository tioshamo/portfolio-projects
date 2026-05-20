      document.addEventListener('DOMContentLoaded', () => {

        // 1. Parallax Logic (Same as Landing Page)
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        function scrollHandler() {
          const scrollY = window.scrollY;
          parallaxElements.forEach(el => {
            const speed = el.getAttribute('data-parallax');
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
              el.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
            }
          });
        }
        window.addEventListener('scroll', () => window.requestAnimationFrame(scrollHandler));

        // 2. Fade In Logic
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
            }
          });
        }, { threshold: 0.1 });

        document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));

        // 3. Form Handling (Mock Submission)
        const form = document.getElementById('reservationForm');
        const successMsg = document.getElementById('successMessage');

        form.addEventListener('submit', (e) => {
          e.preventDefault();

          // Submit Button Animation Simulation
          const btn = form.querySelector('.btn-submit');
          const originalText = btn.textContent;
          btn.textContent = "送信中...";
          btn.style.opacity = "0.7";

          setTimeout(() => {
            // Fade out form
            form.style.opacity = '0';
            form.style.transition = 'opacity 0.5s ease';

            setTimeout(() => {
              form.style.display = 'none';
              successMsg.classList.add('active');

              // Smooth scroll to message
              window.scrollTo({
                top: successMsg.offsetTop - 100,
                behavior: 'smooth'
              });
            }, 500);
          }, 1500);
        });

        // 4. Default Date (Today + 3 days)
        const dateInput = document.getElementById('date');
        const today = new Date();
        today.setDate(today.getDate() + 3);
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.min = `${yyyy}-${mm}-${dd}`;
      });

