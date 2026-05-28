// ==UserScript==
// @name         TW Dashboard
// @version      1.0.0
// @description  The-West Dashboard - Bot kontrolü ve istatistikler
// @author       ssoydeger645-tech
// @include      https://*.the-west.*/game.php*
// @include      https://*.the-west.com.*/game.php*
// @include      https://*.the-west.*.com/game.php*
// @include      https://*.tw.innogames.*/game.php*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DB_KEY = 'TW_Dashboard_Stats';
    let stats = loadStats();
    let chartInterval = null;

    const waitForGame = setInterval(() => {
        if (typeof window.west === 'undefined' || typeof window.Character === 'undefined') return;
        clearInterval(waitForGame);
        init();
    }, 1000);

    function init() {
        addMenuButton();
        startTracking();
    }

    // İstatistik yükleme/kaydetme
    function loadStats() {
        try {
            return JSON.parse(localStorage.getItem(DB_KEY)) || createEmptyStats();
        } catch (e) {
            return createEmptyStats();
        }
    }

    function createEmptyStats() {
        return {
            sessions: [],
            totalXP: 0,
            totalMoney: 0,
            totalJobs: 0,
            startXP: 0,
            startMoney: 0,
            lastUpdate: Date.now(),
        };
    }

    function saveStats() {
        localStorage.setItem(DB_KEY, JSON.stringify(stats));
    }

    // Karakter takibi
    function startTracking() {
        if (!stats.startXP) {
            stats.startXP = window.Character.experience;
            stats.startMoney = window.Character.money + window.Character.deposit;
            saveStats();
        }

        setInterval(() => {
            const xp = window.Character.experience;
            const money = window.Character.money + window.Character.deposit;
            const now = Date.now();

            stats.sessions.push({
                time: now,
                xp: xp,
                money: money,
                health: Math.round((window.Character.health / window.Character.maxHealth) * 100),
                energy: Math.round((window.Character.energy / window.Character.maxEnergy) * 100),
            });

            // Son 24 saatin verilerini tut
            const oneDayAgo = now - 24 * 3600 * 1000;
            stats.sessions = stats.sessions.filter(s => s.time > oneDayAgo);
            stats.lastUpdate = now;
            saveStats();
        }, 60000); // Her dakika kaydet
    }

    // Sağ menüye buton ekle
    function addMenuButton() {
        const btn = document.createElement('div');
        btn.className = 'menulink';
        btn.title = 'TW Dashboard';
        btn.style.cssText = `
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23FFD700"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>');
            background-size: 20px;
            background-repeat: no-repeat;
            background-position: center;
            cursor: pointer;
        `;
        btn.addEventListener('click', openDashboard);
        btn.addEventListener('mouseover', () => (btn.style.backgroundPosition = 'center -25px'));
        btn.addEventListener('mouseout', () => (btn.style.backgroundPosition = 'center'));

        const menubar = document.getElementById('ui_menubar');
        if (menubar) menubar.appendChild(btn);
    }

    // Dashboard penceresi aç
    function openDashboard() {
        // Varsa kapat
        const existing = document.getElementById('tw-dashboard-window');
        if (existing) {
            existing.remove();
            return;
        }

        const win = document.createElement('div');
        win.id = 'tw-dashboard-window';
        win.style.cssText = `
            position: fixed;
            top: 50px;
            left: 200px;
            width: 700px;
            height: 500px;
            background: rgba(40, 20, 0, 0.97);
            border: 2px solid #8B6914;
            border-radius: 8px;
            z-index: 9998;
            font-family: Georgia, serif;
            color: #FFD700;
            display: flex;
            flex-direction: column;
            user-select: none;
        `;

        win.innerHTML = `
            <div id="tw-db-header" style="
                background: rgba(100,50,0,0.9);
                padding: 10px 15px;
                border-radius: 6px 6px 0 0;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span style="font-size: 16px; font-weight: bold;">📊 TW Dashboard</span>
                <button onclick="document.getElementById('tw-dashboard-window').remove()" style="
                    background: #600000;
                    color: #fff;
                    border: none;
                    padding: 3px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">✕</button>
            </div>

            <div style="display: flex; border-bottom: 1px solid #8B6914;">
                <button class="tw-db-tab active" data-tab="overview" style="
                    padding: 8px 15px;
                    background: rgba(100,50,0,0.5);
                    border: none;
                    color: #FFD700;
                    cursor: pointer;
                    font-family: Georgia, serif;
                    border-bottom: 2px solid #FFD700;
                ">📈 Genel Bakış</button>
                <button class="tw-db-tab" data-tab="bot" style="
                    padding: 8px 15px;
                    background: transparent;
                    border: none;
                    color: #aaa;
                    cursor: pointer;
                    font-family: Georgia, serif;
                ">🤠 Bot Kontrolü</button>
                <button class="tw-db-tab" data-tab="stats" style="
                    padding: 8px 15px;
                    background: transparent;
                    border: none;
                    color: #aaa;
                    cursor: pointer;
                    font-family: Georgia, serif;
                ">📊 İstatistikler</button>
                <button class="tw-db-tab" data-tab="log" style="
                    padding: 8px 15px;
                    background: transparent;
                    border: none;
                    color: #aaa;
                    cursor: pointer;
                    font-family: Georgia, serif;
                ">📋 Log</button>
            </div>

            <div id="tw-db-content" style="flex: 1; overflow-y: auto; padding: 15px;">
            </div>
        `;

        document.body.appendChild(win);
        makeDraggable(win, document.getElementById('tw-db-header'));

        // Sekme olayları
        win.querySelectorAll('.tw-db-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                win.querySelectorAll('.tw-db-tab').forEach(t => {
                    t.style.background = 'transparent';
                    t.style.color = '#aaa';
                    t.style.borderBottom = 'none';
                });
                tab.style.background = 'rgba(100,50,0,0.5)';
                tab.style.color = '#FFD700';
                tab.style.borderBottom = '2px solid #FFD700';
                showTab(tab.dataset.tab);
            });
        });

        showTab('overview');
    }

    function showTab(tab) {
        const content = document.getElementById('tw-db-content');
        if (!content) return;

        if (tab === 'overview') content.innerHTML = getOverviewHTML();
        else if (tab === 'bot') content.innerHTML = getBotHTML();
        else if (tab === 'stats') content.innerHTML = getStatsHTML();
        else if (tab === 'log') content.innerHTML = getLogHTML();
    }

    function getOverviewHTML() {
        const char = window.Character;
        const healthPct = Math.round((char.health / char.maxHealth) * 100);
        const energyPct = Math.round((char.energy / char.maxEnergy) * 100);
        const xpGained = char.experience - (stats.startXP || char.experience);
        const moneyTotal = char.money + char.deposit;

        // Bot durumu
        const botStatus = localStorage.getItem('TW_AutoJob_Status') || 'Bilinmiyor';

        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid #8B6914;">
                    <h3 style="margin: 0 0 10px 0; color: #FFD700;">👤 Karakter</h3>
                    <p style="margin: 4px 0; color: #ccc;">İsim: <span style="color: #fff">${char.name}</span></p>
                    <p style="margin: 4px 0; color: #ccc;">Seviye: <span style="color: #fff">${char.level}</span></p>
                    <p style="margin: 4px 0; color: #ccc;">Sınıf: <span style="color: #fff">${char.charClass}</span></p>
                    <p style="margin: 4px 0; color: #ccc;">Düello Seviyesi: <span style="color: #fff">${
                        char.duelLevel
                    }</span></p>
                </div>

                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid #8B6914;">
                    <h3 style="margin: 0 0 10px 0; color: #FFD700;">❤️ Durum</h3>
                    <p style="margin: 4px 0; color: #ccc;">Can: 
                        <span style="color: ${healthPct < 30 ? '#ff4444' : '#44ff44'}">${char.health}/${
            char.maxHealth
        } (%${healthPct})</span>
                    </p>
                    <div style="background: #333; border-radius: 4px; height: 8px; margin: 4px 0;">
                        <div style="background: ${
                            healthPct < 30 ? '#ff4444' : '#44ff44'
                        }; width: ${healthPct}%; height: 100%; border-radius: 4px;"></div>
                    </div>
                    <p style="margin: 8px 0 4px 0; color: #ccc;">Enerji: 
                        <span style="color: ${energyPct < 20 ? '#ff4444' : '#4444ff'}">${char.energy}/${
            char.maxEnergy
        } (%${energyPct})</span>
                    </p>
                    <div style="background: #333; border-radius: 4px; height: 8px; margin: 4px 0;">
                        <div style="background: ${
                            energyPct < 20 ? '#ff4444' : '#4488ff'
                        }; width: ${energyPct}%; height: 100%; border-radius: 4px;"></div>
                    </div>
                </div>

                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid #8B6914;">
                    <h3 style="margin: 0 0 10px 0; color: #FFD700;">💰 Para</h3>
                    <p style="margin: 4px 0; color: #ccc;">Cüzdan: <span style="color: #FFD700">$${char.money.toLocaleString()}</span></p>
                    <p style="margin: 4px 0; color: #ccc;">Banka: <span style="color: #FFD700">$${char.deposit.toLocaleString()}</span></p>
                    <p style="margin: 4px 0; color: #ccc;">Toplam: <span style="color: #FFD700">$${moneyTotal.toLocaleString()}</span></p>
                </div>

                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid #8B6914;">
                    <h3 style="margin: 0 0 10px 0; color: #FFD700;">🤠 Bot Durumu</h3>
                    <p style="margin: 4px 0; color: #ccc;">Durum: <span style="color: #44ff44">${botStatus}</span></p>
                    <p style="margin: 4px 0; color: #ccc;">Bu oturumda kazanılan XP: <span style="color: #fff">${xpGained.toLocaleString()}</span></p>
                    <p style="margin: 4px 0; color: #ccc;">XP: <span style="color: #fff">${char.experience.toLocaleString()}</span></p>
                </div>
            </div>

            <div style="margin-top: 10px; text-align: right; color: #666; font-size: 11px;">
                Son güncelleme: ${new Date().toLocaleTimeString()}
                <button onclick="document.querySelectorAll('.tw-db-tab')[0].click()" style="
                    margin-left: 10px;
                    background: #2a3a00;
                    color: #fff;
                    border: 1px solid #4a6000;
                    padding: 2px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 11px;
                ">🔄 Yenile</button>
            </div>
        `;
    }

    function getBotHTML() {
        const jobs = window.JobList.getSortedJobs('id');
        let jobOptions = '<option value="">-- Seç --</option>';
        jobs.forEach(j => {
            jobOptions += `<option value="${j.id}">${j.name} (Sv.${j.level})</option>`;
        });

        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid #8B6914;">
                    <h3 style="margin: 0 0 10px 0; color: #FFD700;">⚙️ Çalışma Ayarları</h3>
                    
                    <div style="margin-bottom: 10px;">
                        <label style="color: #ccc; display: block; margin-bottom: 3px;">Çalışma 1:</label>
                        <select id="db-job-0" style="width: 100%; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 4px;">${jobOptions}</select>
                        <div style="margin-top: 4px;">
                            <label style="color: #ccc;">Tekrar: </label>
                            <input id="db-count-0" type="number" value="1" min="1" max="999" style="width: 60px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                        </div>
                    </div>

                    <div style="margin-bottom: 10px;">
                        <label style="color: #ccc; display: block; margin-bottom: 3px;">Çalışma 2:</label>
                        <select id="db-job-1" style="width: 100%; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 4px;">${jobOptions}</select>
                        <div style="margin-top: 4px;">
                            <label style="color: #ccc;">Tekrar: </label>
                            <input id="db-count-1" type="number" value="1" min="1" max="999" style="width: 60px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                        </div>
                    </div>
                </div>

                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid #8B6914;">
                    <h3 style="margin: 0 0 10px 0; color: #FFD700;">🎛️ Bot Ayarları</h3>
                    
                    <div style="margin-bottom: 6px;">
                        <label style="color: #ccc;">Süre: </label>
                        <select id="db-duration" style="background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                            <option value="15">15 saniye</option>
                            <option value="600">10 dakika</option>
                            <option value="3600" selected>1 saat</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 6px;">
                        <label style="color: #ccc;">Min. Can %: </label>
                        <input id="db-min-health" type="number" value="30" min="10" max="90" style="width: 45px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    </div>

                    <div style="margin-bottom: 6px;">
                        <label style="color: #ccc;">Min. Enerji %: </label>
                        <input id="db-min-energy" type="number" value="20" min="5" max="90" style="width: 45px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    </div>

                    <div style="margin-bottom: 6px;">
                        <label style="color: #ccc;">Dinlenme (sn): </label>
                        <input id="db-rest-time" type="number" value="30" min="5" max="3600" style="width: 55px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    </div>

                    <div style="margin-bottom: 6px;">
                        <label style="color: #ccc;">Uyku (saat): </label>
                        <input id="db-sleep-hours" type="number" value="8" min="1" max="12" style="width: 45px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    </div>

                    <div style="margin-top: 15px; text-align: center;">
                        <button id="db-start-btn" onclick="dashboardStartBot()" style="
                            background: #2a6000;
                            color: #fff;
                            border: 1px solid #4a8000;
                            padding: 8px 20px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 14px;
                            font-family: Georgia, serif;
                        ">▶ Botu Başlat</button>
                    </div>
                </div>
            </div>

            <div id="db-bot-status" style="
                margin-top: 15px;
                padding: 10px;
                background: rgba(0,0,0,0.3);
                border-radius: 6px;
                border: 1px solid #8B6914;
                color: #aaa;
                text-align: center;
            ">Bot bekleniyor...</div>
        `;
    }

    function getStatsHTML() {
        const sessions = stats.sessions;
        if (sessions.length < 2) {
            return '<div style="text-align: center; padding: 40px; color: #aaa;">Henüz yeterli veri yok. Biraz bekleyin...</div>';
        }

        const first = sessions[0];
        const last = sessions[sessions.length - 1];
        const timeDiff = (last.time - first.time) / 3600000;
        const xpDiff = last.xp - first.xp;
        const moneyDiff = last.money - first.money;
        const xpPerHour = timeDiff > 0 ? Math.round(xpDiff / timeDiff) : 0;
        const moneyPerHour = timeDiff > 0 ? Math.round(moneyDiff / timeDiff) : 0;

        // Mini grafik
        const maxXP = Math.max(...sessions.map(s => s.xp));
        const minXP = Math.min(...sessions.map(s => s.xp));
        const xpRange = maxXP - minXP || 1;

        const points = sessions
            .map((s, i) => {
                const x = (i / (sessions.length - 1)) * 560;
                const y = 80 - ((s.xp - minXP) / xpRange) * 70;
                return `${x},${y}`;
            })
            .join(' ');

        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid #8B6914; text-align: center;">
                    <div style="color: #aaa; font-size: 11px;">XP/Saat</div>
                    <div style="color: #44ff44; font-size: 20px; font-weight: bold;">${xpPerHour.toLocaleString()}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid #8B6914; text-align: center;">
                    <div style="color: #aaa; font-size: 11px;">Para/Saat</div>
                    <div style="color: #FFD700; font-size: 20px; font-weight: bold;">$${moneyPerHour.toLocaleString()}</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid #8B6914; text-align: center;">
                    <div style="color: #aaa; font-size: 11px;">Takip Süresi</div>
                    <div style="color: #fff; font-size: 20px; font-weight: bold;">${timeDiff.toFixed(1)}s</div>
                </div>
            </div>

            <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border: 1px solid #8B6914;">
                <h3 style="margin: 0 0 10px 0; color: #FFD700;">📈 XP Grafiği (Son 24 Saat)</h3>
                <svg width="100%" height="90" viewBox="0 0 560 90" style="overflow: visible;">
                    <polyline points="${points}" fill="none" stroke="#44ff44" stroke-width="2"/>
                    ${sessions
                        .map((s, i) => {
                            const x = (i / (sessions.length - 1)) * 560;
                            const y = 80 - ((s.xp - minXP) / xpRange) * 70;
                            return `<circle cx="${x}" cy="${y}" r="3" fill="#44ff44"/>`;
                        })
                        .join('')}
                </svg>
            </div>

            <div style="margin-top: 10px; text-align: right;">
                <button onclick="localStorage.removeItem('TW_Dashboard_Stats'); location.reload();" style="
                    background: #600000;
                    color: #fff;
                    border: 1px solid #800000;
                    padding: 4px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                ">🗑️ İstatistikleri Sıfırla</button>
            </div>
        `;
    }

    function getLogHTML() {
        const logs = JSON.parse(localStorage.getItem('TW_AutoJob_Logs') || '[]');
        if (!logs.length) {
            return '<div style="text-align: center; padding: 40px; color: #aaa;">Henüz log kaydı yok.</div>';
        }

        return `
            <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; border: 1px solid #8B6914; font-size: 11px; line-height: 1.6;">
                ${logs
                    .map(
                        l =>
                            `<div style="color: #aaa; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 2px 0;">${l}</div>`,
                    )
                    .join('')}
            </div>
            <div style="margin-top: 10px; text-align: right;">
                <button onclick="localStorage.removeItem('TW_AutoJob_Logs'); document.querySelectorAll('.tw-db-tab')[3].click();" style="
                    background: #600000;
                    color: #fff;
                    border: 1px solid #800000;
                    padding: 4px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                ">🗑️ Logları Temizle</button>
            </div>
        `;
    }

    // Dashboard'dan bot başlatma
    window.dashboardStartBot = function () {
        const config = {
            jobs: [0, 1].map(i => ({
                id: parseInt(document.getElementById('db-job-' + i).value) || null,
                count: parseInt(document.getElementById('db-count-' + i).value) || 1,
            })),
            minHealth: parseInt(document.getElementById('db-min-health').value),
            minEnergy: parseInt(document.getElementById('db-min-energy').value),
            restTime: parseInt(document.getElementById('db-rest-time').value),
            jobDuration: parseInt(document.getElementById('db-duration').value),
            hotelSleepHours: parseInt(document.getElementById('db-sleep-hours').value),
        };

        localStorage.setItem('TW_Dashboard_BotConfig', JSON.stringify(config));
        localStorage.setItem('TW_Dashboard_BotCommand', 'start');

        const btn = document.getElementById('db-start-btn');
        const status = document.getElementById('db-bot-status');
        if (btn) {
            btn.textContent = '⏹ Botu Durdur';
            btn.style.background = '#600000';
            btn.onclick = function () {
                localStorage.setItem('TW_Dashboard_BotCommand', 'stop');
                btn.textContent = '▶ Botu Başlat';
                btn.style.background = '#2a6000';
                btn.onclick = window.dashboardStartBot;
                if (status) status.textContent = 'Bot durduruldu.';
            };
        }
        if (status) status.textContent = '✅ Bot başlatıldı!';
    };

    function makeDraggable(el, handle) {
        let startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', e => {
            startX = e.clientX;
            startY = e.clientY;
            startLeft = el.offsetLeft;
            startTop = el.offsetTop;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        function onMove(e) {
            el.style.left = startLeft + e.clientX - startX + 'px';
            el.style.top = startTop + e.clientY - startY + 'px';
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
    }
})();
