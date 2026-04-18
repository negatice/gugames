// ============================================
        // GAME DATA - TAMBAH GAME KAMU DI SINI!
        // ============================================
        // Ganti 'url' dengan path ke file HTML game kamu
        const games = [
            { id: 1, name: "Time Freeze", category: "action", mode: "singleplayer", icon: "⏱️", gradient: "linear-gradient(135deg, #10b981, #059669)", rating: 4.5, plays: "12.5K", badge: "hot", desc: "Perfect Time is real?", url: "games/time_freeze/index.html" },
            { id: 2, name: "Tic Tac Toe", category: "strategy", mode: "multiplayer", icon: "❌⭕", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)", rating: 4.2, plays: "8.3K", badge: "popular", desc: "Permainan klasik dua pemain.", url: "games/tictactoe/index.html" },
            { id: 4, name: "Quiz Duel", category: "action", mode: "multiplayer", icon: "➗", gradient: "linear-gradient(135deg, #f59e0b, #d97706)", rating: 4.7, plays: "15.1K", badge: "new", desc: "Uji kemampuan menghitungmu!", url: "games/duel_quiz/index.html" },
            { id: 7, name: "Rhythm Hero", category: "arcade", mode: "singleplayer", icon: "🎹", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)", rating: 4.3, plays: "22.0K", badge: "hot", desc: "Mainkan musik dengan mengetuk irama!", url: "games/rhythm_hero/index.html" },
            { id: 5, name: "Tank Battle", category: "action", mode: "multiplayer", icon: "🪖", gradient: "linear-gradient(135deg, #ef4444, #dc2626)", rating: 4.8, plays: "18.7K", badge: "popular", desc: "Tempur tidak ada batasan.", url: "games/tank/index.html" },
            { id: 6, name: "Jet Manuver", category: "action", mode: "singleplayer", icon: "🚀", gradient: "linear-gradient(135deg, #ec4899, #db2777)", rating: 4.1, plays: "5.4K", badge: "new", desc: "Jadi Pilot pemberani, taklukan semua missile!", url: "games/jet_manuver/index.html" },
            { id: 3, name: "Space Shooter", category: "action", mode: "singleplayer", icon: "👽", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)", rating: 4.6, plays: "9.8K", badge: "hot", desc: "Pertahankan galaksi dari invasi alien!", url: "games/space_shooter/index.html" },
            { id: 8, name: "Bom Defuse", category: "action", mode: "singleplayer", icon: "💥", gradient: "linear-gradient(135deg, #14b8a6, #0d9488)", rating: 4.4, plays: "7.2K", badge: null, desc: "jinakkan bom sebelum meledak, uji ingatanmu!", url: "games/bom_defuse/index.html" },
            { id: 9, name: "Flying Duck", category: "arcade", mode: "singleplayer", icon: "🦆", gradient: "linear-gradient(135deg, #f97316, #ea580c)", rating: 4.3, plays: "11.3K", badge: "popular", desc: "Tembak semua bebek! dan jaga dirimu!", url: "games/flying_duck/index.html" },
            // { id: 10, name: "Tower Defense", category: "strategy", mode: "multiplayer", icon: "🏰", gradient: "linear-gradient(135deg, #64748b, #475569)", rating: 4.5, plays: "6.1K", badge: "new", desc: "Bangun menara pertahanan dan lindungi markasmu!", url: "games/towerdefense/index.html" }
        ];

        // ============================================
        // STATE
        // ============================================
        let currentCategory = 'all';
        let searchQuery = '';
        let activeFeaturedIndex = 0;

        // ============================================
        // RENDER GAMES BY MODE
        // ============================================
        function renderGamesByMode() {
            const multiplayer = games.filter(g => g.mode === "multiplayer");
            const singleplayer = games.filter(g => g.mode === "singleplayer");

            document.getElementById('multiplayerCount').textContent = `${multiplayer.length} games`;
            document.getElementById('singleplayerCount').textContent = `${singleplayer.length} games`;

            renderGrid('multiplayerGrid', multiplayer);
            renderGrid('singleplayerGrid', singleplayer);

            // Hide section if empty
            document.getElementById('multiplayerSection').style.display = multiplayer.length ? 'block' : 'none';
            document.getElementById('singleplayerSection').style.display = singleplayer.length ? 'block' : 'none';
        }

        function renderGrid(gridId, gameList) {
            const grid = document.getElementById(gridId);
            grid.innerHTML = gameList.map(game => `
                <a class="game-card" onclick="openGameModal(${game.id}); return false;" href="${game.url}">
                    <div class="game-thumb" style="background: ${game.gradient}">
                        <span class="game-thumb-icon">${game.icon}</span>
                        ${game.badge ? `<span class="game-badge ${game.badge}">${game.badge}</span>` : ''}
                    </div>
                    <div class="game-info">
                        <div class="game-name">${game.name}</div>
                        <div class="game-category">${game.category.charAt(0).toUpperCase() + game.category.slice(1)}</div>
                        <div class="game-footer">
                            <span class="game-rating">⭐ ${game.rating}</span>
                            <span class="game-plays">🎮 ${game.plays}</span>
                        </div>
                    </div>
                    <div class="play-btn-mini">▶</div>
                </a>
            `).join('');
        }

        // ============================================
        // SEARCH FUNCTIONALITY
        // ============================================
        function setupSearch() {
            const input = document.getElementById('searchInput');
            const clearBtn = document.getElementById('searchClear');
            const emptyState = document.getElementById('emptyState');
            let debounceTimer;

            input.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                clearBtn.classList.toggle('visible', input.value.length > 0);

                debounceTimer = setTimeout(() => {
                    const query = input.value.trim().toLowerCase();
                    filterGames(query);
                }, 200);
            });
        }

        function filterGames(query) {
            const multiplayerGrid = document.getElementById('multiplayerGrid');
            const singleplayerGrid = document.getElementById('singleplayerGrid');
            const emptyState = document.getElementById('emptyState');

            if (!query) {
                renderGamesByMode();
                emptyState.classList.remove('visible');
                return;
            }

            const multiMatch = games.filter(g => g.mode === "multiplayer" && matchesQuery(g, query));
            const singleMatch = games.filter(g => g.mode === "singleplayer" && matchesQuery(g, query));

            renderGrid('multiplayerGrid', multiMatch);
            renderGrid('singleplayerGrid', singleMatch);

            document.getElementById('multiplayerSection').style.display = multiMatch.length ? 'block' : 'none';
            document.getElementById('singleplayerSection').style.display = singleMatch.length ? 'block' : 'none';

            if (multiMatch.length === 0 && singleMatch.length === 0) {
                emptyState.classList.add('visible');
            } else {
                emptyState.classList.remove('visible');
            }
        }

        function matchesQuery(game, q) {
            return game.name.toLowerCase().includes(q) || 
                game.category.toLowerCase().includes(q) || 
                game.desc.toLowerCase().includes(q);
        }

        function clearSearch() {
            const input = document.getElementById('searchInput');
            input.value = '';
            document.getElementById('searchClear').classList.remove('visible');
            filterGames('');
        }

        // ============================================
        // INIT
        // ============================================
        document.addEventListener('DOMContentLoaded', () => {
            renderGamesByMode();
            setupSearch();
            animateCounter('totalGames', games.length, 1000);
        });

        // ============================================
        // MODAL
        // ============================================
        function openGameModal(id) {
            const game = games.find(g => g.id === id);
            if (!game) return;

            document.getElementById('modalThumb').style.background = game.gradient;
            document.getElementById('modalThumb').innerHTML = `<span style="font-size:72px;filter:drop-shadow(0 8px 16px rgba(0,0,0,0.3))">${game.icon}</span>`;
            document.getElementById('modalName').textContent = game.name;
            document.getElementById('modalDesc').textContent = game.desc;
            document.getElementById('modalPlayBtn').onclick = () => {
                closeModalDirect();
                openGame(id);
            };

            document.getElementById('modalOverlay').classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        function closeModal(e) {
            if (e.target === document.getElementById('modalOverlay')) {
                closeModalDirect();
            }
        }

        function closeModalDirect() {
            document.getElementById('modalOverlay').classList.remove('open');
            document.body.style.overflow = '';
        }

        // ============================================
        // NAVIGATE TO GAME
        // ============================================
        function openGame(id) {
            const game = games.find(g => g.id === id);
            if (!game) return;

            showToast(`Membuka ${game.name}...`);

            setTimeout(() => {
                // Ganti dengan path relatif ke game kamu
                window.location.href = game.url;
            }, 500);
        }

        // ============================================
        // TOAST
        // ============================================
        function showToast(text) {
            const toast = document.getElementById('toast');
            document.getElementById('toastText').textContent = text;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
            }, 2500);
        }

        // ============================================
        // COUNTER ANIMATION
        // ============================================
        function animateCounter(elementId, target, duration) {
            const el = document.getElementById(elementId);
            if (!el) return;

            const start = 0;
            const startTime = performance.now();

            function update(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = Math.round(start + (target - start) * eased);

                el.textContent = current;

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }

            requestAnimationFrame(update);
        }

        // ============================================
        // THEME TOGGLE (placeholder)
        // ============================================
        function toggleTheme() {
            showToast('Theme toggle coming soon! 🎨');
        }

        // ============================================
        // KEYBOARD SHORTCUTS
        // ============================================
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModalDirect();
            }
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                document.getElementById('searchInput').focus();
            }
        });

                // Fungsi buka/tutup modal About
        function openAboutModal() {
            document.getElementById('aboutModalOverlay').classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        function closeAboutModal(e) {
            if (!e || e.target.id === 'aboutModalOverlay') {
                document.getElementById('aboutModalOverlay').classList.remove('open');
                document.body.style.overflow = '';
            }
        }

        // Update keyboard shortcut agar bisa menutup modal About juga
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.open').forEach(modal => {
                    modal.classList.remove('open');
                });
                document.body.style.overflow = '';
            }
        });

        // ============================================
        // SERVICE WORKER REGISTRATION (PWA Ready)
        // ============================================
        if ('serviceWorker' in navigator) {
            // navigator.serviceWorker.register('/sw.js');
        }

        // 🎵 Background Music Controller
