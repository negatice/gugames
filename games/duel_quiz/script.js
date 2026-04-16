 // ================= AUDIO SYSTEM (Web Audio API) =================
        let audioCtx = null;
        
        function initAudio() {
            if(!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if(audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }

        // Generate beep sound with parameters
        function playBeep(frequency, duration, type = 'sine', volume = 0.3, delay = 0) {
            if(!audioCtx) return;
            
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime + delay);
            gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + delay + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
            
            oscillator.start(audioCtx.currentTime + delay);
            oscillator.stop(audioCtx.currentTime + delay + duration);
        }

        // Sound Effect Presets
        const SFX = {
            start: () => { playBeep(880, 0.15, 'square', 0.2); setTimeout(() => playBeep(1100, 0.15, 'square', 0.2), 80); },
            countdown: (num) => {
                const freqs = [523, 659, 784]; // C5, E5, G5
                playBeep(freqs[num-1] || 880, 0.2, 'sine', 0.4);
            },
            go: () => {
                playBeep(880, 0.1, 'square', 0.3);
                setTimeout(() => playBeep(1100, 0.1, 'square', 0.3), 50);
                setTimeout(() => playBeep(1320, 0.2, 'square', 0.35), 100);
            },
            correct: () => {
                playBeep(880, 0.08, 'sine', 0.3);
                setTimeout(() => playBeep(1100, 0.08, 'sine', 0.35), 60);
                setTimeout(() => playBeep(1320, 0.12, 'sine', 0.4), 120);
            },
            wrong: () => {
                playBeep(220, 0.15, 'sawtooth', 0.25);
                setTimeout(() => playBeep(180, 0.2, 'sawtooth', 0.2), 100);
            },
            timeout: () => {
                playBeep(330, 0.1, 'triangle', 0.2);
                setTimeout(() => playBeep(330, 0.1, 'triangle', 0.2), 120);
                setTimeout(() => playBeep(330, 0.15, 'triangle', 0.2), 240);
            },
            win: () => {
                [523, 659, 784, 1047].forEach((freq, i) => {
                    setTimeout(() => playBeep(freq, 0.15, 'sine', 0.35 - i*0.05), i * 100);
                });
            },
            button: () => playBeep(660, 0.05, 'sine', 0.15)
        };

        // ================= GAME STATE =================
        let gameState = {
            mode: null,
            score1: 0,
            score2: 0,
            currentQuestion: null,
            timer: null,
            timeLeft: 5,
            maxTime: 5,
            gameActive: false,
            timeLimit: 60,
            timeRemaining: 60,
            player1Answered: false,
            player2Answered: false,
            questionStartTime: 0,
            maxScore: 10
        };

        // ================= COUNTDOWN SYSTEM =================
        function runCountdown(callback) {
            return new Promise((resolve) => {
                const overlay = document.getElementById('countdownOverlay');
                const numberEl = document.getElementById('countdownNumber');
                const subtitleEl = document.getElementById('countdownSubtitle');
                
                overlay.style.display = 'flex';
                
                let count = 3;
                const interval = setInterval(() => {
                    if(count > 0) {
                        // Update display
                        numberEl.textContent = count;
                        numberEl.className = 'countdown-number';
                        subtitleEl.textContent = count === 3 ? 'Get Ready!' : count === 2 ? 'Focus!' : 'Go!';
                        
                        // Play sound
                        SFX.countdown(count);
                        
                        // Trigger reflow for animation restart
                        void numberEl.offsetWidth;
                        
                        count--;
                    } else {
                        clearInterval(interval);
                        // GO!
                        numberEl.textContent = 'GO!';
                        numberEl.className = 'countdown-number go';
                        subtitleEl.textContent = '';
                        SFX.go();
                        
                        setTimeout(() => {
                            overlay.style.display = 'none';
                            if(callback) callback();
                            resolve();
                        }, 400);
                    }
                }, 700);
            });
        }

        // ================= MATH QUESTION =================
        function generateQuestion() {
            const operations = ['+', '-', '×'];
            const operation = operations[Math.floor(Math.random() * operations.length)];
            let num1, num2, answer;

            switch(operation) {
                case '+':
                    num1 = Math.floor(Math.random() * 20) + 1;
                    num2 = Math.floor(Math.random() * 20) + 1;
                    answer = num1 + num2;
                    break;
                case '-':
                    num1 = Math.floor(Math.random() * 20) + 5;
                    num2 = Math.floor(Math.random() * num1);
                    answer = num1 - num2;
                    break;
                case '×':
                    num1 = Math.floor(Math.random() * 10) + 1;
                    num2 = Math.floor(Math.random() * 10) + 1;
                    answer = num1 * num2;
                    break;
            }

            const answers = new Set([answer]);
            while(answers.size < 4) {
                let offset = Math.floor(Math.random() * 10) - 5;
                if(offset !== 0) {
                    let wrongAnswer = answer + offset;
                    if(wrongAnswer >= 0) answers.add(wrongAnswer);
                }
            }

            const shuffledAnswers = Array.from(answers).sort(() => Math.random() - 0.5);

            return {
                text: `${num1} ${operation} ${num2} = ?`,
                correct: answer,
                options: shuffledAnswers
            };
        }

        // ================= RACE TRACK =================
        function updateRaceTrack() {
            const maxScore = gameState.maxScore;
            const trackWidth = document.getElementById('raceTrack').offsetWidth - 50;
            
            const pos1 = 8 + (gameState.score1 / maxScore) * trackWidth;
            const pos2 = 8 + (gameState.score2 / maxScore) * trackWidth;
            
            document.getElementById('racer1').style.left = pos1 + 'px';
            document.getElementById('racer2').style.left = pos2 + 'px';
        }

        // ================= START GAME =================
        async function startGame(mode) {
            initAudio();
            SFX.button();
            
            gameState.mode = mode;
            gameState.gameActive = true;
            gameState.score1 = 0;
            gameState.score2 = 0;
            gameState.timeRemaining = mode === 'time60' ? 60 : 999;
            gameState.maxScore = mode === 'first10' ? 10 : 20;
            
            document.getElementById('score1').textContent = '0';
            document.getElementById('score2').textContent = '0';
            
            document.getElementById('startScreen').style.display = 'none';
            document.getElementById('gameContainer').style.display = 'block';
            
            if(mode === 'time60') {
                document.getElementById('globalTimer').style.display = 'block';
                startTimeBattle();
            }
            
            updateRaceTrack();
            
            // Run countdown before first question
            SFX.start();
            await runCountdown(() => {
                nextQuestion();
            });
        }

        // ================= TIME BATTLE =================
        function startTimeBattle() {
            const timer = setInterval(() => {
                if(!gameState.gameActive) {
                    clearInterval(timer);
                    return;
                }
                
                gameState.timeRemaining--;
                document.getElementById('globalTimer').textContent = gameState.timeRemaining + 's';
                
                if(gameState.timeRemaining <= 0) {
                    clearInterval(timer);
                    endGame();
                }
            }, 1000);
        }

                // ================= NEXT QUESTION =================
        function nextQuestion() {  // ← Hapus 'async' karena tidak perlu await lagi
            if(!gameState.gameActive) return;
            
            if(gameState.mode === 'first10') {
                if(gameState.score1 >= 10 || gameState.score2 >= 10) {
                    endGame();
                    return;
                }
            }
            
            // ✅ Langsung generate soal tanpa countdown
            gameState.currentQuestion = generateQuestion();
            gameState.player1Answered = false;
            gameState.player2Answered = false;
            gameState.timeLeft = gameState.maxTime;
            gameState.questionStartTime = Date.now();
            
            document.getElementById('question1').textContent = gameState.currentQuestion.text;
            document.getElementById('question2').textContent = gameState.currentQuestion.text;
            document.getElementById('statusText1').textContent = '';
            document.getElementById('statusText2').textContent = '';
            
            createAnswerButtons('answers1', 1);
            createAnswerButtons('answers2', 2);
            
            startTimer();
        }

        function createAnswerButtons(containerId, player) {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            
            gameState.currentQuestion.options.forEach((option) => {
                const btn = document.createElement('button');
                btn.className = 'answer-btn';
                btn.textContent = option;
                btn.onclick = () => handleAnswer(player, option, btn);
                container.appendChild(btn);
            });
        }

        // ================= TIMER =================
        function startTimer() {
            if(gameState.timer) clearInterval(gameState.timer);
            
            gameState.timer = setInterval(() => {
                gameState.timeLeft -= 0.1;
                
                const percentage = Math.max(0, (gameState.timeLeft / gameState.maxTime) * 100);
                
                document.getElementById('timerFill1').style.width = percentage + '%';
                document.getElementById('timerFill2').style.width = percentage + '%';
                document.getElementById('timerText1').textContent = gameState.timeLeft.toFixed(1) + 's';
                document.getElementById('timerText2').textContent = gameState.timeLeft.toFixed(1) + 's';
                
                if(gameState.timeLeft <= 0) {
                    clearInterval(gameState.timer);
                    handleTimeOut();
                }
            }, 100);
        }

        // ================= HANDLE ANSWER =================
        function handleAnswer(player, answer, btnElement) {
            if(!gameState.gameActive || gameState.timeLeft <= 0) return;
            
            const playerAnswered = player === 1 ? gameState.player1Answered : gameState.player2Answered;
            if(playerAnswered) return;
            
            const isCorrect = answer === gameState.currentQuestion.correct;
            const responseTime = Date.now() - gameState.questionStartTime;
            
            if(isCorrect) {
                SFX.correct();
                btnElement.classList.add('correct');
                
                let points = 1;
                if(responseTime < 2000) points = 2;
                
                if(player === 1) {
                    gameState.score1 += points;
                    gameState.player1Answered = true;
                    document.getElementById('score1').textContent = gameState.score1;
                    document.getElementById('statusText1').textContent = `+${points} • ${(responseTime/1000).toFixed(1)}s`;
                } else {
                    gameState.score2 += points;
                    gameState.player2Answered = true;
                    document.getElementById('score2').textContent = gameState.score2;
                    document.getElementById('statusText2').textContent = `+${points} • ${(responseTime/1000).toFixed(1)}s`;
                }
                
                updateRaceTrack();
                disableAllButtons();
                
                setTimeout(() => {
                    clearInterval(gameState.timer);
                    nextQuestion();
                }, 1200);
                
            } else {
                SFX.wrong();
                btnElement.classList.add('wrong');
                
                if(player === 1) {
                    gameState.score1 = Math.max(0, gameState.score1 - 1);
                    document.getElementById('score1').textContent = gameState.score1;
                    gameState.player1Answered = true;
                    document.getElementById('statusText1').textContent = '❌ -1';
                } else {
                    gameState.score2 = Math.max(0, gameState.score2 - 1);
                    document.getElementById('score2').textContent = gameState.score2;
                    gameState.player2Answered = true;
                    document.getElementById('statusText2').textContent = '❌ -1';
                }
                
                updateRaceTrack();
                btnElement.disabled = true;
            }
        }

        function disableAllButtons() {
            document.querySelectorAll('.answer-btn').forEach(btn => {
                btn.classList.add('disabled');
                btn.disabled = true;
            });
        }

        function handleTimeOut() {
            SFX.timeout();
            document.getElementById('statusText1').textContent = "⏰ Time!";
            document.getElementById('statusText2').textContent = "⏰ Time!";
            disableAllButtons();
            
            setTimeout(() => {
                nextQuestion();
            }, 1200);
        }

        // ================= END GAME =================
        function endGame() {
            gameState.gameActive = false;
            clearInterval(gameState.timer);
            
            document.getElementById('gameContainer').style.display = 'none';
            document.getElementById('endScreen').style.display = 'flex';
            
            SFX.win();
            
            let winnerText = '';
            if(gameState.score1 > gameState.score2) {
                winnerText = '🎉 Player 1 Wins!';
            } else if(gameState.score2 > gameState.score1) {
                winnerText = '🎉 Player 2 Wins!';
            } else {
                winnerText = "🤝 It's a Draw!";
            }
            
            document.getElementById('winnerText').textContent = winnerText;
            document.getElementById('finalScores').innerHTML = 
                `Player 1: ${gameState.score1}<br>Player 2: ${gameState.score2}`;
        }

        // ================= EVENT LISTENERS =================
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if(now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Init audio on first user interaction
        document.addEventListener('click', initAudio, { once: true });
        document.addEventListener('touchstart', initAudio, { once: true });

        window.addEventListener('resize', updateRaceTrack);

        // ================= CONFETTI SYSTEM =================
function createConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#f1c40f', '#00d9ff', '#00ff88', '#e74c3c', '#9b59b6', '#fff'];
    
    for(let i = 0; i < 80; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Random properties
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        confetti.style.width = (Math.random() * 8 + 6) + 'px';
        confetti.style.height = (Math.random() * 8 + 6) + 'px';
        
        container.appendChild(confetti);
        
        // Remove after animation
        setTimeout(() => confetti.remove(), 5000);
    }
}

// ================= ANIMATE SCORE COUNT-UP =================
function animateScore(elementId, targetValue, duration = 1000) {
    const element = document.getElementById(elementId);
    let start = 0;
    const increment = targetValue / (duration / 16);
    
    const animate = () => {
        start += increment;
        if(start < targetValue) {
            element.textContent = Math.floor(start);
            requestAnimationFrame(animate);
        } else {
            element.textContent = targetValue;
        }
    };
    animate();
}

// ================= UPDATE END GAME FUNCTION =================
// GANTI fungsi endGame() yang lama dengan ini:
function endGame() {
    gameState.gameActive = false;
    clearInterval(gameState.timer);
    
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('endScreen').style.display = 'flex';
    
    // ✨ Play victory sound
    if(typeof SFX !== 'undefined') SFX.win();
    
    // ✨ Determine winner
    let winnerText = '';
    let winnerPlayer = 0;
    
    if(gameState.score1 > gameState.score2) {
        winnerText = '🎉 Player 1 Wins!';
        winnerPlayer = 1;
    } else if(gameState.score2 > gameState.score1) {
        winnerText = '🎉 Player 2 Wins!';
        winnerPlayer = 2;
    } else {
        winnerText = "🤝 It's a Draw!";
        winnerPlayer = 0;
    }
    
    // ✨ Update UI
    document.getElementById('winnerText').textContent = winnerText;
    
    // ✨ Animate scores with count-up
    setTimeout(() => {
        animateScore('finalScore1', gameState.score1);
        animateScore('finalScore2', gameState.score2);
    }, 300);
    
    // ✨ Highlight winner card
    if(winnerPlayer === 1) {
        document.getElementById('endScore1').classList.add('winner');
        document.getElementById('status1').textContent = '👑 Champion';
        document.getElementById('status2').textContent = 'Points';
    } else if(winnerPlayer === 2) {
        document.getElementById('endScore2').classList.add('winner');
        document.getElementById('status2').textContent = '👑 Champion';
        document.getElementById('status1').textContent = 'Points';
    } else {
        document.getElementById('status1').textContent = 'Points';
        document.getElementById('status2').textContent = 'Points';
    }
    
    // ✨ Update trophy icon based on winner
    const trophyIcon = document.querySelector('.trophy-icon');
    if(winnerPlayer === 1) {
        trophyIcon.textContent = '🏴';
        trophyIcon.style.fontSize = '3.5rem';
    } else if(winnerPlayer === 2) {
        trophyIcon.textContent = '🏳️';
        trophyIcon.style.fontSize = '3.5rem';
    } else {
        trophyIcon.textContent = '🏆';
    }
    
    // ✨ Calculate and show simple stats
    const totalAnswers = gameState.score1 + gameState.score2 + 
                        Math.max(0, 10 - gameState.score1) + 
                        Math.max(0, 10 - gameState.score2); // rough estimate
    const accuracy = totalAnswers > 0 
        ? Math.round((gameState.score1 + gameState.score2) / totalAnswers * 100) 
        : 0;
    
    document.getElementById('bestRound').textContent = Math.max(gameState.score1, gameState.score2);
    document.getElementById('accuracy').textContent = accuracy + '%';
    
    // ✨ Start confetti celebration
    setTimeout(() => {
        createConfetti();
        // Repeat confetti for extra celebration
        setInterval(() => createConfetti(), 3000);
    }, 600);
}

(function() {
  const btn = document.getElementById('homeReturnBtn');
  if (!btn) return;

  let holdTimer = null;

  function startHold(e) {
    if (e.cancelable) e.preventDefault();
    btn.classList.add('holding');
    holdTimer = setTimeout(() => {
      // Feedback haptic (jika device mendukung)
      if (navigator.vibrate) navigator.vibrate(30);
      // Ganti path ini jika struktur folder kamu berbeda
      window.location.href = '../../index.html';
    }, 1000); // 1000ms = 1 detik
  }

  function cancelHold() {
    btn.classList.remove('holding');
    clearTimeout(holdTimer);
  }

  // Mouse events
  btn.addEventListener('mousedown', startHold);
  btn.addEventListener('mouseup', cancelHold);
  btn.addEventListener('mouseleave', cancelHold);

  // Touch events
  btn.addEventListener('touchstart', startHold, { passive: false });
  btn.addEventListener('touchend', cancelHold);
  btn.addEventListener('touchcancel', cancelHold);
})();