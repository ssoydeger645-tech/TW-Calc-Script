// ==UserScript==
// @name         TW Auto Job
// @version      1.1.0
// @description  Otomatik iş yapma - sürüklenebilir panel
// @author       ssoydeger645-tech
// @include      https://*.the-west.*/game.php*
// @include      https://*.the-west.com.*/game.php*
// @include      https://*.the-west.*.com/game.php*
// @include      https://*.tw.innogames.*/game.php*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        minHealth: 30,
        restTime: 5 * 60 * 1000,
        jobDuration: 3600,
        hotelSleepHours: 8,
        enabled: false,
        selectedJobId: null,
    };

    let isWorking = false;
    let isSleeping = false;

    const waitForGame = setInterval(() => {
        if (typeof window.west === 'undefined' || typeof window.Character === 'undefined') return;
        clearInterval(waitForGame);
        init();
    }, 1000);

    function init() {
        createUI();
    }

    function getHealthPercent() {
        return Math.round((window.Character.health / window.Character.maxHealth) * 100);
    }

    function goToHotel() {
        if (isSleeping) return;
        isSleeping = true;
        updateStatus('Can düşük! Otele gidiliyor...');
        const town = window.Character.homeTown;
        if (!town) {
            isSleeping = false;
            return;
        }
        window.Ajax.remoteCallMode(
            'hotel',
            'sleep',
            {
                town_id: town.town_id,
                time: CONFIG.hotelSleepHours,
            },
            data => {
                if (data.error) {
                    isSleeping = false;
                    updateStatus('Otel hatası: ' + data.msg);
                } else {
                    updateStatus('Uyuyor... (' + CONFIG.hotelSleepHours + ' saat)');
                    setTimeout(() => {
                        isSleeping = false;
                        if (CONFIG.enabled) startJob();
                    }, CONFIG.hotelSleepHours * 3600 * 1000);
                }
            },
        );
    }

    function startJob() {
        if (!CONFIG.enabled || isWorking || isSleeping) return;

        if (getHealthPercent() < CONFIG.minHealth) {
            goToHotel();
            return;
        }

        if (!CONFIG.selectedJobId) {
            updateStatus('Lütfen bir çalışma seçin!');
            return;
        }

        const job = window.JobList.getJobById(CONFIG.selectedJobId);
        if (!job) {
            updateStatus('Çalışma bulunamadı!');
            return;
        }

        window.Ajax.get('map', 'get_minimap', {}, minimap => {
            const pos = window.Character.position;
            const group = minimap.job_groups[job.groupid];
            if (!group || !group.length) {
                updateStatus('Çalışma konumu bulunamadı!');
                return;
            }

            const nearest = group
                .slice()
                .sort(
                    (a, b) =>
                        Math.abs(a[0] - pos.x) +
                        Math.abs(a[1] - pos.y) -
                        (Math.abs(b[0] - pos.x) + Math.abs(b[1] - pos.y)),
                )[0];

            isWorking = true;
            updateStatus('Çalışılıyor: ' + job.name);

            const task = new window.TaskJob(job.id, nearest[0], nearest[1], CONFIG.jobDuration);
            window.TaskQueue.add(task);

            setTimeout(() => {
                isWorking = false;
                updateStatus('Dinleniyor... (' + CONFIG.restTime / 60000 + ' dk)');
                setTimeout(() => {
                    if (CONFIG.enabled) startJob();
                }, CONFIG.restTime);
            }, (CONFIG.jobDuration + 30) * 1000);
        });
    }

    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'tw-auto-job-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 10px;
            width: 240px;
            background: rgba(50, 25, 0, 0.95);
            border: 2px solid #8B6914;
            border-radius: 8px;
            z-index: 9999;
            color: #FFD700;
            font-family: Georgia, serif;
            font-size: 12px;
            user-select: none;
        `;

        // Çalışma listesi oluştur
        const jobs = window.JobList.getSortedJobs('id').filter(j => j.level <= window.Character.level);

        let jobOptions = '<option value="">-- Çalışma Seç --</option>';
        jobs.forEach(j => {
            jobOptions += `<option value="${j.id}">${j.name} (Sv.${j.level})</option>`;
        });

        panel.innerHTML = `
            <div id="aj-header" style="
                background: rgba(100,50,0,0.8);
                padding: 8px 10px;
                border-radius: 6px 6px 0 0;
                cursor: move;
                font-weight: bold;
                font-size: 14px;
                text-align: center;
                color: #FFD700;
            ">🤠 TW Auto Job</div>

            <div style="padding: 10px;">
                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc; display: block; margin-bottom: 3px;">Çalışma:</label>
                    <select id="aj-job-select" style="
                        width: 100%;
                        background: #2a1400;
                        color: #FFD700;
                        border: 1px solid #8B6914;
                        padding: 3px;
                        font-size: 11px;
                    ">${jobOptions}</select>
                </div>

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Süre:</label>
                    <select id="aj-duration" style="margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                        <option value="15">15 saniye</option>
                        <option value="600">10 dakika</option>
                        <option value="3600" selected>1 saat</option>
                    </select>
                </div>

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Min. Can %:</label>
                    <input id="aj-min-health" type="number" value="30" min="10" max="90"
                        style="width: 50px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Dinlenme (dk):</label>
                    <input id="aj-rest-time" type="number" value="5" min="1" max="60"
                        style="width: 50px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div style="margin-bottom: 10px;">
                    <label style="color: #ccc;">Uyku (saat):</label>
                    <input id="aj-sleep-hours" type="number" value="8" min="1" max="12"
                        style="width: 50px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div id="aj-status" style="margin-bottom: 8px; color: #aaa; text-align: center; font-size: 11px;">
                    Bekleniyor...
                </div>

                <div style="text-align: center;">
                    <button id="aj-toggle" style="
                        background: #2a6000;
                        color: #fff;
                        border: 1px solid #4a8000;
                        padding: 5px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        margin-right: 5px;
                    ">▶ Başlat</button>
                    <button id="aj-close" style="
                        background: #600000;
                        color: #fff;
                        border: 1px solid #800000;
                        padding: 5px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                    ">✕</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Sürükleme
        makeDraggable(panel, document.getElementById('aj-header'));

        // Butonlar
        document.getElementById('aj-toggle').addEventListener('click', toggleAutoJob);
        document.getElementById('aj-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });
    }

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
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = startLeft + dx + 'px';
            el.style.top = startTop + dy + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }

        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
    }

    function toggleAutoJob() {
        CONFIG.selectedJobId = parseInt(document.getElementById('aj-job-select').value) || null;
        CONFIG.minHealth = parseInt(document.getElementById('aj-min-health').value);
        CONFIG.restTime = parseInt(document.getElementById('aj-rest-time').value) * 60000;
        CONFIG.jobDuration = parseInt(document.getElementById('aj-duration').value);
        CONFIG.hotelSleepHours = parseInt(document.getElementById('aj-sleep-hours').value);
        CONFIG.enabled = !CONFIG.enabled;

        const btn = document.getElementById('aj-toggle');
        if (CONFIG.enabled) {
            btn.textContent = '⏹ Durdur';
            btn.style.background = '#600000';
            btn.style.borderColor = '#800000';
            startJob();
        } else {
            btn.textContent = '▶ Başlat';
            btn.style.background = '#2a6000';
            btn.style.borderColor = '#4a8000';
            isWorking = false;
            updateStatus('Durduruldu.');
        }
    }

    function updateStatus(msg) {
        const el = document.getElementById('aj-status');
        if (el) el.textContent = msg;
    }
})();
