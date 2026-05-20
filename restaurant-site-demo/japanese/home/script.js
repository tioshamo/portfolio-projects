      document.addEventListener('DOMContentLoaded', () => {

        // 1. パララックス効果
        // 画像自体を動かします（transform）。これは opacity（CSS）と干渉しません。
        const parallaxElements = document.querySelectorAll('[data-parallax]');

        function scrollHandler() {
          const scrollY = window.scrollY;

          parallaxElements.forEach(el => {
            const speed = el.getAttribute('data-parallax');
            const rect = el.getBoundingClientRect();

            // 画面内にある時だけ計算
            if (rect.top < window.innerHeight && rect.bottom > 0) {
              const offset = scrollY * speed;
              // 単純な移動のみ。scaleなどは操作しないため安全です。
              el.style.transform = `translate3d(0, ${offset}px, 0)`;
            }
          });
        }

        let ticking = false;
        window.addEventListener('scroll', () => {
          if (!ticking) {
            window.requestAnimationFrame(() => {
              scrollHandler();
              ticking = false;
            });
            ticking = true;
          }
        });

        // 初期ロード時にも位置計算を実行
        window.addEventListener('load', () => {
          scrollHandler();
        });

        // 2. ふわっと表示させるアニメーション (Intersection Observer)
        const observerOptions = {
          root: null,
          rootMargin: '0px',
          threshold: 0.1 // 10%見えたら発火
        };

        const observer = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              // 画面に入ったら 'is-visible' クラスを追加
              // CSSで opacity が 0 -> 1 に変化します
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        }, observerOptions);

        // 監視対象: テキスト(.fade-in-up) と 画像ラッパー(.fade-in-slow)
        const animatedElements = document.querySelectorAll('.fade-in-up, .fade-in-slow');
        animatedElements.forEach(el => observer.observe(el));
      });