(function() {
  const bgm = document.getElementById('bgmAudio');
  const toggleBtn = document.getElementById('bgmToggle');
  if (!bgm || !toggleBtn) return;

  // Atur volume awal (0.1 = 10%, 0.5 = 50%)
  bgm.volume = 0.3;

  // Coba autoplay saat halaman dimuat
  bgm.play().catch(() => {
    // Jika browser memblokir autoplay, set icon ke mute
    toggleBtn.textContent = '🔇';
    
    // Aktifkan musik saat user pertama kali menyentuh/klik layar
    const enableBGM = () => {
      bgm.play().catch(() => {});
    };
    document.addEventListener('click', enableBGM, { once: true });
    document.addEventListener('touchstart', enableBGM, { once: true });
  });

  // Tombol toggle mute/unmute
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Mencegah konflik dengan event lain
    if (bgm.paused) {
      bgm.play().catch(() => {});
      bgm.volume = 0.3; 
      toggleBtn.textContent = '🔊';
    } else {
      bgm.pause();
      toggleBtn.textContent = '🔇';
    }
  });
})();

// 🎵 Auto-Play Banner Controller
(function() {
  const banner = document.getElementById('promoBanner');
  const okBtn = document.getElementById('promoOkBtn');
  const bgm = document.getElementById('bgmAudio');
  
  // Jika sudah pernah klik OK, jangan tampilkan lagi
  if (localStorage.getItem('bgm_prompt_accepted') || !banner || !okBtn || !bgm) return;

  // Tampilkan banner setelah halaman stabil (1.5 detik)
  setTimeout(() => {
    banner.classList.add('show');
  }, 1500);

  // Saat tombol OK ditekan
  okBtn.addEventListener('click', () => {
    bgm.play().catch(() => {}); // Play musik
    localStorage.setItem('bgm_prompt_accepted', 'true'); // Simpan status
    banner.classList.remove('show'); // Sembunyikan banner
  });
})();